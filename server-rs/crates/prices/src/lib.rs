/// Price feed client (Pyth Hermes / REST fallback).
///
/// Prices are cached in Redis with a short TTL. The oracle signer and the
/// GET /v1/prices endpoint both read from this cache.
use anyhow::Result;
use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ── Domain types ─────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketPrice {
    pub market:     String,
    pub price:      Decimal,
    pub publish_ts: DateTime<Utc>,
}

impl MarketPrice {
    /// USDC minor-unit representation of the price (6 decimals).
    /// Used as the fixed-scale u64 in the on-chain program.
    pub fn scaled_u64(&self) -> u64 {
        let minor = self.price * Decimal::new(1_000_000, 0);
        minor.floor().to_string().parse::<u64>().unwrap_or(0)
    }

    /// True if the price is stale (older than `max_age_secs`).
    pub fn is_stale(&self, max_age_secs: i64) -> bool {
        let age = Utc::now().signed_duration_since(self.publish_ts).num_seconds();
        age > max_age_secs
    }
}

// ── Config ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub struct PriceConfig {
    /// Pyth Hermes REST endpoint, e.g. "https://hermes.pyth.network"
    pub pyth_url: String,
    /// Maximum price age in seconds before refusing to sign.
    pub max_age_secs: i64,
    /// Redis cache TTL for prices.
    pub cache_ttl_secs: u64,
}

impl PriceConfig {
    pub fn from_env() -> Self {
        Self {
            pyth_url: std::env::var("PYTH_URL")
                .unwrap_or_else(|_| "https://hermes.pyth.network".into()),
            max_age_secs:   std::env::var("PRICE_MAX_AGE_SECS")
                .ok().and_then(|s| s.parse().ok()).unwrap_or(10),
            cache_ttl_secs: std::env::var("PRICE_CACHE_TTL_SECS")
                .ok().and_then(|s| s.parse().ok()).unwrap_or(5),
        }
    }
}

// ── Pyth price IDs for devnet ─────────────────────────────────────────────────

pub fn pyth_price_id(market: &str) -> Option<&'static str> {
    match market {
        "SOL-PERP" | "SOL/USD" =>
            Some("0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d"),
        "BTC-PERP" | "BTC/USD" =>
            Some("0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43"),
        "ETH-PERP" | "ETH/USD" =>
            Some("0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace"),
        _ => None,
    }
}

/// All markets supported for simulated trading.
pub const SUPPORTED_MARKETS: &[&str] = &["SOL-PERP", "BTC-PERP", "ETH-PERP"];

// ── Price fetching ────────────────────────────────────────────────────────────

/// Fetch the current price for a market from Pyth Hermes.
pub async fn fetch_price(
    client: &reqwest::Client,
    cfg: &PriceConfig,
    market: &str,
) -> Result<MarketPrice> {
    let price_id = pyth_price_id(market)
        .ok_or_else(|| anyhow::anyhow!("unknown market: {market}"))?;

    let url = format!("{}/api/latest_price_feeds?ids[]={price_id}", cfg.pyth_url);

    #[derive(Deserialize)]
    struct PythResponse {
        id:   String,
        price: PythPrice,
    }
    #[derive(Deserialize)]
    struct PythPrice {
        price: String,
        expo:  i32,
        publish_time: i64,
    }

    let resp: Vec<PythResponse> = client
        .get(&url)
        .send()
        .await?
        .json()
        .await?;

    let feed = resp.into_iter().next()
        .ok_or_else(|| anyhow::anyhow!("no price feed returned for {market}"))?;

    let mantissa: i64 = feed.price.price.parse()
        .map_err(|e| anyhow::anyhow!("parse price mantissa: {e}"))?;
    let expo = feed.price.expo; // typically negative, e.g. -8
    let price = Decimal::new(mantissa, (-expo) as u32);
    let publish_ts = DateTime::from_timestamp(feed.price.publish_time, 0)
        .unwrap_or_else(Utc::now);

    Ok(MarketPrice { market: market.to_string(), price, publish_ts })
}

/// Fetch all supported market prices.
pub async fn fetch_all_prices(
    client: &reqwest::Client,
    cfg: &PriceConfig,
) -> HashMap<String, MarketPrice> {
    let mut map = HashMap::new();
    for market in SUPPORTED_MARKETS {
        match fetch_price(client, cfg, market).await {
            Ok(p) => { map.insert(market.to_string(), p); }
            Err(e) => {
                tracing::warn!(market, "price fetch failed: {e}");
            }
        }
    }
    map
}

// ── Redis cache ───────────────────────────────────────────────────────────────

const PRICE_CACHE_KEY: &str = "arcadia:prices";

pub async fn cache_prices(
    rds: &mut redis::aio::MultiplexedConnection,
    prices: &HashMap<String, MarketPrice>,
    ttl: u64,
) -> Result<()> {
    use redis::AsyncCommands;
    let json = serde_json::to_string(prices)?;
    rds.set_ex::<_, _, ()>(PRICE_CACHE_KEY, json, ttl).await?;
    Ok(())
}

pub async fn get_cached_prices(
    rds: &mut redis::aio::MultiplexedConnection,
) -> Result<Option<HashMap<String, MarketPrice>>> {
    use redis::AsyncCommands;
    let raw: Option<String> = rds.get(PRICE_CACHE_KEY).await?;
    Ok(raw.as_deref().map(serde_json::from_str).transpose()?)
}
