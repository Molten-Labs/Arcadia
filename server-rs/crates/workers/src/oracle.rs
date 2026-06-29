/// Oracle helpers: capacity DB update + oracle co-sign (record_trade).
///
/// For MVP devnet the set_capacity onchain push is skipped.
/// The score worker calls `update_capacity_in_db` to write the computed
/// capacity ceiling and deposits_open flag directly to Postgres.
/// The onchain capacity_usd field is updated lazily when the admin
/// chooses to push it; the API gate (deposits_open) is sufficient for now.
use crate::WorkerCtx;
use anyhow::Result;
use rust_decimal::Decimal;
use tracing::info;

/// Called by the score worker after each scoring run.
/// Writes capacity_cap_usd, score_tier, and deposits_open to the DB.
/// deposits_open is set to true when score >= 600.
pub async fn update_capacity_in_db(
    ctx: &WorkerCtx,
    profile: &str,
    capacity_usd: Decimal,
    score_tier: u8,
    deposits_open: bool,
) -> Result<()> {
    sqlx::query(
        "UPDATE trader_profile
         SET capacity_cap_usd = $1,
             score_tier       = $2,
             deposits_open    = $3,
             updated_at       = now()
         WHERE profile = $4",
    )
    .bind(capacity_usd)
    .bind(score_tier as i16)
    .bind(deposits_open)
    .bind(profile)
    .execute(&ctx.db)
    .await?;

    info!(
        profile,
        %capacity_usd,
        score_tier,
        deposits_open,
        "capacity updated in DB"
    );
    Ok(())
}
