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
    states::{ManagerProfile, VaultConfig, VaultState, TREASURY_SEED},
};

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, SchemaRead)]
pub struct WithdrawJuniorArgs {
    pub shares_to_burn: u64,
}

/// Returns the minimum junior ratio in basis points for a given total capital.
fn min_junior_ratio_bps(total_capital: u64) -> u16 {
    const FIFTY_K: u64 = 50_000_000_000;
    const TWO_HUNDRED_K: u64 = 200_000_000_000;
    const FIVE_HUNDRED_K: u64 = 500_000_000_000;
    const ONE_M: u64 = 1_000_000_000_000;

    if total_capital < FIFTY_K {
        2000
    } else if total_capital < TWO_HUNDRED_K {
        1500
    } else if total_capital < FIVE_HUNDRED_K {
        1200
    } else if total_capital < ONE_M {
        1000
    } else {
        800
    }
}

/// Withdraw junior capital from a vault.
///
/// Expected accounts (in order):
/// 0: manager (signer, writable)
/// 1: manager_profile (writable)
/// 2: vault_config (readonly)
/// 3: vault_state (writable)
/// 4: treasury (writable)
/// 5: clock (readonly)
pub fn withdraw_junior(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let [manager, manager_profile, vault_config, vault_state, treasury, clock_sysvar] = accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !manager.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !manager.is_writable()
        || !manager_profile.is_writable()
        || !vault_state.is_writable()
        || !treasury.is_writable()
    {
        return Err(ProgramError::InvalidAccountData);
    }

    let args: WithdrawJuniorArgs =
        deserialize_exact(data).map_err(|_| ProgramError::InvalidInstructionData)?;
    if args.shares_to_burn == 0 {
        return Err(KilnError::InvalidAmount.into());
    }

    let config = VaultConfig::load(vault_config)?;
    let clock = Clock::from_account_info(clock_sysvar)?;

    {
        let mgr = ManagerProfile::load(manager_profile)?;
        if mgr.owner != *manager.key() {
            return Err(KilnError::ManagerMismatch.into());
        }
    }

    let state = VaultState::load(vault_state)?;
    if state.vault_config != *vault_config.key() {
        return Err(KilnError::VaultStateMismatch.into());
    }
    if config.manager != *manager.key() {
        return Err(KilnError::ManagerMismatch.into());
    }
    if config.treasury != *treasury.key() {
        return Err(KilnError::TreasuryMismatch.into());
    }
    if state.junior_shares_outstanding < args.shares_to_burn {
        return Err(KilnError::InsufficientJuniorCapital.into());
    }

    // Calculate withdrawal amount: pro-rata share of junior capital
    let withdrawal_amount = args
        .shares_to_burn
        .checked_mul(state.junior_capital)
        .ok_or(KilnError::MathOverflow)?
        .checked_div(state.junior_shares_outstanding)
        .ok_or(KilnError::MathOverflow)?;

    if withdrawal_amount == 0 {
        return Err(KilnError::InvalidAmount.into());
    }

    // If vault is graduated and has senior capital, check ratio stays valid
    if state.is_graduated != 0 && state.senior_capital > 0 {
        let new_junior = state
            .junior_capital
            .checked_sub(withdrawal_amount)
            .ok_or(KilnError::MathOverflow)?;
        let new_total = new_junior
            .checked_add(state.senior_capital)
            .ok_or(KilnError::MathOverflow)?;

        if new_total > 0 {
            let new_ratio_bps = new_junior
                .checked_mul(10_000)
                .ok_or(KilnError::MathOverflow)?
                .checked_div(new_total)
                .ok_or(KilnError::MathOverflow)? as u16;

            let required = min_junior_ratio_bps(new_total);
            if new_ratio_bps < required {
                return Err(KilnError::JuniorRatioViolation.into());
            }
        }
    }

    // Block withdrawal in paper mode if it would drain all junior capital
    if state.is_paper_mode != 0 && withdrawal_amount >= state.junior_capital {
        return Err(KilnError::InsufficientJuniorCapital.into());
    }

    let available = treasury
        .lamports()
        .checked_sub(config.treasury_rent_lamports)
        .ok_or(KilnError::TreasuryAccountingMismatch)?;
    if available < withdrawal_amount {
        return Err(KilnError::TreasuryAccountingMismatch.into());
    }

    drop(state);

    // Transfer from treasury to manager
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
        to: manager,
        lamports: withdrawal_amount,
    }
    .invoke_signed(&treasury_signers)?;

    // Update vault state
    let mut state = VaultState::load_mut(vault_state)?;
    state.junior_capital = state
        .junior_capital
        .checked_sub(withdrawal_amount)
        .ok_or(KilnError::MathOverflow)?;
    state.junior_shares_outstanding = state
        .junior_shares_outstanding
        .checked_sub(args.shares_to_burn)
        .ok_or(KilnError::MathOverflow)?;
    state.current_nav = state
        .current_nav
        .checked_sub(withdrawal_amount)
        .ok_or(KilnError::MathOverflow)?;
    state.last_nav = state.current_nav;
    state.last_nav_update_at = clock.unix_timestamp;

    Ok(())
}
