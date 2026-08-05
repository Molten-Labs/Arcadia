use anyhow::{Context, Result};
use std::time::Duration;
use tokio::time::sleep;

/// Configuration for the execution orchestrator.
#[derive(Clone, Debug)]
pub struct ExecutionConfig {
    pub rpc_url: String,
    pub master_password: String,
    pub sidecar_url: String,
    pub sidecar_token: String,
}

impl ExecutionConfig {
    pub fn from_env() -> Self {
        Self {
            rpc_url: std::env::var("SOLANA_RPC_URL")
                .unwrap_or_else(|_| "https://api.devnet.solana.com".into()),
            master_password: std::env::var("AGENT_WALLET_MASTER_PASSWORD")
                .unwrap_or_default(),
            sidecar_url: std::env::var("SIDECAR_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3001".into()),
            sidecar_token: std::env::var("SIDECAR_TOKEN").unwrap_or_default(),
        }
    }
}

/// The supervised orchestrator loop.
///
/// For every ready execution wallet (status 0) it drives the full lifecycle:
/// ensure local-seed wallet → sidecar open → WS monitor → sidecar close →
/// record fill (append-only execution event + canonical trade). The on-chain
/// fund/sweep steps are gated behind a deployed program; until then they are
/// no-ops with a clear log.
pub async fn run(
    db: sqlx::PgPool,
    redis: redis::Client,
    cfg: ExecutionConfig,
) -> Result<()> {
    tracing::info!(sidecar = %cfg.sidecar_url, "execution orchestrator started");

    loop {
        if let Err(e) = tick(&db, &redis, &cfg).await {
            tracing::error!("orchestrator tick error: {e:#}");
        }
        sleep(Duration::from_secs(30)).await;
    }
}

async fn tick(
    db: &sqlx::PgPool,
    redis: &redis::Client,
    cfg: &ExecutionConfig,
) -> Result<()> {
    let ready = arcadia_db::queries::list_execution_wallets_by_status(db, 0).await?;

    for ew in &ready {
        tracing::info!(profile = %ew.profile, pubkey = %ew.pubkey, "processing ready wallet");
        if let Err(e) = process_one(db, redis, cfg, ew).await {
            tracing::error!(profile = %ew.profile, "lifecycle error: {e:#}");
        }
    }

    Ok(())
}

async fn process_one(
    db: &sqlx::PgPool,
    redis: &redis::Client,
    cfg: &ExecutionConfig,
    ew: &arcadia_db::models::DbExecutionWallet,
) -> Result<()> {
    // 1. Execution wallet identity: use the operator's local devnet keypair.
    //    (The seed stored for the profile is the local keypair seed.)
    let seed = crate::wallet::load_decrypted_seed(db, &ew.profile, &cfg.master_password)
        .await
        .with_context(|| format!("load seed for {}", ew.profile))?;
    let seed_b58 = bs58::encode(seed).into_string();

    // 2. Funding (on-chain vault -> execution wallet ATA) is gated on a
    //    deployed program. Until then the execution wallet is self-funded
    //    on devnet and this step is a no-op.
    tracing::info!(profile = %ew.profile, "fund_execution: deferred until program deploy");

    // 3. Open a position via the sidecar.
    let market = std::env::var("EXECUTION_MARKET").unwrap_or_else(|_| "XAU/USD".into());
    let direction = std::env::var("EXECUTION_DIRECTION").unwrap_or_else(|_| "long".into());
    let amount = std::env::var("EXECUTION_AMOUNT").unwrap_or_else(|_| "10".into());

    let open_body = serde_json::json!({
        "seedBase58": seed_b58,
        "market": market,
        "direction": direction,
        "amount": amount,
    });
    let client = reqwest::Client::new();
    let open_resp: Value = client
        .post(format!("{}/trade/open", cfg.sidecar_url))
        .bearer_auth(&cfg.sidecar_token)
        .json(&open_body)
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .context("sidecar /trade/open failed")?
        .json()
        .await?;
    if open_resp.get("error").is_some() {
        anyhow::bail!("sidecar open error: {}", open_resp["error"]);
    }
    let open_sig = open_resp["signature"].as_str().unwrap_or("").to_string();
    let venue_position_key = open_resp["venuePositionKey"].as_str().unwrap_or("").to_string();
    tracing::info!(profile = %ew.profile, %open_sig, %venue_position_key, "position opened");

    // 4. Monitor via FlashTrade WS -> Redis (position state at ~1s).
    let redis_client = redis.clone();
    let owner = ew.pubkey.clone();
    tokio::spawn(async move {
        if let Err(e) = crate::flash_ws::stream_position(&redis_client, &owner, 1_000).await {
            tracing::error!(owner = %owner, "WS monitor ended: {e:#}");
        }
    });

    // 5. Hold, then close.
    let hold_secs = std::env::var("EXECUTION_HOLD_SECS")
        .ok().and_then(|s| s.parse().ok()).unwrap_or(60);
    sleep(Duration::from_secs(hold_secs)).await;

    let close_resp: Value = client
        .post(format!("{}/trade/close", cfg.sidecar_url))
        .bearer_auth(&cfg.sidecar_token)
        .json(&serde_json::json!({
            "seedBase58": seed_b58,
            "market": market,
            "direction": direction,
        }))
        .timeout(Duration::from_secs(120))
        .send()
        .await
        .context("sidecar /trade/close failed")?
        .json()
        .await?;
    if close_resp.get("error").is_some() {
        anyhow::bail!("sidecar close error: {}", close_resp["error"]);
    }
    let close_sig = close_resp["signature"].as_str().unwrap_or("").to_string();
    let position = close_resp["position"].clone();

    // 6. Normalize the close snapshot into a canonical fill and record it.
    let metrics = position_metrics_from_json(&position);
    let profile_row = arcadia_db::queries::get_trader_by_profile(db, &ew.profile).await?;
    let trader = profile_row.map(|p| p.trader).unwrap_or_else(|| ew.pubkey.clone());

    let closed_at = chrono::Utc::now();
    let opened_at = closed_at - chrono::Duration::seconds(hold_secs as i64);

    let close = crate::fills::RawClose::from_position(
        &ew.profile,
        &trader,
        "flashtrade",
        &ew.pubkey,
        &venue_position_key,
        &close_sig,
        &market,
        0, // direction long
        opened_at,
        closed_at,
        0,
        &metrics,
    )?;
    crate::fills::record(db, &close).await?;

    // 7. Sweep (on-chain) deferred until program deploy.
    tracing::info!(profile = %ew.profile, "sweep: deferred until program deploy");

    // 8. Mark the wallet processed (status 2 = closed/recorded).
    arcadia_db::queries::update_execution_wallet_status(db, &ew.profile, 2).await?;
    tracing::info!(profile = %ew.profile, "execution lifecycle complete");

    Ok(())
}

fn position_metrics_from_json(v: &serde_json::Value) -> crate::flash_ws::PositionMetrics {
    crate::flash_ws::PositionMetrics {
        market_symbol: v["marketSymbol"].as_str().map(String::from),
        side_ui: v["sideUi"].as_str().map(String::from),
        entry_price_ui: v["entryPriceUi"].as_str().map(String::from),
        exit_price_ui: v["exitPriceUi"].as_str().map(String::from),
        size_amount_ui: v["sizeAmountUi"].as_str().map(String::from),
        size_usd_ui: v["sizeUsdUi"].as_str().map(String::from),
        collateral_amount_ui: v["collateralUsdUi"].as_str().map(String::from),
        pnl_with_fee_usd_ui: v["pnlWithFeeUsdUi"].as_str().map(String::from),
        pnl_percentage_with_fee: v["pnlPercentageWithFee"].as_str().map(String::from),
        leverage_ui: v["leverageUi"].as_str().map(String::from),
        liquidation_price_ui: v["liquidationPriceUi"].as_str().map(String::from),
    }
}

use serde_json::Value;
