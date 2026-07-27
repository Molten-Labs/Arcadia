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

pub mod executor;

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
    /// Sidecar URL for FlashTrade SDK bridge.
    pub sidecar_url: String,
    /// Master password for execution wallet seed decryption.
    pub master_password: String,
    /// Admin keypair path for vault transaction signing.
    pub admin_keypair_path: String,
}

impl WorkerConfig {
    pub fn from_env() -> Self {
        Self {
            score_interval_secs:  std::env::var("SCORE_INTERVAL_SECS")
                .ok().and_then(|s| s.parse().ok()).unwrap_or(3600),
            price_interval_secs: std::env::var("PRICE_INTERVAL_SECS")
                .ok().and_then(|s| s.parse().ok()).unwrap_or(5),
            program_id: std::env::var("PROGRAM_ID")
                .unwrap_or_else(|_| "FPoAMRkM3kXfuvFn1iC2cM8B554KfnaPjibjLH31CHtd".into()),
            yellowstone_endpoint: std::env::var("YELLOWSTONE_ENDPOINT")
                .unwrap_or_else(|_| "https://grpc.your-provider.com".into()),
            yellowstone_token: std::env::var("YELLOWSTONE_TOKEN")
                .unwrap_or_default(),
            sidecar_url: std::env::var("SIDECAR_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3001".into()),
            master_password: std::env::var("AGENT_WALLET_MASTER_PASSWORD")
                .expect("AGENT_WALLET_MASTER_PASSWORD must be set"),
            admin_keypair_path: std::env::var("ADMIN_KEYPAIR_PATH")
                .unwrap_or_else(|_| "/run/secrets/admin_keypair.json".into()),
        }
    }
}
