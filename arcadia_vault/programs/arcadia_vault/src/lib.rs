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
pub(crate) use instructions::initialize_smoke::__client_accounts_initialize_smoke;
pub(crate) use instructions::ping::__client_accounts_ping;

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

    pub fn initialize_smoke(ctx: Context<InitializeSmoke>, message: String) -> Result<()> {
        instructions::initialize_smoke::handler(ctx, message)
    }

    pub fn ping(ctx: Context<Ping>, message: String) -> Result<()> {
        instructions::ping::handler(ctx, message)
    }
}
