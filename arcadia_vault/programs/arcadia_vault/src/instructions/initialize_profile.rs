use anchor_lang::prelude::*;

use crate::{
    token::Mint, token::TokenAccount, token::TokenInterface, ArcadiaError, PlatformConfig,
    ProfileInitialized, TraderProfile, MAX_LEVERAGE_CEILING, NOT_FUNDABLE_TIER, PROFILE_SEED,
    PROFILE_STATUS_ACTIVE, SHARE_SCALE,
};

#[derive(Accounts)]
pub struct InitializeProfile<'info> {
    #[account(mut)]
    pub trader: Signer<'info>,
    #[account(has_one = base_mint)]
    pub config: Account<'info, PlatformConfig>,
    #[account(
        init,
        payer = trader,
        space = 8 + TraderProfile::INIT_SPACE,
        seeds = [PROFILE_SEED, trader.key().as_ref()],
        bump
    )]
    pub profile: Account<'info, TraderProfile>,
    pub base_mint: InterfaceAccount<'info, Mint>,
    #[account(
        init,
        payer = trader,
        token::mint = base_mint,
        token::authority = profile,
        token::token_program = token_program
    )]
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn handler(ctx: Context<InitializeProfile>, max_leverage: u8) -> Result<()> {
    require!(
        max_leverage > 0 && max_leverage <= MAX_LEVERAGE_CEILING,
        ArcadiaError::InvalidLeverage
    );

    let now = Clock::get()?.unix_timestamp;
    let profile = &mut ctx.accounts.profile;
    profile.trader = ctx.accounts.trader.key();
    profile.base_mint = ctx.accounts.base_mint.key();
    profile.vault_token = ctx.accounts.vault_token.key();
    profile.total_shares = 0;
    profile.trader_shares = 0;
    profile.hwm_per_share = SHARE_SCALE;
    profile.capacity_cap_usd = 0;
    profile.trader_claimable = 0;
    profile.last_settle_ts = now;
    profile.created_at = now;
    profile.status = PROFILE_STATUS_ACTIVE;
    profile.score_tier = NOT_FUNDABLE_TIER;
    profile.max_leverage = max_leverage;
    profile.bump = ctx.bumps.profile;

    emit!(ProfileInitialized {
        profile: profile.key(),
        trader: profile.trader,
        ts: now,
    });

    Ok(())
}
