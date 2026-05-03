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

pub(crate) const JUPITER_PROGRAM_ID: Pubkey =
    pinocchio_pubkey::pubkey!("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, SchemaRead)]
pub struct ExecuteSwapArgs {
    pub in_amount: u64,
    pub minimum_amount_out: u64,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct JupiterSwapArgs<'a> {
    pub route: u8,
    pub max_slippage_bps: u16,
    pub in_amount: u64,
    pub minimum_amount_out: u64,
    pub quote_slot_or_expiry: i64,
    pub jupiter_instruction_data: &'a [u8],
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
    if data.len() == core::mem::size_of::<ExecuteSwapArgs>() {
        return execute_guard_only_swap(accounts, data);
    }

    execute_jupiter_swap(accounts, data)
}

fn execute_guard_only_swap(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let [manager, manager_profile, vault_config, vault_state, treasury, clock_sysvar] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !manager.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !vault_state.is_writable() || !treasury.is_writable() {
        return Err(ProgramError::InvalidAccountData);
    }

    let args: ExecuteSwapArgs =
        deserialize_exact(data).map_err(|_| ProgramError::InvalidInstructionData)?;
    if args.in_amount == 0 {
        return Err(KilnError::InvalidAmount.into());
    }
    if args.minimum_amount_out != 0 {
        return Err(KilnError::SlippageExceeded.into());
    }

    let config = VaultConfig::load(vault_config)?;
    let clock = Clock::from_account_info(clock_sysvar)?;

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

    // Update HWM if NAV increased
    if new_nav > state.high_water_mark {
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
    let [
        manager,
        manager_profile,
        vault_config,
        vault_state,
        treasury,
        clock_sysvar,
        jupiter_program,
        token_program,
        source_token_account,
        destination_token_account,
        sol_price_account,
        usdc_price_account,
        jupiter_accounts @ ..,
    ] = accounts
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
            if source.mint != super::custody::WSOL_MINT || destination.mint != super::custody::USDC_MINT {
                return Err(KilnError::InvalidSwapRoute.into());
            }
        }
        ROUTE_USDC_TO_SOL => {
            if source.mint != super::custody::USDC_MINT || destination.mint != super::custody::WSOL_MINT {
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
    vault_guard::run_guards_with_notional(&state, swap_notional_usdc, clock.unix_timestamp)?;
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
    let (usdc_after, wsol_after) = if args.route == ROUTE_USDC_TO_SOL {
        (source_after.amount, destination_after_snapshot.amount)
    } else {
        (destination_after_snapshot.amount, source_after.amount)
    };
    let new_nav = super::custody::nav_usdc(
        usdc_after,
        wsol_after,
        sol_price.price,
        usdc_price.price,
    )?;
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
    if new_nav > state.high_water_mark {
        state.high_water_mark = new_nav;
    }

    vault_guard::apply_post_swap_cooldown(
        &mut state,
        old_nav,
        new_nav,
        clock.unix_timestamp,
        args.in_amount,
    );

    Ok(())
}

fn parse_jupiter_swap_args(data: &[u8]) -> Result<JupiterSwapArgs<'_>, ProgramError> {
    if data.len() < EXTENDED_SWAP_ARGS_LEN {
        return Err(ProgramError::InvalidInstructionData);
    }
    let route = data[0];
    let max_slippage_bps = u16::from_le_bytes(
        data[2..4]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    );
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
    Ok(JupiterSwapArgs {
        route,
        max_slippage_bps,
        in_amount,
        minimum_amount_out,
        quote_slot_or_expiry,
        jupiter_instruction_data: &data[EXTENDED_SWAP_ARGS_LEN..],
    })
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
