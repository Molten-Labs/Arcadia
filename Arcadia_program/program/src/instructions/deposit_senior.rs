use wincode::deserialize_exact;

use pinocchio::{
    account_info::AccountInfo,
    instruction::{Seed, Signer},
    program_error::ProgramError,
    pubkey::find_program_address,
    sysvars::{clock::Clock, rent::Rent},
    ProgramResult,
};
use pinocchio_system::instructions::CreateAccount;
use wincode::SchemaRead;

use crate::{
    errors::KilnError,
    states::{InvestorPosition, VaultConfig, VaultState, INVESTOR_POSITION_SEED},
};

#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Eq, SchemaRead)]
pub struct DepositSeniorArgs {
    pub amount_lamports: u64,
}

/// Minimum senior deposit: 10_000_000 lamports (~$10 equivalent in simplified model)
const MIN_SENIOR_DEPOSIT: u64 = 10_000_000;

/// Returns the minimum junior ratio in basis points for a given total capital.
/// Sliding scale: smaller vaults require higher junior buffer.
fn min_junior_ratio_bps(total_capital: u64) -> u16 {
    const FIFTY_K: u64 = 50_000_000_000;
    const TWO_HUNDRED_K: u64 = 200_000_000_000;
    const FIVE_HUNDRED_K: u64 = 500_000_000_000;
    const ONE_M: u64 = 1_000_000_000_000;

    if total_capital < FIFTY_K {
        2000 // 20%
    } else if total_capital < TWO_HUNDRED_K {
        1500 // 15%
    } else if total_capital < FIVE_HUNDRED_K {
        1200 // 12%
    } else if total_capital < ONE_M {
        1000 // 10%
    } else {
        800 // 8%
    }
}

/// Deposit senior capital into a graduated vault.
///
/// Expected accounts (in order):
/// 0: investor (signer, writable)
/// 1: vault_config (readonly)
/// 2: vault_state (writable)
/// 3: treasury (writable)
/// 4: investor_position (writable) — PDA, created if needed
/// 5: rent (readonly)
/// 6: clock (readonly)
/// 7: system_program (readonly)
pub fn deposit_senior(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    if accounts.len() >= 11 {
        return deposit_senior_usdc(accounts, data);
    }

    let [investor, vault_config, vault_state, treasury, investor_position, rent_sysvar, clock_sysvar, system_program] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !investor.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !investor.is_writable()
        || !vault_state.is_writable()
        || !treasury.is_writable()
        || !investor_position.is_writable()
    {
        return Err(ProgramError::InvalidAccountData);
    }
    if system_program.key() != &pinocchio_system::ID {
        return Err(KilnError::InvalidSystemProgram.into());
    }

    let args: DepositSeniorArgs =
        deserialize_exact(data).map_err(|_| ProgramError::InvalidInstructionData)?;
    if args.amount_lamports < MIN_SENIOR_DEPOSIT {
        return Err(KilnError::MinDepositNotMet.into());
    }

    let config = VaultConfig::load(vault_config)?;
    let clock = Clock::from_account_info(clock_sysvar)?;

    {
        let state = VaultState::load(vault_state)?;

        if state.vault_config != *vault_config.key() {
            return Err(KilnError::VaultStateMismatch.into());
        }
        if config.treasury != *treasury.key() {
            return Err(KilnError::TreasuryMismatch.into());
        }
        if state.is_graduated == 0 {
            return Err(KilnError::VaultNotGraduated.into());
        }
        if state.is_paused != 0 {
            return Err(KilnError::VaultPaused.into());
        }

        // Check sliding junior ratio after deposit
        let new_total = state
            .junior_capital
            .checked_add(state.senior_capital)
            .ok_or(KilnError::MathOverflow)?
            .checked_add(args.amount_lamports)
            .ok_or(KilnError::MathOverflow)?;

        let required_ratio_bps = min_junior_ratio_bps(new_total);
        // junior_ratio_bps = junior_capital * 10000 / new_total
        let junior_ratio_bps = state
            .junior_capital
            .checked_mul(10_000)
            .ok_or(KilnError::MathOverflow)?
            .checked_div(new_total)
            .ok_or(KilnError::MathOverflow)? as u16;

        if junior_ratio_bps < required_ratio_bps {
            return Err(KilnError::JuniorRatioViolation.into());
        }
    }

    // Validate investor_position PDA
    let (expected_pos, pos_bump) = find_program_address(
        &[
            INVESTOR_POSITION_SEED,
            investor.key().as_ref(),
            vault_config.key().as_ref(),
        ],
        &crate::ID,
    );
    if investor_position.key() != &expected_pos {
        return Err(KilnError::InvalidInvestorPositionPda.into());
    }

    // Create investor_position account if it doesn't exist yet
    if investor_position.data_is_empty() {
        let rent = Rent::from_account_info(rent_sysvar)?;
        let bump_seed = [pos_bump];
        let signer_seeds = [
            Seed::from(INVESTOR_POSITION_SEED),
            Seed::from(investor.key().as_ref()),
            Seed::from(vault_config.key().as_ref()),
            Seed::from(&bump_seed[..]),
        ];
        let signers = [Signer::from(&signer_seeds[..])];
        CreateAccount {
            from: investor,
            to: investor_position,
            lamports: rent.minimum_balance(InvestorPosition::LEN),
            space: InvestorPosition::LEN as u64,
            owner: &crate::ID,
        }
        .invoke_signed(&signers)?;

        InvestorPosition::initialize(
            investor_position,
            investor.key(),
            vault_config.key(),
            pos_bump,
            clock.unix_timestamp,
        )?;
    }

    // Transfer lamports from investor to treasury
    pinocchio_system::instructions::Transfer {
        from: investor,
        to: treasury,
        lamports: args.amount_lamports,
    }
    .invoke()?;

    // Update vault state
    let mut state = VaultState::load_mut(vault_state)?;

    state.senior_capital = state
        .senior_capital
        .checked_add(args.amount_lamports)
        .ok_or(KilnError::MathOverflow)?;
    state.senior_shares_outstanding = state
        .senior_shares_outstanding
        .checked_add(args.amount_lamports)
        .ok_or(KilnError::MathOverflow)?;
    state.current_nav = state
        .current_nav
        .checked_add(args.amount_lamports)
        .ok_or(KilnError::MathOverflow)?;
    if state.high_water_mark == 0 {
        state.high_water_mark = state.current_nav;
    } else {
        state.high_water_mark = state
            .high_water_mark
            .checked_add(args.amount_lamports)
            .ok_or(KilnError::MathOverflow)?;
    }
    state.last_nav = state.current_nav;
    state.last_nav_update_at = clock.unix_timestamp;

    // Update investor position
    let mut pos = InvestorPosition::load_mut(investor_position)?;
    pos.senior_shares = pos
        .senior_shares
        .checked_add(args.amount_lamports)
        .ok_or(KilnError::MathOverflow)?;
    pos.total_deposited = pos
        .total_deposited
        .checked_add(args.amount_lamports)
        .ok_or(KilnError::MathOverflow)?;
    pos.deposited_at = clock.unix_timestamp;

    Ok(())
}

fn deposit_senior_usdc(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let [investor, vault_config, vault_state, treasury, investor_position, investor_usdc, vault_usdc, token_program, rent_sysvar, clock_sysvar, system_program, ..] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if !investor.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !vault_state.is_writable()
        || !investor_position.is_writable()
        || !investor_usdc.is_writable()
        || !vault_usdc.is_writable()
    {
        return Err(ProgramError::InvalidAccountData);
    }
    if system_program.key() != &pinocchio_system::ID {
        return Err(KilnError::InvalidSystemProgram.into());
    }

    let args: DepositSeniorArgs =
        deserialize_exact(data).map_err(|_| ProgramError::InvalidInstructionData)?;
    if args.amount_lamports < MIN_SENIOR_DEPOSIT {
        return Err(KilnError::MinDepositNotMet.into());
    }

    let config = VaultConfig::load(vault_config)?;
    let clock = Clock::from_account_info(clock_sysvar)?;

    let investor_source = super::custody::read_token_account(investor_usdc)?;
    if investor_source.owner != *investor.key()
        || investor_source.mint != super::custody::USDC_MINT
        || investor_source.amount < args.amount_lamports
    {
        return Err(KilnError::InvalidTokenAccount.into());
    }
    super::custody::validate_custody_account(vault_usdc, treasury, &super::custody::USDC_MINT)?;

    {
        let state = VaultState::load(vault_state)?;

        if state.vault_config != *vault_config.key() {
            return Err(KilnError::VaultStateMismatch.into());
        }
        if config.treasury != *treasury.key() {
            return Err(KilnError::TreasuryMismatch.into());
        }
        if state.is_graduated == 0 {
            return Err(KilnError::VaultNotGraduated.into());
        }
        if state.is_paused != 0 {
            return Err(KilnError::VaultPaused.into());
        }

        let new_total = state
            .junior_capital
            .checked_add(state.senior_capital)
            .ok_or(KilnError::MathOverflow)?
            .checked_add(args.amount_lamports)
            .ok_or(KilnError::MathOverflow)?;

        let required_ratio_bps = min_junior_ratio_bps(new_total);
        let junior_ratio_bps = state
            .junior_capital
            .checked_mul(10_000)
            .ok_or(KilnError::MathOverflow)?
            .checked_div(new_total)
            .ok_or(KilnError::MathOverflow)? as u16;

        if junior_ratio_bps < required_ratio_bps {
            return Err(KilnError::JuniorRatioViolation.into());
        }
    }

    let (expected_pos, pos_bump) = find_program_address(
        &[
            INVESTOR_POSITION_SEED,
            investor.key().as_ref(),
            vault_config.key().as_ref(),
        ],
        &crate::ID,
    );
    if investor_position.key() != &expected_pos {
        return Err(KilnError::InvalidInvestorPositionPda.into());
    }

    if investor_position.data_is_empty() {
        let rent = Rent::from_account_info(rent_sysvar)?;
        let bump_seed = [pos_bump];
        let signer_seeds = [
            Seed::from(INVESTOR_POSITION_SEED),
            Seed::from(investor.key().as_ref()),
            Seed::from(vault_config.key().as_ref()),
            Seed::from(&bump_seed[..]),
        ];
        let signers = [Signer::from(&signer_seeds[..])];
        CreateAccount {
            from: investor,
            to: investor_position,
            lamports: rent.minimum_balance(InvestorPosition::LEN),
            space: InvestorPosition::LEN as u64,
            owner: &crate::ID,
        }
        .invoke_signed(&signers)?;

        InvestorPosition::initialize(
            investor_position,
            investor.key(),
            vault_config.key(),
            pos_bump,
            clock.unix_timestamp,
        )?;
    }

    super::custody::transfer_token(
        token_program,
        investor_usdc,
        vault_usdc,
        investor,
        args.amount_lamports,
    )?;

    let mut state = VaultState::load_mut(vault_state)?;

    state.senior_capital = state
        .senior_capital
        .checked_add(args.amount_lamports)
        .ok_or(KilnError::MathOverflow)?;
    state.senior_shares_outstanding = state
        .senior_shares_outstanding
        .checked_add(args.amount_lamports)
        .ok_or(KilnError::MathOverflow)?;
    state.current_nav = state
        .current_nav
        .checked_add(args.amount_lamports)
        .ok_or(KilnError::MathOverflow)?;
    if state.high_water_mark == 0 {
        state.high_water_mark = state.current_nav;
    } else {
        state.high_water_mark = state
            .high_water_mark
            .checked_add(args.amount_lamports)
            .ok_or(KilnError::MathOverflow)?;
    }
    state.last_nav = state.current_nav;
    state.last_nav_update_at = clock.unix_timestamp;

    let mut pos = InvestorPosition::load_mut(investor_position)?;
    pos.senior_shares = pos
        .senior_shares
        .checked_add(args.amount_lamports)
        .ok_or(KilnError::MathOverflow)?;
    pos.total_deposited = pos
        .total_deposited
        .checked_add(args.amount_lamports)
        .ok_or(KilnError::MathOverflow)?;
    pos.deposited_at = clock.unix_timestamp;

    Ok(())
}
