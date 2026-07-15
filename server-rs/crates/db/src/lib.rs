pub mod models;
pub mod queries;

use anyhow::Result;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

pub use models::*;
pub use queries::*;

pub async fn connect(database_url: &str) -> Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(20)
        .connect(database_url)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    seed_demo_trader(&pool).await?;

    Ok(pool)
}

async fn seed_demo_trader(pool: &PgPool) -> Result<()> {
    use chrono::Utc;
    use rust_decimal::Decimal;
    use rust_decimal::prelude::*;

    let count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM trader_profile"
    )
    .fetch_one(pool)
    .await?;

    if count.0 > 0 {
        return Ok(());
    }

    let now = Utc::now();

    sqlx::query(
        "INSERT INTO trader_profile (
            profile, trader, handle, status, score_tier,
            total_shares, trader_shares, nav_per_share, hwm_per_share,
            capacity_cap_usd, trader_claimable, max_leverage, aum_usd,
            trader_self_funded, deposits_open, investors_count,
            style_tags, initialized_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        ON CONFLICT (profile) DO NOTHING"
    )
    .bind("ArcVltDemoNovaXxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
    .bind("DemoNova11111111111111111111111111111111111")
    .bind("nova")
    .bind(1i16)
    .bind(3i16)
    .bind(Decimal::from(1000000u64))
    .bind(Decimal::from(50000u64))
    .bind(Decimal::from(1124000u64))
    .bind(Decimal::from(1124000u64))
    .bind(Decimal::from(912000u64))
    .bind(Decimal::from(0u64))
    .bind(Decimal::from(10u64))
    .bind(Decimal::from(387000u64))
    .bind(true)
    .bind(true)
    .bind(34i32)
    .bind(&["#momentum", "#SOL", "#scalp"] as &[&str])
    .bind(now)
    .bind(now)
    .execute(pool)
    .await?;

    let profiles = ["ArcVlt2VegaYxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
                    "ArcVlt5OrionVxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"];
    let handles = ["vega", "orion"];
    let traders = ["Vega11111111111111111111111111111111111111",
                   "Orion1111111111111111111111111111111111111"];
    let aums: [u64; 2] = [742000, 621000];

    for i in 0..2 {
        sqlx::query(
            "INSERT INTO trader_profile (
                profile, trader, handle, status, score_tier,
                total_shares, trader_shares, nav_per_share, hwm_per_share,
                capacity_cap_usd, trader_claimable, max_leverage, aum_usd,
                trader_self_funded, deposits_open, investors_count,
                style_tags, initialized_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            ON CONFLICT (profile) DO NOTHING"
        )
        .bind(profiles[i])
        .bind(traders[i])
        .bind(handles[i])
        .bind(1i16)
        .bind(2i16)
        .bind(Decimal::from(1000000u64))
        .bind(Decimal::from(50000u64))
        .bind(Decimal::from(1000000u64))
        .bind(Decimal::from(1000000u64))
        .bind(Decimal::from(aums[i]))
        .bind(Decimal::from(0u64))
        .bind(Decimal::from(5u64))
        .bind(Decimal::from(aums[i]))
        .bind(true)
        .bind(true)
        .bind((30 + i as i32 * 33) as i32)
        .bind([&["#swing", "#BTC"][i]].as_slice())
        .bind(now)
        .bind(now)
        .execute(pool)
        .await?;
    }

    sqlx::query(
        "INSERT INTO score_snapshot (
            profile, computed_at, score, tier, confidence,
            ci_low, ci_high, capacity_usd, sortino, calmar,
            max_dd, ulcer, liq_rate, pct_profitable,
            avg_leverage, trade_count, days_active
        )
        SELECT $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
        WHERE NOT EXISTS (SELECT 1 FROM score_snapshot WHERE profile = $1)"
    )
    .bind("ArcVltDemoNovaXxxxxxxxxxxxxxxxxxxxxxxxxxxxxx")
    .bind(now)
    .bind(912)
    .bind("Elite")
    .bind(Decimal::from_f64(0.92).unwrap())
    .bind(Decimal::from(895u64))
    .bind(Decimal::from(928u64))
    .bind(Decimal::from(912000u64))
    .bind(Decimal::from_f64(3.18).unwrap())
    .bind(Decimal::from_f64(2.87).unwrap())
    .bind(Decimal::from_f64(-8.4).unwrap())
    .bind(Decimal::from_f64(2.1).unwrap())
    .bind(Decimal::from_f64(0.03).unwrap())
    .bind(Decimal::from_f64(68.3).unwrap())
    .bind(Decimal::from_f64(4.2).unwrap())
    .bind(847)
    .bind(127)
    .execute(pool)
    .await?;

    tracing::info!("seeded demo trader profiles");

    Ok(())
}
