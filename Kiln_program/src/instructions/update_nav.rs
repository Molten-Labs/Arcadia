/* Kiln/Kiln_program/src/instructions/update_nav.rs
   Handles UpdateNav and GraduateVault logic: recompute NAV, apply waterfall,
   and attempt vault graduation.

   This implementation is intentionally conservative and uses only on-chain
   lamport balances (treasury lamports) to compute NAV. Oracle integration
   (Pyth) and CPI-based swaps should be added later.

   The functions follow the project's validation and zero-copy patterns.
*/

use wincode::deserialize_exact;

use pinocchio::{
    account_info::AccountInfo,
    program_error::ProgramError,
    sysvars::clock::Clock,
    ProgramResult,
};
use crate::errors::KilnError;
use crate::states::{VaultConfig, VaultState, ManagerProfile};

/// Instruction args for UpdateNav (currently empty - placeholder for future oracle params)
#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, wincode::SchemaRead)]
pub struct UpdateNavArgs {
    // Future: packed oracle prices or flags
    pub _reserved: u8,
}

/// Instruction args for GraduateVault (empty for now)
#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, wincode::SchemaRead)]
pub struct GraduateVaultArgs {
    pub _reserved: u8,
}

/// Recompute NAV for a vault, apply waterfall loss logic and update timestamps.
///
/// Expected accounts (in order):
/// 0: updater (caller) - optional signer
/// 1: vault_config (readonly)
/// 2: vault_state (writable)
/// 3: treasury (writable) -- a system account holding lamports representing USDC in this simplified MVP
/// 4: clock (readonly)
pub fn update_nav(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    // Minimal decode to keep parity with wincode-based instruction shapes.
    let _args: UpdateNavArgs =
        deserialize_exact(data).map_err(|_| ProgramError::InvalidInstructionData)?;

    let [ _updater, vault_config, vault_state, treasury, clock_sys ] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // Basic writable checks
    if !vault_state.is_writable() || !treasury.is_writable() {
        return Err(ProgramError::InvalidAccountData);
    }

    // Load current state/config
    let config = VaultConfig::load(vault_config)?;
    let mut state = VaultState::load_mut(vault_state)?;

    // Ensure state links to config
    if state.vault_config != *vault_config.key() {
        return Err(KilnError::VaultStateMismatch.into());
    }

    // Compute current_nav from treasury lamports minus configured rent reserve
    // Note: VaultConfig stores treasury_rent_lamports as min balance expected.
    let treasury_lamports = treasury.lamports();
    let rent_reserved = config.treasury_rent_lamports;
    let available = treasury_lamports.checked_sub(rent_reserved)
        .ok_or(KilnError::TreasuryAccountingMismatch)?;

    // For this simplified model, NAV is just the available lamports.
    let new_nav = available;

    // Save previous nav and timestamps
    let old_nav = state.current_nav;
    state.last_nav = old_nav;
    state.current_nav = new_nav;

    // Update last_nav_update_at timestamp
    let clock = Clock::from_account_info(clock_sys)?;
    state.last_nav_update_at = clock.unix_timestamp;

    // If this is the first meaningful NAV (e.g., after initial deposit), ensure HWM set
    if state.high_water_mark == 0 {
        state.high_water_mark = state.current_nav;
    }

    // If NAV decreased, apply waterfall loss sequence:
    if new_nav < old_nav {
        let loss = old_nav.checked_sub(new_nav).ok_or(KilnError::MathOverflow)?;
        // First apply to junior_capital
        if loss <= state.junior_capital {
            // junior absorbs full loss
            state.junior_capital = state.junior_capital.checked_sub(loss).ok_or(KilnError::MathOverflow)?;
        } else {
            // junior wiped; remaining loss hits senior
            let remaining = loss.checked_sub(state.junior_capital).ok_or(KilnError::MathOverflow)?;
            state.junior_capital = 0;
            // senior_capital may underflow; guard with error
            state.senior_capital = state.senior_capital.checked_sub(remaining).ok_or(KilnError::MathOverflow)?;
            // Freeze trading if junior is wiped
            state.trading_enabled = 0;
        }
        // Record last loss time
        state.last_nav_update_at = clock.unix_timestamp;
    }

    // Sanity check: ensure treasury accounting still covers recorded current_nav
    let available_after = treasury.lamports().checked_sub(config.treasury_rent_lamports)
        .ok_or(KilnError::TreasuryAccountingMismatch)?;
    if available_after < state.current_nav {
        return Err(KilnError::TreasuryAccountingMismatch.into());
    }

    Ok(())
}

/// Attempt to graduate a paper-mode vault.
/// This is a lightweight check that enforces:
/// - vault is currently in paper mode
/// - enough time has elapsed (paper_window_secs)
/// - junior_capital > 0 and current_nav > original_junior_deposit (positive paper PnL)
///
/// Expected accounts (in order):
/// 0: caller (signer)
/// 1: vault_state (writable)
/// 2: vault_config (readonly)
/// 3: treasury (readonly)
/// 4: manager_profile (writable)
/// 5: clock (readonly)
pub fn graduate_vault(accounts: &[AccountInfo], _data: &[u8]) -> ProgramResult {
    let [ caller, vault_state, vault_config, _treasury, manager_profile, clock_sys ] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !caller.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !vault_state.is_writable() || !manager_profile.is_writable() {
        return Err(ProgramError::InvalidAccountData);
    }

    let config = VaultConfig::load(vault_config)?;
    let mut state = VaultState::load_mut(vault_state)?;

    // verify linkage
    if state.vault_config != *vault_config.key() {
        return Err(KilnError::VaultStateMismatch.into());
    }

    // Must be in paper mode
    if state.is_paper_mode == 0 {
        return Err(KilnError::InvalidVaultConfiguration.into());
    }

    // Basic temporal check: created_at + paper_window_secs <= now
    let clock = Clock::from_account_info(clock_sys)?;
    let elapsed = clock.unix_timestamp.checked_sub(state.created_at)
        .ok_or(KilnError::MathOverflow)?;
    if elapsed < config.paper_window_secs {
        return Err(KilnError::InvalidVaultConfiguration.into());
    }

    // junior must be positive and NAV must exceed original junior deposit
    if state.junior_capital == 0 {
        return Err(KilnError::InsufficientJuniorCapital.into());
    }
    if state.current_nav <= state.original_junior_deposit {
        return Err(KilnError::InvalidVaultConfiguration.into());
    }

    // Mark as graduated
    state.is_paper_mode = 0;
    state.is_graduated = 1;
    state.graduated_at = clock.unix_timestamp;

    // Update manager profile counters
    let mut mgr = ManagerProfile::load_mut(manager_profile)?;
    mgr.active_vaults = mgr.active_vaults.checked_sub(1).unwrap_or(0);
    // Note: graduated vaults count could be tracked elsewhere; incrementing total_vaults is not done here

    Ok(())
}
