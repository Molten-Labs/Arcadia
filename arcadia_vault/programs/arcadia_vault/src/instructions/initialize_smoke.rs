use anchor_lang::prelude::*;

use crate::{error::ErrorCode as ArcadiaError, SmokeState, MAX_SMOKE_MESSAGE_LEN, SMOKE_SEED};

#[derive(Accounts)]
pub struct InitializeSmoke<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + SmokeState::INIT_SPACE,
        seeds = [SMOKE_SEED, authority.key().as_ref()],
        bump
    )]
    pub smoke_state: Account<'info, SmokeState>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<InitializeSmoke>, message: String) -> Result<()> {
    require!(
        message.len() <= MAX_SMOKE_MESSAGE_LEN,
        ArcadiaError::SmokeMessageTooLong
    );

    let smoke_state = &mut ctx.accounts.smoke_state;
    smoke_state.authority = ctx.accounts.authority.key();
    smoke_state.count = 0;
    smoke_state.bump = ctx.bumps.smoke_state;
    smoke_state.message = message;

    msg!("Smoke state initialized");
    Ok(())
}
