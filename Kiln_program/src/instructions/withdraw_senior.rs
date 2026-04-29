use core::convert::TryInto;

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
    if accounts.len() >= 12 {
        return withdraw_senior_usdc(accounts, data);
    }

    let [investor, vault_config, vault_state, treasury, investor_position, clock_sysvar] = accounts
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
    let total_capital = state
        .junior_capital
        .checked_add(state.senior_capital)
        .ok_or(KilnError::MathOverflow)?;
    let junior_ratio_bps = if total_capital > 0 {
        state
            .junior_capital
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
        let elapsed = clock
            .unix_timestamp
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
    let available = treasury
        .lamports()
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

/// USDC withdrawal path with fresh SOL/USDC NAV and optional WSOL auto-unwind.
///
/// Expected accounts (in order):
/// 0: investor (signer)
/// 1: vault_config (readonly)
/// 2: vault_state (writable)
/// 3: treasury PDA (readonly authority)
/// 4: investor_position (writable)
/// 5: vault_usdc_token_account (writable)
/// 6: vault_wsol_token_account (writable)
/// 7: investor_usdc_token_account (writable)
/// 8: sol_usd_price_account
/// 9: usdc_usd_price_account
/// 10: token_program
/// 11: clock
/// 12: jupiter_program, required only when auto-unwind is needed
/// 13..: Jupiter CPI accounts in exact Jupiter instruction order
///
/// Data layout:
/// bytes 0..8: shares_to_burn
/// bytes 8..16: optional minimum_unwind_usdc
/// bytes 16..24: optional quote expiry unix timestamp
/// bytes 24..: optional Jupiter instruction data for WSOL -> USDC.
fn withdraw_senior_usdc(accounts: &[AccountInfo], data: &[u8]) -> ProgramResult {
    let [
        investor,
        vault_config,
        vault_state,
        treasury,
        investor_position,
        vault_usdc,
        vault_wsol,
        investor_usdc,
        sol_price_account,
        usdc_price_account,
        token_program,
        clock_sysvar,
        remaining @ ..,
    ] = accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    if data.len() < 8 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let shares_to_burn = u64::from_le_bytes(
        data[0..8]
            .try_into()
            .map_err(|_| ProgramError::InvalidInstructionData)?,
    );
    if shares_to_burn == 0 {
        return Err(KilnError::InvalidAmount.into());
    }

    if !investor.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    if !vault_state.is_writable()
        || !investor_position.is_writable()
        || !vault_usdc.is_writable()
        || !vault_wsol.is_writable()
        || !investor_usdc.is_writable()
    {
        return Err(ProgramError::InvalidAccountData);
    }

    let config = VaultConfig::load(vault_config)?;
    if config.treasury != *treasury.key() {
        return Err(KilnError::TreasuryMismatch.into());
    }
    let clock = Clock::from_account_info(clock_sysvar)?;

    let investor_token = super::custody::read_token_account(investor_usdc)?;
    if investor_token.owner != *investor.key() || investor_token.mint != super::custody::USDC_MINT {
        return Err(KilnError::InvalidTokenAccount.into());
    }
    let vault_usdc_snapshot =
        super::custody::validate_custody_account(vault_usdc, treasury, &super::custody::USDC_MINT)?;
    let vault_wsol_snapshot =
        super::custody::validate_custody_account(vault_wsol, treasury, &super::custody::WSOL_MINT)?;

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
    let fresh_nav = super::custody::nav_usdc(
        vault_usdc_snapshot.amount,
        vault_wsol_snapshot.amount,
        sol_price.price,
        usdc_price.price,
    )?;

    let pos = InvestorPosition::load(investor_position)?;
    if pos.investor != *investor.key() {
        return Err(KilnError::InvestorMismatch.into());
    }
    if pos.vault_config != *vault_config.key() {
        return Err(KilnError::VaultStateMismatch.into());
    }
    if pos.senior_shares < shares_to_burn {
        return Err(KilnError::InsufficientSeniorCapital.into());
    }
    drop(pos);

    let state = VaultState::load(vault_state)?;
    if state.vault_config != *vault_config.key() {
        return Err(KilnError::VaultStateMismatch.into());
    }

    let total_capital = state
        .junior_capital
        .checked_add(state.senior_capital)
        .ok_or(KilnError::MathOverflow)?;
    let junior_ratio_bps = if total_capital > 0 {
        state
            .junior_capital
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
        let elapsed = clock
            .unix_timestamp
            .checked_sub(pos_ref.deposited_at)
            .ok_or(KilnError::MathOverflow)?;
        if elapsed < COOLDOWN_SECS {
            return Err(KilnError::WithdrawalCooldownActive.into());
        }
        drop(pos_ref);
    }

    let withdrawal_amount = if state.senior_shares_outstanding > 0 {
        shares_to_burn
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
    if withdrawal_amount > fresh_nav {
        return Err(KilnError::InsufficientLiquidity.into());
    }
    drop(state);

    let liquid_usdc = super::custody::read_token_amount(vault_usdc)?;
    if liquid_usdc < withdrawal_amount {
        let shortfall = withdrawal_amount
            .checked_sub(liquid_usdc)
            .ok_or(KilnError::MathOverflow)?;
        let needed_wsol =
            super::custody::wsol_needed_for_usdc(shortfall, sol_price.price, usdc_price.price)?;
        let current_wsol = super::custody::read_token_amount(vault_wsol)?;
        if current_wsol < needed_wsol || current_wsol == 0 {
            return Err(KilnError::InsufficientLiquidity.into());
        }
        if data.len() < 24 || remaining.is_empty() {
            return Err(KilnError::InsufficientLiquidity.into());
        }

        let [jupiter_program, jupiter_accounts @ ..] = remaining else {
            return Err(ProgramError::NotEnoughAccountKeys);
        };
        if jupiter_program.key() != &super::execute_swap::JUPITER_PROGRAM_ID {
            return Err(KilnError::InvalidJupiterProgram.into());
        }
        if jupiter_accounts.is_empty() {
            return Err(KilnError::JupiterCpiFailed.into());
        }

        let minimum_unwind_usdc = u64::from_le_bytes(
            data[8..16]
                .try_into()
                .map_err(|_| ProgramError::InvalidInstructionData)?,
        );
        let quote_expiry = i64::from_le_bytes(
            data[16..24]
                .try_into()
                .map_err(|_| ProgramError::InvalidInstructionData)?,
        );
        if quote_expiry > 0 && clock.unix_timestamp > quote_expiry {
            return Err(KilnError::SlippageExceeded.into());
        }
        let unwind_data = &data[24..];
        if unwind_data.is_empty() {
            return Err(KilnError::JupiterCpiFailed.into());
        }

        let usdc_before = super::custody::read_token_amount(vault_usdc)?;
        let wsol_before = super::custody::read_token_amount(vault_wsol)?;
        super::execute_swap::invoke_jupiter(
            jupiter_accounts,
            unwind_data,
            treasury,
            vault_config.key(),
            config.treasury_bump,
        )?;
        let usdc_after = super::custody::read_token_amount(vault_usdc)?;
        let wsol_after = super::custody::read_token_amount(vault_wsol)?;
        let received = usdc_after
            .checked_sub(usdc_before)
            .ok_or(KilnError::SlippageExceeded)?;
        let wsol_spent = wsol_before
            .checked_sub(wsol_after)
            .ok_or(KilnError::SlippageExceeded)?;
        if wsol_spent == 0 || wsol_spent > needed_wsol {
            return Err(KilnError::SlippageExceeded.into());
        }
        if received < shortfall || received < minimum_unwind_usdc {
            return Err(KilnError::SlippageExceeded.into());
        }
    }

    let liquid_after_unwind = super::custody::read_token_amount(vault_usdc)?;
    if liquid_after_unwind < withdrawal_amount {
        return Err(KilnError::InsufficientLiquidity.into());
    }

    super::custody::transfer_token_from_treasury(
        token_program,
        vault_usdc,
        investor_usdc,
        treasury,
        vault_config.key(),
        config.treasury_bump,
        withdrawal_amount,
    )?;

    let final_usdc = super::custody::read_token_amount(vault_usdc)?;
    let final_wsol = super::custody::read_token_amount(vault_wsol)?;
    let post_withdraw_nav =
        super::custody::nav_usdc(final_usdc, final_wsol, sol_price.price, usdc_price.price)?;

    let mut state = VaultState::load_mut(vault_state)?;
    state.senior_capital = state
        .senior_capital
        .checked_sub(withdrawal_amount)
        .ok_or(KilnError::MathOverflow)?;
    state.senior_shares_outstanding = state
        .senior_shares_outstanding
        .checked_sub(shares_to_burn)
        .ok_or(KilnError::MathOverflow)?;
    state.last_nav = fresh_nav;
    state.current_nav = post_withdraw_nav;
    state.last_nav_update_at = clock.unix_timestamp;
    drop(state);

    let mut pos = InvestorPosition::load_mut(investor_position)?;
    pos.senior_shares = pos
        .senior_shares
        .checked_sub(shares_to_burn)
        .ok_or(KilnError::MathOverflow)?;

    Ok(())
}
