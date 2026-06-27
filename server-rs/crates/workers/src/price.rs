/// Price worker: refreshes all market prices in Redis every N seconds.
use crate::WorkerCtx;
use anyhow::Result;
use arcadia_prices::{cache_prices, fetch_all_prices, PriceConfig};
use tokio::time::{sleep, Duration};
use tracing::{error, info};

pub async fn run(ctx: WorkerCtx) -> Result<()> {
    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()?;
    let price_cfg = PriceConfig::from_env();

    loop {
        match refresh(&ctx, &http, &price_cfg).await {
            Ok(n)  => info!(markets = n, "prices refreshed"),
            Err(e) => error!("price refresh error: {e:#}"),
        }
        sleep(Duration::from_secs(ctx.cfg.price_interval_secs)).await;
    }
}

async fn refresh(
    ctx: &WorkerCtx,
    http: &reqwest::Client,
    cfg: &PriceConfig,
) -> Result<usize> {
    let prices = fetch_all_prices(http, cfg).await;
    let n = prices.len();

    let mut conn = ctx.redis
        .get_multiplexed_tokio_connection()
        .await?;

    cache_prices(&mut conn, &prices, cfg.cache_ttl_secs).await?;
    Ok(n)
}
