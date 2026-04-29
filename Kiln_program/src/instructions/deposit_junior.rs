use wincode::deserialize_exact;

use pinocchio::{
    account_info::AccountInfo, program_error::ProgramError, sysvars::clock::Clock, ProgramResult,
};
use pinocchio_system::instructions::Transfer;
use wincode::SchemaRead;

use crate::{
    errors::KilnError,
    states::{ManagerProfile, VaultConfig, VaultState},
};

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, SchemaRead)]
pub struct DepositJuniorArgs {
    pub amount_lamports: u64,
}

pub fn deposit_junior(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if accounts.len() >= 10 {
        return deposit_junior_usdc(accounts, data);
    }

    let [manager, manager_profile, vault_config, vault_state, treasury, clock_sysvar, system_program] =
        accounts
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
    if system_program.key() != &pinocchio_system::ID {
        return Err(KilnError::InvalidSystemProgram.into());
    }

    let args: DepositJuniorArgs =
        deserialize_exact(data).map_err(|_| ProgramError::InvalidInstructionData)?;
    if args.amount_lamports == 0 {
        return Err(KilnError::InvalidAmount.into());
    }

    let clock = Clock::from_account_info(clock_sysvar)?;

    {
        let manager_profile_state = ManagerProfile::load(manager_profile)?;
        let config = VaultConfig::load(vault_config)?;
        let state = VaultState::load(vault_state)?;

        if manager_profile_state.owner != *manager.key()
            || config.manager_profile != *manager_profile.key()
        {
            return Err(KilnError::ManagerMismatch.into());
        }
        if config.manager != *manager.key() {
            return Err(KilnError::ManagerMismatch.into());
        }
        if state.vault_config != *vault_config.key() {
            return Err(KilnError::VaultStateMismatch.into());
        }
        if config.treasury != *treasury.key() {
            return Err(KilnError::TreasuryMismatch.into());
        }
        if state.is_paused != 0 || state.trading_enabled == 0 {
            return Err(KilnError::VaultPaused.into());
        }
    }

    Transfer {
        from: manager,
        to: treasury,
        lamports: args.amount_lamports,
    }
    .invoke()?;

    let config = VaultConfig::load(vault_config)?;
    let mut state = VaultState::load_mut(vault_state)?;
    let mut manager_profile = ManagerProfile::load_mut(manager_profile)?;

    let new_shares = calculate_shares(
        args.amount_lamports,
        state.junior_capital,
        state.junior_shares_outstanding,
    )?;

    state.original_junior_deposit = state
        .original_junior_deposit
        .checked_add(args.amount_lamports)
        .ok_or(KilnError::MathOverflow)?;

    state.junior_capital = state
        .junior_capital
        .checked_add(args.amount_lamports)
        .ok_or(KilnError::MathOverflow)?;
    state.junior_shares_outstanding = state
        .junior_shares_outstanding
        .checked_add(new_shares)
        .ok_or(KilnError::MathOverflow)?;
    state.current_nav = state
        .current_nav
        .checked_add(args.amount_lamports)
        .ok_or(KilnError::MathOverflow)?;
    state.last_nav = state.current_nav;
    if state.high_water_mark == 0 {
        state.high_water_mark = state.current_nav;
    }
    state.last_nav_update_at = clock.unix_timestamp;

    manager_profile.total_junior_deposited = manager_profile
        .total_junior_deposited
        .checked_add(args.amount_lamports)
        .ok_or(KilnError::MathOverflow)?;

    let available_treasury = treasury
        .lamports()
        .checked_sub(config.treasury_rent_lamports)
        .ok_or(KilnError::TreasuryAccountingMismatch)?;
    if available_treasury < state.current_nav {
        return Err(KilnError::TreasuryAccountingMismatch.into());
    }

    Ok(())
}

fn deposit_junior_usdc(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let [
        manager,
        manager_profile,
        vault_config,
        vault_state,
        treasury,
        manager_usdc,
        vault_usdc,
        token_program,
        clock_sysvar,
        _system_program,
        ..,
    ] = accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !manager.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !manager_profile.is_writable()
        || !vault_state.is_writable()
        || !manager_usdc.is_writable()
        || !vault_usdc.is_writable()
    {
        return Err(ProgramError::InvalidAccountData);
    }

    let args: DepositJuniorArgs =
        deserialize_exact(data).map_err(|_| ProgramError::InvalidInstructionData)?;
    if args.amount_lamports == 0 {
        return Err(KilnError::InvalidAmount.into());
    }

    let manager_source = super::custody::read_token_account(manager_usdc)?;
    if manager_source.owner != *manager.key()
        || manager_source.mint != super::custody::USDC_MINT
        || manager_source.amount < args.amount_lamports
    {
        return Err(KilnError::InvalidTokenAccount.into());
    }
    super::custody::validate_custody_account(vault_usdc, treasury, &super::custody::USDC_MINT)?;

    let clock = Clock::from_account_info(clock_sysvar)?;

    {
        let manager_profile_state = ManagerProfile::load(manager_profile)?;
        let config = VaultConfig::load(vault_config)?;
        let state = VaultState::load(vault_state)?;

        if manager_profile_state.owner != *manager.key()
            || config.manager_profile != *manager_profile.key()
        {
            return Err(KilnError::ManagerMismatch.into());
        }
        if config.manager != *manager.key() {
            return Err(KilnError::ManagerMismatch.into());
        }
        if state.vault_config != *vault_config.key() {
            return Err(KilnError::VaultStateMismatch.into());
        }
        if config.treasury != *treasury.key() {
            return Err(KilnError::TreasuryMismatch.into());
        }
        if state.is_paused != 0 || state.trading_enabled == 0 {
            return Err(KilnError::VaultPaused.into());
        }
    }

    super::custody::transfer_token(
        token_program,
        manager_usdc,
        vault_usdc,
        manager,
        args.amount_lamports,
    )?;

    let mut state = VaultState::load_mut(vault_state)?;
    let mut manager_profile = ManagerProfile::load_mut(manager_profile)?;
    let new_shares = calculate_shares(
        args.amount_lamports,
        state.junior_capital,
        state.junior_shares_outstanding,
    )?;

    state.original_junior_deposit = state
        .original_junior_deposit
        .checked_add(args.amount_lamports)
        .ok_or(KilnError::MathOverflow)?;
    state.junior_capital = state
        .junior_capital
        .checked_add(args.amount_lamports)
        .ok_or(KilnError::MathOverflow)?;
    state.junior_shares_outstanding = state
        .junior_shares_outstanding
        .checked_add(new_shares)
        .ok_or(KilnError::MathOverflow)?;
    state.current_nav = state
        .current_nav
        .checked_add(args.amount_lamports)
        .ok_or(KilnError::MathOverflow)?;
    state.last_nav = state.current_nav;
    if state.high_water_mark == 0 {
        state.high_water_mark = state.current_nav;
    }
    state.last_nav_update_at = clock.unix_timestamp;

    manager_profile.total_junior_deposited = manager_profile
        .total_junior_deposited
        .checked_add(args.amount_lamports)
        .ok_or(KilnError::MathOverflow)?;

    Ok(())
}

fn calculate_shares(amount: u64, capital: u64, outstanding: u64) -> Result<u64, ProgramError> {
    if capital == 0 || outstanding == 0 {
        return Ok(amount);
    }

    amount
        .checked_mul(outstanding)
        .ok_or(KilnError::MathOverflow)?
        .checked_div(capital)
        .ok_or(KilnError::MathOverflow.into())
}
