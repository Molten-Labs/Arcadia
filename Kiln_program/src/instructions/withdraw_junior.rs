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
    pub amount_usdc: u64,
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
    if accounts.len() >= 9 {
        return withdraw_junior_usdc(accounts, data);
    }

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
    if args.amount_usdc == 0 {
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
    if state.junior_shares_outstanding == 0 {
        return Err(KilnError::InsufficientJuniorCapital.into());
    }

    let withdrawal_amount = args.amount_usdc;
    if withdrawal_amount > state.junior_capital {
        return Err(KilnError::InsufficientJuniorCapital.into());
    }
    let principal_to_reduce = principal_for_claim(
        withdrawal_amount,
        state.junior_capital,
        state.junior_shares_outstanding,
    )?;

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
        .checked_sub(principal_to_reduce)
        .ok_or(KilnError::MathOverflow)?;
    state.current_nav = state
        .current_nav
        .checked_sub(withdrawal_amount)
        .ok_or(KilnError::MathOverflow)?;
    state.last_nav = state.current_nav;
    state.last_nav_update_at = clock.unix_timestamp;

    Ok(())
}

/// USDC junior withdrawal path.
///
/// Expected accounts (in order):
/// 0: manager (signer)
/// 1: manager_profile (writable)
/// 2: vault_config (readonly)
/// 3: vault_state (writable)
/// 4: treasury PDA (readonly authority)
/// 5: vault_usdc_token_account (writable)
/// 6: manager_usdc_token_account (writable)
/// 7: token_program
/// 8: clock
fn withdraw_junior_usdc(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let [
        manager,
        manager_profile,
        vault_config,
        vault_state,
        treasury,
        vault_usdc,
        manager_usdc,
        token_program,
        clock_sysvar,
        ..
    ] = accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !manager.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !manager_profile.is_writable()
        || !vault_state.is_writable()
        || !vault_usdc.is_writable()
        || !manager_usdc.is_writable()
    {
        return Err(ProgramError::InvalidAccountData);
    }

    let args: WithdrawJuniorArgs =
        deserialize_exact(data).map_err(|_| ProgramError::InvalidInstructionData)?;
    if args.amount_usdc == 0 {
        return Err(KilnError::InvalidAmount.into());
    }

    let config = VaultConfig::load(vault_config)?;
    if config.manager != *manager.key() {
        return Err(KilnError::ManagerMismatch.into());
    }
    if config.treasury != *treasury.key() {
        return Err(KilnError::TreasuryMismatch.into());
    }
    let clock = Clock::from_account_info(clock_sysvar)?;

    {
        let mgr = ManagerProfile::load(manager_profile)?;
        if mgr.owner != *manager.key() {
            return Err(KilnError::ManagerMismatch.into());
        }
    }

    let manager_token = super::custody::read_token_account(manager_usdc)?;
    if manager_token.owner != *manager.key() || manager_token.mint != super::custody::USDC_MINT {
        return Err(KilnError::InvalidTokenAccount.into());
    }
    let vault_usdc_snapshot =
        super::custody::validate_custody_account(vault_usdc, treasury, &super::custody::USDC_MINT)?;

    let state = VaultState::load(vault_state)?;
    if state.vault_config != *vault_config.key() {
        return Err(KilnError::VaultStateMismatch.into());
    }
    if state.junior_shares_outstanding == 0 {
        return Err(KilnError::InsufficientJuniorCapital.into());
    }

    let withdrawal_amount = args.amount_usdc;
    if withdrawal_amount > state.junior_capital {
        return Err(KilnError::InsufficientJuniorCapital.into());
    }
    let principal_to_reduce = principal_for_claim(
        withdrawal_amount,
        state.junior_capital,
        state.junior_shares_outstanding,
    )?;
    if vault_usdc_snapshot.amount < withdrawal_amount {
        return Err(KilnError::InsufficientLiquidity.into());
    }

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

    if state.is_paper_mode != 0 && withdrawal_amount >= state.junior_capital {
        return Err(KilnError::InsufficientJuniorCapital.into());
    }
    drop(state);

    super::custody::transfer_token_from_treasury(
        token_program,
        vault_usdc,
        manager_usdc,
        treasury,
        vault_config.key(),
        config.treasury_bump,
        withdrawal_amount,
    )?;

    let mut state = VaultState::load_mut(vault_state)?;
    state.junior_capital = state
        .junior_capital
        .checked_sub(withdrawal_amount)
        .ok_or(KilnError::MathOverflow)?;
    state.junior_shares_outstanding = state
        .junior_shares_outstanding
        .checked_sub(principal_to_reduce)
        .ok_or(KilnError::MathOverflow)?;
    state.current_nav = state
        .current_nav
        .checked_sub(withdrawal_amount)
        .ok_or(KilnError::MathOverflow)?;
    state.last_nav = state.current_nav;
    state.last_nav_update_at = clock.unix_timestamp;

    Ok(())
}

fn principal_for_claim(
    claim_amount: u64,
    pool_capital: u64,
    total_principal: u64,
) -> Result<u64, ProgramError> {
    if claim_amount == 0 || pool_capital == 0 || total_principal == 0 {
        return Err(KilnError::InvalidAmount.into());
    }
    let numerator = (claim_amount as u128)
        .checked_mul(total_principal as u128)
        .ok_or(KilnError::MathOverflow)?;
    let denominator = pool_capital as u128;
    let principal = numerator
        .checked_add(denominator.checked_sub(1).ok_or(KilnError::MathOverflow)?)
        .ok_or(KilnError::MathOverflow)?
        .checked_div(denominator)
        .ok_or(KilnError::MathOverflow)?;
    let principal = core::cmp::min(principal, total_principal as u128);
    if principal == 0 || principal > u64::MAX as u128 {
        return Err(KilnError::MathOverflow.into());
    }
    Ok(principal as u64)
}
