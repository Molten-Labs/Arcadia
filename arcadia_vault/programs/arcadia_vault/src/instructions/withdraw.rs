use anchor_lang::prelude::*;

use crate::{
    checked_add_u64, token::TokenAccount, withdrawal_ready_ts, ArcadiaError, InvestorPosition,
    TraderProfile, WithdrawRequested, POSITION_SEED,
};

#[derive(Accounts)]
pub struct RequestWithdraw<'info> {
    pub owner: Signer<'info>,
    #[account(
        has_one = vault_token,
        constraint = vault_token.mint == profile.base_mint @ ArcadiaError::Unauthorized
    )]
    pub profile: Account<'info, TraderProfile>,
    pub vault_token: InterfaceAccount<'info, TokenAccount>,
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
