/// Ingest worker: poll the chain for arcadia_vault transactions, decode the
/// Anchor events they emit, and apply them to the DB.
///
/// This is the authoritative bridge from chain → DB. Every row here is keyed
/// on the real tx signature + slot, so replays are idempotent
/// (`ON CONFLICT DO NOTHING`) and the score engine reads chain-originated
/// flow/trade data.
///
/// Transport choice: JSON-RPC polling (`getSignaturesForAddress` +
/// `getTransaction`) against `SOLANA_RPC_URL`. This is the simplest production
/// path for an MVP — no geyser subscription, one RPC dependency already in the
/// workspace, resumes from a DB watermark. A geyser/gRPC stream can replace
/// the poll loop later without touching the projection layer.
use crate::WorkerCtx;
use anyhow::{anyhow, Context, Result};
use arcadia_core::events::ArcadiaEvent;
use arcadia_db::queries;
use reqwest::Client;
use rust_decimal::Decimal;
use serde_json::{json, Value};
use std::time::Duration;
use tokio::time::sleep;
use tracing::{error, warn};

/// Poll cadence. Trades happen via the execution pipeline; this worker just
/// needs to keep flow/equity fresh at sub-score-interval granularity.
const POLL_EVERY: Duration = Duration::from_secs(15);
/// Rows fetched per poll page.
const BATCH_SIZE: usize = 100;
/// JSON-RPC version header for all requests.
const RPC_VERSION: &str = "2.0";

pub async fn run(ctx: WorkerCtx) -> Result<()> {
    if ctx.cfg.rpc_url.is_empty() {
        warn!("ingest: SOLANA_RPC_URL not set; will retry");
    }

    let client = Client::new();

    loop {
        if let Err(e) = tick(&ctx, &client).await {
            error!("ingest worker tick error: {e:#}");
        }
        sleep(POLL_EVERY).await;
    }
}

async fn tick(ctx: &WorkerCtx, client: &Client) -> Result<()> {
    let mut cursor = queries::get_ingest_cursor(&ctx.db).await?;
    if cursor == 0 {
        // Start from "now" on first run — we don't want to backfill the
        // entire program history. Fresh deployments have no prior chain state.
        if let Some(slot) = rpc_get_slot(client, &ctx.cfg.rpc_url).await? {
            queries::set_ingest_cursor(&ctx.db, slot).await?;
            cursor = slot;
        }
    }

    // Fetch confirmed signatures for the program, newest-first, and process
    // every tx whose slot is above our watermark. `getSignaturesForAddress`
    // returns newest-first, so once we hit a slot ≤ cursor we can stop.
    let sigs = rpc_get_signatures_for_address(
        client,
        &ctx.cfg.rpc_url,
        &ctx.cfg.program_id,
        BATCH_SIZE,
    )
    .await?;

    let mut highest_slot = cursor;
    for (sig, slot) in sigs {
        if slot <= cursor {
            break; // everything after this is already ingested
        }
        if slot > highest_slot {
            highest_slot = slot;
        }
        let tx = rpc_get_transaction(client, &ctx.cfg.rpc_url, &sig).await;
        match tx {
            Ok(Some(logs)) => {
                if let Err(e) = apply_logs(ctx, &sig, slot, &logs).await {
                    warn!(sig = %sig, "apply failed: {e:#}");
                }
            }
            Ok(None) => {
                // transaction not finalized yet — skip; idempotent re-process
            }
            Err(e) => {
                warn!(sig = %sig, "getTransaction failed: {e:#}");
            }
        }
    }

    // Advance the watermark. Rows are idempotent (ON CONFLICT DO NOTHING), so
    // re-processing after a crash is safe.
    if highest_slot > cursor {
        queries::set_ingest_cursor(&ctx.db, highest_slot).await?;
    }
    Ok(())
}

/// Apply the decoded events from one transaction's logs to the DB.
async fn apply_logs(ctx: &WorkerCtx, sig: &str, slot: i64, logs: &[String]) -> Result<()> {
    for line in logs {
        let Some(event) = arcadia_decode::decode_log_line(line)? else {
            continue;
        };
        project_event(&ctx, sig, slot, event).await?;
    }
    Ok(())
}

/// Project one decoded on-chain event into the DB (real sig/slot provenance).
async fn project_event(ctx: &WorkerCtx, sig: &str, slot: i64, event: ArcadiaEvent) -> Result<()> {
    use arcadia_db::models::DbFlow;

    match event {
        ArcadiaEvent::ProfileInitialized(e) => {
            queries::upsert_trader_profile(&ctx.db, &e.profile, &e.trader, &e.trader, e.ts).await?;
        }
        ArcadiaEvent::InvestorInitialized(e) => {
            queries::upsert_investor_account(&ctx.db, &e.investor, e.ts).await?;
        }
        ArcadiaEvent::Deposited(e) => {
            queries::insert_flow(
                &ctx.db,
                &DbFlow {
                    signature: sig.to_string(),
                    event_index: 0,
                    slot,
                    profile: e.profile.clone(),
                    owner: e.depositor.clone(),
                    is_trader: e.is_trader,
                    kind: "deposit".into(),
                    amount_usd: e.amount_usd,
                    shares: e.shares_minted,
                    nav_per_share: e.nav_per_share,
                    ts: e.ts,
                },
            )
            .await?;
            queries::upsert_investor_position(
                &ctx.db,
                &e.depositor,
                &e.profile,
                e.shares_minted,
                e.amount_usd,
            )
            .await?;
        }
        ArcadiaEvent::Withdrawn(e) => {
            queries::insert_flow(
                &ctx.db,
                &DbFlow {
                    signature: sig.to_string(),
                    event_index: 0,
                    slot,
                    profile: e.profile.clone(),
                    owner: e.owner.clone(),
                    is_trader: false,
                    kind: "withdraw".into(),
                    amount_usd: e.amount_usd,
                    shares: e.shares_burned,
                    nav_per_share: e.nav_per_share,
                    ts: chrono::Utc::now(),
                },
            )
            .await?;
        }
        ArcadiaEvent::WithdrawRequested(e) => {
            queries::insert_flow(
                &ctx.db,
                &DbFlow {
                    signature: sig.to_string(),
                    event_index: 0,
                    slot,
                    profile: e.profile.clone(),
                    owner: e.owner.clone(),
                    is_trader: false,
                    kind: "withdraw_request".into(),
                    amount_usd: Decimal::ZERO,
                    shares: e.shares,
                    nav_per_share: e.nav_per_share,
                    ts: e.withdraw_ready_ts,
                },
            )
            .await?;
        }
        ArcadiaEvent::TradeClosed(e) => {
            queries::insert_trade(
                &ctx.db,
                &arcadia_db::models::DbTrade {
                    signature: sig.to_string(),
                    event_index: 0,
                    slot,
                    profile: e.profile.clone(),
                    trader: e.trader.clone(),
                    market: e.market,
                    direction: e.direction as i16,
                    size_usd: e.size_usd,
                    leverage_x: e.leverage_x,
                    entry_px: e.entry_px,
                    exit_px: e.exit_px,
                    realized_pnl: e.realized_pnl,
                    fees_usd: e.fees_usd,
                    was_liquidated: e.was_liquidated,
                    opened_at: e.opened_at,
                    closed_at: e.closed_at,
                },
            )
            .await?;
        }
        ArcadiaEvent::Settled(..)
        | ArcadiaEvent::ProfitWithdrawn(..) => {
            // Derived state — consumed by the score/withdraw workers.
        }
        ArcadiaEvent::ExecutionFunded(e) => {
            tracing::debug!(profile = %e.profile, "execution funding event (informational)");
        }
    }
    Ok(())
}

// ── JSON-RPC helpers ───────────────────────────────────────────────────────────

async fn rpc(client: &Client, url: &str, method: &str, params: Value) -> Result<Value> {
    let body = json!({
        "jsonrpc": RPC_VERSION,
        "id": 1,
        "method": method,
        "params": params,
    });
    let resp = client
        .post(url)
        .json(&body)
        .timeout(Duration::from_secs(30))
        .send()
        .await
        .context("rpc request failed")?;
    let v: Value = resp.json().await.context("rpc response decode failed")?;
    if let Some(err) = v.get("error") {
        return Err(anyhow!("rpc error: {err}"));
    }
    v.get("result")
        .cloned()
        .ok_or_else(|| anyhow!("rpc response missing result"))
}

async fn rpc_get_slot(client: &Client, url: &str) -> Result<Option<i64>> {
    let v = rpc(client, url, "getSlot", json!([])).await?;
    Ok(v.as_i64())
}

async fn rpc_get_signatures_for_address(
    client: &Client,
    url: &str,
    program_id: &str,
    limit: usize,
) -> Result<Vec<(String, i64)>> {
    let params = json!([program_id, { "limit": limit, "commitment": "confirmed" }]);
    let v = rpc(client, url, "getSignaturesForAddress", params).await?;
    let arr = v.as_array().cloned().unwrap_or_default();
    let mut out = Vec::with_capacity(arr.len());
    for item in arr {
        let sig = item["signature"].as_str().unwrap_or("").to_string();
        let slot = item["slot"].as_i64().unwrap_or(0);
        if !sig.is_empty() {
            out.push((sig, slot));
        }
    }
    Ok(out)
}

async fn rpc_get_transaction(
    client: &Client,
    url: &str,
    sig: &str,
) -> Result<Option<Vec<String>>> {
    let params = json!([sig, { "encoding": "json", "commitment": "confirmed" }]);
    let v = match rpc(client, url, "getTransaction", params).await {
        Ok(v) => v,
        Err(_) => return Ok(None), // not found / not confirmed yet
    };
    let logs = v["meta"]["logMessages"].as_array().map(|a| {
        a.iter()
            .filter_map(|l| l.as_str().map(String::from))
            .collect::<Vec<String>>()
    });
    Ok(logs)
}
