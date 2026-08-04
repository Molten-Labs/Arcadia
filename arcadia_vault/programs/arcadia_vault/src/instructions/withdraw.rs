use anchor_lang::prelude::*;

use crate::{
    assets_for_shares, checked_add_u64, checked_sub_u64, nav_bearing_assets,
    token::{
        profile_signer_seeds, transfer_checked_accounts_with_signer, Mint, Token, TokenAccount,
    },
    withdrawal_ready_ts, ArcadiaError, InvestorAccount, InvestorPosition, PlatformConfig,
    TraderProfile, WithdrawRequested, Withdrawn, INVESTOR_SEED, PLATFORM_SEED, POSITION_SEED,
};

#[derive(Accounts)]
pub struct RequestWithdraw<'info> {
    pub owner: Signer<'info>,
    #[account(
        has_one = vault_token,
        constraint = vault_token.mint == profile.base_mint @ ArcadiaError::Unauthorized
    )]
    pub profile: Account<'info, TraderProfile>,
    pub vault_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        seeds = [POSITION_SEED, owner.key().as_ref(), profile.key().as_ref()],
        bump = position.bump,
        constraint = position.owner == owner.key() @ ArcadiaError::Unauthorized,
        constraint = position.profile == profile.key() @ ArcadiaError::Unauthorized
    )]
    pub position: Account<'info, InvestorPosition>,
}

pub fn request_withdraw_handler(ctx: Context<RequestWithdraw>, shares: u64) -> Result<()> {
    require!(shares > 0, ArcadiaError::ZeroAmount);

    let new_pending = checked_add_u64(ctx.accounts.position.pending_withdraw_shares, shares)?;
    require!(
        new_pending <= ctx.accounts.position.shares,
        ArcadiaError::InsufficientShares
    );

    let now = Clock::get()?.unix_timestamp;
    let withdraw_ready_ts = withdrawal_ready_ts(
        shares,
        ctx.accounts.vault_token.amount,
        ctx.accounts.profile.trader_claimable,
        ctx.accounts.profile.total_shares,
        now,
    )?;

    ctx.accounts.position.pending_withdraw_shares = new_pending;
    ctx.accounts.position.withdraw_ready_ts = withdraw_ready_ts;

    emit!(WithdrawRequested {
        profile: ctx.accounts.profile.key(),
        owner: ctx.accounts.owner.key(),
        shares,
        withdraw_ready_ts,
    });

    Ok(())
}

#[derive(Accounts)]
pub struct ProcessWithdraw<'info> {
    pub authority: Signer<'info>,
    #[account(
        seeds = [PLATFORM_SEED],
        bump = config.bump
    )]
    pub config: Account<'info, PlatformConfig>,
    #[account(mut, has_one = base_mint, has_one = vault_token)]
    pub profile: Account<'info, TraderProfile>,
    /// CHECK: pubkey reference for PDA derivation and authority check
    pub owner: UncheckedAccount<'info>,
    #[account(
        mut,
        seeds = [INVESTOR_SEED, owner.key().as_ref()],
        bump = investor_account.bump
    )]
    pub investor_account: Account<'info, InvestorAccount>,
    #[account(
        mut,
        seeds = [POSITION_SEED, owner.key().as_ref(), profile.key().as_ref()],
        bump = position.bump,
        constraint = position.profile == profile.key() @ ArcadiaError::Unauthorized
    )]
    pub position: Account<'info, InvestorPosition>,
    pub base_mint: Account<'info, Mint>,
    #[account(
        mut,
        token::mint = base_mint,
        token::authority = profile,
        token::token_program = token_program
    )]
    pub vault_token: Account<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = base_mint,
        token::authority = owner,
        token::token_program = token_program
    )]
    pub owner_token: Account<'info, TokenAccount>,
    pub token_program: Program<'info, Token>,
}

pub fn process_withdraw_handler(ctx: Context<ProcessWithdraw>) -> Result<()> {
    let owner_key = ctx.accounts.owner.key();
    let authority_key = ctx.accounts.authority.key();
    require!(
        authority_key == owner_key || authority_key == ctx.accounts.config.processor,
        ArcadiaError::Unauthorized
    );

    require!(
        ctx.accounts.position.pending_withdraw_shares > 0,
        ArcadiaError::NothingPending
    );

    let now = Clock::get()?.unix_timestamp;
    require!(
        now >= ctx.accounts.position.withdraw_ready_ts,
        ArcadiaError::NoticeNotElapsed
    );

    let profile_key = ctx.accounts.profile.key();
    let burn = ctx.accounts.position.pending_withdraw_shares;
    let vault_balance_before = ctx.accounts.vault_token.amount;
    let owner_balance_before = ctx.accounts.owner_token.amount;
    let nav_excl = nav_bearing_assets(vault_balance_before, ctx.accounts.profile.trader_claimable)?;
    let assets_out = assets_for_shares(burn, nav_excl, ctx.accounts.profile.total_shares)?;
    require!(
        assets_out <= vault_balance_before,
        ArcadiaError::InsufficientVaultLiquidity
    );

    ctx.accounts.profile.total_shares = checked_sub_u64(ctx.accounts.profile.total_shares, burn)?;
    if owner_key == ctx.accounts.profile.trader {
        ctx.accounts.profile.trader_shares =
            checked_sub_u64(ctx.accounts.profile.trader_shares, burn)?;
    }
    ctx.accounts.position.shares = checked_sub_u64(ctx.accounts.position.shares, burn)?;
    ctx.accounts.position.pending_withdraw_shares = 0;
    ctx.accounts.position.withdraw_ready_ts = 0;

    let profile_bump = [ctx.accounts.profile.bump];
    let seeds = profile_signer_seeds(&ctx.accounts.profile.trader, &profile_bump);
    let signer_seeds = &[&seeds[..]];
    transfer_checked_accounts_with_signer(
        ctx.accounts.token_program.key(),
        ctx.accounts.vault_token.to_account_info(),
        ctx.accounts.base_mint.to_account_info(),
        ctx.accounts.owner_token.to_account_info(),
        ctx.accounts.profile.to_account_info(),
        assets_out,
        ctx.accounts.base_mint.decimals,
        signer_seeds,
    )?;

    ctx.accounts.vault_token.reload()?;
    ctx.accounts.owner_token.reload()?;

    let vault_delta = vault_balance_before
        .checked_sub(ctx.accounts.vault_token.amount)
        .ok_or(ArcadiaError::TokenConservationFailed)?;
    let owner_delta = ctx
        .accounts
        .owner_token
        .amount
        .checked_sub(owner_balance_before)
        .ok_or(ArcadiaError::TokenConservationFailed)?;
    require_eq!(
        vault_delta,
        assets_out,
        ArcadiaError::TokenConservationFailed
    );
    require_eq!(
        owner_delta,
        assets_out,
        ArcadiaError::TokenConservationFailed
    );

    emit!(Withdrawn {
        profile: profile_key,
        owner: owner_key,
        shares_burned: burn,
        amount_usd: assets_out,
    });

    if ctx.accounts.position.shares == 0 {
        ctx.accounts
            .position
            .close(ctx.accounts.owner.to_account_info())?;
        ctx.accounts.investor_account.position_count = ctx
            .accounts
            .investor_account
            .position_count
            .checked_sub(1)
            .ok_or(ArcadiaError::MathOverflow)?;
    }

    Ok(())
}
