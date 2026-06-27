/// arcadia-server — Arcadia indexer / backend.
///
/// Five supervised tasks run in parallel:
///   A) ingest   — Yellowstone gRPC → decode events → Postgres (stub by default)
///   B) score    — hourly: TWR + metrics + score + snapshot
///   C) price    — refresh price cache in Redis
///   D) oracle   — (embedded in score worker for capacity push)
///   E) api      — Axum HTTP server on $PORT
///
/// Feature flags:
///   --features solana   → enable live set_capacity / record_trade signing
///   --features grpc     → enable Yellowstone gRPC event ingestion
///   --features full     → enable both
use anyhow::Result;
use arcadia_api::build_router;
use arcadia_api::state::{ApiConfig, AppState};
use arcadia_workers::{supervisor::supervise, WorkerConfig, WorkerCtx};
use tracing_subscriber::{fmt, EnvFilter};

#[tokio::main]
async fn main() -> Result<()> {
    // ── Logging ───────────────────────────────────────────────────────────
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info,arcadia=debug"));
    fmt().with_env_filter(filter).json().init();

    // ── Environment ───────────────────────────────────────────────────────
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let redis_url =
        std::env::var("REDIS_URL").unwrap_or_else(|_| "redis://127.0.0.1:6379".into());
    let jwt_secret =
        std::env::var("JWT_SECRET").unwrap_or_else(|_| "change-me-in-production".into());
    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8080);

    // ── Database pool + migrations ────────────────────────────────────────
    tracing::info!("connecting to Postgres…");
    let db = arcadia_db::connect(&database_url).await?;
    tracing::info!("migrations applied");

    // ── Redis client ──────────────────────────────────────────────────────
    let redis = redis::Client::open(redis_url.as_str())?;

    // ── Shared context ────────────────────────────────────────────────────
    let worker_cfg = WorkerConfig::from_env();
    let worker_ctx = WorkerCtx {
        db: db.clone(),
        redis: redis.clone(),
        cfg: worker_cfg,
    };

    let api_state = AppState {
        db,
        redis,
        jwt_secret,
        cfg: ApiConfig::from_env(),
    };

    // ── Workers ───────────────────────────────────────────────────────────
    let wctx_ingest = worker_ctx.clone();
    let wctx_score = worker_ctx.clone();
    let wctx_price = worker_ctx.clone();

    let ingest_task = tokio::spawn(async move {
        supervise("ingest", move || {
            let c = wctx_ingest.clone();
            async move { arcadia_workers::ingest::run(c).await }
        })
        .await;
    });

    let score_task = tokio::spawn(async move {
        supervise("score", move || {
            let c = wctx_score.clone();
            async move { arcadia_workers::score::run(c).await }
        })
        .await;
    });

    let price_task = tokio::spawn(async move {
        supervise("price", move || {
            let c = wctx_price.clone();
            async move { arcadia_workers::price::run(c).await }
        })
        .await;
    });

    // ── Axum HTTP server ──────────────────────────────────────────────────
    let addr = std::net::SocketAddr::from(([0, 0, 0, 0], port));
    let listener = tokio::net::TcpListener::bind(addr).await?;
    tracing::info!(port, "arcadia-server listening");

    let app = build_router(api_state);

    let api_task = tokio::spawn(async move {
        // Use the re-exported serve from the API crate (which already depends on axum)
        arcadia_api::serve(listener, app).await.expect("server failed");
    });

    // Wait for any task to finish (they shouldn't unless there's a fatal error)
    tokio::select! {
        _ = ingest_task => tracing::error!("ingest supervisor exited"),
        _ = score_task  => tracing::error!("score supervisor exited"),
        _ = price_task  => tracing::error!("price supervisor exited"),
        _ = api_task    => tracing::error!("api task exited"),
    }

    Ok(())
}
