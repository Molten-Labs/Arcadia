use anchor_lang::prelude::*;

use crate::{
    checked_add_u64, shares_for_deposit,
    token::{transfer_checked_accounts, Mint, TokenAccount, TokenInterface},
    ArcadiaError, Deposited, InvestorAccount, InvestorPosition, TraderProfile, INVESTOR_SEED,
    POSITION_SEED, PROFILE_STATUS_ACTIVE,
};

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(mut)]
    pub depositor: Signer<'info>,
    #[account(
        mut,
        seeds = [INVESTOR_SEED, depositor.key().as_ref()],
        bump = investor_account.bump,
        constraint = investor_account.owner == depositor.key() @ ArcadiaError::Unauthorized
    )]
    pub investor_account: Account<'info, InvestorAccount>,
    #[account(
        mut,
        has_one = base_mint,
        has_one = vault_token,
        constraint = profile.status == PROFILE_STATUS_ACTIVE @ ArcadiaError::VaultNotActive
    )]
    pub profile: Account<'info, TraderProfile>,
    #[account(
        init_if_needed,
        payer = depositor,
        space = 8 + InvestorPosition::INIT_SPACE,
        seeds = [POSITION_SEED, depositor.key().as_ref(), profile.key().as_ref()],
        bump
    )]
    pub position: Account<'info, InvestorPosition>,
    pub base_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = base_mint,
        token::authority = profile,
        token::token_program = token_program
    )]
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = base_mint,
        token::authority = depositor,
        token::token_program = token_program
    )]
    pub depositor_token: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    require!(amount > 0, ArcadiaError::ZeroAmount);
    require!(
        amount <= ctx.accounts.depositor_token.amount,
        ArcadiaError::InsufficientFunds
    );

    let now = Clock::get()?.unix_timestamp;
    let depositor = ctx.accounts.depositor.key();
    let profile_key = ctx.accounts.profile.key();
    let is_trader = depositor == ctx.accounts.profile.trader;
    let total_assets_before = ctx.accounts.vault_token.amount;
    let depositor_balance_before = ctx.accounts.depositor_token.amount;

    if !is_trader {
        require!(
            ctx.accounts.profile.capacity_cap_usd > 0,
            ArcadiaError::CapacityNotSet
        );
        let assets_after = checked_add_u64(total_assets_before, amount)?;
        require!(
            assets_after <= ctx.accounts.profile.capacity_cap_usd,
            ArcadiaError::CapacityExceeded
        );
        require!(
            ctx.accounts.profile.total_shares > 0,
            ArcadiaError::DustDeposit
        );
    }

    let shares_minted = shares_for_deposit(
        amount,
        ctx.accounts.profile.total_shares,
        total_assets_before,
    )?;
    require!(shares_minted > 0, ArcadiaError::DustDeposit);

    let fresh_position = ctx.accounts.position.owner == Pubkey::default()
        && ctx.accounts.position.profile == Pubkey::default();
    if fresh_position {
        ctx.accounts.position.owner = depositor;
        ctx.accounts.position.profile = profile_key;
        ctx.accounts.position.shares = 0;
        ctx.accounts.position.cost_basis_usd = 0;
        ctx.accounts.position.pending_withdraw_shares = 0;
        ctx.accounts.position.withdraw_ready_ts = 0;
    } else {
        require_keys_eq!(
            ctx.accounts.position.owner,
            depositor,
            ArcadiaError::Unauthorized
        );
        require_keys_eq!(
            ctx.accounts.position.profile,
            profile_key,
            ArcadiaError::Unauthorized
        );
    }

    ctx.accounts.profile.total_shares =
        checked_add_u64(ctx.accounts.profile.total_shares, shares_minted)?;
    if is_trader {
        ctx.accounts.profile.trader_shares =
            checked_add_u64(ctx.accounts.profile.trader_shares, shares_minted)?;
    }

    ctx.accounts.position.shares = checked_add_u64(ctx.accounts.position.shares, shares_minted)?;
    ctx.accounts.position.cost_basis_usd =
        checked_add_u64(ctx.accounts.position.cost_basis_usd, amount)?;
    ctx.accounts.position.deposited_at = now;
    ctx.accounts.position.bump = ctx.bumps.position;

    ctx.accounts.investor_account.total_deposited_usd =
        checked_add_u64(ctx.accounts.investor_account.total_deposited_usd, amount)?;
    if fresh_position {
        ctx.accounts.investor_account.position_count = ctx
            .accounts
            .investor_account
            .position_count
            .checked_add(1)
            .ok_or(ArcadiaError::MathOverflow)?;
    }

    transfer_checked_accounts(
        ctx.accounts.token_program.key(),
        ctx.accounts.depositor_token.to_account_info(),
        ctx.accounts.base_mint.to_account_info(),
        ctx.accounts.vault_token.to_account_info(),
        ctx.accounts.depositor.to_account_info(),
        amount,
        ctx.accounts.base_mint.decimals,
    )?;

    ctx.accounts.vault_token.reload()?;
    ctx.accounts.depositor_token.reload()?;

    let vault_delta = ctx
        .accounts
        .vault_token
        .amount
        .checked_sub(total_assets_before)
        .ok_or(ArcadiaError::TokenConservationFailed)?;
    let depositor_delta = depositor_balance_before
        .checked_sub(ctx.accounts.depositor_token.amount)
        .ok_or(ArcadiaError::TokenConservationFailed)?;
    require_eq!(vault_delta, amount, ArcadiaError::TokenConservationFailed);
    require_eq!(
        depositor_delta,
        amount,
        ArcadiaError::TokenConservationFailed
    );

    emit!(Deposited {
        profile: profile_key,
        depositor,
        is_trader,
        amount_usd: amount,
        shares_minted,
        ts: now,
    });

    Ok(())
}
