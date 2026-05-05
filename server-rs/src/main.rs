use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{postgres::PgPoolOptions, PgPool, Row};
use std::{
    collections::{HashMap, HashSet},
    env,
    net::SocketAddr,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};
use thiserror::Error;
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info};
use tracing_subscriber::{fmt, EnvFilter};

static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");

#[derive(Clone)]
struct AppState {
    store: Store,
    webhook_secret: Option<String>,
    jupiter_api_key: Option<String>,
    jupiter_swap_base_url: String,
}

#[derive(Clone)]
enum Store {
    Postgres(PgPool),
    #[allow(dead_code)]
    Memory(Arc<Mutex<MaterializedState>>),
}

#[derive(Default)]
struct MaterializedState {
    raw_events: Vec<Value>,
    raw_event_keys: HashSet<String>,
    nav_event_keys: HashSet<String>,
    trade_event_keys: HashSet<String>,
    status_event_keys: HashSet<String>,
    managers: HashMap<String, ManagerView>,
    vaults: HashMap<String, VaultView>,
    positions: HashMap<String, PositionView>,
    nav_points: Vec<NavPoint>,
    trades: Vec<TradeEvent>,
    status_events: Vec<StatusEvent>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HealthResponse {
    status: &'static str,
    database: &'static str,
    indexer: &'static str,
    last_ingested_at: Option<i64>,
    raw_events: i64,
    vaults: i64,
    managers: i64,
    positions: i64,
    nav_points: i64,
    trades: i64,
    status_events: i64,
}

#[derive(Debug, Default)]
struct HealthStats {
    last_ingested_at: Option<i64>,
    raw_events: i64,
    vaults: i64,
    managers: i64,
    positions: i64,
    nav_points: i64,
    trades: i64,
    status_events: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VaultView {
    id: String,
    name: String,
    config_pubkey: String,
    state_pubkey: String,
    treasury_pubkey: String,
    manager_pubkey: String,
    manager_profile_pubkey: String,
    status: String,
    tvl: f64,
    junior_capital: f64,
    senior_capital: f64,
    junior_shares_outstanding: f64,
    senior_shares_outstanding: f64,
    junior_health: f64,
    current_nav: f64,
    high_water_mark: f64,
    fee_bps: i32,
    max_slippage_bps: i32,
    created_at: i64,
    graduated_at: i64,
    paper_trade_count: i32,
    min_qualifying_trades: i32,
    rolling24h_loss_bps: i32,
    rolling7d_loss_bps: i32,
    trading_enabled: bool,
    instant_exit: bool,
    vault_index: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManagerView {
    pubkey: String,
    owner: String,
    total_vaults: i32,
    active_vaults: i32,
    total_junior_deposited: f64,
    created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ManagerDetail {
    #[serde(flatten)]
    manager: ManagerView,
    vaults: Vec<VaultView>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PositionView {
    pubkey: String,
    vault_config_pubkey: String,
    vault: Option<VaultView>,
    investor_pubkey: String,
    deposited_at: i64,
    senior_shares: f64,
    total_deposited: f64,
    alert_threshold_bps: i32,
    current_value: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct NavPoint {
    vault_config_pubkey: String,
    recorded_at: i64,
    nav: f64,
    junior_capital: f64,
    senior_capital: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct TradeEvent {
    vault_config_pubkey: String,
    occurred_at: i64,
    visibility_after: i64,
    is_public_visible: bool,
    side: String,
    size: f64,
    route: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StatusEvent {
    vault_config_pubkey: String,
    occurred_at: i64,
    status: String,
    reason: Option<String>,
}

#[derive(Debug, Serialize)]
struct Items<T> {
    items: Vec<T>,
}

#[derive(Error, Debug)]
enum AppError {
    #[error("database error: {0}")]
    Db(#[from] sqlx::Error),
    #[error("unauthorized webhook")]
    Unauthorized,
    #[error("not found")]
    NotFound,
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("upstream error: {0}")]
    Upstream(String),
    #[error("state lock poisoned")]
    StatePoisoned,
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, body): (StatusCode, String) = match &self {
            AppError::Db(e) => {
                error!("database error: {:?}", e);
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "database error".to_string(),
                )
            }
            AppError::Unauthorized => {
                (StatusCode::UNAUTHORIZED, "unauthorized webhook".to_string())
            }
            AppError::NotFound => (StatusCode::NOT_FOUND, "not found".to_string()),
            AppError::BadRequest(e) => (StatusCode::BAD_REQUEST, e.clone()),
            AppError::Upstream(e) => (StatusCode::BAD_GATEWAY, e.clone()),
            AppError::StatePoisoned => {
                (StatusCode::INTERNAL_SERVER_ERROR, "state error".to_string())
            }
        };
        (status, body).into_response()
    }
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));
    tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_span_events(fmt::format::FmtSpan::CLOSE)
        .init();

    let _ = dotenvy::dotenv();

    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@localhost/kiln".to_string());
    let port: u16 = env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(8080);
    let webhook_secret = env::var("HELIUS_WEBHOOK_SECRET").ok();
    let jupiter_api_key = env::var("JUPITER_API_KEY")
        .ok()
        .filter(|value| !value.is_empty());
    let jupiter_swap_base_url = env::var("JUPITER_SWAP_BASE_URL")
        .unwrap_or_else(|_| "https://api.jup.ag/swap/v1".to_string());

    info!(
        "starting server-rs; connecting to database: {}",
        mask_db_url(&database_url)
    );

    let db = PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await?;
    MIGRATOR.run(&db).await?;

    if webhook_secret.is_none() {
        info!("HELIUS_WEBHOOK_SECRET not set; webhook receiver accepts unsigned payloads");
    }

    let app = build_app(AppState {
        store: Store::Postgres(db),
        webhook_secret,
        jupiter_api_key,
        jupiter_swap_base_url,
    });

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!("listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

fn build_app(state: AppState) -> Router {
    let cors = CorsLayer::new().allow_origin(Any).allow_methods(Any);
    Router::new()
        .route("/health", get(health_handler))
        .route("/webhook", post(webhook_handler))
        .route("/vaults", get(list_vaults_handler))
        .route("/vaults/:config_address", get(get_vault_handler))
        .route(
            "/vaults/:config_address/nav-history",
            get(nav_history_handler),
        )
        .route("/vaults/:config_address/trades", get(trades_handler))
        .route("/managers", get(list_managers_handler))
        .route("/managers/:address", get(get_manager_handler))
        .route("/positions/:wallet", get(positions_handler))
        .route("/jupiter/quote", get(jupiter_quote_handler))
        .route(
            "/jupiter/swap-instructions",
            post(jupiter_swap_instructions_handler),
        )
        .layer(cors)
        .with_state(Arc::new(state))
}

async fn health_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<HealthResponse>, AppError> {
    let stats = state.health_stats().await?;
    Ok(Json(HealthResponse {
        status: "ok",
        database: state.store_name(),
        indexer: "materialized",
        last_ingested_at: stats.last_ingested_at,
        raw_events: stats.raw_events,
        vaults: stats.vaults,
        managers: stats.managers,
        positions: stats.positions,
        nav_points: stats.nav_points,
        trades: stats.trades,
        status_events: stats.status_events,
    }))
}

async fn webhook_handler(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Json(payload): Json<Value>,
) -> Result<impl IntoResponse, AppError> {
    state.verify_webhook(&headers)?;
    let kind = event_kind(&payload);
    state.record_webhook(kind, payload).await?;
    Ok((StatusCode::OK, Json(serde_json::json!({ "ok": true }))))
}

async fn list_vaults_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Items<VaultView>>, AppError> {
    Ok(Json(Items {
        items: state.list_vaults().await?,
    }))
}

async fn get_vault_handler(
    State(state): State<Arc<AppState>>,
    Path(config_address): Path<String>,
) -> Result<Json<VaultView>, AppError> {
    state
        .get_vault(&config_address)
        .await?
        .map(Json)
        .ok_or(AppError::NotFound)
}

async fn nav_history_handler(
    State(state): State<Arc<AppState>>,
    Path(config_address): Path<String>,
) -> Result<Json<Items<NavPoint>>, AppError> {
    Ok(Json(Items {
        items: state.nav_history(&config_address).await?,
    }))
}

async fn trades_handler(
    State(state): State<Arc<AppState>>,
    Path(config_address): Path<String>,
) -> Result<Json<Items<TradeEvent>>, AppError> {
    Ok(Json(Items {
        items: state.public_trades(&config_address).await?,
    }))
}

async fn list_managers_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Items<ManagerView>>, AppError> {
    Ok(Json(Items {
        items: state.list_managers().await?,
    }))
}

async fn get_manager_handler(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> Result<Json<ManagerDetail>, AppError> {
    state
        .get_manager(&address)
        .await?
        .map(Json)
        .ok_or(AppError::NotFound)
}

async fn positions_handler(
    State(state): State<Arc<AppState>>,
    Path(wallet): Path<String>,
) -> Result<Json<Items<PositionView>>, AppError> {
    Ok(Json(Items {
        items: state.positions(&wallet).await?,
    }))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JupiterQuoteQuery {
    #[serde(default = "default_cluster")]
    cluster: String,
    input_mint: String,
    output_mint: String,
    amount: String,
    #[serde(default = "default_slippage_bps")]
    slippage_bps: u16,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct JupiterSwapInstructionsRequest {
    #[serde(default = "default_cluster")]
    cluster: String,
    user_public_key: String,
    quote_response: Value,
    #[serde(default)]
    wrap_and_unwrap_sol: bool,
    destination_token_account: Option<String>,
}

async fn jupiter_quote_handler(
    State(state): State<Arc<AppState>>,
    Query(query): Query<JupiterQuoteQuery>,
) -> Result<impl IntoResponse, AppError> {
    if let Some(response) = jupiter_gate(
        &state,
        &query.cluster,
        &query.input_mint,
        &query.output_mint,
        Some(query.slippage_bps),
    ) {
        return Ok(response);
    }
    query
        .amount
        .parse::<u64>()
        .map_err(|_| AppError::BadRequest("amount must be a positive integer".to_string()))?;

    let slippage_bps = query.slippage_bps.to_string();
    let params = [
        ("inputMint", query.input_mint.as_str()),
        ("outputMint", query.output_mint.as_str()),
        ("amount", query.amount.as_str()),
        ("slippageBps", slippage_bps.as_str()),
        ("swapMode", "ExactIn"),
        ("onlyDirectRoutes", "false"),
    ];
    let client = reqwest::Client::new();
    let mut request = client
        .get(format!(
            "{}/quote",
            state.jupiter_swap_base_url.trim_end_matches('/')
        ))
        .query(&params);
    if let Some(api_key) = &state.jupiter_api_key {
        request = request.header("x-api-key", api_key);
    }
    let response = request
        .send()
        .await
        .map_err(|e| AppError::Upstream(format!("Jupiter quote request failed: {e}")))?;
    proxy_json_response(response).await
}

async fn jupiter_swap_instructions_handler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<JupiterSwapInstructionsRequest>,
) -> Result<impl IntoResponse, AppError> {
    let input_mint = payload
        .quote_response
        .get("inputMint")
        .and_then(Value::as_str)
        .unwrap_or_default();
    let output_mint = payload
        .quote_response
        .get("outputMint")
        .and_then(Value::as_str)
        .unwrap_or_default();
    if let Some(response) = jupiter_gate(&state, &payload.cluster, input_mint, output_mint, None) {
        return Ok(response);
    }
    validate_pubkey_like(&payload.user_public_key, "userPublicKey")?;
    if let Some(destination) = &payload.destination_token_account {
        validate_pubkey_like(destination, "destinationTokenAccount")?;
    }

    let body = serde_json::json!({
        "userPublicKey": payload.user_public_key,
        "quoteResponse": payload.quote_response,
        "wrapAndUnwrapSol": payload.wrap_and_unwrap_sol,
        "destinationTokenAccount": payload.destination_token_account,
    });
    let client = reqwest::Client::new();
    let mut request = client
        .post(format!(
            "{}/swap-instructions",
            state.jupiter_swap_base_url.trim_end_matches('/')
        ))
        .json(&body);
    if let Some(api_key) = &state.jupiter_api_key {
        request = request.header("x-api-key", api_key);
    }
    let response = request.send().await.map_err(|e| {
        AppError::Upstream(format!("Jupiter swap-instructions request failed: {e}"))
    })?;
    proxy_json_response(response).await
}

const SOL_MINT: &str = "So11111111111111111111111111111111111111112";
const USDC_MINT: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

fn default_cluster() -> String {
    "devnet".to_string()
}

fn default_slippage_bps() -> u16 {
    50
}

fn jupiter_gate(
    state: &AppState,
    cluster: &str,
    input_mint: &str,
    output_mint: &str,
    slippage_bps: Option<u16>,
) -> Option<axum::response::Response> {
    if cluster != "mainnet-beta" {
        return Some((
            StatusCode::CONFLICT,
            Json(serde_json::json!({
                "mode": "mock",
                "reason": "Real Jupiter swaps are mainnet-beta only; devnet swaps remain guard-only."
            })),
        ).into_response());
    }
    if !is_supported_route(input_mint, output_mint) {
        return Some(
            (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "error": "Only SOL/USDC exact-in routes are supported in this release."
                })),
            )
                .into_response(),
        );
    }
    if let Some(slippage_bps) = slippage_bps {
        if !(1..=500).contains(&slippage_bps) {
            return Some(
                (
                    StatusCode::BAD_REQUEST,
                    Json(serde_json::json!({
                        "error": "slippageBps must be between 1 and 500."
                    })),
                )
                    .into_response(),
            );
        }
    }
    if state.jupiter_api_key.is_none() {
        return Some(
            (
                StatusCode::SERVICE_UNAVAILABLE,
                Json(serde_json::json!({
                    "error": "JUPITER_API_KEY is not configured on the server."
                })),
            )
                .into_response(),
        );
    }
    None
}

fn is_supported_route(input_mint: &str, output_mint: &str) -> bool {
    (input_mint == SOL_MINT && output_mint == USDC_MINT)
        || (input_mint == USDC_MINT && output_mint == SOL_MINT)
}

fn validate_pubkey_like(value: &str, field: &str) -> Result<(), AppError> {
    if value.len() >= 32 {
        Ok(())
    } else {
        Err(AppError::BadRequest(format!(
            "{field} must be a base58 public key"
        )))
    }
}

async fn proxy_json_response(
    response: reqwest::Response,
) -> Result<axum::response::Response, AppError> {
    let status =
        StatusCode::from_u16(response.status().as_u16()).unwrap_or(StatusCode::BAD_GATEWAY);
    let body = response
        .json::<Value>()
        .await
        .unwrap_or_else(|_| serde_json::json!({}));
    Ok((status, Json(body)).into_response())
}

impl AppState {
    fn store_name(&self) -> &'static str {
        match self.store {
            Store::Postgres(_) => "postgres",
            Store::Memory(_) => "memory",
        }
    }

    fn verify_webhook(&self, headers: &HeaderMap) -> Result<(), AppError> {
        let Some(secret) = &self.webhook_secret else {
            return Ok(());
        };
        let header_secret = headers
            .get("x-helius-signature")
            .or_else(|| headers.get("x-kiln-webhook-secret"))
            .and_then(|v| v.to_str().ok());

        if header_secret == Some(secret.as_str()) {
            Ok(())
        } else {
            Err(AppError::Unauthorized)
        }
    }

    async fn health_stats(&self) -> Result<HealthStats, AppError> {
        match &self.store {
            Store::Postgres(pool) => {
                sqlx::query("SELECT 1").execute(pool).await?;
                let row = sqlx::query(
                    "SELECT
                       (SELECT EXTRACT(EPOCH FROM max(received_at))::BIGINT FROM raw_events) AS last_ingested_at,
                       (SELECT count(*) FROM raw_events) AS raw_events,
                       (SELECT count(*) FROM vaults) AS vaults,
                       (SELECT count(*) FROM manager_profiles) AS managers,
                       (SELECT count(*) FROM investor_positions) AS positions,
                       (SELECT count(*) FROM nav_points) AS nav_points,
                       (SELECT count(*) FROM trade_events) AS trades,
                       (SELECT count(*) FROM status_events) AS status_events",
                )
                .fetch_one(pool)
                .await?;
                Ok(HealthStats {
                    last_ingested_at: row.get("last_ingested_at"),
                    raw_events: row.get("raw_events"),
                    vaults: row.get("vaults"),
                    managers: row.get("managers"),
                    positions: row.get("positions"),
                    nav_points: row.get("nav_points"),
                    trades: row.get("trades"),
                    status_events: row.get("status_events"),
                })
            }
            Store::Memory(state) => {
                let state = state.lock().map_err(|_| AppError::StatePoisoned)?;
                Ok(HealthStats {
                    last_ingested_at: state.raw_events.last().map(|_| now_ts()),
                    raw_events: state.raw_events.len() as i64,
                    vaults: state.vaults.len() as i64,
                    managers: state.managers.len() as i64,
                    positions: state.positions.len() as i64,
                    nav_points: state.nav_points.len() as i64,
                    trades: state.trades.len() as i64,
                    status_events: state.status_events.len() as i64,
                })
            }
        }
    }

    async fn record_webhook(&self, kind: Option<String>, payload: Value) -> Result<(), AppError> {
        let raw_event_key = event_key(&payload, kind.as_deref(), 0);
        let updates = MaterializedUpdate::from_payload(&payload);
        match &self.store {
            Store::Postgres(pool) => {
                sqlx::query(
                    "INSERT INTO raw_events (event_key, kind, payload) VALUES ($1, $2, $3)
                     ON CONFLICT (event_key) DO NOTHING",
                )
                .bind(&raw_event_key)
                .bind(&kind)
                .bind(&payload)
                .execute(pool)
                .await?;
                apply_update_postgres(pool, updates).await?;
            }
            Store::Memory(state) => {
                let mut state = state.lock().map_err(|_| AppError::StatePoisoned)?;
                if !state.raw_event_keys.insert(raw_event_key) {
                    return Ok(());
                }
                state.raw_events.push(payload);
                state.apply_updates(updates);
            }
        }
        Ok(())
    }

    async fn list_vaults(&self) -> Result<Vec<VaultView>, AppError> {
        match &self.store {
            Store::Postgres(pool) => {
                let rows = sqlx::query(VAULT_SELECT_SQL).fetch_all(pool).await?;
                Ok(rows.into_iter().map(row_to_vault).collect())
            }
            Store::Memory(state) => {
                let state = state.lock().map_err(|_| AppError::StatePoisoned)?;
                let mut vaults: Vec<_> = state.vaults.values().cloned().collect();
                vaults.sort_by(|a, b| b.created_at.cmp(&a.created_at));
                Ok(vaults)
            }
        }
    }

    async fn get_vault(&self, config_address: &str) -> Result<Option<VaultView>, AppError> {
        match &self.store {
            Store::Postgres(pool) => {
                let row = sqlx::query(&format!("{VAULT_SELECT_SQL} WHERE config_pubkey = $1"))
                    .bind(config_address)
                    .fetch_optional(pool)
                    .await?;
                Ok(row.map(row_to_vault))
            }
            Store::Memory(state) => {
                let state = state.lock().map_err(|_| AppError::StatePoisoned)?;
                Ok(state.vaults.get(config_address).cloned())
            }
        }
    }

    async fn nav_history(&self, config_address: &str) -> Result<Vec<NavPoint>, AppError> {
        match &self.store {
            Store::Postgres(pool) => {
                let rows = sqlx::query(
                    "SELECT vault_config_pubkey, recorded_at, nav, junior_capital, senior_capital
                     FROM nav_points WHERE vault_config_pubkey = $1 ORDER BY recorded_at ASC",
                )
                .bind(config_address)
                .fetch_all(pool)
                .await?;
                Ok(rows.into_iter().map(row_to_nav_point).collect())
            }
            Store::Memory(state) => {
                let state = state.lock().map_err(|_| AppError::StatePoisoned)?;
                Ok(state
                    .nav_points
                    .iter()
                    .filter(|p| p.vault_config_pubkey == config_address)
                    .cloned()
                    .collect())
            }
        }
    }

    async fn public_trades(&self, config_address: &str) -> Result<Vec<TradeEvent>, AppError> {
        let now = now_ts();
        match &self.store {
            Store::Postgres(pool) => {
                let rows = sqlx::query(
                    "SELECT vault_config_pubkey, occurred_at, visibility_after, is_public_visible, side, size, route
                     FROM trade_events
                     WHERE vault_config_pubkey = $1 AND is_public_visible = TRUE AND visibility_after <= $2
                     ORDER BY occurred_at DESC",
                )
                .bind(config_address)
                .bind(now)
                .fetch_all(pool)
                .await?;
                Ok(rows.into_iter().map(row_to_trade).collect())
            }
            Store::Memory(state) => {
                let state = state.lock().map_err(|_| AppError::StatePoisoned)?;
                Ok(state
                    .trades
                    .iter()
                    .filter(|t| {
                        t.vault_config_pubkey == config_address
                            && t.is_public_visible
                            && t.visibility_after <= now
                    })
                    .cloned()
                    .collect())
            }
        }
    }

    async fn list_managers(&self) -> Result<Vec<ManagerView>, AppError> {
        match &self.store {
            Store::Postgres(pool) => {
                let rows = sqlx::query(
                    "SELECT pubkey, owner, total_vaults, active_vaults, total_junior_deposited, created_at
                     FROM manager_profiles ORDER BY total_vaults DESC, created_at DESC",
                )
                .fetch_all(pool)
                .await?;
                Ok(rows.into_iter().map(row_to_manager).collect())
            }
            Store::Memory(state) => {
                let state = state.lock().map_err(|_| AppError::StatePoisoned)?;
                let mut managers: Vec<_> = state.managers.values().cloned().collect();
                managers.sort_by(|a, b| b.total_vaults.cmp(&a.total_vaults));
                Ok(managers)
            }
        }
    }

    async fn get_manager(&self, address: &str) -> Result<Option<ManagerDetail>, AppError> {
        match &self.store {
            Store::Postgres(pool) => {
                let manager = sqlx::query(
                    "SELECT pubkey, owner, total_vaults, active_vaults, total_junior_deposited, created_at
                     FROM manager_profiles WHERE pubkey = $1 OR owner = $1",
                )
                .bind(address)
                .fetch_optional(pool)
                .await?
                .map(row_to_manager);

                let Some(manager) = manager else {
                    return Ok(None);
                };
                let vaults = sqlx::query(&format!(
                    "{VAULT_SELECT_SQL} WHERE manager_pubkey = $1 OR manager_profile_pubkey = $1"
                ))
                .bind(address)
                .fetch_all(pool)
                .await?
                .into_iter()
                .map(row_to_vault)
                .collect();

                Ok(Some(ManagerDetail { manager, vaults }))
            }
            Store::Memory(state) => {
                let state = state.lock().map_err(|_| AppError::StatePoisoned)?;
                let manager = state.managers.get(address).cloned().or_else(|| {
                    state
                        .managers
                        .values()
                        .find(|m| m.owner == address)
                        .cloned()
                });
                Ok(manager.map(|manager| {
                    let vaults = state
                        .vaults
                        .values()
                        .filter(|v| {
                            v.manager_pubkey == address || v.manager_profile_pubkey == address
                        })
                        .cloned()
                        .collect();
                    ManagerDetail { manager, vaults }
                }))
            }
        }
    }

    async fn positions(&self, wallet: &str) -> Result<Vec<PositionView>, AppError> {
        match &self.store {
            Store::Postgres(pool) => {
                let rows = sqlx::query(
                    "SELECT pubkey, vault_config_pubkey, investor_pubkey, deposited_at, senior_shares,
                            total_deposited, alert_threshold_bps, current_value
                     FROM investor_positions WHERE investor_pubkey = $1 ORDER BY deposited_at DESC",
                )
                .bind(wallet)
                .fetch_all(pool)
                .await?;
                let mut positions = Vec::with_capacity(rows.len());
                for row in rows {
                    let vault_id: String = row.get("vault_config_pubkey");
                    let vault = self.get_vault(&vault_id).await?;
                    positions.push(row_to_position(row, vault));
                }
                Ok(positions)
            }
            Store::Memory(state) => {
                let state = state.lock().map_err(|_| AppError::StatePoisoned)?;
                Ok(state
                    .positions
                    .values()
                    .filter(|p| p.investor_pubkey == wallet)
                    .cloned()
                    .collect())
            }
        }
    }
}

#[derive(Default)]
struct MaterializedUpdate {
    event_key: String,
    manager: Option<ManagerView>,
    vault: Option<VaultView>,
    position: Option<PositionView>,
    nav_point: Option<NavPoint>,
    trade: Option<TradeEvent>,
    status: Option<StatusEvent>,
}

impl MaterializedUpdate {
    fn from_payload(payload: &Value) -> Vec<Self> {
        match payload {
            Value::Array(items) => items
                .iter()
                .enumerate()
                .flat_map(|(index, item)| Self::from_single_payload(item, index))
                .collect(),
            _ => Self::from_single_payload(payload, 0),
        }
    }

    fn from_single_payload(payload: &Value, payload_index: usize) -> Vec<Self> {
        let base_key = event_key(payload, event_kind(payload).as_deref(), payload_index);
        let mut updates = Vec::new();
        for (index, data) in materialization_nodes(payload).into_iter().enumerate() {
            let manager = data
                .get("manager")
                .or_else(|| data.get("managerProfile"))
                .and_then(parse_manager);
            let vault = data.get("vault").or(Some(data)).and_then(parse_vault);
            let position = data
                .get("position")
                .and_then(|v| parse_position(v, vault.clone()));
            let nav_point = data
                .get("navPoint")
                .and_then(parse_nav_point)
                .or_else(|| vault.as_ref().map(vault_to_nav_point));
            let trade = data.get("trade").and_then(parse_trade);
            let status = data.get("statusEvent").and_then(parse_status_event);

            if manager.is_some()
                || vault.is_some()
                || position.is_some()
                || nav_point.is_some()
                || trade.is_some()
                || status.is_some()
            {
                updates.push(Self {
                    event_key: format!("{base_key}:{index}"),
                    manager,
                    vault,
                    position,
                    nav_point,
                    trade,
                    status,
                });
            }
        }
        updates
    }
}

fn materialization_nodes(payload: &Value) -> Vec<&Value> {
    let mut nodes = Vec::new();
    if let Some(data) = payload.get("data") {
        nodes.push(data);
    }
    for key in ["kiln", "kilnEvent", "event"] {
        if let Some(value) = payload.get(key) {
            nodes.push(value);
        }
    }
    if let Some(events) = payload.get("events") {
        match events {
            Value::Array(values) => nodes.extend(values),
            Value::Object(map) => nodes.extend(map.values()),
            _ => {}
        }
    }
    if nodes.is_empty() {
        nodes.push(payload);
    }
    nodes
}

fn event_key(payload: &Value, kind: Option<&str>, index: usize) -> String {
    let signature = string(
        payload,
        &["signature", "transactionSignature", "txSignature", "id"],
    )
    .or_else(|| {
        payload
            .get("transaction")
            .and_then(|transaction| string(transaction, &["signature"]))
    })
    .unwrap_or_else(|| payload.to_string());
    format!("{}:{}:{index}", kind.unwrap_or("webhook"), signature)
}

impl MaterializedState {
    fn apply_updates(&mut self, updates: Vec<MaterializedUpdate>) {
        for update in updates {
            if let Some(manager) = update.manager {
                self.managers.insert(manager.pubkey.clone(), manager);
            }
            if let Some(vault) = update.vault {
                self.vaults.insert(vault.config_pubkey.clone(), vault);
            }
            if let Some(position) = update.position {
                self.positions.insert(position.pubkey.clone(), position);
            }
            if let Some(point) = update.nav_point {
                if self
                    .nav_event_keys
                    .insert(format!("{}:nav", update.event_key))
                {
                    self.nav_points.push(point);
                }
            }
            if let Some(trade) = update.trade {
                if self
                    .trade_event_keys
                    .insert(format!("{}:trade", update.event_key))
                {
                    self.trades.push(trade);
                }
            }
            if let Some(status) = update.status {
                if self
                    .status_event_keys
                    .insert(format!("{}:status", update.event_key))
                {
                    self.status_events.push(status);
                }
            }
        }
    }
}

async fn apply_update_postgres(
    pool: &PgPool,
    updates: Vec<MaterializedUpdate>,
) -> Result<(), sqlx::Error> {
    for update in updates {
        if let Some(manager) = update.manager {
            sqlx::query(
                "INSERT INTO manager_profiles
             (pubkey, owner, total_vaults, active_vaults, total_junior_deposited, created_at)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (pubkey) DO UPDATE SET
               owner = EXCLUDED.owner,
               total_vaults = EXCLUDED.total_vaults,
               active_vaults = EXCLUDED.active_vaults,
               total_junior_deposited = EXCLUDED.total_junior_deposited,
               created_at = EXCLUDED.created_at,
               updated_at = now()",
            )
            .bind(manager.pubkey)
            .bind(manager.owner)
            .bind(manager.total_vaults)
            .bind(manager.active_vaults)
            .bind(manager.total_junior_deposited)
            .bind(manager.created_at)
            .execute(pool)
            .await?;
        }

        if let Some(vault) = update.vault {
            upsert_vault(pool, &vault).await?;
        }
        if let Some(position) = update.position {
            sqlx::query(
                "INSERT INTO investor_positions
             (pubkey, vault_config_pubkey, investor_pubkey, deposited_at, senior_shares,
              total_deposited, alert_threshold_bps, current_value)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (pubkey) DO UPDATE SET
               vault_config_pubkey = EXCLUDED.vault_config_pubkey,
               investor_pubkey = EXCLUDED.investor_pubkey,
               deposited_at = EXCLUDED.deposited_at,
               senior_shares = EXCLUDED.senior_shares,
               total_deposited = EXCLUDED.total_deposited,
               alert_threshold_bps = EXCLUDED.alert_threshold_bps,
               current_value = EXCLUDED.current_value,
               updated_at = now()",
            )
            .bind(position.pubkey)
            .bind(position.vault_config_pubkey)
            .bind(position.investor_pubkey)
            .bind(position.deposited_at)
            .bind(position.senior_shares)
            .bind(position.total_deposited)
            .bind(position.alert_threshold_bps)
            .bind(position.current_value)
            .execute(pool)
            .await?;
        }
        if let Some(point) = update.nav_point {
            sqlx::query(
            "INSERT INTO nav_points (event_key, vault_config_pubkey, recorded_at, nav, junior_capital, senior_capital)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (event_key) DO NOTHING",
        )
        .bind(format!("{}:nav", update.event_key))
        .bind(point.vault_config_pubkey)
        .bind(point.recorded_at)
        .bind(point.nav)
        .bind(point.junior_capital)
        .bind(point.senior_capital)
        .execute(pool)
        .await?;
        }
        if let Some(trade) = update.trade {
            sqlx::query(
            "INSERT INTO trade_events
             (event_key, vault_config_pubkey, occurred_at, visibility_after, is_public_visible, side, size, route)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             ON CONFLICT (event_key) DO NOTHING",
        )
        .bind(format!("{}:trade", update.event_key))
        .bind(trade.vault_config_pubkey)
        .bind(trade.occurred_at)
        .bind(trade.visibility_after)
        .bind(trade.is_public_visible)
        .bind(trade.side)
        .bind(trade.size)
        .bind(trade.route)
        .execute(pool)
        .await?;
        }
        if let Some(status) = update.status {
            sqlx::query(
            "INSERT INTO status_events (event_key, vault_config_pubkey, occurred_at, status, reason)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (event_key) DO NOTHING",
        )
        .bind(format!("{}:status", update.event_key))
        .bind(status.vault_config_pubkey)
        .bind(status.occurred_at)
        .bind(status.status)
        .bind(status.reason)
        .execute(pool)
        .await?;
        }
    }
    Ok(())
}

async fn upsert_vault(pool: &PgPool, vault: &VaultView) -> Result<(), sqlx::Error> {
    sqlx::query(
        "INSERT INTO vaults
         (config_pubkey, state_pubkey, treasury_pubkey, manager_pubkey, manager_profile_pubkey,
          name, status, tvl, junior_capital, senior_capital, junior_shares_outstanding,
          senior_shares_outstanding, junior_health, current_nav, high_water_mark, fee_bps,
          max_slippage_bps, created_at, graduated_at, paper_trade_count, min_qualifying_trades,
          rolling24h_loss_bps, rolling7d_loss_bps, trading_enabled, instant_exit, vault_index)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                 $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
         ON CONFLICT (config_pubkey) DO UPDATE SET
           state_pubkey = EXCLUDED.state_pubkey,
           treasury_pubkey = EXCLUDED.treasury_pubkey,
           manager_pubkey = EXCLUDED.manager_pubkey,
           manager_profile_pubkey = EXCLUDED.manager_profile_pubkey,
           name = EXCLUDED.name,
           status = EXCLUDED.status,
           tvl = EXCLUDED.tvl,
           junior_capital = EXCLUDED.junior_capital,
           senior_capital = EXCLUDED.senior_capital,
           junior_shares_outstanding = EXCLUDED.junior_shares_outstanding,
           senior_shares_outstanding = EXCLUDED.senior_shares_outstanding,
           junior_health = EXCLUDED.junior_health,
           current_nav = EXCLUDED.current_nav,
           high_water_mark = EXCLUDED.high_water_mark,
           fee_bps = EXCLUDED.fee_bps,
           max_slippage_bps = EXCLUDED.max_slippage_bps,
           created_at = EXCLUDED.created_at,
           graduated_at = EXCLUDED.graduated_at,
           paper_trade_count = EXCLUDED.paper_trade_count,
           min_qualifying_trades = EXCLUDED.min_qualifying_trades,
           rolling24h_loss_bps = EXCLUDED.rolling24h_loss_bps,
           rolling7d_loss_bps = EXCLUDED.rolling7d_loss_bps,
           trading_enabled = EXCLUDED.trading_enabled,
           instant_exit = EXCLUDED.instant_exit,
           vault_index = EXCLUDED.vault_index,
           updated_at = now()",
    )
    .bind(&vault.config_pubkey)
    .bind(&vault.state_pubkey)
    .bind(&vault.treasury_pubkey)
    .bind(&vault.manager_pubkey)
    .bind(&vault.manager_profile_pubkey)
    .bind(&vault.name)
    .bind(&vault.status)
    .bind(vault.tvl)
    .bind(vault.junior_capital)
    .bind(vault.senior_capital)
    .bind(vault.junior_shares_outstanding)
    .bind(vault.senior_shares_outstanding)
    .bind(vault.junior_health)
    .bind(vault.current_nav)
    .bind(vault.high_water_mark)
    .bind(vault.fee_bps)
    .bind(vault.max_slippage_bps)
    .bind(vault.created_at)
    .bind(vault.graduated_at)
    .bind(vault.paper_trade_count)
    .bind(vault.min_qualifying_trades)
    .bind(vault.rolling24h_loss_bps)
    .bind(vault.rolling7d_loss_bps)
    .bind(vault.trading_enabled)
    .bind(vault.instant_exit)
    .bind(vault.vault_index)
    .execute(pool)
    .await?;
    Ok(())
}

const VAULT_SELECT_SQL: &str =
    "SELECT config_pubkey, state_pubkey, treasury_pubkey, manager_pubkey,
    manager_profile_pubkey, name, status, tvl, junior_capital, senior_capital,
    junior_shares_outstanding, senior_shares_outstanding, junior_health, current_nav,
    high_water_mark, fee_bps, max_slippage_bps, created_at, graduated_at, paper_trade_count,
    min_qualifying_trades, rolling24h_loss_bps, rolling7d_loss_bps, trading_enabled,
    instant_exit, vault_index FROM vaults";

fn row_to_vault(row: sqlx::postgres::PgRow) -> VaultView {
    let config_pubkey: String = row.get("config_pubkey");
    VaultView {
        id: config_pubkey.clone(),
        name: row.get("name"),
        config_pubkey,
        state_pubkey: row.get("state_pubkey"),
        treasury_pubkey: row.get("treasury_pubkey"),
        manager_pubkey: row.get("manager_pubkey"),
        manager_profile_pubkey: row.get("manager_profile_pubkey"),
        status: row.get("status"),
        tvl: row.get("tvl"),
        junior_capital: row.get("junior_capital"),
        senior_capital: row.get("senior_capital"),
        junior_shares_outstanding: row.get("junior_shares_outstanding"),
        senior_shares_outstanding: row.get("senior_shares_outstanding"),
        junior_health: row.get("junior_health"),
        current_nav: row.get("current_nav"),
        high_water_mark: row.get("high_water_mark"),
        fee_bps: row.get("fee_bps"),
        max_slippage_bps: row.get("max_slippage_bps"),
        created_at: row.get("created_at"),
        graduated_at: row.get("graduated_at"),
        paper_trade_count: row.get("paper_trade_count"),
        min_qualifying_trades: row.get("min_qualifying_trades"),
        rolling24h_loss_bps: row.get("rolling24h_loss_bps"),
        rolling7d_loss_bps: row.get("rolling7d_loss_bps"),
        trading_enabled: row.get("trading_enabled"),
        instant_exit: row.get("instant_exit"),
        vault_index: row.get("vault_index"),
    }
}

fn row_to_manager(row: sqlx::postgres::PgRow) -> ManagerView {
    ManagerView {
        pubkey: row.get("pubkey"),
        owner: row.get("owner"),
        total_vaults: row.get("total_vaults"),
        active_vaults: row.get("active_vaults"),
        total_junior_deposited: row.get("total_junior_deposited"),
        created_at: row.get("created_at"),
    }
}

fn row_to_nav_point(row: sqlx::postgres::PgRow) -> NavPoint {
    NavPoint {
        vault_config_pubkey: row.get("vault_config_pubkey"),
        recorded_at: row.get("recorded_at"),
        nav: row.get("nav"),
        junior_capital: row.get("junior_capital"),
        senior_capital: row.get("senior_capital"),
    }
}

fn row_to_trade(row: sqlx::postgres::PgRow) -> TradeEvent {
    TradeEvent {
        vault_config_pubkey: row.get("vault_config_pubkey"),
        occurred_at: row.get("occurred_at"),
        visibility_after: row.get("visibility_after"),
        is_public_visible: row.get("is_public_visible"),
        side: row.get("side"),
        size: row.get("size"),
        route: row.get("route"),
    }
}

fn row_to_position(row: sqlx::postgres::PgRow, vault: Option<VaultView>) -> PositionView {
    PositionView {
        pubkey: row.get("pubkey"),
        vault_config_pubkey: row.get("vault_config_pubkey"),
        vault,
        investor_pubkey: row.get("investor_pubkey"),
        deposited_at: row.get("deposited_at"),
        senior_shares: row.get("senior_shares"),
        total_deposited: row.get("total_deposited"),
        alert_threshold_bps: row.get("alert_threshold_bps"),
        current_value: row.get("current_value"),
    }
}

fn parse_manager(value: &Value) -> Option<ManagerView> {
    Some(ManagerView {
        pubkey: string(value, &["pubkey", "address"])?,
        owner: string(value, &["owner"])?,
        total_vaults: i32_value(value, &["totalVaults"]).unwrap_or_default(),
        active_vaults: i32_value(value, &["activeVaults"]).unwrap_or_default(),
        total_junior_deposited: f64_value(value, &["totalJuniorDeposited"]).unwrap_or_default(),
        created_at: i64_value(value, &["createdAt"]).unwrap_or_else(now_ts),
    })
}

fn parse_vault(value: &Value) -> Option<VaultView> {
    let config_pubkey = string(value, &["configPubkey", "configAddress"])?;
    let junior_capital = f64_value(value, &["juniorCapital"]).unwrap_or_default();
    let senior_capital = f64_value(value, &["seniorCapital"]).unwrap_or_default();
    let original_junior = f64_value(value, &["originalJuniorDeposit"]).unwrap_or(junior_capital);
    let junior_health = f64_value(value, &["juniorHealth"]).unwrap_or_else(|| {
        if original_junior > 0.0 {
            ((junior_capital / original_junior) * 100.0).clamp(0.0, 100.0)
        } else {
            0.0
        }
    });

    Some(VaultView {
        id: config_pubkey.clone(),
        name: string(value, &["name"]).unwrap_or_else(|| format!("Vault {config_pubkey}")),
        config_pubkey,
        state_pubkey: string(value, &["statePubkey", "stateAddress"]).unwrap_or_default(),
        treasury_pubkey: string(value, &["treasuryPubkey", "treasuryAddress"]).unwrap_or_default(),
        manager_pubkey: string(value, &["managerPubkey", "manager"]).unwrap_or_default(),
        manager_profile_pubkey: string(value, &["managerProfilePubkey", "managerProfile"])
            .unwrap_or_default(),
        status: string(value, &["status"]).unwrap_or_else(|| "paper".to_string()),
        tvl: f64_value(value, &["tvl"]).unwrap_or(junior_capital + senior_capital),
        junior_capital,
        senior_capital,
        junior_shares_outstanding: f64_value(value, &["juniorSharesOutstanding"])
            .unwrap_or_default(),
        senior_shares_outstanding: f64_value(value, &["seniorSharesOutstanding"])
            .unwrap_or_default(),
        junior_health,
        current_nav: f64_value(value, &["currentNav"]).unwrap_or(junior_capital + senior_capital),
        high_water_mark: f64_value(value, &["highWaterMark"]).unwrap_or_default(),
        fee_bps: i32_value(value, &["feeBps", "managerFeeBps"]).unwrap_or_default(),
        max_slippage_bps: i32_value(value, &["maxSlippageBps"]).unwrap_or_default(),
        created_at: i64_value(value, &["createdAt"]).unwrap_or_else(now_ts),
        graduated_at: i64_value(value, &["graduatedAt"]).unwrap_or_default(),
        paper_trade_count: i32_value(value, &["paperTradeCount"]).unwrap_or_default(),
        min_qualifying_trades: i32_value(value, &["minQualifyingTrades"]).unwrap_or_default(),
        rolling24h_loss_bps: i32_value(value, &["rolling24hLossBps"]).unwrap_or_default(),
        rolling7d_loss_bps: i32_value(value, &["rolling7dLossBps"]).unwrap_or_default(),
        trading_enabled: bool_value(value, &["tradingEnabled"]).unwrap_or(true),
        instant_exit: bool_value(value, &["instantExit"]).unwrap_or(junior_health < 20.0),
        vault_index: i32_value(value, &["vaultIndex"]).unwrap_or_default(),
    })
}

fn parse_position(value: &Value, vault: Option<VaultView>) -> Option<PositionView> {
    let senior_shares = f64_value(value, &["seniorShares"]).unwrap_or_default();
    let total_deposited = f64_value(value, &["totalDeposited"]).unwrap_or_default();
    let current_value = vault
        .as_ref()
        .and_then(|v| {
            if v.senior_shares_outstanding > 0.0 {
                Some((senior_shares / v.senior_shares_outstanding) * v.senior_capital)
            } else {
                None
            }
        })
        .unwrap_or(total_deposited);

    Some(PositionView {
        pubkey: string(value, &["pubkey", "address"])?,
        vault_config_pubkey: string(value, &["vaultConfigPubkey", "vaultConfig"])?,
        vault,
        investor_pubkey: string(value, &["investorPubkey", "investor"])?,
        deposited_at: i64_value(value, &["depositedAt"]).unwrap_or_else(now_ts),
        senior_shares,
        total_deposited,
        alert_threshold_bps: i32_value(value, &["alertThresholdBps"]).unwrap_or(2000),
        current_value,
    })
}

fn parse_nav_point(value: &Value) -> Option<NavPoint> {
    Some(NavPoint {
        vault_config_pubkey: string(value, &["vaultConfigPubkey", "vaultConfig"])?,
        recorded_at: i64_value(value, &["recordedAt", "timestamp"]).unwrap_or_else(now_ts),
        nav: f64_value(value, &["nav", "currentNav"])?,
        junior_capital: f64_value(value, &["juniorCapital"]).unwrap_or_default(),
        senior_capital: f64_value(value, &["seniorCapital"]).unwrap_or_default(),
    })
}

fn vault_to_nav_point(vault: &VaultView) -> NavPoint {
    NavPoint {
        vault_config_pubkey: vault.config_pubkey.clone(),
        recorded_at: now_ts(),
        nav: vault.current_nav,
        junior_capital: vault.junior_capital,
        senior_capital: vault.senior_capital,
    }
}

fn parse_trade(value: &Value) -> Option<TradeEvent> {
    let occurred_at = i64_value(value, &["occurredAt", "timestamp"]).unwrap_or_else(now_ts);
    Some(TradeEvent {
        vault_config_pubkey: string(value, &["vaultConfigPubkey", "vaultConfig"])?,
        occurred_at,
        visibility_after: i64_value(value, &["visibilityAfter"]).unwrap_or(occurred_at + 43_200),
        is_public_visible: bool_value(value, &["isPublicVisible"]).unwrap_or(true),
        side: string(value, &["side"]).unwrap_or_else(|| "swap".to_string()),
        size: f64_value(value, &["size", "amount"]).unwrap_or_default(),
        route: string(value, &["route"]),
    })
}

fn parse_status_event(value: &Value) -> Option<StatusEvent> {
    Some(StatusEvent {
        vault_config_pubkey: string(value, &["vaultConfigPubkey", "vaultConfig"])?,
        occurred_at: i64_value(value, &["occurredAt", "timestamp"]).unwrap_or_else(now_ts),
        status: string(value, &["status"])?,
        reason: string(value, &["reason"]),
    })
}

fn event_kind(payload: &Value) -> Option<String> {
    payload
        .get("kind")
        .or_else(|| payload.get("type"))
        .or_else(|| payload.get("eventType"))
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn string(value: &Value, keys: &[&str]) -> Option<String> {
    keys.iter()
        .find_map(|key| value.get(*key))
        .and_then(Value::as_str)
        .map(ToString::to_string)
}

fn f64_value(value: &Value, keys: &[&str]) -> Option<f64> {
    keys.iter()
        .find_map(|key| value.get(*key))
        .and_then(|v| v.as_f64().or_else(|| v.as_str()?.parse().ok()))
}

fn i64_value(value: &Value, keys: &[&str]) -> Option<i64> {
    keys.iter()
        .find_map(|key| value.get(*key))
        .and_then(|v| v.as_i64().or_else(|| v.as_str()?.parse().ok()))
}

fn i32_value(value: &Value, keys: &[&str]) -> Option<i32> {
    i64_value(value, keys).and_then(|v| i32::try_from(v).ok())
}

fn bool_value(value: &Value, keys: &[&str]) -> Option<bool> {
    keys.iter()
        .find_map(|key| value.get(*key))
        .and_then(|v| v.as_bool().or_else(|| v.as_str()?.parse().ok()))
}

fn now_ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or_default()
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
    info!("shutdown signal received, terminating");
}

fn mask_db_url(url: &str) -> String {
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

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::{to_bytes, Body};
    use axum::http::{Method, Request};
    use serde_json::json;
    use tower::ServiceExt;

    fn test_app(secret: Option<&str>) -> Router {
        build_app(AppState {
            store: Store::Memory(Arc::new(Mutex::new(MaterializedState::default()))),
            webhook_secret: secret.map(ToString::to_string),
            jupiter_api_key: None,
            jupiter_swap_base_url: "https://api.jup.ag/swap/v1".to_string(),
        })
    }

    async fn json_request(
        app: Router,
        method: Method,
        uri: &str,
        body: Value,
    ) -> (StatusCode, Value) {
        let response = app
            .oneshot(
                Request::builder()
                    .method(method)
                    .uri(uri)
                    .header("content-type", "application/json")
                    .body(Body::from(body.to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        let status = response.status();
        let bytes = to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let json = serde_json::from_slice(&bytes).unwrap_or(Value::Null);
        (status, json)
    }

    #[test]
    fn migration_defines_product_tables() {
        let sql = include_str!("../migrations/0001_init.sql");
        for table in [
            "raw_events",
            "manager_profiles",
            "vaults",
            "investor_positions",
            "nav_points",
            "trade_events",
            "status_events",
        ] {
            assert!(sql.contains(table), "missing table {table}");
        }
    }

    #[tokio::test]
    async fn webhook_fixture_materializes_read_apis() {
        let app = test_app(None);
        let payload = json!({
            "kind": "fixture_snapshot",
            "data": {
                "manager": {
                    "pubkey": "manager-profile-1",
                    "owner": "manager-wallet-1",
                    "totalVaults": 1,
                    "activeVaults": 1,
                    "totalJuniorDeposited": 10,
                    "createdAt": 100
                },
                "vault": {
                    "configPubkey": "vault-config-1",
                    "statePubkey": "vault-state-1",
                    "treasuryPubkey": "treasury-1",
                    "managerPubkey": "manager-wallet-1",
                    "managerProfilePubkey": "manager-profile-1",
                    "name": "Fixture Vault",
                    "status": "active",
                    "juniorCapital": 12.0,
                    "seniorCapital": 40.0,
                    "seniorSharesOutstanding": 400.0,
                    "currentNav": 52.0,
                    "highWaterMark": 52.0,
                    "createdAt": 100,
                    "tradingEnabled": true
                },
                "position": {
                    "pubkey": "position-1",
                    "vaultConfigPubkey": "vault-config-1",
                    "investorPubkey": "investor-wallet-1",
                    "seniorShares": 100.0,
                    "totalDeposited": 10.0,
                    "depositedAt": 110
                },
                "trade": {
                    "vaultConfigPubkey": "vault-config-1",
                    "occurredAt": 120,
                    "visibilityAfter": 121,
                    "isPublicVisible": true,
                    "side": "swap",
                    "size": 2.5
                },
                "statusEvent": {
                    "vaultConfigPubkey": "vault-config-1",
                    "occurredAt": 130,
                    "status": "active"
                }
            }
        });

        let (status, _) = json_request(app.clone(), Method::POST, "/webhook", payload).await;
        assert_eq!(status, StatusCode::OK);

        let (status, vaults) = json_request(app.clone(), Method::GET, "/vaults", Value::Null).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(vaults["items"][0]["configPubkey"], "vault-config-1");

        let (status, manager) = json_request(
            app.clone(),
            Method::GET,
            "/managers/manager-profile-1",
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(manager["owner"], "manager-wallet-1");
        assert_eq!(manager["vaults"][0]["name"], "Fixture Vault");

        let (status, positions) = json_request(
            app.clone(),
            Method::GET,
            "/positions/investor-wallet-1",
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(positions["items"][0]["currentValue"], 10.0);

        let (status, nav) = json_request(
            app.clone(),
            Method::GET,
            "/vaults/vault-config-1/nav-history",
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(nav["items"][0]["nav"], 52.0);

        let (status, trades) = json_request(
            app,
            Method::GET,
            "/vaults/vault-config-1/trades",
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(trades["items"][0]["side"], "swap");
    }

    #[tokio::test]
    async fn delayed_trades_are_hidden_until_visible() {
        let app = test_app(None);
        let payload = json!({
            "kind": "trade",
            "data": {
                "trade": {
                    "vaultConfigPubkey": "vault-config-2",
                    "occurredAt": 120,
                    "visibilityAfter": 9_999_999_999_i64,
                    "isPublicVisible": true,
                    "size": 4
                }
            }
        });

        let (status, _) = json_request(app.clone(), Method::POST, "/webhook", payload).await;
        assert_eq!(status, StatusCode::OK);

        let (status, trades) = json_request(
            app,
            Method::GET,
            "/vaults/vault-config-2/trades",
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(trades["items"].as_array().unwrap().len(), 0);
    }

    #[tokio::test]
    async fn webhook_secret_is_optional_but_enforced_when_configured() {
        let app = test_app(Some("secret"));
        let response = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/webhook")
                    .header("content-type", "application/json")
                    .body(Body::from("{}"))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn duplicate_webhook_signature_is_idempotent() {
        let app = test_app(None);
        let payload = json!({
            "signature": "same-signature",
            "kind": "trade",
            "data": {
                "trade": {
                    "vaultConfigPubkey": "vault-config-3",
                    "occurredAt": 120,
                    "visibilityAfter": 121,
                    "isPublicVisible": true,
                    "size": 4
                }
            }
        });

        let (status, _) =
            json_request(app.clone(), Method::POST, "/webhook", payload.clone()).await;
        assert_eq!(status, StatusCode::OK);
        let (status, _) = json_request(app.clone(), Method::POST, "/webhook", payload).await;
        assert_eq!(status, StatusCode::OK);

        let (status, trades) = json_request(
            app,
            Method::GET,
            "/vaults/vault-config-3/trades",
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(trades["items"].as_array().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn helius_wrapped_events_materialize() {
        let app = test_app(None);
        let payload = json!([{
            "signature": "helius-signature-1",
            "type": "UNKNOWN",
            "timestamp": 1700000000,
            "events": {
                "kiln": {
                    "vault": {
                        "configPubkey": "vault-config-4",
                        "managerPubkey": "manager-wallet-4",
                        "managerProfilePubkey": "manager-profile-4",
                        "juniorCapital": 5,
                        "seniorCapital": 7,
                        "currentNav": 12
                    },
                    "navPoint": {
                        "vaultConfigPubkey": "vault-config-4",
                        "recordedAt": 1700000000,
                        "nav": 12,
                        "juniorCapital": 5,
                        "seniorCapital": 7
                    }
                }
            }
        }]);

        let (status, _) = json_request(app.clone(), Method::POST, "/webhook", payload).await;
        assert_eq!(status, StatusCode::OK);

        let (status, vault) =
            json_request(app, Method::GET, "/vaults/vault-config-4", Value::Null).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(vault["currentNav"], 12.0);
    }

    #[tokio::test]
    async fn health_reports_materialized_counts() {
        let app = test_app(None);
        let payload = json!({
            "signature": "health-signature",
            "data": {
                "vault": {
                    "configPubkey": "vault-config-health",
                    "juniorCapital": 1,
                    "currentNav": 1
                }
            }
        });
        let (status, _) = json_request(app.clone(), Method::POST, "/webhook", payload).await;
        assert_eq!(status, StatusCode::OK);

        let (status, health) = json_request(app, Method::GET, "/health", Value::Null).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(health["database"], "memory");
        assert_eq!(health["indexer"], "materialized");
        assert_eq!(health["rawEvents"], 1);
        assert_eq!(health["vaults"], 1);
        assert!(health["lastIngestedAt"].as_i64().is_some());
    }

    #[tokio::test]
    async fn jupiter_devnet_quote_returns_guard_message() {
        let app = test_app(None);
        let (status, body) = json_request(
            app,
            Method::GET,
            "/jupiter/quote?cluster=devnet&inputMint=So11111111111111111111111111111111111111112&outputMint=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&amount=1000&slippageBps=50",
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::CONFLICT);
        assert_eq!(body["mode"], "mock");
    }

    #[tokio::test]
    async fn jupiter_devnet_swap_instructions_returns_guard_message() {
        let app = test_app(None);
        let payload = json!({
            "cluster": "devnet",
            "userPublicKey": "11111111111111111111111111111111",
            "quoteResponse": {
                "inputMint": "So11111111111111111111111111111111111111112",
                "outputMint": "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
            }
        });

        let (status, body) =
            json_request(app, Method::POST, "/jupiter/swap-instructions", payload).await;
        assert_eq!(status, StatusCode::CONFLICT);
        assert_eq!(body["mode"], "mock");
    }
}
