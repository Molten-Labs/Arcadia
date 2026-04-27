use axum::{
    extract::{Extension, Json},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{postgres::PgPoolOptions, PgPool};
use std::{env, net::SocketAddr, sync::Arc};
use thiserror::Error;
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info};
use tracing_subscriber::{fmt, EnvFilter};

#[derive(Debug, Serialize, Deserialize)]
struct HealthResponse {
    status: &'static str,
}

/// Simple application state shared across handlers.
#[derive(Clone)]
struct AppState {
    db: PgPool,
}

#[derive(Error, Debug)]
enum AppError {
    #[error("database error: {0}")]
    Db(#[from] sqlx::Error),
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, body) = match &self {
            AppError::Db(e) => {
                error!("database error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "database error".to_string(),
                )
            }
        };
        (status, body).into_response()
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize logging
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_span_events(fmt::format::FmtSpan::CLOSE)
        .init();

    // Load .env (optional)
    let _ = dotenvy::dotenv();

    // Read configuration from environment
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost/kiln".to_string());
    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8080);
    let helius_api_key = env::var("HELIUS_API_KEY").ok();

    info!(
        "starting server; connecting to database: {}",
        mask_db_url(&database_url)
    );

    // Create database pool
    let db = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;

    // Ensure a simple events table exists (best-effort)
    if let Err(e) = ensure_events_table(&db).await {
        error!("failed to ensure events table exists: {:?}", e);
    }

    if helius_api_key.is_none() {
        info!("HELIUS_API_KEY not set; webhook receiver will still accept payloads");
    }

    let shared = Arc::new(AppState { db });

    // Build routes
    let cors = CorsLayer::new().allow_origin(Any).allow_methods(Any);
    let app = Router::new()
        .route("/health", get(health_handler))
        .route("/webhook", post(webhook_handler))
        .layer(cors)
        .layer(Extension(shared));

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn health_handler() -> impl IntoResponse {
    let body = HealthResponse { status: "ok" };
    (StatusCode::OK, Json(body))
}

/// Receives Helius (or other) webhooks. Stores a JSON blob into Postgres `events` table.
///
/// Expected JSON body: arbitrary. We try to extract a `kind` field if present, else NULL.
async fn webhook_handler(
    Extension(state): Extension<Arc<AppState>>,
    Json(payload): Json<Value>,
) -> Result<impl IntoResponse, AppError> {
    // Try to normalize into our WebhookPayload if possible
    let kind = payload
        .get("kind")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // store payload in DB
    let payload_json = payload;

    let query = r#"
        INSERT INTO events (kind, payload)
        VALUES ($1, $2)
    "#;

    // Use `payload_json` directly as JSON; sqlx will encode serde_json::Value -> jsonb
    sqlx::query(query)
        .bind(&kind)
        .bind(payload_json)
        .execute(&state.db)
        .await
        .map_err(AppError::Db)?;

    info!("webhook received and stored (kind={:?})", kind);

    Ok((StatusCode::OK, "ok"))
}

/// Ensure a minimal `events` table exists. This is a convenience for dev setups.
/// In production you should manage migrations properly.
async fn ensure_events_table(db: &PgPool) -> Result<(), sqlx::Error> {
    let create = r#"
    CREATE TABLE IF NOT EXISTS events (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        kind TEXT,
        payload JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    "#;
    // Try `gen_random_uuid()` (pgcrypto/pg or pg extension) — if absent fallback to uuid_generate_v4 check.
    // This create statement will work if pg has `pgcrypto` or `pg_uuid` extensions; it's best-effort.
    sqlx::query(create).execute(db).await?;
    Ok(())
}

/// Simple Ctrl+C shutdown
async fn shutdown_signal() {
    // Wait for the CTRL+C signal
    let _ = tokio::signal::ctrl_c().await;
    info!("shutdown signal received, terminating");
}

/// Mask sensitive parts of DB URL for logging
fn mask_db_url(url: &str) -> String {
    // naive mask: remove user:pass@ if present
    if let Some(at_idx) = url.find('@') {
        if let Some(slash_idx) = url.find("//") {
            let prefix = &url[..slash_idx + 2];
            let suffix = &url[at_idx + 1..];
            return format!("{}***@{}", prefix, suffix);
        }
        return "***@".to_string() + &url[at_idx + 1..];
    }
    url.to_string()
}
