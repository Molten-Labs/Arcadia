use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    sysvars::clock::Clock,
    ProgramResult,
};

use crate::{
    errors::KilnError,
    states::{ManagerProfile, VaultConfig, VaultState, TREASURY_SEED},
};

const FEE_BPS: u64 = 2000; // 20% performance fee

/// Claim performance fees above high water mark.
///
/// Expected accounts (in order):
/// 0: manager (signer, writable)
/// 1: manager_profile (readonly)
/// 2: vault_config (readonly)
/// 3: vault_state (writable)
/// 4: treasury (writable)
/// 5: clock (readonly)
pub fn claim_fees(accounts: &[AccountInfo], _data: &[u8]) -> ProgramResult {
    let [manager, manager_profile, vault_config, vault_state, treasury, clock_sysvar] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !manager.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !manager.is_writable() || !vault_state.is_writable() || !treasury.is_writable() {
        return Err(ProgramError::InvalidAccountData);
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
    if state.is_graduated == 0 {
        return Err(KilnError::VaultNotGraduated.into());
    }

    // Only charge fees on profit above HWM
    if state.current_nav <= state.high_water_mark {
        return Err(KilnError::InvalidAmount.into());
    }

    let profit = state.current_nav
        .checked_sub(state.high_water_mark)
        .ok_or(KilnError::MathOverflow)?;

    // Use the vault's configured fee rate, capped at protocol max
    let fee_rate = core::cmp::min(config.manager_fee_bps as u64, FEE_BPS);
    let fee_lamports = profit
        .checked_mul(fee_rate)
        .ok_or(KilnError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(KilnError::MathOverflow)?;

    if fee_lamports == 0 {
        return Err(KilnError::InvalidAmount.into());
    }

    let available = treasury.lamports()
        .checked_sub(config.treasury_rent_lamports)
        .ok_or(KilnError::TreasuryAccountingMismatch)?;
    if available < fee_lamports {
        return Err(KilnError::TreasuryAccountingMismatch.into());
    }

    drop(state);

    // Transfer fee from treasury to manager
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
        lamports: fee_lamports,
    }
    .invoke_signed(&treasury_signers)?;

    // Update HWM and NAV
    let mut state = VaultState::load_mut(vault_state)?;
    state.high_water_mark = state.current_nav;
    state.current_nav = state
        .current_nav
        .checked_sub(fee_lamports)
        .ok_or(KilnError::MathOverflow)?;
    state.last_nav = state.current_nav;
    state.last_nav_update_at = clock.unix_timestamp;

    // Fee comes from junior capital (manager's share)
    state.junior_capital = state
        .junior_capital
        .checked_sub(fee_lamports)
        .ok_or(KilnError::MathOverflow)?;

    Ok(())
}
