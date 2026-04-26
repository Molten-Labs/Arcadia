use wincode::deserialize_exact;

use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    sysvars::clock::Clock,
    ProgramResult,
};
use wincode::SchemaRead;

use crate::{
    errors::KilnError,
    states::{InvestorPosition, VaultConfig, VaultState, TREASURY_SEED},
};

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, SchemaRead)]
pub struct WithdrawSeniorArgs {
    pub shares_to_burn: u64,
}

const COOLDOWN_SECS: i64 = 86_400; // 24 hours
const INSTANT_EXIT_THRESHOLD_BPS: u64 = 2000; // 20%

/// Withdraw senior capital from a vault.
///
/// Expected accounts (in order):
/// 0: investor (signer, writable)
/// 1: vault_config (readonly)
/// 2: vault_state (writable)
/// 3: treasury (writable)
/// 4: investor_position (writable)
/// 5: clock (readonly)
pub fn withdraw_senior(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let [investor, vault_config, vault_state, treasury, investor_position, clock_sysvar] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !investor.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !investor.is_writable() || !vault_state.is_writable() || !treasury.is_writable() || !investor_position.is_writable() {
        return Err(ProgramError::InvalidAccountData);
    }

    let args: WithdrawSeniorArgs =
        deserialize_exact(data).map_err(|_| ProgramError::InvalidInstructionData)?;
    if args.shares_to_burn == 0 {
        return Err(KilnError::InvalidAmount.into());
    }

    let config = VaultConfig::load(vault_config)?;
    let clock = Clock::from_account_info(clock_sysvar)?;

    let pos = InvestorPosition::load(investor_position)?;
    if pos.investor != *investor.key() {
        return Err(KilnError::InvestorMismatch.into());
    }
    if pos.vault_config != *vault_config.key() {
        return Err(KilnError::VaultStateMismatch.into());
    }
    if pos.senior_shares < args.shares_to_burn {
        return Err(KilnError::InsufficientSeniorCapital.into());
    }
    drop(pos);

    let state = VaultState::load(vault_state)?;
    if state.vault_config != *vault_config.key() {
        return Err(KilnError::VaultStateMismatch.into());
    }
    if config.treasury != *treasury.key() {
        return Err(KilnError::TreasuryMismatch.into());
    }

    // Cooldown check: 24h unless junior buffer is dangerously low
    let total_capital = state.junior_capital
        .checked_add(state.senior_capital)
        .ok_or(KilnError::MathOverflow)?;
    let junior_ratio_bps = if total_capital > 0 {
        state.junior_capital
            .checked_mul(10_000)
            .ok_or(KilnError::MathOverflow)?
            .checked_div(total_capital)
            .ok_or(KilnError::MathOverflow)?
    } else {
        0
    };

    let instant_exit = junior_ratio_bps < INSTANT_EXIT_THRESHOLD_BPS;
    if !instant_exit {
        let pos_ref = InvestorPosition::load(investor_position)?;
        let elapsed = clock.unix_timestamp
            .checked_sub(pos_ref.deposited_at)
            .ok_or(KilnError::MathOverflow)?;
        if elapsed < COOLDOWN_SECS {
            return Err(KilnError::WithdrawalCooldownActive.into());
        }
        drop(pos_ref);
    }

    // Calculate withdrawal amount: pro-rata share of senior capital
    let withdrawal_amount = if state.senior_shares_outstanding > 0 {
        args.shares_to_burn
            .checked_mul(state.senior_capital)
            .ok_or(KilnError::MathOverflow)?
            .checked_div(state.senior_shares_outstanding)
            .ok_or(KilnError::MathOverflow)?
    } else {
        return Err(KilnError::InsufficientSeniorCapital.into());
    };

    if withdrawal_amount == 0 {
        return Err(KilnError::InvalidAmount.into());
    }

    // Ensure treasury has enough (minus rent)
    let available = treasury.lamports()
        .checked_sub(config.treasury_rent_lamports)
        .ok_or(KilnError::TreasuryAccountingMismatch)?;
    if available < withdrawal_amount {
        return Err(KilnError::TreasuryAccountingMismatch.into());
    }

    drop(state);

    // Transfer from treasury to investor using PDA signature
    let treasury_bump = config.treasury_bump;
    let treasury_bump_seed = [treasury_bump];
    let treasury_signer_seeds = [
        Seed::from(TREASURY_SEED),
        Seed::from(vault_config.key().as_ref()),
        Seed::from(&treasury_bump_seed[..]),
    ];
    let treasury_signers = [Signer::from(&treasury_signer_seeds[..])];

    pinocchio_system::instructions::Transfer {
        from: treasury,
        to: investor,
        lamports: withdrawal_amount,
    }
    .invoke_signed(&treasury_signers)?;

    // Update vault state
    let mut state = VaultState::load_mut(vault_state)?;
    state.senior_capital = state
        .senior_capital
        .checked_sub(withdrawal_amount)
        .ok_or(KilnError::MathOverflow)?;
    state.senior_shares_outstanding = state
        .senior_shares_outstanding
        .checked_sub(args.shares_to_burn)
        .ok_or(KilnError::MathOverflow)?;
    state.current_nav = state
        .current_nav
        .checked_sub(withdrawal_amount)
        .ok_or(KilnError::MathOverflow)?;
    state.last_nav = state.current_nav;
    state.last_nav_update_at = clock.unix_timestamp;
    drop(state);

    // Update investor position
    let mut pos = InvestorPosition::load_mut(investor_position)?;
    pos.senior_shares = pos
        .senior_shares
        .checked_sub(args.shares_to_burn)
        .ok_or(KilnError::MathOverflow)?;

    Ok(())
}
