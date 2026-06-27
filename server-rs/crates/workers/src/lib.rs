/// Background workers:
///   A) Ingest worker  — Yellowstone gRPC → decode events → upsert DB
///   B) Score worker   — hourly: TWR curve + metrics + score + snapshot
///   C) Capacity worker — after each score snapshot: push set_capacity if changed
///   D) Oracle signer  — co-sign sim-trade record_trade with real prices
///   E) Price worker   — refresh price cache in Redis every N seconds
pub mod ingest;
pub mod oracle;
pub mod price;
pub mod score;
pub mod supervisor;

use anyhow::Result;
use sqlx::PgPool;

/// Shared worker context (subset of AppCtx without the HTTP server).
#[derive(Clone)]
pub struct WorkerCtx {
    pub db:    PgPool,
    pub redis: redis::Client,
    pub cfg:   WorkerConfig,
}

#[derive(Clone, Debug)]
pub struct WorkerConfig {
    /// How often the score worker runs (seconds).
    pub score_interval_secs: u64,
    /// How often the price worker refreshes (seconds).
    pub price_interval_secs: u64,
    /// Program ID to subscribe to via Yellowstone.
    pub program_id: String,
    /// Yellowstone gRPC endpoint (requires grpc feature).
    pub yellowstone_endpoint: String,
    /// Yellowstone auth token (requires grpc feature).
    pub yellowstone_token: String,
}

impl WorkerConfig {
    pub fn from_env() -> Self {
        Self {
            score_interval_secs:  std::env::var("SCORE_INTERVAL_SECS")
                .ok().and_then(|s| s.parse().ok()).unwrap_or(3600),
            price_interval_secs: std::env::var("PRICE_INTERVAL_SECS")
                .ok().and_then(|s| s.parse().ok()).unwrap_or(5),
            program_id: std::env::var("PROGRAM_ID")
                .unwrap_or_else(|_| "ArcadiaVau1tProgramId11111111111111111111111".into()),
            yellowstone_endpoint: std::env::var("YELLOWSTONE_ENDPOINT")
                .unwrap_or_else(|_| "https://grpc.your-provider.com".into()),
            yellowstone_token: std::env::var("YELLOWSTONE_TOKEN")
                .unwrap_or_default(),
        }
    }
}
