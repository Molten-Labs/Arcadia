use anchor_lang::prelude::*;

use crate::{
    checked_sub_u64, nav_bearing_assets,
    token::{
        profile_signer_seeds, transfer_checked_accounts_with_signer, Mint, TokenAccount,
        TokenInterface,
    },
    ArcadiaError, ProfitWithdrawn, TraderProfile,
};

#[derive(Accounts)]
pub struct TraderWithdrawProfit<'info> {
    pub trader: Signer<'info>,
    #[account(mut, has_one = trader, has_one = base_mint, has_one = vault_token)]
    pub profile: Account<'info, TraderProfile>,
    pub base_mint: InterfaceAccount<'info, Mint>,
    #[account(
        mut,
        token::mint = base_mint,
        token::authority = profile,
        token::token_program = token_program,
        constraint = vault_token.key() != trader_token.key() @ ArcadiaError::TokenConservationFailed
    )]
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
    #[account(
        mut,
        token::mint = base_mint,
        token::authority = trader,
        token::token_program = token_program
    )]
    pub trader_token: InterfaceAccount<'info, TokenAccount>,
    pub token_program: Interface<'info, TokenInterface>,
}

pub fn handler(ctx: Context<TraderWithdrawProfit>, amount: u64) -> Result<()> {
    require!(amount > 0, ArcadiaError::ZeroAmount);
    require!(
        amount <= ctx.accounts.profile.trader_claimable,
        ArcadiaError::InsufficientClaimable
    );
    require!(
        amount <= ctx.accounts.vault_token.amount,
        ArcadiaError::InsufficientVaultLiquidity
    );

    let vault_balance_before = ctx.accounts.vault_token.amount;
    let trader_balance_before = ctx.accounts.trader_token.amount;
    let nav_before =
        nav_bearing_assets(vault_balance_before, ctx.accounts.profile.trader_claimable)?;

    ctx.accounts.profile.trader_claimable =
        checked_sub_u64(ctx.accounts.profile.trader_claimable, amount)?;

    let profile_bump = [ctx.accounts.profile.bump];
    let seeds = profile_signer_seeds(&ctx.accounts.profile.trader, &profile_bump);
    let signer_seeds = &[&seeds[..]];
    transfer_checked_accounts_with_signer(
        ctx.accounts.token_program.key(),
        ctx.accounts.vault_token.to_account_info(),
        ctx.accounts.base_mint.to_account_info(),
        ctx.accounts.trader_token.to_account_info(),
        ctx.accounts.profile.to_account_info(),
        amount,
        ctx.accounts.base_mint.decimals,
        signer_seeds,
    )?;

    ctx.accounts.vault_token.reload()?;
    ctx.accounts.trader_token.reload()?;

    let vault_delta = vault_balance_before
        .checked_sub(ctx.accounts.vault_token.amount)
        .ok_or(ArcadiaError::TokenConservationFailed)?;
    let trader_delta = ctx
        .accounts
        .trader_token
        .amount
        .checked_sub(trader_balance_before)
        .ok_or(ArcadiaError::TokenConservationFailed)?;
    require_eq!(vault_delta, amount, ArcadiaError::TokenConservationFailed);
    require_eq!(trader_delta, amount, ArcadiaError::TokenConservationFailed);

    let nav_after = nav_bearing_assets(
        ctx.accounts.vault_token.amount,
        ctx.accounts.profile.trader_claimable,
    )?;
    require_eq!(nav_after, nav_before, ArcadiaError::TokenConservationFailed);

    emit!(ProfitWithdrawn {
        profile: ctx.accounts.profile.key(),
        trader: ctx.accounts.profile.trader,
        amount_usd: amount,
    });

    Ok(())
}
