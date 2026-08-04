use anchor_lang::prelude::*;

use crate::{
    nav_bearing_assets,
    token::{
        profile_signer_seeds, transfer_checked_accounts_with_signer, Mint, Token, TokenAccount,
    },
    ArcadiaError, ExecutionFunded, PlatformConfig, TraderProfile, PROFILE_STATUS_ACTIVE,
};

#[derive(Accounts)]
pub struct FundExecution<'info> {
    pub broadcaster: Signer<'info>,
    pub admin: Signer<'info>,
    #[account(has_one = admin, has_one = base_mint)]
    pub config: Account<'info, PlatformConfig>,
    #[account(
        mut,
        has_one = base_mint,
        has_one = vault_token,
        constraint = profile.status == PROFILE_STATUS_ACTIVE @ ArcadiaError::VaultNotActive
    )]
    pub profile: Account<'info, TraderProfile>,
    pub base_mint: Account<'info, Mint>,
    #[account(
        mut,
        token::mint = base_mint,
        token::authority = profile,
        token::token_program = token_program
    )]
    pub vault_token: Account<'info, TokenAccount>,
    /// CHECK: execution wallet ATA — validated by token program on transfer
    #[account(mut)]
    pub execution_wallet_ata: UncheckedAccount<'info>,
    pub token_program: Program<'info, Token>,
}

pub fn handler(ctx: Context<FundExecution>, amount: u64) -> Result<()> {
    require!(amount > 0, ArcadiaError::ZeroAmount);
    let fundable = nav_bearing_assets(
        ctx.accounts.vault_token.amount,
        ctx.accounts.profile.trader_claimable,
    )?;
    require!(amount <= fundable, ArcadiaError::InsufficientFunds);

    let vault_balance_before = ctx.accounts.vault_token.amount;

    let profile_bump = [ctx.accounts.profile.bump];
    let seeds = profile_signer_seeds(&ctx.accounts.profile.trader, &profile_bump);
    let signer_seeds = &[&seeds[..]];

    transfer_checked_accounts_with_signer(
        ctx.accounts.token_program.key(),
        ctx.accounts.vault_token.to_account_info(),
        ctx.accounts.base_mint.to_account_info(),
        ctx.accounts.execution_wallet_ata.to_account_info(),
        ctx.accounts.profile.to_account_info(),
        amount,
        ctx.accounts.base_mint.decimals,
        signer_seeds,
    )?;

    ctx.accounts.vault_token.reload()?;

    let vault_delta = vault_balance_before
        .checked_sub(ctx.accounts.vault_token.amount)
        .ok_or(ArcadiaError::TokenConservationFailed)?;
    require_eq!(vault_delta, amount, ArcadiaError::TokenConservationFailed);

    emit!(ExecutionFunded {
        profile: ctx.accounts.profile.key(),
        execution_wallet: ctx.accounts.execution_wallet_ata.key(),
        amount_usd: amount,
        ts: Clock::get()?.unix_timestamp,
    });

    Ok(())
}
