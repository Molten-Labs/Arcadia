use anchor_lang::prelude::*;

use crate::{
    checked_add_u64, checked_sub_u64, fee_from_bps, nav_per_share, profit_assets, tier_bps,
    token::{
        profile_signer_seeds, transfer_checked_accounts_with_signer, Mint, TokenAccount,
        TokenInterface,
    },
    ArcadiaError, PlatformConfig, Settled, TraderProfile,
};

#[derive(Accounts)]
pub struct Settle<'info> {
    pub caller: Signer<'info>,
    #[account(has_one = base_mint, has_one = treasury_token)]
    pub config: Account<'info, PlatformConfig>,
    #[account(mut, has_one = base_mint, has_one = vault_token)]
    pub profile: Account<'info, TraderProfile>,
    pub base_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = base_mint,
        token::authority = profile,
        token::token_program = token_program,
        constraint = vault_token.key() != treasury_token.key() @ ArcadiaError::TokenConservationFailed
    )]
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = base_mint,
        token::token_program = token_program
    )]
    pub treasury_token: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<Settle>) -> Result<()> {
    let caller = ctx.accounts.caller.key();
    require!(
        caller == ctx.accounts.profile.trader || caller == ctx.accounts.config.oracle_authority,
        ArcadiaError::Unauthorized
    );
    require!(
        ctx.accounts.profile.total_shares > 0,
        ArcadiaError::NoShares
    );

    let now = Clock::get()?.unix_timestamp;
    let vault_balance_before = ctx.accounts.vault_token.amount;
    let treasury_balance_before = ctx.accounts.treasury_token.amount;
    let current_nav = nav_per_share(
        vault_balance_before,
        ctx.accounts.profile.trader_claimable,
        ctx.accounts.profile.total_shares,
    )?;

    if current_nav <= ctx.accounts.profile.hwm_per_share {
        ctx.accounts.profile.last_settle_ts = now;
        return Ok(());
    }

    let profit_usd = profit_assets(
        current_nav,
        ctx.accounts.profile.hwm_per_share,
        ctx.accounts.profile.total_shares,
    )?;
    let trader_bps = tier_bps(ctx.accounts.profile.score_tier).ok_or(ArcadiaError::InvalidTier)?;
    let trader_cut = fee_from_bps(profit_usd, trader_bps)?;
    let platform_cut = fee_from_bps(profit_usd, ctx.accounts.config.perf_fee_bps)?;

    let trader_claimable_after =
        checked_add_u64(ctx.accounts.profile.trader_claimable, trader_cut)?;
    let vault_balance_after = checked_sub_u64(vault_balance_before, platform_cut)?;
    let hwm_after = nav_per_share(
        vault_balance_after,
        trader_claimable_after,
        ctx.accounts.profile.total_shares,
    )?;

    ctx.accounts.profile.trader_claimable = trader_claimable_after;
    ctx.accounts.profile.hwm_per_share = hwm_after;
    ctx.accounts.profile.last_settle_ts = now;

    if platform_cut > 0 {
        let profile_bump = [ctx.accounts.profile.bump];
        let seeds = profile_signer_seeds(&ctx.accounts.profile.trader, &profile_bump);
        let signer_seeds = &[&seeds[..]];
        transfer_checked_accounts_with_signer(
            ctx.accounts.token_program.key(),
            ctx.accounts.vault_token.to_account_info(),
            ctx.accounts.base_mint.to_account_info(),
            ctx.accounts.treasury_token.to_account_info(),
            ctx.accounts.profile.to_account_info(),
            platform_cut,
            ctx.accounts.base_mint.decimals,
            signer_seeds,
        )?;
    }

    ctx.accounts.vault_token.reload()?;
    ctx.accounts.treasury_token.reload()?;

    let vault_delta = vault_balance_before
        .checked_sub(ctx.accounts.vault_token.amount)
        .ok_or(ArcadiaError::TokenConservationFailed)?;
    let treasury_delta = ctx
        .accounts
        .treasury_token
        .amount
        .checked_sub(treasury_balance_before)
        .ok_or(ArcadiaError::TokenConservationFailed)?;
    require_eq!(
        vault_delta,
        platform_cut,
        ArcadiaError::TokenConservationFailed
    );
    require_eq!(
        treasury_delta,
        platform_cut,
        ArcadiaError::TokenConservationFailed
    );

    emit!(Settled {
        profile: ctx.accounts.profile.key(),
        profit_usd,
        trader_cut,
        platform_cut,
        hwm_per_share: hwm_after,
    });

    Ok(())
}
