use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct PlatformConfig {
    pub admin: Pubkey,
    pub oracle_authority: Pubkey,
    pub treasury_token: Pubkey,
    pub base_mint: Pubkey,
    pub perf_fee_bps: u16,
    pub mgmt_fee_bps: u16,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct TraderProfile {
    pub trader: Pubkey,
    pub base_mint: Pubkey,
    pub vault_token: Pubkey,
    pub total_shares: u64,
    pub trader_shares: u64,
    pub hwm_per_share: u64,
    pub capacity_cap_usd: u64,
    pub trader_claimable: u64,
    pub last_settle_ts: i64,
    pub created_at: i64,
    pub status: u8,
    pub score_tier: u8,
    pub max_leverage: u8,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct InvestorAccount {
    pub owner: Pubkey,
    pub position_count: u32,
    pub total_deposited_usd: u64,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct InvestorPosition {
    pub owner: Pubkey,
    pub profile: Pubkey,
    pub shares: u64,
    pub cost_basis_usd: u64,
    pub pending_withdraw_shares: u64,
    pub withdraw_ready_ts: i64,
    pub deposited_at: i64,
    pub bump: u8,
}
