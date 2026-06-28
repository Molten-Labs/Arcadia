pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod math;
pub mod smoke;
pub mod state;
pub mod token;

use anchor_lang::prelude::*;

pub use constants::*;
pub use error::*;
pub use events::*;
pub use instructions::*;
pub use math::*;
pub use smoke::*;
pub use state::*;
pub use token::*;

pub(crate) use instructions::admin::initialize_platform::__client_accounts_initialize_platform;
pub(crate) use instructions::admin::set_capacity::__client_accounts_set_capacity;
pub(crate) use instructions::deposit::__client_accounts_deposit;
pub(crate) use instructions::initialize_investor::__client_accounts_initialize_investor;
pub(crate) use instructions::initialize_profile::__client_accounts_initialize_profile;
pub(crate) use instructions::initialize_smoke::__client_accounts_initialize_smoke;
pub(crate) use instructions::ping::__client_accounts_ping;
pub(crate) use instructions::record_trade::__client_accounts_record_trade;
pub(crate) use instructions::settle::__client_accounts_settle;
pub(crate) use instructions::withdraw::__client_accounts_process_withdraw;
pub(crate) use instructions::withdraw::__client_accounts_request_withdraw;

declare_id!("gTHauBMdJHs45tc8tjCKL7MejvBECQHgD184io3hx1C");

#[program]
pub mod arcadia_vault {
    use super::*;

    pub fn initialize_platform(
        ctx: Context<InitializePlatform>,
        perf_fee_bps: u16,
        mgmt_fee_bps: u16,
        oracle_authority: Pubkey,
    ) -> Result<()> {
        instructions::admin::initialize_platform::handler(
            ctx,
            perf_fee_bps,
            mgmt_fee_bps,
            oracle_authority,
        )
    }

    pub fn initialize_profile(ctx: Context<InitializeProfile>, max_leverage: u8) -> Result<()> {
        instructions::initialize_profile::handler(ctx, max_leverage)
    }

    pub fn set_capacity(ctx: Context<SetCapacity>, cap_usd: u64, score_tier: u8) -> Result<()> {
        instructions::admin::set_capacity::handler(ctx, cap_usd, score_tier)
    }

    pub fn initialize_investor(ctx: Context<InitializeInvestor>) -> Result<()> {
        instructions::initialize_investor::handler(ctx)
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        instructions::deposit::handler(ctx, amount)
    }

    pub fn request_withdraw(ctx: Context<RequestWithdraw>, shares: u64) -> Result<()> {
        instructions::withdraw::request_withdraw_handler(ctx, shares)
    }

    pub fn process_withdraw(ctx: Context<ProcessWithdraw>) -> Result<()> {
        instructions::withdraw::process_withdraw_handler(ctx)
    }

    #[allow(clippy::too_many_arguments)]
    pub fn record_trade(
        ctx: Context<RecordTrade>,
        market: String,
        direction: u8,
        size_usd: u64,
        leverage_x100: u16,
        entry_px: u64,
        exit_px: u64,
        fees_usd: u64,
        was_liquidated: bool,
        opened_at: i64,
        closed_at: i64,
    ) -> Result<()> {
        instructions::record_trade::handler(
            ctx,
            market,
            direction,
            size_usd,
            leverage_x100,
            entry_px,
            exit_px,
            fees_usd,
            was_liquidated,
            opened_at,
            closed_at,
        )
    }

    pub fn settle(ctx: Context<Settle>) -> Result<()> {
        instructions::settle::handler(ctx)
    }

    pub fn initialize_smoke(ctx: Context<InitializeSmoke>, message: String) -> Result<()> {
        instructions::initialize_smoke::handler(ctx, message)
    }

    pub fn ping(ctx: Context<Ping>, message: String) -> Result<()> {
        instructions::ping::handler(ctx, message)
    }
}
