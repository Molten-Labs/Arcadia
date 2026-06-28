use anchor_lang::prelude::*;

#[event]
pub struct ProfileInitialized {
    pub profile: Pubkey,
    pub trader: Pubkey,
    pub ts: i64,
}

#[event]
pub struct InvestorInitialized {
    pub investor: Pubkey,
    pub ts: i64,
}

#[event]
pub struct Deposited {
    pub profile: Pubkey,
    pub depositor: Pubkey,
    pub is_trader: bool,
    pub amount_usd: u64,
    pub shares_minted: u64,
    pub ts: i64,
}

#[event]
pub struct WithdrawRequested {
    pub profile: Pubkey,
    pub owner: Pubkey,
    pub shares: u64,
    pub withdraw_ready_ts: i64,
}

#[event]
pub struct Withdrawn {
    pub profile: Pubkey,
    pub owner: Pubkey,
    pub shares_burned: u64,
    pub amount_usd: u64,
}

#[event]
pub struct TradeClosed {
    pub profile: Pubkey,
    pub trader: Pubkey,
    pub market: String,
    pub direction: u8,
    pub size_usd: u64,
    pub leverage_x100: u16,
    pub entry_px: u64,
    pub exit_px: u64,
    pub realized_pnl: i64,
    pub fees_usd: u64,
    pub was_liquidated: bool,
    pub opened_at: i64,
    pub closed_at: i64,
}

#[event]
pub struct Settled {
    pub profile: Pubkey,
    pub profit_usd: u64,
    pub trader_cut: u64,
    pub platform_cut: u64,
    pub hwm_per_share: u64,
}

#[event]
pub struct ProfitWithdrawn {
    pub profile: Pubkey,
    pub trader: Pubkey,
    pub amount_usd: u64,
}
