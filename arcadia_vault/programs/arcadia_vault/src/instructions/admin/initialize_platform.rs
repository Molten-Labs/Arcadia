use anchor_lang::prelude::*;

use crate::{
    is_fee_config_safe, token::Mint, token::TokenAccount, ArcadiaError, PlatformConfig,
    PLATFORM_SEED,
};

#[derive(Accounts)]
pub struct InitializePlatform<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,
    #[account(
        init,
        payer = admin,
        space = 8 + PlatformConfig::INIT_SPACE,
        seeds = [PLATFORM_SEED],
        bump
    )]
    pub config: Account<'info, PlatformConfig>,
    pub base_mint: InterfaceAccount<'info, Mint>,
    #[account(token::mint = base_mint)]
    pub treasury_token: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<InitializePlatform>,
    perf_fee_bps: u16,
    mgmt_fee_bps: u16,
    oracle_authority: Pubkey,
) -> Result<()> {
    require!(
        is_fee_config_safe(perf_fee_bps, mgmt_fee_bps),
        ArcadiaError::InvalidFeeConfig
    );

    let config = &mut ctx.accounts.config;
    config.admin = ctx.accounts.admin.key();
    config.oracle_authority = oracle_authority;
    config.treasury_token = ctx.accounts.treasury_token.key();
    config.base_mint = ctx.accounts.base_mint.key();
    config.perf_fee_bps = perf_fee_bps;
    config.mgmt_fee_bps = mgmt_fee_bps;
    config.bump = ctx.bumps.config;

    Ok(())
}
