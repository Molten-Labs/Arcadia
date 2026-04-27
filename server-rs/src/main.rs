use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{postgres::PgPoolOptions, PgPool, Row};
use std::{
    collections::HashMap,
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
    #[error("state lock poisoned")]
    StatePoisoned,
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let (status, body) = match &self {
            AppError::Db(e) => {
                error!("database error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "database error")
            }
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "unauthorized webhook"),
            AppError::NotFound => (StatusCode::NOT_FOUND, "not found"),
            AppError::StatePoisoned => (StatusCode::INTERNAL_SERVER_ERROR, "state error"),
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
        .layer(cors)
        .with_state(Arc::new(state))
}

async fn health_handler(
    State(state): State<Arc<AppState>>,
) -> Result<Json<HealthResponse>, AppError> {
    state.check_health().await?;
    Ok(Json(HealthResponse {
        status: "ok",
        database: state.store_name(),
        indexer: "materialized",
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

    async fn check_health(&self) -> Result<(), AppError> {
        if let Store::Postgres(pool) = &self.store {
            sqlx::query("SELECT 1").execute(pool).await?;
        }
        Ok(())
    }

    async fn record_webhook(&self, kind: Option<String>, payload: Value) -> Result<(), AppError> {
        let updates = MaterializedUpdate::from_payload(&payload);
        match &self.store {
            Store::Postgres(pool) => {
                sqlx::query("INSERT INTO raw_events (kind, payload) VALUES ($1, $2)")
                    .bind(&kind)
                    .bind(&payload)
                    .execute(pool)
                    .await?;
                apply_update_postgres(pool, updates).await?;
            }
            Store::Memory(state) => {
                let mut state = state.lock().map_err(|_| AppError::StatePoisoned)?;
                state.raw_events.push(payload);
                state.apply_update(updates);
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
    manager: Option<ManagerView>,
    vault: Option<VaultView>,
    position: Option<PositionView>,
    nav_point: Option<NavPoint>,
    trade: Option<TradeEvent>,
    status: Option<StatusEvent>,
}

impl MaterializedUpdate {
    fn from_payload(payload: &Value) -> Self {
        let data = payload.get("data").unwrap_or(payload);
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

        Self {
            manager,
            vault,
            position,
            nav_point,
            trade,
            status,
        }
    }
}

impl MaterializedState {
    fn apply_update(&mut self, update: MaterializedUpdate) {
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
            self.nav_points.push(point);
        }
        if let Some(trade) = update.trade {
            self.trades.push(trade);
        }
        if let Some(status) = update.status {
            self.status_events.push(status);
        }
    }
}

async fn apply_update_postgres(
    pool: &PgPool,
    update: MaterializedUpdate,
) -> Result<(), sqlx::Error> {
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
            "INSERT INTO nav_points (vault_config_pubkey, recorded_at, nav, junior_capital, senior_capital)
             VALUES ($1, $2, $3, $4, $5)",
        )
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
             (vault_config_pubkey, occurred_at, visibility_after, is_public_visible, side, size, route)
             VALUES ($1, $2, $3, $4, $5, $6, $7)",
        )
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
            "INSERT INTO status_events (vault_config_pubkey, occurred_at, status, reason)
             VALUES ($1, $2, $3, $4)",
        )
        .bind(status.vault_config_pubkey)
        .bind(status.occurred_at)
        .bind(status.status)
        .bind(status.reason)
        .execute(pool)
        .await?;
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
}
