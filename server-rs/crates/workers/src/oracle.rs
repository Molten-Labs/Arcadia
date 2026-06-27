/// Oracle signer: pushes set_capacity onchain + co-signs record_trade.
use crate::WorkerCtx;
use anyhow::Result;
use arcadia_chain::{push_set_capacity, OracleConfig};
use tracing::{info, warn};

/// Push the computed capacity ceiling to the program after a scoring run.
pub async fn push_capacity_onchain(
    ctx: &WorkerCtx,
    profile: &str,
    cap_u64: u64,
    tier_u8: u8,
) -> Result<()> {
    let oracle_cfg = OracleConfig::from_env()?;
    let result = push_set_capacity(&oracle_cfg, profile, cap_u64, tier_u8).await?;

    if result.confirmed {
        info!(profile, cap_u64, tier_u8, sig = result.signature, "set_capacity confirmed");
    } else {
        warn!(profile, "set_capacity stub — enable --features solana for live devnet");
    }

    // Record the computed capacity back on the trader_profile row
    sqlx::query(
        "UPDATE trader_profile SET capacity_cap_usd = $1, updated_at = now() WHERE profile = $2",
    )
    .bind(rust_decimal::Decimal::new(cap_u64 as i64, 6))
    .bind(profile)
    .execute(&ctx.db)
    .await?;

    Ok(())
}
