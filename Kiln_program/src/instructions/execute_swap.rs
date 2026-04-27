use wincode::deserialize_exact;

use pinocchio::{
    account_info::AccountInfo, program_error::ProgramError, sysvars::clock::Clock, ProgramResult,
};
use wincode::SchemaRead;

use crate::{
    errors::KilnError,
    states::{VaultConfig, VaultState},
};

use super::vault_guard;

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, SchemaRead)]
pub struct ExecuteSwapArgs {
    pub in_amount: u64,
    pub minimum_amount_out: u64,
}

/// Execute a swap from the vault treasury.
///
/// MVP implementation: validates all guard checks and updates NAV from the
/// treasury balance. The actual Jupiter CPI call will be added when
/// jupiter-cpi dependency is integrated.
///
/// Expected accounts (in order):
/// 0: manager (signer)
/// 1: manager_profile (readonly)
/// 2: vault_config (readonly)
/// 3: vault_state (writable)
/// 4: treasury (writable)
/// 5: clock (readonly)
///
/// Future: additional accounts for Jupiter CPI routing
pub fn execute_swap(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
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
