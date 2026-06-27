/// Score worker: runs every N hours, computes TWR + metrics + score for each
/// active trader, writes a score_snapshot, then triggers the capacity worker.
use crate::WorkerCtx;
use anyhow::Result;
use arcadia_db::queries;
use arcadia_scoring::{metrics, score, capacity};
use arcadia_db::models::DbScoreSnapshot;
use chrono::Utc;
use rust_decimal::Decimal;
use tokio::time::{sleep, Duration};
use tracing::{error, info};

pub async fn run(ctx: WorkerCtx) -> Result<()> {
    loop {
        if let Err(e) = tick(&ctx).await {
            error!("score worker tick error: {e:#}");
        }
        sleep(Duration::from_secs(ctx.cfg.score_interval_secs)).await;
    }
}

async fn tick(ctx: &WorkerCtx) -> Result<()> {
    let traders = queries::list_traders(&ctx.db).await?;
    info!(count = traders.len(), "score worker: processing traders");

    for trader in &traders {
        if let Err(e) = score_one(ctx, &trader.profile).await {
            error!(profile = trader.profile, "scoring failed: {e:#}");
        }
    }
    Ok(())
}

async fn score_one(ctx: &WorkerCtx, profile: &str) -> Result<()> {
    // 1. Fetch equity curve and all trades from DB
    let curve  = queries::get_equity_curve(&ctx.db, profile).await?;
    let trades = queries::get_vault_trades(&ctx.db, profile, 10_000, None).await?;

    if curve.len() < 2 || trades.is_empty() {
        tracing::debug!(profile, "not enough data for scoring — skipping");
        return Ok(());
    }

    // 2. Convert DB rows to scoring-engine types
    let equity_pairs: Vec<(chrono::NaiveDate, Decimal)> =
        curve.iter().map(|ep| (ep.day, ep.twr_nav)).collect();

    let core_trades: Vec<arcadia_core::types::Trade> = trades.iter().map(|t| {
        arcadia_core::types::Trade {
            signature:     t.signature.clone(),
            event_index:   t.event_index,
            slot:          t.slot,
            profile:       t.profile.clone(),
            trader:        t.trader.clone(),
            market:        t.market.clone(),
            direction:     t.direction,
            size_usd:      t.size_usd,
            leverage_x:    t.leverage_x,
            entry_px:      t.entry_px,
            exit_px:       t.exit_px,
            realized_pnl:  t.realized_pnl,
            fees_usd:      t.fees_usd,
            was_liquidated: t.was_liquidated,
            opened_at:     t.opened_at,
            closed_at:     t.closed_at,
        }
    }).collect();

    // 3. Run the scoring engine
    let m = metrics::compute(&equity_pairs, &core_trades);
    let s = score::compute(&m, core_trades.len() as u32);
    let c = capacity::compute(s.score);

    // 4. Determine tier string
    let tier = arcadia_core::ScoreTier::from_score(s.score)
        .map(|t| t.to_string());

    // 5. Write score_snapshot to DB
    let snap = DbScoreSnapshot {
        profile:        profile.to_string(),
        computed_at:    Utc::now(),
        score:          s.score as i32,
        tier,
        confidence:     Decimal::try_from(s.confidence).unwrap_or_default(),
        ci_low:         Decimal::try_from(s.ci_low).unwrap_or_default(),
        ci_high:        Decimal::try_from(s.ci_high).unwrap_or_default(),
        capacity_usd:   c.capacity_usd,
        sortino:        Decimal::try_from(m.sortino).unwrap_or_default(),
        calmar:         Decimal::try_from(m.calmar).unwrap_or_default(),
        max_dd:         Decimal::try_from(m.max_dd).unwrap_or_default(),
        ulcer:          Decimal::try_from(m.ulcer).unwrap_or_default(),
        liq_rate:       Decimal::try_from(m.liq_rate).unwrap_or_default(),
        pct_profitable: Decimal::try_from(m.pct_profitable).unwrap_or_default(),
        avg_leverage:   Decimal::try_from(m.avg_leverage).unwrap_or_default(),
        trade_count:    m.trade_count as i32,
        days_active:    m.days_active as i32,
    };

    queries::insert_score_snapshot(&ctx.db, &snap).await?;

    info!(
        profile,
        score = s.score,
        tier  = snap.tier.as_deref().unwrap_or("none"),
        cap   = %c.capacity_usd,
        "scored"
    );

    // 6. Push capacity onchain if in tier
    if s.score >= 600 {
        if let Err(e) = crate::oracle::push_capacity_onchain(ctx, profile, c.cap_u64, c.tier_u8).await {
            error!(profile, "capacity push failed: {e:#}");
        }
    }

    Ok(())
}
