use anchor_lang::prelude::*;

use crate::{error::ErrorCode as ArcadiaError, SmokeState, MAX_SMOKE_MESSAGE_LEN, SMOKE_SEED};

#[derive(Accounts)]
pub struct Ping<'info> {
    pub authority: Signer<'info>,
    #[account(
        mut,
        seeds = [SMOKE_SEED, authority.key().as_ref()],
        bump = smoke_state.bump,
        has_one = authority
    )]
    pub smoke_state: Account<'info, SmokeState>,
}

pub fn handler(ctx: Context<Ping>, message: String) -> Result<()> {
    require!(
        message.len() <= MAX_SMOKE_MESSAGE_LEN,
        ArcadiaError::SmokeMessageTooLong
    );

    let smoke_state = &mut ctx.accounts.smoke_state;
    smoke_state.count = smoke_state
        .count
        .checked_add(1)
        .ok_or(ArcadiaError::SmokeCounterOverflow)?;
    smoke_state.message = message;

    msg!("Smoke ping {}", smoke_state.count);
    Ok(())
}
