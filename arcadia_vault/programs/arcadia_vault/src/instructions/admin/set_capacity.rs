use anchor_lang::prelude::*;

use crate::{
    is_valid_score_tier, ArcadiaError, PlatformConfig, TraderProfile, PROFILE_STATUS_ACTIVE,
};

#[derive(Accounts)]
pub struct SetCapacity<'info> {
    pub oracle_authority: Signer<'info>,
    #[account(has_one = oracle_authority)]
    pub config: Account<'info, PlatformConfig>,
    #[account(mut)]
    pub profile: Account<'info, TraderProfile>,
}

pub fn handler(ctx: Context<SetCapacity>, cap_usd: u64, score_tier: u8) -> Result<()> {
    require!(is_valid_score_tier(score_tier), ArcadiaError::InvalidTier);
    require!(
        ctx.accounts.profile.status == PROFILE_STATUS_ACTIVE,
        ArcadiaError::VaultNotActive
    );

    let profile = &mut ctx.accounts.profile;
    profile.capacity_cap_usd = cap_usd;
    profile.score_tier = score_tier;

    Ok(())
}
