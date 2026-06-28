use anchor_lang::prelude::*;

use crate::{InvestorAccount, InvestorInitialized, INVESTOR_SEED};

#[derive(Accounts)]
pub struct InitializeInvestor<'info> {
    #[account(mut)]
    pub wallet: Signer<'info>,
    #[account(
        init,
        payer = wallet,
        space = 8 + InvestorAccount::INIT_SPACE,
        seeds = [INVESTOR_SEED, wallet.key().as_ref()],
        bump
    )]
    pub investor_account: Account<'info, InvestorAccount>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeInvestor>) -> Result<()> {
    let now = Clock::get()?.unix_timestamp;
    let investor_account = &mut ctx.accounts.investor_account;
    investor_account.owner = ctx.accounts.wallet.key();
    investor_account.position_count = 0;
    investor_account.total_deposited_usd = 0;
    investor_account.created_at = now;
    investor_account.bump = ctx.bumps.investor_account;

    emit!(InvestorInitialized {
        investor: investor_account.key(),
        ts: now,
    });

    Ok(())
}
