use anyhow::{Context, Result};
use futures_util::{SinkExt, StreamExt};
use serde_json::Value;
use std::time::Duration;
use tokio::time::sleep;
use tokio_tungstenite::{connect_async, tungstenite::Message};

/// Position metrics from the FlashTrade WebSocket.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct PositionMetrics {
    pub market_symbol: Option<String>,
    pub side_ui: Option<String>,
    pub entry_price_ui: Option<String>,
    pub size_amount_ui: Option<String>,
    pub size_usd_ui: Option<String>,
    pub collateral_amount_ui: Option<String>,
    pub pnl_with_fee_usd_ui: Option<String>,
    pub pnl_percentage_with_fee: Option<String>,
    pub leverage_ui: Option<String>,
    pub liquidation_price_ui: Option<String>,
}

/// Redis key prefix for live position data.
const POSITION_REDIS_KEY_PREFIX: &str = "arcadia:position:";

/// Connect to the FlashTrade WebSocket for a given owner wallet and stream
/// position metrics to Redis at ~1s intervals.
///
/// Returns when the connection drops or is closed; caller should restart via
/// the supervisor.
pub async fn stream_position(
    redis: &redis::Client,
    owner: &str,
    update_interval_ms: u64,
) -> Result<()> {
    let url = format!("wss://flashapi.trade/owner/{owner}/ws?updateIntervalMs={update_interval_ms}");
    tracing::info!(owner, url, "connecting to FlashTrade WS");

    let (ws_stream, _) = connect_async(&url)
        .await
        .context("FlashTrade WS connect failed")?;

    let (mut _write, mut read) = ws_stream.split();

    while let Some(msg) = read.next().await {
        let msg = msg.context("FlashTrade WS read error")?;
        match msg {
            Message::Text(text) => {
                if let Err(e) = handle_message(redis, owner, &text).await {
                    tracing::error!(owner, error = %e, "WS message handler error");
                }
            }
            Message::Ping(data) => {
                _write.send(Message::Pong(data)).await.ok();
            }
            Message::Close(_) => {
                tracing::info!(owner, "FlashTrade WS closed");
                break;
            }
            _ => {}
        }
    }

    Ok(())
}

async fn handle_message(redis: &redis::Client, owner: &str, text: &str) -> Result<()> {
    let msg: Value = serde_json::from_str(text).context("WS JSON parse failed")?;

    let msg_type = msg["type"]
        .as_str()
        .unwrap_or("unknown");

    let data = &msg["data"];

    // Extract position metrics — same structure for both "basket" and "metrics" types.
    let position_metrics = data.get("positionMetrics");

    if let Some(metrics) = position_metrics {
        let json_str = serde_json::to_string(metrics)?;
        let redis_key = format!("{POSITION_REDIS_KEY_PREFIX}{owner}");

        let mut conn = redis
            .get_multiplexed_tokio_connection()
            .await?;

        redis::Cmd::set_ex(&redis_key, json_str, 5)
            .query_async::<_, ()>(&mut conn)
            .await
            .context("Redis SETEX failed")?;
    }

    // Log basket snapshot once
    if msg_type == "basket" {
        let market_count = position_metrics
            .and_then(|pm| pm.as_object())
            .map(|o| o.len())
            .unwrap_or(0);
        tracing::info!(owner, market_count, "WS basket snapshot received");
    }

    Ok(())
}

/// Fetch the latest cached position metrics from Redis for an owner.
pub async fn get_cached_position(
    redis: &redis::Client,
    owner: &str,
) -> Result<Option<Value>> {
    let mut conn = redis
        .get_multiplexed_tokio_connection()
        .await?;

    let val: Option<String> = redis::Cmd::get(&format!("{POSITION_REDIS_KEY_PREFIX}{owner}"))
        .query_async(&mut conn)
        .await?;

    match val {
        Some(json) => Ok(Some(serde_json::from_str(&json)?)),
        None => Ok(None),
    }
}

/// Poll Redis until position metrics appear or timeout.
pub async fn wait_for_position(
    redis: &redis::Client,
    owner: &str,
    max_attempts: usize,
    delay_ms: u64,
) -> Result<Option<Value>> {
    for i in 0..max_attempts {
        if let Some(metrics) = get_cached_position(redis, owner).await? {
            return Ok(Some(metrics));
        }
        tracing::debug!(owner, attempt = i + 1, "waiting for position data");
        sleep(Duration::from_millis(delay_ms)).await;
    }
    Ok(None)
}
