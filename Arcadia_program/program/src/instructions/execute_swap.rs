use core::convert::TryInto;

use wincode::deserialize_exact;

use pinocchio::{
    account_info::AccountInfo,
    cpi::slice_invoke_signed,
    instruction::{AccountMeta, Instruction, Seed, Signer},
    program_error::ProgramError,
    pubkey::Pubkey,
    sysvars::clock::Clock,
    ProgramResult,
};
use pinocchio_log::logger::Logger;
use wincode::SchemaRead;

use crate::{
    errors::KilnError,
    states::{VaultConfig, VaultState, TREASURY_SEED},
};

use super::vault_guard;

pub const ROUTE_SOL_TO_USDC: u8 = 1;
pub const ROUTE_USDC_TO_SOL: u8 = 2;
const EXTENDED_SWAP_ARGS_LEN: usize = 32;
const MAX_JUPITER_CPI_ACCOUNTS: usize = 48;
pub const MAGICBLOCK_PRIVATE_INTENT_VERSION: u8 = 1;
pub const PRIVATE_INTENT_PROOF_KIND_ER: u16 = 1;
pub const PRIVATE_INTENT_SESSION_MAGIC: [u8; 4] = *b"MBER";
pub const PRIVATE_INTENT_SESSION_LEN: usize = 152;

pub(crate) const JUPITER_PROGRAM_ID: Pubkey =
    pinocchio_pubkey::pubkey!("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, SchemaRead)]
pub struct ExecuteSwapArgs {
    pub in_amount: u64,
    pub minimum_amount_out: u64,
}

/// Opt-in MagicBlock ER proof envelope. It is parsed, guarded, and logged
/// without being persisted so existing vault and custody accounts do not move.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct PrivateIntentSession<'a> {
    pub version: u8,
    pub flags: u8,
    pub proof_kind: u16,
    pub session_id: &'a [u8; 32],
    pub intent_commitment: &'a [u8; 32],
    pub proof_hash: &'a [u8; 32],
    pub er_state_root: &'a [u8; 32],
    pub max_in_amount: u64,
    pub expires_at: i64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct GuardOnlySwapArgs<'a> {
    pub args: ExecuteSwapArgs,
    pub private_intent_session: Option<PrivateIntentSession<'a>>,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct JupiterSwapArgs<'a> {
    pub route: u8,
    pub max_slippage_bps: u16,
    pub in_amount: u64,
    pub minimum_amount_out: u64,
    pub quote_slot_or_expiry: i64,
    pub jupiter_instruction_data: &'a [u8],
    pub private_intent_session: Option<PrivateIntentSession<'a>>,
}

/// Execute a swap from the vault treasury.
///
/// Legacy 16-byte data remains the devnet guard-only path. The extended
/// mainnet path validates fixed SOL/USDC custody accounts and invokes Jupiter
/// with caller-provided route accounts.
///
/// Legacy expected accounts (in order):
/// 0: manager (signer)
/// 1: manager_profile (readonly)
/// 2: vault_config (readonly)
/// 3: vault_state (writable)
/// 4: treasury (writable)
/// 5: clock (readonly)
///
/// Extended expected accounts append:
/// 6: jupiter_program
/// 7: token_program
/// 8: source_token_account (writable, owner = treasury PDA)
/// 9: destination_token_account (writable, owner = treasury PDA)
/// 10: sol_usd_price_account placeholder
/// 11: usdc_usd_price_account placeholder
/// 12..: Jupiter CPI accounts in exact Jupiter instruction order
pub fn execute_swap(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if is_guard_only_swap_data(data) {
        return execute_guard_only_swap(accounts, data);
    }

    execute_jupiter_swap(accounts, data)
}

fn execute_guard_only_swap(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let [manager, manager_profile, vault_config, vault_state, treasury, clock_sysvar] = accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !manager.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !vault_state.is_writable() || !treasury.is_writable() {
        return Err(ProgramError::InvalidAccountData);
    }

    let parsed_args = parse_guard_only_swap_args(data)?;
    let args = parsed_args.args;
    if args.in_amount == 0 {
        return Err(KilnError::InvalidAmount.into());
    }
    if args.minimum_amount_out != 0 {
        return Err(KilnError::SlippageExceeded.into());
    }

    let config = VaultConfig::load(vault_config)?;
    let clock = Clock::from_account_info(clock_sysvar)?;
    if let Some(session) = parsed_args.private_intent_session {
        validate_private_intent_session(&session, args.in_amount, clock.unix_timestamp)?;
        log_private_intent_session(
            "guard_pre",
            &session,
            args.in_amount,
            args.in_amount,
            clock.unix_timestamp,
        );
    }

    // Validate manager ownership
    {
        let mgr = crate::states::ManagerProfile::load(manager_profile)?;
        if mgr.owner != *manager.key() {
            return Err(KilnError::ManagerMismatch.into());
        }
    }

    if config.manager != *manager.key() {
        return Err(KilnError::ManagerMismatch.into());
    }
    if config.treasury != *treasury.key() {
        return Err(KilnError::TreasuryMismatch.into());
    }

    let state = VaultState::load(vault_state)?;
    if state.vault_config != *vault_config.key() {
        return Err(KilnError::VaultStateMismatch.into());
    }

    // Run all vault guard checks
    vault_guard::run_guards(&state, args.in_amount, clock.unix_timestamp)?;
    if let Some(session) = parsed_args.private_intent_session {
        log_private_intent_session(
            "guard_pass",
            &session,
            args.in_amount,
            args.in_amount,
            clock.unix_timestamp,
        );
    }

    let old_nav = state.current_nav;
    drop(state);

    // =========================================================================
    // Jupiter CPI would go here in production:
    //
    //   let before = treasury.lamports();
    //   jupiter_cpi::shared_accounts_route(...)
    //       .invoke_signed(&treasury_signers)?;
    //   treasury.reload()?;
    //   let received = treasury.lamports() - before + in_amount;
    //   require!(received >= args.minimum_amount_out, SlippageExceeded);
    //
    // For MVP devnet demo, the swap is a no-op on the treasury balance.
    // NAV is recomputed from actual treasury lamports below.
    // =========================================================================

    // Recompute NAV from treasury balance (same as update_nav)
    let treasury_lamports = treasury.lamports();
    let available = treasury_lamports
        .checked_sub(config.treasury_rent_lamports)
        .ok_or(KilnError::TreasuryAccountingMismatch)?;

    let mut state = VaultState::load_mut(vault_state)?;
    let new_nav = available;

    state.last_nav = state.current_nav;
    state.current_nav = new_nav;
    state.last_nav_update_at = clock.unix_timestamp;

    // Apply waterfall if NAV decreased
    if new_nav < old_nav {
        let loss = old_nav
            .checked_sub(new_nav)
            .ok_or(KilnError::MathOverflow)?;
        if loss <= state.junior_capital {
            state.junior_capital = state
                .junior_capital
                .checked_sub(loss)
                .ok_or(KilnError::MathOverflow)?;
        } else {
            let remaining = loss
                .checked_sub(state.junior_capital)
                .ok_or(KilnError::MathOverflow)?;
            state.junior_capital = 0;
            state.senior_capital = state
                .senior_capital
                .checked_sub(remaining)
                .ok_or(KilnError::MathOverflow)?;
            state.trading_enabled = 0;
        }
    }

    if state.high_water_mark == 0 {
        state.high_water_mark = new_nav;
    }

    // Do not count paper-mode trades until real swap execution exists. Counting
    // a requested notional here would let a no-op instruction satisfy the
    // graduation activity gate.
    let qualifying_notional = 0;

    // Apply post-swap cooldown logic
    vault_guard::apply_post_swap_cooldown(
        &mut state,
        old_nav,
        new_nav,
        clock.unix_timestamp,
        qualifying_notional,
    );

    Ok(())
}

fn execute_jupiter_swap(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let [manager, manager_profile, vault_config, vault_state, treasury, clock_sysvar, jupiter_program, token_program, source_token_account, destination_token_account, sol_price_account, usdc_price_account, jupiter_accounts @ ..] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !manager.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !vault_state.is_writable()
        || !treasury.is_writable()
        || !source_token_account.is_writable()
        || !destination_token_account.is_writable()
    {
        return Err(ProgramError::InvalidAccountData);
    }
    if jupiter_program.key() != &JUPITER_PROGRAM_ID {
        return Err(KilnError::InvalidJupiterProgram.into());
    }
    if token_program.key() != &super::custody::TOKEN_PROGRAM_ID {
        return Err(KilnError::InvalidTokenProgram.into());
    }
    if sol_price_account.key() == usdc_price_account.key()
        || sol_price_account.data_is_empty()
        || usdc_price_account.data_is_empty()
    {
        return Err(KilnError::InvalidOracleAccount.into());
    }

    let args = parse_jupiter_swap_args(data)?;
    if args.jupiter_instruction_data.is_empty() {
        return Err(KilnError::JupiterCpiFailed.into());
    }
    let config = VaultConfig::load(vault_config)?;
    if args.max_slippage_bps == 0 || args.max_slippage_bps > config.max_slippage_bps {
        return Err(KilnError::SlippageExceeded.into());
    }

    let clock = Clock::from_account_info(clock_sysvar)?;
    if args.quote_slot_or_expiry > 0 && clock.unix_timestamp > args.quote_slot_or_expiry {
        return Err(KilnError::SlippageExceeded.into());
    }

    {
        let mgr = crate::states::ManagerProfile::load(manager_profile)?;
        if mgr.owner != *manager.key() {
            return Err(KilnError::ManagerMismatch.into());
        }
    }
    if config.manager != *manager.key() {
        return Err(KilnError::ManagerMismatch.into());
    }
    if config.treasury != *treasury.key() {
        return Err(KilnError::TreasuryMismatch.into());
    }

    let source = super::custody::read_token_account(source_token_account)?;
    let destination = super::custody::read_token_account(destination_token_account)?;
    if source.owner != *treasury.key() || destination.owner != *treasury.key() {
        return Err(KilnError::InvalidTokenAccount.into());
    }
    match args.route {
        ROUTE_SOL_TO_USDC => {
            if source.mint != super::custody::WSOL_MINT
                || destination.mint != super::custody::USDC_MINT
            {
                return Err(KilnError::InvalidSwapRoute.into());
            }
        }
        ROUTE_USDC_TO_SOL => {
            if source.mint != super::custody::USDC_MINT
                || destination.mint != super::custody::WSOL_MINT
            {
                return Err(KilnError::InvalidSwapRoute.into());
            }
        }
        _ => return Err(KilnError::InvalidSwapRoute.into()),
    }
    if source.amount < args.in_amount {
        return Err(KilnError::InvalidAmount.into());
    }

    let state = VaultState::load(vault_state)?;
    if state.vault_config != *vault_config.key() {
        return Err(KilnError::VaultStateMismatch.into());
    }
    let sol_price = super::custody::read_price(
        sol_price_account,
        super::custody::PRICE_FEED_SOL_USD,
        clock.unix_timestamp,
    )?;
    let usdc_price = super::custody::read_price(
        usdc_price_account,
        super::custody::PRICE_FEED_USDC_USD,
        clock.unix_timestamp,
    )?;
    let swap_notional_usdc = if args.route == ROUTE_USDC_TO_SOL {
        args.in_amount
    } else {
        super::custody::wsol_value_usdc(args.in_amount, sol_price.price, usdc_price.price)?
    };
    if let Some(session) = args.private_intent_session {
        validate_private_intent_session(&session, args.in_amount, clock.unix_timestamp)?;
        log_private_intent_session(
            "jupiter_pre",
            &session,
            args.in_amount,
            swap_notional_usdc,
            clock.unix_timestamp,
        );
    }
    vault_guard::run_guards_with_notional(&state, swap_notional_usdc, clock.unix_timestamp)?;
    if let Some(session) = args.private_intent_session {
        log_private_intent_session(
            "jupiter_pass",
            &session,
            args.in_amount,
            swap_notional_usdc,
            clock.unix_timestamp,
        );
    }
    let old_nav = state.current_nav;
    drop(state);

    if jupiter_accounts.is_empty() || jupiter_accounts.len() > MAX_JUPITER_CPI_ACCOUNTS {
        return Err(KilnError::JupiterCpiFailed.into());
    }

    let destination_before = destination.amount;
    invoke_jupiter(
        jupiter_accounts,
        args.jupiter_instruction_data,
        treasury,
        vault_config.key(),
        config.treasury_bump,
    )?;

    let destination_after = super::custody::read_token_amount(destination_token_account)?;
    let received = destination_after
        .checked_sub(destination_before)
        .ok_or(KilnError::SlippageExceeded)?;
    if received < args.minimum_amount_out {
        return Err(KilnError::SlippageExceeded.into());
    }

    let source_after = super::custody::read_token_account(source_token_account)?;
    let destination_after_snapshot = super::custody::read_token_account(destination_token_account)?;
    let spent_source_amount = source
        .amount
        .checked_sub(source_after.amount)
        .ok_or(KilnError::SlippageExceeded)?;
    if spent_source_amount == 0 || spent_source_amount > args.in_amount {
        return Err(KilnError::SlippageExceeded.into());
    }
    let (usdc_after, wsol_after) = if args.route == ROUTE_USDC_TO_SOL {
        (source_after.amount, destination_after_snapshot.amount)
    } else {
        (destination_after_snapshot.amount, source_after.amount)
    };
    let new_nav =
        super::custody::nav_usdc(usdc_after, wsol_after, sol_price.price, usdc_price.price)?;
    if args.route == ROUTE_USDC_TO_SOL {
        vault_guard::enforce_usdc_reserve_after_swap(usdc_after, new_nav)?;
    }

    let mut state = VaultState::load_mut(vault_state)?;
    state.last_nav = state.current_nav;
    state.current_nav = new_nav;
    state.last_nav_update_at = clock.unix_timestamp;

    if new_nav < old_nav {
        let loss = old_nav
            .checked_sub(new_nav)
            .ok_or(KilnError::MathOverflow)?;
        if loss <= state.junior_capital {
            state.junior_capital = state
                .junior_capital
                .checked_sub(loss)
                .ok_or(KilnError::MathOverflow)?;
        } else {
            let remaining = loss
                .checked_sub(state.junior_capital)
                .ok_or(KilnError::MathOverflow)?;
            state.junior_capital = 0;
            state.senior_capital = state
                .senior_capital
                .checked_sub(remaining)
                .ok_or(KilnError::MathOverflow)?;
            state.trading_enabled = 0;
        }
    }
    if state.high_water_mark == 0 {
        state.high_water_mark = new_nav;
    }

    let qualifying_notional_usdc = if args.route == ROUTE_USDC_TO_SOL {
        spent_source_amount
    } else {
        super::custody::wsol_value_usdc(spent_source_amount, sol_price.price, usdc_price.price)?
    };
    vault_guard::apply_post_swap_cooldown(
        &mut state,
        old_nav,
        new_nav,
        clock.unix_timestamp,
        qualifying_notional_usdc,
    );

    Ok(())
}

pub fn is_guard_only_swap_data(data: &[u8]) -> bool {
    if data.len() == core::mem::size_of::<ExecuteSwapArgs>() {
        return true;
    }
    let guarded_private_intent_len =
        core::mem::size_of::<ExecuteSwapArgs>() + PRIVATE_INTENT_SESSION_LEN;
    if data.len() != guarded_private_intent_len {
        return false;
    }
    if data[16..20] != PRIVATE_INTENT_SESSION_MAGIC {
        return false;
    }
    u64::from_le_bytes([
        data[8], data[9], data[10], data[11], data[12], data[13], data[14], data[15],
    ]) == 0
}

pub fn parse_guard_only_swap_args(data: &[u8]) -> Result<GuardOnlySwapArgs<'_>, ProgramError> {
    let args_len = core::mem::size_of::<ExecuteSwapArgs>();
    if data.len() != args_len && data.len() != args_len + PRIVATE_INTENT_SESSION_LEN {
        return Err(ProgramError::InvalidInstructionData);
    }
    let args: ExecuteSwapArgs =
        deserialize_exact(&data[..args_len]).map_err(|_| ProgramError::InvalidInstructionData)?;
    let private_intent_session = if data.len() == args_len {
        None
    } else {
        Some(parse_private_intent_session(&data[args_len..])?)
    };
    Ok(GuardOnlySwapArgs {
        args,
        private_intent_session,
    })
}

pub fn parse_jupiter_swap_args(data: &[u8]) -> Result<JupiterSwapArgs<'_>, ProgramError> {
    if data.len() < EXTENDED_SWAP_ARGS_LEN {
        return Err(ProgramError::InvalidInstructionData);
    }
    let route = data[0];
    let private_intent_version = data[1];
    let max_slippage_bps = u16::from_le_bytes(
        data[2..4]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    let private_intent_len = u16::from_le_bytes(
        data[4..6]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    ) as usize;
    let jupiter_instruction_len = u16::from_le_bytes(
        data[6..8]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    ) as usize;
    let in_amount = u64::from_le_bytes(
        data[8..16]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    let minimum_amount_out = u64::from_le_bytes(
        data[16..24]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    let quote_slot_or_expiry = i64::from_le_bytes(
        data[24..32]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    if in_amount == 0 || minimum_amount_out == 0 {
        return Err(KilnError::InvalidAmount.into());
    }
    let (private_intent_session, jupiter_instruction_data) = parse_jupiter_private_intent_envelope(
        private_intent_version,
        private_intent_len,
        jupiter_instruction_len,
        data,
    )?;
    Ok(JupiterSwapArgs {
        route,
        max_slippage_bps,
        in_amount,
        minimum_amount_out,
        quote_slot_or_expiry,
        jupiter_instruction_data,
        private_intent_session,
    })
}

fn parse_jupiter_private_intent_envelope<'a>(
    version: u8,
    private_intent_len: usize,
    jupiter_instruction_len: usize,
    data: &'a [u8],
) -> Result<(Option<PrivateIntentSession<'a>>, &'a [u8]), ProgramError> {
    if version == 0 {
        return Ok((None, &data[EXTENDED_SWAP_ARGS_LEN..]));
    }
    if version != MAGICBLOCK_PRIVATE_INTENT_VERSION {
        return Err(KilnError::InvalidPrivateIntentSession.into());
    }
    if private_intent_len != PRIVATE_INTENT_SESSION_LEN || jupiter_instruction_len == 0 {
        return Err(KilnError::InvalidPrivateIntentSession.into());
    }
    let private_intent_end = EXTENDED_SWAP_ARGS_LEN
        .checked_add(private_intent_len)
        .ok_or(KilnError::MathOverflow)?;
    let jupiter_instruction_end = private_intent_end
        .checked_add(jupiter_instruction_len)
        .ok_or(KilnError::MathOverflow)?;
    if jupiter_instruction_end != data.len() {
        return Err(ProgramError::InvalidInstructionData);
    }
    let session = parse_private_intent_session(&data[EXTENDED_SWAP_ARGS_LEN..private_intent_end])?;
    Ok((
        Some(session),
        &data[private_intent_end..jupiter_instruction_end],
    ))
}

pub fn parse_private_intent_session(data: &[u8]) -> Result<PrivateIntentSession<'_>, ProgramError> {
    if data.len() != PRIVATE_INTENT_SESSION_LEN || data[0..4] != PRIVATE_INTENT_SESSION_MAGIC {
        return Err(KilnError::InvalidPrivateIntentSession.into());
    }
    let version = data[4];
    if version != MAGICBLOCK_PRIVATE_INTENT_VERSION {
        return Err(KilnError::InvalidPrivateIntentSession.into());
    }
    let flags = data[5];
    let proof_kind = u16::from_le_bytes(
        data[6..8]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    if proof_kind != PRIVATE_INTENT_PROOF_KIND_ER {
        return Err(KilnError::InvalidPrivateIntentSession.into());
    }
    let session_id: &[u8; 32] = data[8..40]
        .try_into()
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let intent_commitment: &[u8; 32] = data[40..72]
        .try_into()
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let proof_hash: &[u8; 32] = data[72..104]
        .try_into()
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    let er_state_root: &[u8; 32] = data[104..136]
        .try_into()
        .map_err(|_| ProgramError::InvalidInstructionData)?;
    if is_zero_32(session_id)
        || is_zero_32(intent_commitment)
        || is_zero_32(proof_hash)
        || is_zero_32(er_state_root)
    {
        return Err(KilnError::InvalidPrivateIntentSession.into());
    }
    let max_in_amount = u64::from_le_bytes(
        data[136..144]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    let expires_at = i64::from_le_bytes(
        data[144..152]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    if max_in_amount == 0 || expires_at <= 0 {
        return Err(KilnError::InvalidPrivateIntentSession.into());
    }
    Ok(PrivateIntentSession {
        version,
        flags,
        proof_kind,
        session_id,
        intent_commitment,
        proof_hash,
        er_state_root,
        max_in_amount,
        expires_at,
    })
}

pub fn validate_private_intent_session(
    session: &PrivateIntentSession<'_>,
    in_amount: u64,
    now: i64,
) -> ProgramResult {
    if now > session.expires_at {
        return Err(KilnError::PrivateIntentExpired.into());
    }
    if in_amount > session.max_in_amount {
        return Err(KilnError::PrivateIntentAmountExceeded.into());
    }
    Ok(())
}

fn is_zero_32(bytes: &[u8; 32]) -> bool {
    let mut i = 0;
    while i < 32 {
        if bytes[i] != 0 {
            return false;
        }
        i += 1;
    }
    true
}

fn first_u64(bytes: &[u8; 32]) -> u64 {
    u64::from_le_bytes([
        bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5], bytes[6], bytes[7],
    ])
}

fn log_private_intent_session(
    stage: &str,
    session: &PrivateIntentSession<'_>,
    in_amount: u64,
    guard_notional: u64,
    now: i64,
) {
    let mut logger = Logger::<256>::default();
    logger.append("magicblock_private_intent stage=");
    logger.append(stage);
    logger.append(" v=");
    logger.append(session.version);
    logger.append(" kind=");
    logger.append(session.proof_kind);
    logger.append(" session=");
    logger.append(first_u64(session.session_id));
    logger.append(" intent=");
    logger.append(first_u64(session.intent_commitment));
    logger.append(" proof=");
    logger.append(first_u64(session.proof_hash));
    logger.append(" er_root=");
    logger.append(first_u64(session.er_state_root));
    logger.append(" in=");
    logger.append(in_amount);
    logger.append(" guard=");
    logger.append(guard_notional);
    logger.append(" max_in=");
    logger.append(session.max_in_amount);
    logger.append(" expires=");
    logger.append(session.expires_at);
    logger.append(" now=");
    logger.append(now);
    logger.log();
}

pub(crate) fn invoke_jupiter(
    jupiter_accounts: &[AccountInfo],
    instruction_data: &[u8],
    treasury: &AccountInfo,
    vault_config_key: &Pubkey,
    treasury_bump: u8,
) -> ProgramResult {
    let count = jupiter_accounts.len();
    let mut metas: [AccountMeta<'_>; MAX_JUPITER_CPI_ACCOUNTS] =
        core::array::from_fn(|_| AccountMeta::readonly(treasury.key()));
    let mut infos: [&AccountInfo; MAX_JUPITER_CPI_ACCOUNTS] = core::array::from_fn(|_| treasury);

    let mut i = 0;
    while i < count {
        let account = &jupiter_accounts[i];
        let is_treasury = account.key() == treasury.key();
        metas[i] = AccountMeta::new(account.key(), account.is_writable(), is_treasury);
        infos[i] = account;
        i += 1;
    }

    let instruction = Instruction {
        program_id: &JUPITER_PROGRAM_ID,
        data: instruction_data,
        accounts: &metas[..count],
    };

    let treasury_bump_seed = [treasury_bump];
    let treasury_signer_seeds = [
        Seed::from(TREASURY_SEED),
        Seed::from(vault_config_key.as_ref()),
        Seed::from(&treasury_bump_seed[..]),
    ];
    let signers = [Signer::from(&treasury_signer_seeds[..])];

    slice_invoke_signed(&instruction, &infos[..count], &signers)
        .map_err(|_| KilnError::JupiterCpiFailed.into())
}
