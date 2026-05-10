use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
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
    path::Path as FsPath,
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};
use thiserror::Error;
use tokio::{
    process::Command,
    sync::broadcast,
    time::{interval, sleep, Duration},
};
use tower_http::cors::{Any, CorsLayer};
use tracing::{error, info};
use tracing_subscriber::{fmt, EnvFilter};

#[derive(Clone)]
struct AppState {
    store: Store,
    webhook_secret: Option<String>,
    jupiter_api_key: Option<String>,
    jupiter_swap_base_url: String,
    demo_mode: bool,
    surfpool_mode: bool,
    devnet_faucet: DevnetFaucetConfig,
    faucet_claims: Arc<Mutex<HashMap<String, i64>>>,
    quote_cache: Arc<Mutex<HashMap<String, CachedQuote>>>,
    demo_story: Arc<Mutex<DemoStoryState>>,
    realtime: RealtimeHub,
}

#[derive(Clone)]
struct DevnetFaucetConfig {
    enabled: bool,
    mint: String,
    authority_keypair: String,
    amount_ui: String,
    rpc_url: String,
    cooldown_secs: i64,
}

#[derive(Clone)]
struct CachedQuote {
    inserted_at: i64,
    response: Value,
}

#[derive(Debug, Default)]
struct DemoStoryState {
    running: bool,
    stop_requested: bool,
    active_step: Option<String>,
    completed_steps: Vec<String>,
    last_step: Option<DemoStepEvent>,
}

#[derive(Clone)]
struct RealtimeHub {
    tx: broadcast::Sender<RealtimeEvent>,
}

impl RealtimeHub {
    fn new() -> Self {
        let (tx, _) = broadcast::channel(512);
        Self { tx }
    }

    fn subscribe(&self) -> broadcast::Receiver<RealtimeEvent> {
        self.tx.subscribe()
    }

    fn publish(&self, event: RealtimeEvent) {
        let _ = self.tx.send(event);
    }

    fn publish_materialized(&self, updates: &[MaterializedUpdate]) {
        for update in updates {
            let received_at = now_ts();
            if let Some(manager) = &update.manager {
                self.publish(RealtimeEvent::ManagerUpsert {
                    item: manager.clone(),
                    received_at,
                });
            }
            if let Some(vault) = &update.vault {
                self.publish(RealtimeEvent::VaultUpsert {
                    item: vault.clone(),
                    received_at,
                });
            }
            if let Some(position) = &update.position {
                self.publish(RealtimeEvent::PositionUpsert {
                    wallet: position.investor_pubkey.clone(),
                    item: position.clone(),
                    received_at,
                });
            }
            if let Some(point) = &update.nav_point {
                self.publish(RealtimeEvent::NavPoint {
                    vault_config_pubkey: point.vault_config_pubkey.clone(),
                    item: point.clone(),
                    received_at,
                });
            }
            if let Some(trade) = &update.trade {
                if trade.is_public_visible && trade.visibility_after <= received_at {
                    self.publish(RealtimeEvent::TradePublic {
                        vault_config_pubkey: trade.vault_config_pubkey.clone(),
                        item: trade.clone(),
                        received_at,
                    });
                }
            }
            if let Some(status) = &update.status {
                self.publish(RealtimeEvent::StatusEvent {
                    vault_config_pubkey: status.vault_config_pubkey.clone(),
                    item: status.clone(),
                    received_at,
                });
            }
        }
    }
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
    liquid_usdc: f64,
    wsol_exposure_value: f64,
    reserve_status: String,
    execution_env: Option<String>,
    last_market_update: i64,
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
    reputation_score: f64,
    pnl_30d: f64,
    max_drawdown: f64,
    capital_handled: f64,
    claimed_fees: f64,
    frozen_vault_count: i32,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CapitalEvent {
    vault_config_pubkey: String,
    actor_role: String,
    actor: String,
    action: String,
    amount: f64,
    capital_layer: String,
    status: String,
    detail: String,
    occurred_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FeeEvent {
    vault_config_pubkey: String,
    manager: String,
    high_water_mark: f64,
    profit_above_high_water_mark: f64,
    claimable_fees: f64,
    claimed_fees: f64,
    fee_bps: i32,
    detail: String,
    occurred_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct RiskEvent {
    vault_config_pubkey: String,
    state: String,
    previous_state: Option<String>,
    junior_buffer_remaining: f64,
    junior_buffer_used_pct: f64,
    investor_capital_impacted: f64,
    trading_enabled: bool,
    reason: String,
    occurred_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MarketQuote {
    vault_config_pubkey: String,
    route: String,
    input_amount: f64,
    input_symbol: String,
    expected_output: f64,
    output_symbol: String,
    price_impact_pct: f64,
    route_labels: Vec<String>,
    quote_source: String,
    execution_env: String,
    context_slot: Option<i64>,
    fetched_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct DemoStepEvent {
    id: String,
    label: String,
    stage: String,
    summary: String,
    actor: String,
    metric: Option<String>,
    occurred_at: i64,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct DemoStorySnapshot {
    running: bool,
    active_step: Option<String>,
    completed_steps: Vec<String>,
    last_step: Option<DemoStepEvent>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type")]
enum RealtimeEvent {
    #[serde(rename = "manager.upsert")]
    ManagerUpsert {
        item: ManagerView,
        #[serde(rename = "receivedAt")]
        received_at: i64,
    },
    #[serde(rename = "vault.upsert")]
    VaultUpsert {
        item: VaultView,
        #[serde(rename = "receivedAt")]
        received_at: i64,
    },
    #[serde(rename = "position.upsert")]
    PositionUpsert {
        wallet: String,
        item: PositionView,
        #[serde(rename = "receivedAt")]
        received_at: i64,
    },
    #[serde(rename = "nav.point")]
    NavPoint {
        #[serde(rename = "vaultConfigPubkey")]
        vault_config_pubkey: String,
        item: NavPoint,
        #[serde(rename = "receivedAt")]
        received_at: i64,
    },
    #[serde(rename = "trade.public")]
    TradePublic {
        #[serde(rename = "vaultConfigPubkey")]
        vault_config_pubkey: String,
        item: TradeEvent,
        #[serde(rename = "receivedAt")]
        received_at: i64,
    },
    #[serde(rename = "status.event")]
    StatusEvent {
        #[serde(rename = "vaultConfigPubkey")]
        vault_config_pubkey: String,
        item: StatusEvent,
        #[serde(rename = "receivedAt")]
        received_at: i64,
    },
    #[serde(rename = "deposit.event")]
    DepositEvent {
        item: CapitalEvent,
        #[serde(rename = "receivedAt")]
        received_at: i64,
    },
    #[serde(rename = "withdrawal.event")]
    WithdrawalEvent {
        item: CapitalEvent,
        #[serde(rename = "receivedAt")]
        received_at: i64,
    },
    #[serde(rename = "fee.event")]
    FeeEvent {
        item: FeeEvent,
        #[serde(rename = "receivedAt")]
        received_at: i64,
    },
    #[serde(rename = "risk.event")]
    RiskEvent {
        item: RiskEvent,
        #[serde(rename = "receivedAt")]
        received_at: i64,
    },
    #[serde(rename = "market.quote")]
    MarketQuote {
        item: MarketQuote,
        #[serde(rename = "receivedAt")]
        received_at: i64,
    },
    #[serde(rename = "demo.step")]
    DemoStep {
        item: DemoStepEvent,
        #[serde(rename = "receivedAt")]
        received_at: i64,
    },
    #[serde(rename = "heartbeat")]
    Heartbeat {
        #[serde(rename = "receivedAt")]
        received_at: i64,
    },
    #[serde(rename = "resync_required")]
    ResyncRequired {
        topics: Vec<String>,
        #[serde(rename = "receivedAt")]
        received_at: i64,
    },
}

#[derive(Debug, Serialize)]
struct Items<T> {
    items: Vec<T>,
}

#[derive(Debug, Deserialize)]
struct LiveQuery {
    topics: Option<String>,
}

const DEMO_MANAGER_PROFILE: &str = "DemoManager1111111111111111111111111111111";
const DEMO_MANAGER_WALLET: &str = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgS1";
const DEMO_VAULT_CONFIG: &str = "So11111111111111111111111111111111111111112";
const DEMO_VAULT_STATE: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const DEMO_TREASURY: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DEMO_INVESTOR_WALLET: &str = "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN";
const DEMO_POSITION: &str = "DemoPosition111111111111111111111111111111";
const SURFPOOL_CLUSTER: &str = "surfpool-mainnet-fork";
const JUPITER_QUOTE_CACHE_SECS: i64 = 10;

#[derive(Clone, Copy)]
enum DemoStep {
    TraderJoins,
    CreateVault,
    TraderDepositJunior,
    InvestorDeposit,
    ProfitTrade,
    LossTrade,
    InvestorWithdraw,
    TraderWithdraw,
    ClaimFees,
    FreezeVault,
}

#[derive(Clone, Copy)]
enum SurfpoolMarketStep {
    SimulateSwap,
    PriceUp,
    PriceDown,
    ClaimFees,
    InvestorWithdrawHealthy,
    LossAfterWithdrawal,
    FreezeAfterLoss,
    InvestorWithdrawRemaining,
    TraderWithdrawBlocked,
}

#[derive(Clone, Copy)]
enum DemoStoryAction {
    None,
    Demo(DemoStep),
    Surfpool(SurfpoolMarketStep),
    Quote,
}

#[derive(Clone, Copy)]
struct DemoStoryStep {
    id: &'static str,
    label: &'static str,
    summary: &'static str,
    actor: &'static str,
    metric: Option<&'static str>,
    action: DemoStoryAction,
    delay_ms: u64,
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
    #[error("service unavailable: {0}")]
    ServiceUnavailable(String),
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
            AppError::ServiceUnavailable(e) => (StatusCode::SERVICE_UNAVAILABLE, e.clone()),
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
    let memory_store = env::var("ARCADIA_STORE")
        .map(|value| value.eq_ignore_ascii_case("memory"))
        .unwrap_or(false)
        || database_url.eq_ignore_ascii_case("memory");
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
    let demo_mode = env::var("ARCADIA_DEMO_MODE")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let surfpool_mode = env::var("ARCADIA_SURFPOOL_MODE")
        .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
        .unwrap_or(false);
    let devnet_faucet = devnet_faucet_config_from_env();

    let store = if memory_store {
        info!("starting server-rs with in-memory demo store");
        Store::Memory(Arc::new(Mutex::new(MaterializedState::default())))
    } else {
        info!(
            "starting server-rs; connecting to database: {}",
            mask_db_url(&database_url)
        );
        let db = PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await?;
        let mut migrator = sqlx::migrate!("./migrations");
        migrator.set_ignore_missing(true);
        migrator.run(&db).await?;
        Store::Postgres(db)
    };

    if webhook_secret.is_none() {
        info!("HELIUS_WEBHOOK_SECRET not set; webhook receiver accepts unsigned payloads");
    }

    let app = build_app(AppState {
        store,
        webhook_secret,
        jupiter_api_key,
        jupiter_swap_base_url,
        demo_mode,
        surfpool_mode,
        devnet_faucet,
        faucet_claims: Arc::new(Mutex::new(HashMap::new())),
        quote_cache: Arc::new(Mutex::new(HashMap::new())),
        demo_story: Arc::new(Mutex::new(DemoStoryState::default())),
        realtime: RealtimeHub::new(),
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
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);
    Router::new()
        .route("/health", get(health_handler))
        .route("/webhook", post(webhook_handler))
        .route("/live", get(live_handler))
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
        .route("/devnet/faucet/usdc", post(devnet_usdc_faucet_handler))
        .route("/jupiter/quote", get(jupiter_quote_handler))
        .route(
            "/jupiter/swap-instructions",
            post(jupiter_swap_instructions_handler),
        )
        .route("/demo/reset", post(demo_reset_handler))
        .route("/demo/trader-joins", post(demo_trader_joins_handler))
        .route("/demo/create-vault", post(demo_create_vault_handler))
        .route(
            "/demo/trader-deposit-junior",
            post(demo_trader_deposit_junior_handler),
        )
        .route(
            "/demo/investor-deposit",
            post(demo_investor_deposit_handler),
        )
        .route("/demo/profit-trade", post(demo_profit_trade_handler))
        .route("/demo/loss-trade", post(demo_loss_trade_handler))
        .route(
            "/demo/investor-withdraw",
            post(demo_investor_withdraw_handler),
        )
        .route("/demo/trader-withdraw", post(demo_trader_withdraw_handler))
        .route("/demo/claim-fees", post(demo_claim_fees_handler))
        .route("/demo/freeze-vault", post(demo_freeze_vault_handler))
        .route("/demo/run-full", post(demo_run_full_handler))
        .route("/demo/story", get(demo_story_handler))
        .route("/demo/story/reset", post(demo_story_reset_handler))
        .route("/demo/story/run", post(demo_story_run_handler))
        .route("/demo/story/stop", post(demo_story_stop_handler))
        .route("/demo/surfpool/setup", post(demo_surfpool_setup_handler))
        .route(
            "/demo/surfpool/jupiter-quote",
            get(demo_surfpool_jupiter_quote_handler).post(demo_surfpool_jupiter_quote_handler),
        )
        .route(
            "/demo/surfpool/simulate-swap",
            post(demo_surfpool_simulate_swap_handler),
        )
        .route(
            "/demo/surfpool/price-up",
            post(demo_surfpool_price_up_handler),
        )
        .route(
            "/demo/surfpool/price-down",
            post(demo_surfpool_price_down_handler),
        )
        .layer(cors)
        .with_state(Arc::new(state))
}

fn devnet_faucet_config_from_env() -> DevnetFaucetConfig {
    DevnetFaucetConfig {
        enabled: env::var("ARCADIA_DEVNET_FAUCET_ENABLED")
            .map(|value| value == "1" || value.eq_ignore_ascii_case("true"))
            .unwrap_or(false),
        mint: env::var("ARCADIA_DEVNET_USDC_MINT")
            .unwrap_or_else(|_| "DLkVtDD4zfFJzWgGRLqjzqkBhaBs5sVNzDeBCQ2hPgMz".to_string()),
        authority_keypair: env::var("ARCADIA_DEVNET_USDC_MINT_AUTHORITY")
            .or_else(|_| env::var("SOLANA_KEYPAIR"))
            .unwrap_or_else(|_| {
                let home = env::var("HOME").unwrap_or_else(|_| ".".to_string());
                format!("{home}/.config/solana/id.json")
            }),
        amount_ui: env::var("ARCADIA_DEVNET_FAUCET_AMOUNT")
            .unwrap_or_else(|_| "100000".to_string()),
        rpc_url: env::var("ARCADIA_DEVNET_RPC_URL")
            .or_else(|_| env::var("VITE_RPC_URL"))
            .unwrap_or_else(|_| "https://api.devnet.solana.com".to_string()),
        cooldown_secs: env::var("ARCADIA_DEVNET_FAUCET_COOLDOWN_SECS")
            .ok()
            .and_then(|value| value.parse().ok())
            .unwrap_or(60),
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DevnetUsdcFaucetRequest {
    wallet: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct DevnetUsdcFaucetResponse {
    ok: bool,
    mint: String,
    wallet: String,
    amount_ui: String,
    signature: String,
}

async fn devnet_usdc_faucet_handler(
    State(state): State<Arc<AppState>>,
    Json(request): Json<DevnetUsdcFaucetRequest>,
) -> Result<impl IntoResponse, AppError> {
    let config = state.devnet_faucet.clone();
    if !config.enabled {
        return Err(AppError::ServiceUnavailable(
            "Arcadia devnet USDC faucet is not enabled on this server".to_string(),
        ));
    }

    let wallet = request.wallet.trim().to_string();
    if !is_base58_pubkey_like(&wallet) {
        return Err(AppError::BadRequest(
            "invalid Solana wallet address".to_string(),
        ));
    }
    if !is_positive_ui_amount(&config.amount_ui) {
        return Err(AppError::ServiceUnavailable(
            "invalid faucet amount configuration".to_string(),
        ));
    }
    if !is_base58_pubkey_like(&config.mint) {
        return Err(AppError::ServiceUnavailable(
            "invalid faucet mint configuration".to_string(),
        ));
    }
    if !FsPath::new(&config.authority_keypair).exists() {
        return Err(AppError::ServiceUnavailable(
            "devnet USDC mint authority keypair is not available on this server".to_string(),
        ));
    }

    let now = now_ts();
    {
        let claims = state
            .faucet_claims
            .lock()
            .map_err(|_| AppError::StatePoisoned)?;
        if let Some(last_claim_at) = claims.get(&wallet) {
            let retry_after = config.cooldown_secs - (now - *last_claim_at);
            if retry_after > 0 {
                return Err(AppError::BadRequest(format!(
                    "demo USDC already requested; try again in {retry_after}s"
                )));
            }
        }
    }

    let output = Command::new("spl-token")
        .args([
            "transfer",
            "--fund-recipient",
            "--url",
            config.rpc_url.as_str(),
            "--fee-payer",
            config.authority_keypair.as_str(),
            "--owner",
            config.authority_keypair.as_str(),
            "--output",
            "json",
            config.mint.as_str(),
            config.amount_ui.as_str(),
            wallet.as_str(),
        ])
        .output()
        .await
        .map_err(|error| {
            AppError::ServiceUnavailable(format!("spl-token is unavailable: {error}"))
        })?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let detail = first_non_empty_line(&stderr)
            .or_else(|| first_non_empty_line(&stdout))
            .unwrap_or_else(|| "spl-token transfer failed".to_string());
        return Err(AppError::Upstream(format!(
            "devnet USDC faucet failed: {detail}"
        )));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let signature = extract_cli_signature(&stdout).ok_or_else(|| {
        AppError::Upstream("devnet USDC faucet submitted but no signature was returned".to_string())
    })?;

    {
        let mut claims = state
            .faucet_claims
            .lock()
            .map_err(|_| AppError::StatePoisoned)?;
        claims.insert(wallet.clone(), now);
    }

    Ok(Json(DevnetUsdcFaucetResponse {
        ok: true,
        mint: config.mint,
        wallet,
        amount_ui: config.amount_ui,
        signature,
    }))
}

fn is_positive_ui_amount(value: &str) -> bool {
    value
        .parse::<f64>()
        .map(|amount| amount.is_finite() && amount > 0.0)
        .unwrap_or(false)
}

fn is_base58_pubkey_like(value: &str) -> bool {
    const BASE58: &str = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    (32..=44).contains(&value.len()) && value.chars().all(|ch| BASE58.contains(ch))
}

fn first_non_empty_line(value: &str) -> Option<String> {
    value
        .lines()
        .map(str::trim)
        .find(|line| !line.is_empty())
        .map(ToString::to_string)
}

fn extract_cli_signature(stdout: &str) -> Option<String> {
    let parsed = serde_json::from_str::<Value>(stdout).ok()?;
    find_signature_value(&parsed)
}

fn find_signature_value(value: &Value) -> Option<String> {
    match value {
        Value::String(text) if is_signature_like(text) => Some(text.clone()),
        Value::Array(items) => items.iter().find_map(find_signature_value),
        Value::Object(map) => {
            for key in ["signature", "transactionSignature", "txSignature"] {
                if let Some(Value::String(signature)) = map.get(key) {
                    if is_signature_like(signature) {
                        return Some(signature.clone());
                    }
                }
            }
            map.values().find_map(find_signature_value)
        }
        _ => None,
    }
}

fn is_signature_like(value: &str) -> bool {
    (64..=96).contains(&value.len()) && is_base58_chars(value)
}

fn is_base58_chars(value: &str) -> bool {
    const BASE58: &str = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    value.chars().all(|ch| BASE58.contains(ch))
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

async fn live_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
    Query(query): Query<LiveQuery>,
) -> impl IntoResponse {
    let topics = parse_topics(query.topics.as_deref());
    ws.on_upgrade(move |socket| live_socket(socket, state, topics))
}

async fn live_socket(mut socket: WebSocket, state: Arc<AppState>, topics: HashSet<String>) {
    let mut rx = state.realtime.subscribe();
    let mut heartbeat = interval(Duration::from_secs(25));

    if send_realtime(
        &mut socket,
        RealtimeEvent::Heartbeat {
            received_at: now_ts(),
        },
    )
    .await
    .is_err()
    {
        return;
    }

    loop {
        tokio::select! {
            _ = heartbeat.tick() => {
                if send_realtime(&mut socket, RealtimeEvent::Heartbeat { received_at: now_ts() }).await.is_err() {
                    break;
                }
            }
            event = rx.recv() => {
                match event {
                    Ok(event) if topic_matches(&event, &topics) => {
                        if send_realtime(&mut socket, event).await.is_err() {
                            break;
                        }
                    }
                    Ok(_) => {}
                    Err(broadcast::error::RecvError::Lagged(_)) => {
                        let event = RealtimeEvent::ResyncRequired {
                            topics: topics.iter().cloned().collect(),
                            received_at: now_ts(),
                        };
                        if send_realtime(&mut socket, event).await.is_err() {
                            break;
                        }
                    }
                    Err(broadcast::error::RecvError::Closed) => break,
                }
            }
        }
    }
}

async fn send_realtime(socket: &mut WebSocket, event: RealtimeEvent) -> Result<(), axum::Error> {
    socket
        .send(Message::Text(serde_json::to_string(&event).unwrap_or_else(
            |_| "{\"type\":\"resync_required\",\"topics\":[],\"receivedAt\":0}".to_string(),
        )))
        .await
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

async fn demo_reset_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    state.reset_demo().await?;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({ "ok": true, "step": "reset" })),
    ))
}

async fn demo_trader_joins_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    demo_step(state, DemoStep::TraderJoins).await
}

async fn demo_create_vault_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    demo_step(state, DemoStep::CreateVault).await
}

async fn demo_trader_deposit_junior_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    demo_step(state, DemoStep::TraderDepositJunior).await
}

async fn demo_investor_deposit_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    demo_step(state, DemoStep::InvestorDeposit).await
}

async fn demo_profit_trade_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    demo_step(state, DemoStep::ProfitTrade).await
}

async fn demo_loss_trade_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    demo_step(state, DemoStep::LossTrade).await
}

async fn demo_investor_withdraw_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    demo_step(state, DemoStep::InvestorWithdraw).await
}

async fn demo_trader_withdraw_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    demo_step(state, DemoStep::TraderWithdraw).await
}

async fn demo_claim_fees_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    demo_step(state, DemoStep::ClaimFees).await
}

async fn demo_freeze_vault_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    demo_step(state, DemoStep::FreezeVault).await
}

async fn demo_run_full_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    state.reset_demo().await?;
    for step in [
        DemoStep::TraderJoins,
        DemoStep::CreateVault,
        DemoStep::TraderDepositJunior,
        DemoStep::InvestorDeposit,
        DemoStep::ProfitTrade,
        DemoStep::ClaimFees,
        DemoStep::LossTrade,
        DemoStep::InvestorWithdraw,
        DemoStep::FreezeVault,
        DemoStep::TraderWithdraw,
    ] {
        state.apply_demo_step(step).await?;
    }
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({ "ok": true, "step": "run-full" })),
    ))
}

async fn demo_story_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    Ok((StatusCode::OK, Json(state.demo_story_snapshot()?)))
}

async fn demo_story_reset_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    ensure_surfpool_demo(&state)?;
    state.stop_demo_story()?;
    state.reset_demo().await?;
    state.reset_demo_story()?;
    state.publish_story_event(
        DemoStepEvent {
            id: "reset".to_string(),
            label: "Demo reset".to_string(),
            stage: "completed".to_string(),
            summary: "Story state cleared. Ready to record again.".to_string(),
            actor: "protocol".to_string(),
            metric: None,
            occurred_at: now_ts(),
        },
        false,
    )?;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({ "ok": true, "step": "story-reset" })),
    ))
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
struct DemoStoryRunQuery {
    fast: Option<bool>,
}

async fn demo_story_run_handler(
    State(state): State<Arc<AppState>>,
    Query(query): Query<DemoStoryRunQuery>,
) -> Result<impl IntoResponse, AppError> {
    ensure_surfpool_demo(&state)?;
    if query.fast.unwrap_or(false) {
        run_demo_story_sequence(state.clone(), true).await?;
        return Ok((
            StatusCode::OK,
            Json(serde_json::json!({ "ok": true, "step": "story-run", "mode": "fast" })),
        ));
    }

    state.start_demo_story()?;
    let runner = state.clone();
    tokio::spawn(async move {
        if let Err(error) = run_demo_story_sequence(runner.clone(), false).await {
            error!("demo story failed: {:?}", error);
            let _ = runner.publish_story_event(
                DemoStepEvent {
                    id: "story-error".to_string(),
                    label: "Demo story failed".to_string(),
                    stage: "failed".to_string(),
                    summary: error.to_string(),
                    actor: "protocol".to_string(),
                    metric: None,
                    occurred_at: now_ts(),
                },
                false,
            );
            let _ = runner.finish_demo_story(None);
        }
    });

    Ok((
        StatusCode::OK,
        Json(serde_json::json!({ "ok": true, "step": "story-run", "mode": "async" })),
    ))
}

async fn demo_story_stop_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    ensure_surfpool_demo(&state)?;
    state.stop_demo_story()?;
    state.publish_story_event(
        DemoStepEvent {
            id: "stopped".to_string(),
            label: "Demo stopped".to_string(),
            stage: "completed".to_string(),
            summary: "Timed story paused by operator.".to_string(),
            actor: "operator".to_string(),
            metric: None,
            occurred_at: now_ts(),
        },
        false,
    )?;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({ "ok": true, "step": "story-stop" })),
    ))
}

async fn demo_surfpool_setup_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    ensure_surfpool_demo(&state)?;
    state.reset_demo().await?;
    for step in [
        DemoStep::TraderJoins,
        DemoStep::CreateVault,
        DemoStep::TraderDepositJunior,
        DemoStep::InvestorDeposit,
    ] {
        state.apply_demo_step(step).await?;
    }
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "ok": true,
            "step": "surfpool-setup",
            "mode": SURFPOOL_CLUSTER,
            "message": "Demo vault funded with 20,000 USDC junior and 80,000 USDC senior capital."
        })),
    ))
}

async fn demo_surfpool_jupiter_quote_handler(
    State(state): State<Arc<AppState>>,
    Query(query): Query<SurfpoolQuoteQuery>,
) -> Result<impl IntoResponse, AppError> {
    let market_quote = fetch_demo_surfpool_quote(&state, Some(query)).await?;
    state.realtime.publish(RealtimeEvent::MarketQuote {
        item: market_quote.clone(),
        received_at: now_ts(),
    });
    Ok((StatusCode::OK, Json(market_quote)))
}

async fn fetch_demo_surfpool_quote(
    state: &Arc<AppState>,
    query: Option<SurfpoolQuoteQuery>,
) -> Result<MarketQuote, AppError> {
    ensure_surfpool_demo(state)?;
    let query = query.unwrap_or_default();
    let (input_mint, output_mint, route) = surfpool_route_mints(query.route.as_deref())?;
    let amount = query.amount.unwrap_or_else(|| "30000000000".to_string());
    let quote =
        fetch_jupiter_quote_cached(state, input_mint, output_mint, &amount, query.slippage_bps)
            .await?;
    Ok(market_quote_from_jupiter(&quote, &route, now_ts()))
}

async fn demo_surfpool_simulate_swap_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    ensure_surfpool_demo(&state)?;
    state
        .apply_surfpool_market_step(SurfpoolMarketStep::SimulateSwap)
        .await?;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({
            "ok": true,
            "step": "surfpool-simulate-swap",
            "message": "Live quote accepted; execution simulated locally on Surfpool demo state."
        })),
    ))
}

async fn demo_surfpool_price_up_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    ensure_surfpool_demo(&state)?;
    state
        .apply_surfpool_market_step(SurfpoolMarketStep::PriceUp)
        .await?;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({ "ok": true, "step": "surfpool-price-up" })),
    ))
}

async fn demo_surfpool_price_down_handler(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    ensure_surfpool_demo(&state)?;
    state
        .apply_surfpool_market_step(SurfpoolMarketStep::PriceDown)
        .await?;
    Ok((
        StatusCode::OK,
        Json(serde_json::json!({ "ok": true, "step": "surfpool-price-down" })),
    ))
}

async fn demo_step(state: Arc<AppState>, step: DemoStep) -> Result<impl IntoResponse, AppError> {
    state.apply_demo_step(step).await?;
    Ok((StatusCode::OK, Json(serde_json::json!({ "ok": true }))))
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

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SurfpoolQuoteQuery {
    route: Option<String>,
    amount: Option<String>,
    #[serde(default = "default_slippage_bps")]
    slippage_bps: u16,
}

impl Default for SurfpoolQuoteQuery {
    fn default() -> Self {
        Self {
            route: None,
            amount: None,
            slippage_bps: default_slippage_bps(),
        }
    }
}

#[derive(Clone, Copy)]
enum JupiterOperation {
    Quote,
    SwapInstructions,
}

fn ensure_surfpool_demo(state: &AppState) -> Result<(), AppError> {
    if !state.demo_mode {
        return Err(AppError::BadRequest("demo mode disabled".to_string()));
    }
    if !state.surfpool_mode {
        return Err(AppError::BadRequest(
            "Surfpool mode disabled. Set ARCADIA_SURFPOOL_MODE=true.".to_string(),
        ));
    }
    Ok(())
}

fn surfpool_route_mints(
    route: Option<&str>,
) -> Result<(&'static str, &'static str, String), AppError> {
    match route.unwrap_or("UsdcToSol") {
        "UsdcToSol" | "USDC_SOL" | "USDC->SOL" => {
            Ok((USDC_MINT, SOL_MINT, "USDC -> SOL".to_string()))
        }
        "SolToUsdc" | "SOL_USDC" | "SOL->USDC" => {
            Ok((SOL_MINT, USDC_MINT, "SOL -> USDC".to_string()))
        }
        _ => Err(AppError::BadRequest(
            "Surfpool demo only supports USDC -> SOL and SOL -> USDC.".to_string(),
        )),
    }
}

async fn fetch_jupiter_quote_cached(
    state: &AppState,
    input_mint: &str,
    output_mint: &str,
    amount: &str,
    slippage_bps: u16,
) -> Result<Value, AppError> {
    if let Some(response) = jupiter_gate(
        state,
        SURFPOOL_CLUSTER,
        input_mint,
        output_mint,
        Some(slippage_bps),
        JupiterOperation::Quote,
    ) {
        let status = response.status();
        return if status == StatusCode::SERVICE_UNAVAILABLE {
            Err(AppError::ServiceUnavailable(
                "JUPITER_API_KEY is not configured on the server.".to_string(),
            ))
        } else {
            Err(AppError::BadRequest(
                "Jupiter quote is not available for this Surfpool request.".to_string(),
            ))
        };
    }

    amount
        .parse::<u64>()
        .map_err(|_| AppError::BadRequest("amount must be a positive integer".to_string()))?;

    let cache_key = format!("{input_mint}:{output_mint}:{amount}:{slippage_bps}");
    let now = now_ts();
    if let Some(cached) = state
        .quote_cache
        .lock()
        .map_err(|_| AppError::StatePoisoned)?
        .get(&cache_key)
        .cloned()
    {
        if now - cached.inserted_at <= JUPITER_QUOTE_CACHE_SECS {
            return Ok(cached.response);
        }
    }

    let slippage_bps_string = slippage_bps.to_string();
    let params = [
        ("inputMint", input_mint),
        ("outputMint", output_mint),
        ("amount", amount),
        ("slippageBps", slippage_bps_string.as_str()),
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
    let status = response.status();
    let body = response
        .json::<Value>()
        .await
        .unwrap_or_else(|_| serde_json::json!({}));
    if !status.is_success() {
        return Err(AppError::Upstream(format!(
            "Jupiter quote request failed with status {status}: {body}"
        )));
    }
    state
        .quote_cache
        .lock()
        .map_err(|_| AppError::StatePoisoned)?
        .insert(
            cache_key,
            CachedQuote {
                inserted_at: now,
                response: body.clone(),
            },
        );
    Ok(body)
}

fn market_quote_from_jupiter(quote: &Value, fallback_route: &str, fetched_at: i64) -> MarketQuote {
    let input_mint = quote
        .get("inputMint")
        .and_then(Value::as_str)
        .unwrap_or(USDC_MINT);
    let output_mint = quote
        .get("outputMint")
        .and_then(Value::as_str)
        .unwrap_or(SOL_MINT);
    let input_symbol = mint_symbol(input_mint);
    let output_symbol = mint_symbol(output_mint);
    let input_amount = token_amount(
        quote.get("inAmount").and_then(Value::as_str).unwrap_or("0"),
        input_symbol,
    );
    let expected_output = token_amount(
        quote
            .get("outAmount")
            .and_then(Value::as_str)
            .unwrap_or("0"),
        output_symbol,
    );
    let route_labels = quote
        .get("routePlan")
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(|item| {
                    item.get("swapInfo")
                        .and_then(|swap| swap.get("label"))
                        .and_then(Value::as_str)
                        .map(ToString::to_string)
                })
                .collect::<Vec<_>>()
        })
        .filter(|labels| !labels.is_empty())
        .unwrap_or_else(|| vec!["Jupiter route".to_string()]);

    MarketQuote {
        vault_config_pubkey: DEMO_VAULT_CONFIG.to_string(),
        route: if input_symbol != "Unknown" && output_symbol != "Unknown" {
            format!("{input_symbol} -> {output_symbol}")
        } else {
            fallback_route.to_string()
        },
        input_amount,
        input_symbol: input_symbol.to_string(),
        expected_output,
        output_symbol: output_symbol.to_string(),
        price_impact_pct: quote
            .get("priceImpactPct")
            .and_then(|value| value.as_f64().or_else(|| value.as_str()?.parse().ok()))
            .unwrap_or_default()
            * 100.0,
        route_labels,
        quote_source: "Jupiter mainnet".to_string(),
        execution_env: "Surfpool local simulation".to_string(),
        context_slot: quote.get("contextSlot").and_then(Value::as_i64),
        fetched_at,
    }
}

fn mint_symbol(mint: &str) -> &'static str {
    if mint == SOL_MINT {
        "SOL"
    } else if mint == USDC_MINT {
        "USDC"
    } else {
        "Unknown"
    }
}

fn token_amount(raw: &str, symbol: &str) -> f64 {
    let units = raw.parse::<f64>().unwrap_or_default();
    let decimals = if symbol == "SOL" {
        1_000_000_000.0
    } else {
        1_000_000.0
    };
    units / decimals
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
        JupiterOperation::Quote,
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
    if let Some(response) = jupiter_gate(
        &state,
        &payload.cluster,
        input_mint,
        output_mint,
        None,
        JupiterOperation::SwapInstructions,
    ) {
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
    operation: JupiterOperation,
) -> Option<axum::response::Response> {
    let is_surfpool_quote = cluster == SURFPOOL_CLUSTER
        && state.surfpool_mode
        && matches!(operation, JupiterOperation::Quote);
    if cluster == SURFPOOL_CLUSTER
        && state.surfpool_mode
        && matches!(operation, JupiterOperation::SwapInstructions)
    {
        return Some((
            StatusCode::CONFLICT,
            Json(serde_json::json!({
                "mode": "surfpool",
                "reason": "Surfpool demo uses live Jupiter quotes with local simulated execution; swap instructions remain mainnet-beta only."
            })),
        ).into_response());
    }
    if cluster != "mainnet-beta" && !is_surfpool_quote {
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
                let result = sqlx::query(
                    "INSERT INTO raw_events (event_key, kind, payload) VALUES ($1, $2, $3)
                     ON CONFLICT (event_key) DO NOTHING",
                )
                .bind(&raw_event_key)
                .bind(&kind)
                .bind(&payload)
                .execute(pool)
                .await?;
                if result.rows_affected() == 0 {
                    return Ok(());
                }
                apply_update_postgres(pool, updates.clone()).await?;
            }
            Store::Memory(state) => {
                let mut state = state.lock().map_err(|_| AppError::StatePoisoned)?;
                if !state.raw_event_keys.insert(raw_event_key) {
                    return Ok(());
                }
                state.raw_events.push(payload);
                state.apply_updates(updates.clone());
            }
        }
        self.realtime.publish_materialized(&updates);
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
                    "SELECT pubkey, owner, total_vaults, active_vaults, total_junior_deposited, created_at,
                            reputation_score, pnl_30d, max_drawdown, capital_handled, claimed_fees, frozen_vault_count
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
                    "SELECT pubkey, owner, total_vaults, active_vaults, total_junior_deposited, created_at,
                            reputation_score, pnl_30d, max_drawdown, capital_handled, claimed_fees, frozen_vault_count
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

    async fn reset_demo(&self) -> Result<(), AppError> {
        if !self.demo_mode {
            return Err(AppError::BadRequest("demo mode disabled".to_string()));
        }
        match &self.store {
            Store::Postgres(pool) => {
                sqlx::query(
                    "DELETE FROM investor_positions WHERE pubkey = $1 OR vault_config_pubkey = $2",
                )
                .bind(DEMO_POSITION)
                .bind(DEMO_VAULT_CONFIG)
                .execute(pool)
                .await?;
                sqlx::query("DELETE FROM nav_points WHERE vault_config_pubkey = $1")
                    .bind(DEMO_VAULT_CONFIG)
                    .execute(pool)
                    .await?;
                sqlx::query("DELETE FROM trade_events WHERE vault_config_pubkey = $1")
                    .bind(DEMO_VAULT_CONFIG)
                    .execute(pool)
                    .await?;
                sqlx::query("DELETE FROM status_events WHERE vault_config_pubkey = $1")
                    .bind(DEMO_VAULT_CONFIG)
                    .execute(pool)
                    .await?;
                sqlx::query("DELETE FROM vaults WHERE config_pubkey = $1")
                    .bind(DEMO_VAULT_CONFIG)
                    .execute(pool)
                    .await?;
                sqlx::query("DELETE FROM manager_profiles WHERE pubkey = $1")
                    .bind(DEMO_MANAGER_PROFILE)
                    .execute(pool)
                    .await?;
                sqlx::query("DELETE FROM raw_events WHERE event_key LIKE 'arcadia-demo:%'")
                    .execute(pool)
                    .await?;
            }
            Store::Memory(state) => {
                let mut state = state.lock().map_err(|_| AppError::StatePoisoned)?;
                state.managers.remove(DEMO_MANAGER_PROFILE);
                state.vaults.remove(DEMO_VAULT_CONFIG);
                state.positions.remove(DEMO_POSITION);
                state
                    .nav_points
                    .retain(|point| point.vault_config_pubkey != DEMO_VAULT_CONFIG);
                state
                    .trades
                    .retain(|trade| trade.vault_config_pubkey != DEMO_VAULT_CONFIG);
                state
                    .status_events
                    .retain(|event| event.vault_config_pubkey != DEMO_VAULT_CONFIG);
                state.raw_events.clear();
                state.raw_event_keys.clear();
                state.nav_event_keys.clear();
                state.trade_event_keys.clear();
                state.status_event_keys.clear();
            }
        }
        self.realtime.publish(RealtimeEvent::ResyncRequired {
            topics: vec!["vaults".to_string(), "managers".to_string()],
            received_at: now_ts(),
        });
        Ok(())
    }

    async fn apply_demo_step(&self, step: DemoStep) -> Result<(), AppError> {
        if !self.demo_mode {
            return Err(AppError::BadRequest("demo mode disabled".to_string()));
        }
        let (kind, payload, extra_events) = demo_payload(step);
        self.record_webhook(Some(kind.to_string()), payload).await?;
        for event in extra_events {
            self.realtime.publish(event);
        }
        Ok(())
    }

    async fn apply_surfpool_market_step(&self, step: SurfpoolMarketStep) -> Result<(), AppError> {
        if !self.demo_mode || !self.surfpool_mode {
            return Err(AppError::BadRequest(
                "Surfpool demo mode disabled".to_string(),
            ));
        }
        let (kind, payload, extra_events) = surfpool_market_payload(step);
        self.record_webhook(Some(kind.to_string()), payload).await?;
        for event in extra_events {
            self.realtime.publish(event);
        }
        Ok(())
    }

    fn demo_story_snapshot(&self) -> Result<DemoStorySnapshot, AppError> {
        let story = self
            .demo_story
            .lock()
            .map_err(|_| AppError::StatePoisoned)?;
        Ok(DemoStorySnapshot {
            running: story.running,
            active_step: story.active_step.clone(),
            completed_steps: story.completed_steps.clone(),
            last_step: story.last_step.clone(),
        })
    }

    fn reset_demo_story(&self) -> Result<(), AppError> {
        let mut story = self
            .demo_story
            .lock()
            .map_err(|_| AppError::StatePoisoned)?;
        *story = DemoStoryState::default();
        Ok(())
    }

    fn start_demo_story(&self) -> Result<(), AppError> {
        let mut story = self
            .demo_story
            .lock()
            .map_err(|_| AppError::StatePoisoned)?;
        if story.running {
            return Err(AppError::BadRequest(
                "demo story already running".to_string(),
            ));
        }
        story.running = true;
        story.stop_requested = false;
        story.active_step = None;
        story.completed_steps.clear();
        story.last_step = None;
        Ok(())
    }

    fn finish_demo_story(&self, completed_step: Option<&str>) -> Result<(), AppError> {
        let mut story = self
            .demo_story
            .lock()
            .map_err(|_| AppError::StatePoisoned)?;
        if let Some(step) = completed_step {
            if !story.completed_steps.iter().any(|id| id == step) {
                story.completed_steps.push(step.to_string());
            }
        }
        story.running = false;
        story.active_step = None;
        story.stop_requested = false;
        Ok(())
    }

    fn stop_demo_story(&self) -> Result<(), AppError> {
        let mut story = self
            .demo_story
            .lock()
            .map_err(|_| AppError::StatePoisoned)?;
        story.stop_requested = true;
        story.running = false;
        story.active_step = None;
        Ok(())
    }

    fn should_stop_demo_story(&self) -> Result<bool, AppError> {
        let story = self
            .demo_story
            .lock()
            .map_err(|_| AppError::StatePoisoned)?;
        Ok(story.stop_requested)
    }

    fn publish_story_event(&self, event: DemoStepEvent, completed: bool) -> Result<(), AppError> {
        {
            let mut story = self
                .demo_story
                .lock()
                .map_err(|_| AppError::StatePoisoned)?;
            story.last_step = Some(event.clone());
            match event.stage.as_str() {
                "active" => story.active_step = Some(event.id.clone()),
                "completed" => {
                    if completed && !story.completed_steps.iter().any(|id| id == &event.id) {
                        story.completed_steps.push(event.id.clone());
                    }
                    if story.active_step.as_deref() == Some(event.id.as_str()) {
                        story.active_step = None;
                    }
                }
                "failed" => {
                    story.running = false;
                    story.active_step = None;
                }
                _ => {}
            }
        }
        self.realtime.publish(RealtimeEvent::DemoStep {
            item: event,
            received_at: now_ts(),
        });
        Ok(())
    }
}

fn demo_story_steps() -> Vec<DemoStoryStep> {
    vec![
        DemoStoryStep {
            id: "trader-joins",
            label: "Trader joins Arcadia",
            summary: "Manager profile appears with zero investor capital.",
            actor: "trader",
            metric: Some("Profile live"),
            action: DemoStoryAction::Demo(DemoStep::TraderJoins),
            delay_ms: 900,
        },
        DemoStoryStep {
            id: "paper-mode",
            label: "Paper mode starts",
            summary: "Vault is created in proof mode before investors can deposit.",
            actor: "protocol",
            metric: Some("30 day proof window"),
            action: DemoStoryAction::Demo(DemoStep::CreateVault),
            delay_ms: 900,
        },
        DemoStoryStep {
            id: "proof-built",
            label: "Performance record builds",
            summary: "Public proof routes reputation into marketplace visibility.",
            actor: "protocol",
            metric: Some("12 public trades"),
            action: DemoStoryAction::None,
            delay_ms: 800,
        },
        DemoStoryStep {
            id: "junior-funded",
            label: "Trader posts junior capital",
            summary: "20,000 USDC becomes the first-loss buffer.",
            actor: "trader",
            metric: Some("20,000 USDC junior"),
            action: DemoStoryAction::Demo(DemoStep::TraderDepositJunior),
            delay_ms: 900,
        },
        DemoStoryStep {
            id: "investor-deposit",
            label: "Investor deposits senior capital",
            summary: "80,000 USDC enters the vault after proof mode.",
            actor: "investor",
            metric: Some("80,000 USDC senior"),
            action: DemoStoryAction::Demo(DemoStep::InvestorDeposit),
            delay_ms: 900,
        },
        DemoStoryStep {
            id: "jupiter-quote",
            label: "Live Jupiter quote",
            summary: "Arcadia fetches a real SOL/USDC route while execution remains local.",
            actor: "market",
            metric: Some("USDC -> SOL"),
            action: DemoStoryAction::Quote,
            delay_ms: 900,
        },
        DemoStoryStep {
            id: "surfpool-swap",
            label: "Surfpool swap simulation",
            summary: "The quote is applied to local mainnet-fork demo state.",
            actor: "market",
            metric: Some("30,000 USDC exposure"),
            action: DemoStoryAction::Surfpool(SurfpoolMarketStep::SimulateSwap),
            delay_ms: 900,
        },
        DemoStoryStep {
            id: "profit",
            label: "Profit lifts NAV",
            summary: "SOL marks up 5%, investor value grows, and trader fees become claimable.",
            actor: "market",
            metric: Some("NAV +1.5%"),
            action: DemoStoryAction::Surfpool(SurfpoolMarketStep::PriceUp),
            delay_ms: 1_000,
        },
        DemoStoryStep {
            id: "fee-claimed",
            label: "Trader earns on performance",
            summary: "Fees are claimed only above the high-water mark.",
            actor: "trader",
            metric: Some("300 USDC fee"),
            action: DemoStoryAction::Surfpool(SurfpoolMarketStep::ClaimFees),
            delay_ms: 900,
        },
        DemoStoryStep {
            id: "investor-withdraw-profit",
            label: "Investor withdraws mid-vault",
            summary: "Investor exits part of their claim without waiting on the trader.",
            actor: "investor",
            metric: Some("10,000 USDC paid"),
            action: DemoStoryAction::Surfpool(SurfpoolMarketStep::InvestorWithdrawHealthy),
            delay_ms: 900,
        },
        DemoStoryStep {
            id: "loss-buffer",
            label: "Loss hits junior buffer first",
            summary: "A SOL drawdown reduces trader capital while investor capital stays intact.",
            actor: "market",
            metric: Some("Investor impact 0"),
            action: DemoStoryAction::Surfpool(SurfpoolMarketStep::LossAfterWithdrawal),
            delay_ms: 1_000,
        },
        DemoStoryStep {
            id: "frozen",
            label: "Protection exhausted",
            summary: "A deeper drawdown depletes junior capital and freezes trading.",
            actor: "protocol",
            metric: Some("Trading disabled"),
            action: DemoStoryAction::Surfpool(SurfpoolMarketStep::FreezeAfterLoss),
            delay_ms: 1_000,
        },
        DemoStoryStep {
            id: "investor-withdraw-remaining",
            label: "Investor exits remaining claim",
            summary: "Remaining investor claim is paid after the vault freezes.",
            actor: "investor",
            metric: Some("68,200 USDC paid"),
            action: DemoStoryAction::Surfpool(SurfpoolMarketStep::InvestorWithdrawRemaining),
            delay_ms: 900,
        },
        DemoStoryStep {
            id: "trader-withdraw-blocked",
            label: "Trader withdrawal blocked",
            summary: "Frozen vaults prioritize investor exits and block trader withdrawals.",
            actor: "protocol",
            metric: Some("Blocked"),
            action: DemoStoryAction::Surfpool(SurfpoolMarketStep::TraderWithdrawBlocked),
            delay_ms: 900,
        },
        DemoStoryStep {
            id: "story-complete",
            label: "Demo complete",
            summary:
                "The full lifecycle proves reputation, earnings, loss priority, and withdrawals.",
            actor: "protocol",
            metric: Some("Recording ready"),
            action: DemoStoryAction::None,
            delay_ms: 0,
        },
    ]
}

async fn run_demo_story_sequence(state: Arc<AppState>, fast: bool) -> Result<(), AppError> {
    if fast {
        state.start_demo_story()?;
    }
    state.reset_demo().await?;
    {
        let mut story = state
            .demo_story
            .lock()
            .map_err(|_| AppError::StatePoisoned)?;
        story.running = true;
        story.stop_requested = false;
        story.active_step = None;
        story.completed_steps.clear();
        story.last_step = None;
    }

    for step in demo_story_steps() {
        if state.should_stop_demo_story()? {
            break;
        }
        let active = story_event(&step, "active");
        state.publish_story_event(active, false)?;

        match step.action {
            DemoStoryAction::None => {}
            DemoStoryAction::Demo(demo_step) => state.apply_demo_step(demo_step).await?,
            DemoStoryAction::Surfpool(market_step) => {
                state.apply_surfpool_market_step(market_step).await?;
            }
            DemoStoryAction::Quote => {
                let quote = fetch_demo_surfpool_quote(&state, None).await?;
                state.realtime.publish(RealtimeEvent::MarketQuote {
                    item: quote,
                    received_at: now_ts(),
                });
            }
        }

        let completed = story_event(&step, "completed");
        state.publish_story_event(completed, true)?;
        if !fast && step.delay_ms > 0 {
            sleep(Duration::from_millis(step.delay_ms)).await;
        }
    }

    state.finish_demo_story(None)?;
    Ok(())
}

fn story_event(step: &DemoStoryStep, stage: &str) -> DemoStepEvent {
    DemoStepEvent {
        id: step.id.to_string(),
        label: step.label.to_string(),
        stage: stage.to_string(),
        summary: step.summary.to_string(),
        actor: step.actor.to_string(),
        metric: step.metric.map(ToString::to_string),
        occurred_at: now_ts(),
    }
}

#[derive(Default, Clone)]
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

fn demo_payload(step: DemoStep) -> (&'static str, Value, Vec<RealtimeEvent>) {
    let now = now_ts();
    let received_at = now;
    let mut extras = Vec::new();
    let (kind, manager, vault, position, nav, trade, status) = match step {
        DemoStep::TraderJoins => (
            "arcadia-demo:trader-joins",
            Some(demo_manager(120.0, 0.0, 0.0, 0.0, 0.0, 0)),
            None,
            None,
            None,
            None,
            None,
        ),
        DemoStep::CreateVault => (
            "arcadia-demo:create-vault",
            Some(demo_manager(160.0, 0.0, 0.0, 0.0, 0.0, 0)),
            Some(demo_vault(
                "paper", 0.0, 0.0, 0.0, 0.0, 100_000.0, true, 4, now,
            )),
            None,
            Some(demo_nav(0.0, 0.0, 0.0, now)),
            None,
            Some(demo_status("paper", "Trader entered proof mode", now)),
        ),
        DemoStep::TraderDepositJunior => {
            extras.push(RealtimeEvent::DepositEvent {
                item: demo_capital_event(
                    "trader",
                    DEMO_MANAGER_WALLET,
                    "deposited",
                    20_000.0,
                    "junior",
                    "confirmed",
                    "Trader posted first-loss capital",
                    now,
                ),
                received_at,
            });
            (
                "arcadia-demo:trader-deposit-junior",
                Some(demo_manager(210.0, 0.0, 0.0, 0.0, 0.0, 0)),
                Some(demo_vault(
                    "paper", 20_000.0, 0.0, 20_000.0, 20_000.0, 100_000.0, true, 9, now,
                )),
                None,
                Some(demo_nav(20_000.0, 20_000.0, 0.0, now)),
                None,
                Some(demo_status("paper", "Junior buffer funded", now)),
            )
        }
        DemoStep::InvestorDeposit => {
            extras.push(RealtimeEvent::DepositEvent {
                item: demo_capital_event(
                    "investor",
                    DEMO_INVESTOR_WALLET,
                    "deposited",
                    80_000.0,
                    "senior",
                    "confirmed",
                    "Investor capital entered the vault",
                    now,
                ),
                received_at,
            });
            (
                "arcadia-demo:investor-deposit",
                Some(demo_manager(280.0, 0.0, 0.0, 100_000.0, 0.0, 0)),
                Some(demo_vault(
                    "active", 20_000.0, 80_000.0, 100_000.0, 20_000.0, 100_000.0, true, 12, now,
                )),
                Some(demo_position(80_000.0, 80_000.0, now)),
                Some(demo_nav(100_000.0, 20_000.0, 80_000.0, now)),
                None,
                Some(demo_status("active", "Vault opened to senior capital", now)),
            )
        }
        DemoStep::ProfitTrade => {
            extras.push(RealtimeEvent::FeeEvent {
                item: demo_fee_event(
                    100_000.0,
                    10_000.0,
                    2_000.0,
                    0.0,
                    "Performance fee is now claimable",
                    now,
                ),
                received_at,
            });
            (
                "arcadia-demo:profit-trade",
                Some(demo_manager(390.0, 10.0, -2.5, 110_000.0, 0.0, 0)),
                Some(demo_vault(
                    "active", 30_000.0, 80_000.0, 110_000.0, 20_000.0, 100_000.0, true, 14, now,
                )),
                Some(demo_position(80_000.0, 80_000.0, now)),
                Some(demo_nav(110_000.0, 30_000.0, 80_000.0, now)),
                Some(demo_trade("USDC -> SOL", 18_000.0, now)),
                Some(demo_status(
                    "active",
                    "NAV moved above high-water mark",
                    now,
                )),
            )
        }
        DemoStep::ClaimFees => {
            extras.push(RealtimeEvent::FeeEvent {
                item: demo_fee_event(
                    108_000.0,
                    0.0,
                    0.0,
                    2_000.0,
                    "Trader claimed performance fee earned above HWM",
                    now,
                ),
                received_at,
            });
            (
                "arcadia-demo:claim-fees",
                Some(demo_manager(420.0, 8.0, -2.5, 108_000.0, 2_000.0, 0)),
                Some(demo_vault(
                    "active", 28_000.0, 80_000.0, 108_000.0, 20_000.0, 108_000.0, true, 15, now,
                )),
                Some(demo_position(80_000.0, 80_000.0, now)),
                Some(demo_nav(108_000.0, 28_000.0, 80_000.0, now)),
                None,
                Some(demo_status(
                    "active",
                    "Fees claimed after new performance",
                    now,
                )),
            )
        }
        DemoStep::LossTrade => {
            extras.push(RealtimeEvent::RiskEvent {
                item: demo_risk(
                    "caution",
                    Some("healthy"),
                    8_000.0,
                    60.0,
                    0.0,
                    true,
                    "Loss absorbed by trader junior capital",
                    now,
                ),
                received_at,
            });
            (
                "arcadia-demo:loss-trade",
                Some(demo_manager(330.0, -12.0, -12.0, 88_000.0, 2_000.0, 0)),
                Some(demo_vault(
                    "cooldown", 8_000.0, 80_000.0, 88_000.0, 20_000.0, 108_000.0, true, 16, now,
                )),
                Some(demo_position(80_000.0, 80_000.0, now)),
                Some(demo_nav(88_000.0, 8_000.0, 80_000.0, now)),
                Some(demo_trade("SOL -> USDC", 22_000.0, now)),
                Some(demo_status(
                    "cooldown",
                    "Junior buffer weakened; position limits reduced",
                    now,
                )),
            )
        }
        DemoStep::InvestorWithdraw => {
            extras.push(RealtimeEvent::WithdrawalEvent {
                item: demo_capital_event(
                    "investor",
                    DEMO_INVESTOR_WALLET,
                    "withdrew",
                    5_000.0,
                    "senior",
                    "confirmed",
                    "Mid-vault withdrawal paid from liquid USDC",
                    now,
                ),
                received_at,
            });
            (
                "arcadia-demo:investor-withdraw",
                Some(demo_manager(325.0, -12.0, -12.0, 83_000.0, 2_000.0, 0)),
                Some(demo_vault(
                    "cooldown", 8_000.0, 75_000.0, 83_000.0, 20_000.0, 108_000.0, true, 16, now,
                )),
                Some(demo_position(75_000.0, 75_000.0, now)),
                Some(demo_nav(83_000.0, 8_000.0, 75_000.0, now)),
                None,
                Some(demo_status("cooldown", "Investor withdrawal settled", now)),
            )
        }
        DemoStep::TraderWithdraw => {
            extras.push(RealtimeEvent::WithdrawalEvent {
                item: demo_capital_event(
                    "trader",
                    DEMO_MANAGER_WALLET,
                    "blocked withdrawal",
                    3_000.0,
                    "junior",
                    "blocked",
                    "Trader cannot withdraw while vault is frozen or exit-priority",
                    now,
                ),
                received_at,
            });
            (
                "arcadia-demo:trader-withdraw",
                Some(demo_manager(170.0, -22.0, -22.0, 73_000.0, 2_000.0, 1)),
                Some(demo_vault(
                    "frozen", 0.0, 73_000.0, 73_000.0, 20_000.0, 108_000.0, false, 16, now,
                )),
                Some(demo_position(75_000.0, 73_000.0, now)),
                Some(demo_nav(73_000.0, 0.0, 73_000.0, now)),
                None,
                Some(demo_status(
                    "frozen",
                    "Trader withdrawal blocked; investor exits take priority",
                    now,
                )),
            )
        }
        DemoStep::FreezeVault => {
            extras.push(RealtimeEvent::RiskEvent {
                item: demo_risk(
                    "frozen",
                    Some("caution"),
                    0.0,
                    100.0,
                    2_000.0,
                    false,
                    "Junior buffer depleted; trading disabled",
                    now,
                ),
                received_at,
            });
            (
                "arcadia-demo:freeze-vault",
                Some(demo_manager(180.0, -22.0, -22.0, 73_000.0, 2_000.0, 1)),
                Some(demo_vault(
                    "frozen", 0.0, 73_000.0, 73_000.0, 20_000.0, 108_000.0, false, 16, now,
                )),
                Some(demo_position(75_000.0, 73_000.0, now)),
                Some(demo_nav(73_000.0, 0.0, 73_000.0, now)),
                Some(demo_trade("SOL -> USDC", 14_000.0, now)),
                Some(demo_status(
                    "frozen",
                    "Junior buffer depleted; trading disabled",
                    now,
                )),
            )
        }
    };

    let payload = serde_json::json!({
        "signature": format!("{kind}:{}", now_nonce()),
        "kind": kind,
        "data": {
            "manager": manager,
            "vault": vault,
            "position": position,
            "navPoint": nav,
            "trade": trade,
            "statusEvent": status
        }
    });
    (kind, payload, extras)
}

fn surfpool_market_payload(step: SurfpoolMarketStep) -> (&'static str, Value, Vec<RealtimeEvent>) {
    let now = now_ts();
    let received_at = now;
    let mut extras = Vec::new();
    let (kind, manager, vault, position, nav, trade, status) = match step {
        SurfpoolMarketStep::SimulateSwap => (
            "arcadia-demo:surfpool-simulate-swap",
            Some(demo_manager(285.0, 0.0, 0.0, 100_000.0, 0.0, 0)),
            Some(demo_vault_market(
                "active",
                20_000.0,
                80_000.0,
                100_000.0,
                20_000.0,
                100_000.0,
                true,
                13,
                now,
                70_000.0,
                30_000.0,
                "ok",
                Some("surfpool"),
            )),
            Some(demo_position(80_000.0, 80_000.0, now)),
            Some(demo_nav(100_000.0, 20_000.0, 80_000.0, now)),
            Some(demo_trade(
                "USDC -> SOL · Surfpool simulation",
                30_000.0,
                now,
            )),
            Some(demo_status(
                "active",
                "Jupiter quote accepted; execution simulated locally on Surfpool",
                now,
            )),
        ),
        SurfpoolMarketStep::PriceUp => {
            extras.push(RealtimeEvent::FeeEvent {
                item: demo_fee_event(
                    100_000.0,
                    1_500.0,
                    300.0,
                    0.0,
                    "SOL exposure moved above high-water mark; fee is claimable",
                    now,
                ),
                received_at,
            });
            (
                "arcadia-demo:surfpool-price-up",
                Some(demo_manager(300.0, 1.5, -0.8, 101_500.0, 0.0, 0)),
                Some(demo_vault_market(
                    "active",
                    21_500.0,
                    80_000.0,
                    101_500.0,
                    20_000.0,
                    100_000.0,
                    true,
                    14,
                    now,
                    70_000.0,
                    31_500.0,
                    "ok",
                    Some("surfpool"),
                )),
                Some(demo_position(80_000.0, 80_000.0, now)),
                Some(demo_nav(101_500.0, 21_500.0, 80_000.0, now)),
                Some(demo_trade("SOL mark +5%", 1_500.0, now)),
                Some(demo_status(
                    "active",
                    "NAV +1.5%; trader fee is now claimable",
                    now,
                )),
            )
        }
        SurfpoolMarketStep::PriceDown => {
            extras.push(RealtimeEvent::RiskEvent {
                item: demo_risk(
                    "caution",
                    Some("healthy"),
                    15_500.0,
                    22.5,
                    0.0,
                    true,
                    "SOL moved lower; trader junior capital absorbs the loss first",
                    now,
                ),
                received_at,
            });
            (
                "arcadia-demo:surfpool-price-down",
                Some(demo_manager(265.0, -4.5, -4.5, 95_500.0, 0.0, 0)),
                Some(demo_vault_market(
                    "cooldown",
                    15_500.0,
                    80_000.0,
                    95_500.0,
                    20_000.0,
                    100_000.0,
                    true,
                    15,
                    now,
                    70_000.0,
                    25_500.0,
                    "ok",
                    Some("surfpool"),
                )),
                Some(demo_position(80_000.0, 80_000.0, now)),
                Some(demo_nav(95_500.0, 15_500.0, 80_000.0, now)),
                Some(demo_trade("SOL mark -15%", 4_500.0, now)),
                Some(demo_status(
                    "cooldown",
                    "Junior buffer absorbed the drawdown; investor capital remains intact",
                    now,
                )),
            )
        }
        SurfpoolMarketStep::ClaimFees => {
            extras.push(RealtimeEvent::FeeEvent {
                item: demo_fee_event(
                    101_500.0,
                    0.0,
                    0.0,
                    300.0,
                    "Trader claimed only the profit fee above the high-water mark",
                    now,
                ),
                received_at,
            });
            (
                "arcadia-demo:surfpool-claim-fees",
                Some(demo_manager(304.0, 1.2, -0.8, 101_200.0, 300.0, 0)),
                Some(demo_vault_market(
                    "active",
                    21_200.0,
                    80_000.0,
                    101_200.0,
                    20_000.0,
                    101_500.0,
                    true,
                    14,
                    now,
                    69_700.0,
                    31_500.0,
                    "ok",
                    Some("surfpool"),
                )),
                Some(demo_position(80_000.0, 80_000.0, now)),
                Some(demo_nav(101_200.0, 21_200.0, 80_000.0, now)),
                None,
                Some(demo_status(
                    "active",
                    "Performance fee claimed above HWM",
                    now,
                )),
            )
        }
        SurfpoolMarketStep::InvestorWithdrawHealthy => {
            extras.push(RealtimeEvent::WithdrawalEvent {
                item: demo_capital_event(
                    "investor",
                    DEMO_INVESTOR_WALLET,
                    "withdrew",
                    10_000.0,
                    "senior",
                    "confirmed",
                    "Mid-vault withdrawal paid from liquid USDC",
                    now,
                ),
                received_at,
            });
            (
                "arcadia-demo:surfpool-investor-withdraw-profit",
                Some(demo_manager(304.0, 1.2, -0.8, 91_200.0, 300.0, 0)),
                Some(demo_vault_market(
                    "active",
                    21_200.0,
                    70_000.0,
                    91_200.0,
                    20_000.0,
                    101_500.0,
                    true,
                    14,
                    now,
                    59_700.0,
                    31_500.0,
                    "ok",
                    Some("surfpool"),
                )),
                Some(demo_position(70_000.0, 70_000.0, now)),
                Some(demo_nav(91_200.0, 21_200.0, 70_000.0, now)),
                None,
                Some(demo_status(
                    "active",
                    "Investor withdrew without trader approval",
                    now,
                )),
            )
        }
        SurfpoolMarketStep::LossAfterWithdrawal => {
            extras.push(RealtimeEvent::RiskEvent {
                item: demo_risk(
                    "caution",
                    Some("healthy"),
                    15_200.0,
                    24.0,
                    0.0,
                    true,
                    "Loss absorbed by trader junior capital; investor capital remains protected",
                    now,
                ),
                received_at,
            });
            (
                "arcadia-demo:surfpool-loss-after-withdrawal",
                Some(demo_manager(262.0, -4.8, -4.8, 85_200.0, 300.0, 0)),
                Some(demo_vault_market(
                    "cooldown",
                    15_200.0,
                    70_000.0,
                    85_200.0,
                    20_000.0,
                    101_500.0,
                    true,
                    15,
                    now,
                    59_700.0,
                    25_500.0,
                    "watch",
                    Some("surfpool"),
                )),
                Some(demo_position(70_000.0, 70_000.0, now)),
                Some(demo_nav(85_200.0, 15_200.0, 70_000.0, now)),
                Some(demo_trade("SOL mark -15%", 6_000.0, now)),
                Some(demo_status(
                    "cooldown",
                    "Junior buffer absorbed the drawdown",
                    now,
                )),
            )
        }
        SurfpoolMarketStep::FreezeAfterLoss => {
            extras.push(RealtimeEvent::RiskEvent {
                item: demo_risk(
                    "frozen",
                    Some("caution"),
                    0.0,
                    100.0,
                    1_800.0,
                    false,
                    "Junior buffer depleted; trading disabled and investor exits prioritized",
                    now,
                ),
                received_at,
            });
            (
                "arcadia-demo:surfpool-freeze-after-loss",
                Some(demo_manager(160.0, -31.8, -31.8, 68_200.0, 300.0, 1)),
                Some(demo_vault_market(
                    "frozen",
                    0.0,
                    68_200.0,
                    68_200.0,
                    20_000.0,
                    101_500.0,
                    false,
                    15,
                    now,
                    59_700.0,
                    8_500.0,
                    "exit-priority",
                    Some("surfpool"),
                )),
                Some(demo_position(70_000.0, 68_200.0, now)),
                Some(demo_nav(68_200.0, 0.0, 68_200.0, now)),
                Some(demo_trade("Emergency SOL unwind", 17_000.0, now)),
                Some(demo_status(
                    "frozen",
                    "Protection exhausted; trading disabled",
                    now,
                )),
            )
        }
        SurfpoolMarketStep::InvestorWithdrawRemaining => {
            extras.push(RealtimeEvent::WithdrawalEvent {
                item: demo_capital_event(
                    "investor",
                    DEMO_INVESTOR_WALLET,
                    "withdrew remaining claim",
                    68_200.0,
                    "senior",
                    "confirmed",
                    "Remaining investor claim paid after the vault froze",
                    now,
                ),
                received_at,
            });
            (
                "arcadia-demo:surfpool-investor-withdraw-remaining",
                Some(demo_manager(160.0, -31.8, -31.8, 0.0, 300.0, 1)),
                Some(demo_vault_market(
                    "closed",
                    0.0,
                    0.0,
                    0.0,
                    20_000.0,
                    101_500.0,
                    false,
                    15,
                    now,
                    0.0,
                    0.0,
                    "closed",
                    Some("surfpool"),
                )),
                Some(demo_position(0.0, 0.0, now)),
                Some(demo_nav(0.0, 0.0, 0.0, now)),
                None,
                Some(demo_status(
                    "closed",
                    "Investor exited remaining claim",
                    now,
                )),
            )
        }
        SurfpoolMarketStep::TraderWithdrawBlocked => {
            extras.push(RealtimeEvent::WithdrawalEvent {
                item: demo_capital_event(
                    "trader",
                    DEMO_MANAGER_WALLET,
                    "blocked withdrawal",
                    3_000.0,
                    "junior",
                    "blocked",
                    "Trader withdrawal blocked because the vault froze and investor exits took priority",
                    now,
                ),
                received_at,
            });
            (
                "arcadia-demo:surfpool-trader-withdraw-blocked",
                Some(demo_manager(150.0, -31.8, -31.8, 0.0, 300.0, 1)),
                Some(demo_vault_market(
                    "closed",
                    0.0,
                    0.0,
                    0.0,
                    20_000.0,
                    101_500.0,
                    false,
                    15,
                    now,
                    0.0,
                    0.0,
                    "closed",
                    Some("surfpool"),
                )),
                Some(demo_position(0.0, 0.0, now)),
                Some(demo_nav(0.0, 0.0, 0.0, now)),
                None,
                Some(demo_status(
                    "closed",
                    "Trader withdrawal blocked after protection failed",
                    now,
                )),
            )
        }
    };

    let payload = serde_json::json!({
        "signature": format!("{kind}:{}", now_nonce()),
        "kind": kind,
        "data": {
            "manager": manager,
            "vault": vault,
            "position": position,
            "navPoint": nav,
            "trade": trade,
            "statusEvent": status
        }
    });
    (kind, payload, extras)
}

fn demo_manager(
    reputation_score: f64,
    pnl_30d: f64,
    max_drawdown: f64,
    capital_handled: f64,
    claimed_fees: f64,
    frozen_vault_count: i32,
) -> Value {
    serde_json::json!({
        "pubkey": DEMO_MANAGER_PROFILE,
        "owner": DEMO_MANAGER_WALLET,
        "totalVaults": 1,
        "activeVaults": if frozen_vault_count > 0 { 0 } else { 1 },
        "totalJuniorDeposited": 20_000.0,
        "createdAt": now_ts() - 2_592_000,
        "reputationScore": reputation_score,
        "pnl30d": pnl_30d,
        "maxDrawdown": max_drawdown,
        "capitalHandled": capital_handled,
        "claimedFees": claimed_fees,
        "frozenVaultCount": frozen_vault_count
    })
}

fn demo_vault(
    status: &str,
    junior_capital: f64,
    senior_capital: f64,
    current_nav: f64,
    original_junior: f64,
    high_water_mark: f64,
    trading_enabled: bool,
    paper_trade_count: i32,
    now: i64,
) -> Value {
    demo_vault_market(
        status,
        junior_capital,
        senior_capital,
        current_nav,
        original_junior,
        high_water_mark,
        trading_enabled,
        paper_trade_count,
        now,
        current_nav,
        0.0,
        "ok",
        Some("demo"),
    )
}

#[allow(clippy::too_many_arguments)]
fn demo_vault_market(
    status: &str,
    junior_capital: f64,
    senior_capital: f64,
    current_nav: f64,
    original_junior: f64,
    high_water_mark: f64,
    trading_enabled: bool,
    paper_trade_count: i32,
    now: i64,
    liquid_usdc: f64,
    wsol_exposure_value: f64,
    reserve_status: &str,
    execution_env: Option<&str>,
) -> Value {
    let junior_health = if original_junior > 0.0 {
        ((junior_capital / original_junior) * 100.0).clamp(0.0, 100.0)
    } else {
        0.0
    };
    let senior_principal_remaining = if status == "frozen" {
        75_000.0
    } else {
        senior_capital
    };
    serde_json::json!({
        "configPubkey": DEMO_VAULT_CONFIG,
        "statePubkey": DEMO_VAULT_STATE,
        "treasuryPubkey": DEMO_TREASURY,
        "managerPubkey": DEMO_MANAGER_WALLET,
        "managerProfilePubkey": DEMO_MANAGER_PROFILE,
        "name": "Arcadia Proof Vault",
        "status": status,
        "tvl": current_nav,
        "juniorCapital": junior_capital,
        "seniorCapital": senior_capital,
        "originalJuniorDeposit": original_junior,
        "juniorSharesOutstanding": junior_capital,
        "seniorSharesOutstanding": senior_principal_remaining,
        "juniorHealth": junior_health.round(),
        "currentNav": current_nav,
        "highWaterMark": high_water_mark,
        "feeBps": 2000,
        "maxSlippageBps": 50,
        "createdAt": now - 2_592_000,
        "graduatedAt": if status == "paper" { 0 } else { now - 3_600 },
        "paperTradeCount": paper_trade_count,
        "minQualifyingTrades": 10,
        "rolling24hLossBps": if junior_health < 50.0 { 1200 } else { 0 },
        "rolling7dLossBps": if junior_health < 50.0 { 2200 } else { 0 },
        "tradingEnabled": trading_enabled,
        "instantExit": junior_health < 20.0,
        "vaultIndex": 1,
        "liquidUsdc": liquid_usdc,
        "wsolExposureValue": wsol_exposure_value,
        "reserveStatus": reserve_status,
        "executionEnv": execution_env,
        "lastMarketUpdate": now
    })
}

fn demo_position(principal_remaining: f64, current_value: f64, now: i64) -> Value {
    serde_json::json!({
        "pubkey": DEMO_POSITION,
        "vaultConfigPubkey": DEMO_VAULT_CONFIG,
        "investorPubkey": DEMO_INVESTOR_WALLET,
        "seniorShares": principal_remaining,
        "totalDeposited": 80_000.0,
        "depositedAt": now - 3_000,
        "alertThresholdBps": 2000,
        "currentValue": current_value
    })
}

fn demo_nav(nav: f64, junior_capital: f64, senior_capital: f64, now: i64) -> Value {
    serde_json::json!({
        "vaultConfigPubkey": DEMO_VAULT_CONFIG,
        "recordedAt": now,
        "nav": nav,
        "juniorCapital": junior_capital,
        "seniorCapital": senior_capital
    })
}

fn demo_trade(route: &str, size: f64, now: i64) -> Value {
    serde_json::json!({
        "vaultConfigPubkey": DEMO_VAULT_CONFIG,
        "occurredAt": now,
        "visibilityAfter": now,
        "isPublicVisible": true,
        "side": "swap",
        "size": size,
        "route": route
    })
}

fn demo_status(status: &str, reason: &str, now: i64) -> Value {
    serde_json::json!({
        "vaultConfigPubkey": DEMO_VAULT_CONFIG,
        "occurredAt": now,
        "status": status,
        "reason": reason
    })
}

fn demo_capital_event(
    actor_role: &str,
    actor: &str,
    action: &str,
    amount: f64,
    capital_layer: &str,
    status: &str,
    detail: &str,
    now: i64,
) -> CapitalEvent {
    CapitalEvent {
        vault_config_pubkey: DEMO_VAULT_CONFIG.to_string(),
        actor_role: actor_role.to_string(),
        actor: actor.to_string(),
        action: action.to_string(),
        amount,
        capital_layer: capital_layer.to_string(),
        status: status.to_string(),
        detail: detail.to_string(),
        occurred_at: now,
    }
}

fn demo_fee_event(
    high_water_mark: f64,
    profit_above_high_water_mark: f64,
    claimable_fees: f64,
    claimed_fees: f64,
    detail: &str,
    now: i64,
) -> FeeEvent {
    FeeEvent {
        vault_config_pubkey: DEMO_VAULT_CONFIG.to_string(),
        manager: DEMO_MANAGER_WALLET.to_string(),
        high_water_mark,
        profit_above_high_water_mark,
        claimable_fees,
        claimed_fees,
        fee_bps: 2000,
        detail: detail.to_string(),
        occurred_at: now,
    }
}

fn demo_risk(
    state: &str,
    previous_state: Option<&str>,
    junior_buffer_remaining: f64,
    junior_buffer_used_pct: f64,
    investor_capital_impacted: f64,
    trading_enabled: bool,
    reason: &str,
    now: i64,
) -> RiskEvent {
    RiskEvent {
        vault_config_pubkey: DEMO_VAULT_CONFIG.to_string(),
        state: state.to_string(),
        previous_state: previous_state.map(ToString::to_string),
        junior_buffer_remaining,
        junior_buffer_used_pct,
        investor_capital_impacted,
        trading_enabled,
        reason: reason.to_string(),
        occurred_at: now,
    }
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
             (pubkey, owner, total_vaults, active_vaults, total_junior_deposited, created_at,
              reputation_score, pnl_30d, max_drawdown, capital_handled, claimed_fees, frozen_vault_count)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (pubkey) DO UPDATE SET
               owner = EXCLUDED.owner,
               total_vaults = EXCLUDED.total_vaults,
               active_vaults = EXCLUDED.active_vaults,
               total_junior_deposited = EXCLUDED.total_junior_deposited,
               created_at = EXCLUDED.created_at,
               reputation_score = EXCLUDED.reputation_score,
               pnl_30d = EXCLUDED.pnl_30d,
               max_drawdown = EXCLUDED.max_drawdown,
               capital_handled = EXCLUDED.capital_handled,
               claimed_fees = EXCLUDED.claimed_fees,
               frozen_vault_count = EXCLUDED.frozen_vault_count,
               updated_at = now()",
            )
            .bind(manager.pubkey)
            .bind(manager.owner)
            .bind(manager.total_vaults)
            .bind(manager.active_vaults)
            .bind(manager.total_junior_deposited)
            .bind(manager.created_at)
            .bind(manager.reputation_score)
            .bind(manager.pnl_30d)
            .bind(manager.max_drawdown)
            .bind(manager.capital_handled)
            .bind(manager.claimed_fees)
            .bind(manager.frozen_vault_count)
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
          rolling24h_loss_bps, rolling7d_loss_bps, trading_enabled, instant_exit, vault_index,
          liquid_usdc, wsol_exposure_value, reserve_status, execution_env, last_market_update)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16,
                 $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
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
           liquid_usdc = EXCLUDED.liquid_usdc,
           wsol_exposure_value = EXCLUDED.wsol_exposure_value,
           reserve_status = EXCLUDED.reserve_status,
           execution_env = EXCLUDED.execution_env,
           last_market_update = EXCLUDED.last_market_update,
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
    .bind(vault.liquid_usdc)
    .bind(vault.wsol_exposure_value)
    .bind(&vault.reserve_status)
    .bind(&vault.execution_env)
    .bind(vault.last_market_update)
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
    instant_exit, vault_index, liquid_usdc, wsol_exposure_value, reserve_status, execution_env,
    last_market_update FROM vaults";

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
        liquid_usdc: row.get("liquid_usdc"),
        wsol_exposure_value: row.get("wsol_exposure_value"),
        reserve_status: row.get("reserve_status"),
        execution_env: row.get("execution_env"),
        last_market_update: row.get("last_market_update"),
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
        reputation_score: row.get("reputation_score"),
        pnl_30d: row.get("pnl_30d"),
        max_drawdown: row.get("max_drawdown"),
        capital_handled: row.get("capital_handled"),
        claimed_fees: row.get("claimed_fees"),
        frozen_vault_count: row.get("frozen_vault_count"),
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
        reputation_score: f64_value(value, &["reputationScore"]).unwrap_or_default(),
        pnl_30d: f64_value(value, &["pnl30d", "pnl_30d"]).unwrap_or_default(),
        max_drawdown: f64_value(value, &["maxDrawdown"]).unwrap_or_default(),
        capital_handled: f64_value(value, &["capitalHandled"]).unwrap_or_default(),
        claimed_fees: f64_value(value, &["claimedFees"]).unwrap_or_default(),
        frozen_vault_count: i32_value(value, &["frozenVaultCount"]).unwrap_or_default(),
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
    let current_nav = f64_value(value, &["currentNav"]).unwrap_or(junior_capital + senior_capital);
    let liquid_usdc = f64_value(value, &["liquidUsdc", "liquidUSDC"]).unwrap_or(current_nav);
    let wsol_exposure_value =
        f64_value(value, &["wsolExposureValue", "wsolValue"]).unwrap_or_default();
    let reserve_status = string(value, &["reserveStatus"]).unwrap_or_else(|| {
        if current_nav <= 0.0 || liquid_usdc >= current_nav * 0.1 {
            "ok".to_string()
        } else {
            "watch".to_string()
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
        current_nav,
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
        liquid_usdc,
        wsol_exposure_value,
        reserve_status,
        execution_env: string(value, &["executionEnv"]),
        last_market_update: i64_value(value, &["lastMarketUpdate"]).unwrap_or_default(),
    })
}

fn parse_position(value: &Value, vault: Option<VaultView>) -> Option<PositionView> {
    let senior_shares = f64_value(value, &["seniorShares"]).unwrap_or_default();
    let total_deposited = f64_value(value, &["totalDeposited"]).unwrap_or_default();
    let current_value = f64_value(value, &["currentValue"])
        .or_else(|| {
            vault.as_ref().and_then(|v| {
                if v.senior_shares_outstanding > 0.0 {
                    Some((senior_shares / v.senior_shares_outstanding) * v.senior_capital)
                } else {
                    None
                }
            })
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

fn parse_topics(topics: Option<&str>) -> HashSet<String> {
    topics
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|topic| !topic.is_empty())
        .map(ToString::to_string)
        .collect()
}

fn topic_matches(event: &RealtimeEvent, topics: &HashSet<String>) -> bool {
    if topics.is_empty() {
        return true;
    }
    match event {
        RealtimeEvent::VaultUpsert { item, .. } => {
            topics.contains("vaults") || topics.contains(&format!("vault:{}", item.config_pubkey))
        }
        RealtimeEvent::ManagerUpsert { .. } => topics.contains("managers"),
        RealtimeEvent::PositionUpsert { wallet, item, .. } => {
            topics.contains(&format!("positions:{wallet}"))
                || topics.contains(&format!("vault:{}", item.vault_config_pubkey))
        }
        RealtimeEvent::NavPoint {
            vault_config_pubkey,
            ..
        }
        | RealtimeEvent::TradePublic {
            vault_config_pubkey,
            ..
        }
        | RealtimeEvent::StatusEvent {
            vault_config_pubkey,
            ..
        } => {
            topics.contains(&format!("vault:{vault_config_pubkey}"))
                || topics.contains(&format!("trades:{vault_config_pubkey}"))
                || topics.contains("vaults")
        }
        RealtimeEvent::DepositEvent { item, .. } | RealtimeEvent::WithdrawalEvent { item, .. } => {
            topics.contains("vaults")
                || topics.contains(&format!("vault:{}", item.vault_config_pubkey))
                || topics.contains(&format!("positions:{}", item.actor))
        }
        RealtimeEvent::FeeEvent { item, .. } => {
            topics.contains("managers")
                || topics.contains(&format!("vault:{}", item.vault_config_pubkey))
        }
        RealtimeEvent::RiskEvent { item, .. } => {
            topics.contains("vaults")
                || topics.contains(&format!("vault:{}", item.vault_config_pubkey))
        }
        RealtimeEvent::MarketQuote { item, .. } => {
            topics.contains("vaults")
                || topics.contains("market")
                || topics.contains(&format!("vault:{}", item.vault_config_pubkey))
        }
        RealtimeEvent::DemoStep { .. } => topics.contains("demo") || topics.contains("vaults"),
        RealtimeEvent::Heartbeat { .. } | RealtimeEvent::ResyncRequired { .. } => true,
    }
}

fn now_ts() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or_default()
}

fn now_nonce() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_nanos())
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
        test_app_with_options(secret, false, None)
    }

    fn test_app_with_options(
        secret: Option<&str>,
        surfpool_mode: bool,
        jupiter_api_key: Option<&str>,
    ) -> Router {
        build_app(test_state(secret, surfpool_mode, jupiter_api_key))
    }

    fn test_state(
        secret: Option<&str>,
        surfpool_mode: bool,
        jupiter_api_key: Option<&str>,
    ) -> AppState {
        AppState {
            store: Store::Memory(Arc::new(Mutex::new(MaterializedState::default()))),
            webhook_secret: secret.map(ToString::to_string),
            jupiter_api_key: jupiter_api_key.map(ToString::to_string),
            jupiter_swap_base_url: "https://api.jup.ag/swap/v1".to_string(),
            demo_mode: true,
            surfpool_mode,
            devnet_faucet: DevnetFaucetConfig {
                enabled: false,
                mint: "DLkVtDD4zfFJzWgGRLqjzqkBhaBs5sVNzDeBCQ2hPgMz".to_string(),
                authority_keypair: "/tmp/arcadia-devnet-faucet.json".to_string(),
                amount_ui: "100000".to_string(),
                rpc_url: "https://api.devnet.solana.com".to_string(),
                cooldown_secs: 60,
            },
            faucet_claims: Arc::new(Mutex::new(HashMap::new())),
            quote_cache: Arc::new(Mutex::new(HashMap::new())),
            demo_story: Arc::new(Mutex::new(DemoStoryState::default())),
            realtime: RealtimeHub::new(),
        }
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
    async fn demo_full_run_materializes_capital_lifecycle() {
        let app = test_app(None);

        let (status, _) =
            json_request(app.clone(), Method::POST, "/demo/run-full", Value::Null).await;
        assert_eq!(status, StatusCode::OK);

        let (status, vault) = json_request(
            app.clone(),
            Method::GET,
            "/vaults/So11111111111111111111111111111111111111112",
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(vault["status"], "frozen");
        assert_eq!(vault["tradingEnabled"], false);
        assert_eq!(vault["juniorCapital"], 0.0);

        let (status, managers) =
            json_request(app.clone(), Method::GET, "/managers", Value::Null).await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(managers["items"][0]["claimedFees"], 2000.0);
        assert_eq!(managers["items"][0]["frozenVaultCount"], 1);

        let (status, positions) = json_request(
            app,
            Method::GET,
            "/positions/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(positions["items"][0]["currentValue"], 73000.0);
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

    #[test]
    fn jupiter_surfpool_quote_gate_allows_supported_route_with_key() {
        let state = test_state(None, true, Some("test-key"));
        let gate = jupiter_gate(
            &state,
            SURFPOOL_CLUSTER,
            USDC_MINT,
            SOL_MINT,
            Some(50),
            JupiterOperation::Quote,
        );
        assert!(gate.is_none());
    }

    #[tokio::test]
    async fn jupiter_surfpool_swap_instructions_stay_disabled() {
        let app = test_app_with_options(None, true, Some("test-key"));
        let payload = json!({
            "cluster": SURFPOOL_CLUSTER,
            "userPublicKey": "11111111111111111111111111111111",
            "quoteResponse": {
                "inputMint": USDC_MINT,
                "outputMint": SOL_MINT
            }
        });

        let (status, body) =
            json_request(app, Method::POST, "/jupiter/swap-instructions", payload).await;
        assert_eq!(status, StatusCode::CONFLICT);
        assert_eq!(body["mode"], "surfpool");
    }

    #[tokio::test]
    async fn surfpool_swap_materializes_local_market_state() {
        let app = test_app_with_options(None, true, None);
        let (status, _) = json_request(
            app.clone(),
            Method::POST,
            "/demo/surfpool/setup",
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let (status, _) = json_request(
            app.clone(),
            Method::POST,
            "/demo/surfpool/simulate-swap",
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::OK);

        let (status, vault) = json_request(
            app,
            Method::GET,
            "/vaults/So11111111111111111111111111111111111111112",
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(vault["currentNav"], 100000.0);
        assert_eq!(vault["liquidUsdc"], 70000.0);
        assert_eq!(vault["wsolExposureValue"], 30000.0);
        assert_eq!(vault["reserveStatus"], "ok");
        assert_eq!(vault["executionEnv"], "surfpool");
    }

    #[tokio::test]
    async fn surfpool_price_moves_update_fee_and_risk_state() {
        let app = test_app_with_options(None, true, None);
        let (status, _) = json_request(
            app.clone(),
            Method::POST,
            "/demo/surfpool/setup",
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let (status, _) = json_request(
            app.clone(),
            Method::POST,
            "/demo/surfpool/simulate-swap",
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let (status, _) = json_request(
            app.clone(),
            Method::POST,
            "/demo/surfpool/price-up",
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let (status, vault) = json_request(
            app.clone(),
            Method::GET,
            "/vaults/So11111111111111111111111111111111111111112",
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(vault["currentNav"], 101500.0);
        assert_eq!(vault["juniorCapital"], 21500.0);
        assert_eq!(vault["wsolExposureValue"], 31500.0);

        let (status, _) = json_request(
            app.clone(),
            Method::POST,
            "/demo/surfpool/price-down",
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        let (status, vault) = json_request(
            app,
            Method::GET,
            "/vaults/So11111111111111111111111111111111111111112",
            Value::Null,
        )
        .await;
        assert_eq!(status, StatusCode::OK);
        assert_eq!(vault["status"], "cooldown");
        assert_eq!(vault["currentNav"], 95500.0);
        assert_eq!(vault["juniorCapital"], 15500.0);
        assert_eq!(vault["wsolExposureValue"], 25500.0);
    }

    #[test]
    fn demo_story_sequence_covers_product_intent() {
        let ids: Vec<_> = demo_story_steps().into_iter().map(|step| step.id).collect();
        for required in [
            "trader-joins",
            "paper-mode",
            "proof-built",
            "junior-funded",
            "investor-deposit",
            "jupiter-quote",
            "surfpool-swap",
            "profit",
            "fee-claimed",
            "investor-withdraw-profit",
            "loss-buffer",
            "frozen",
            "investor-withdraw-remaining",
            "trader-withdraw-blocked",
            "story-complete",
        ] {
            assert!(
                ids.contains(&required),
                "missing demo story step {required}"
            );
        }
    }

    #[tokio::test]
    async fn demo_story_state_tracks_active_and_completed_steps() {
        let state = test_state(None, true, None);
        state.start_demo_story().unwrap();
        let step = demo_story_steps()[0];
        state
            .publish_story_event(story_event(&step, "active"), false)
            .unwrap();
        let snapshot = state.demo_story_snapshot().unwrap();
        assert!(snapshot.running);
        assert_eq!(snapshot.active_step.as_deref(), Some("trader-joins"));

        state
            .publish_story_event(story_event(&step, "completed"), true)
            .unwrap();
        let snapshot = state.demo_story_snapshot().unwrap();
        assert!(snapshot
            .completed_steps
            .contains(&"trader-joins".to_string()));
        assert_eq!(snapshot.active_step, None);
    }

    #[tokio::test]
    async fn surfpool_story_lifecycle_updates_capital_safety_kpis() {
        let state = test_state(None, true, None);
        state.reset_demo().await.unwrap();
        for step in [
            DemoStep::TraderJoins,
            DemoStep::CreateVault,
            DemoStep::TraderDepositJunior,
            DemoStep::InvestorDeposit,
        ] {
            state.apply_demo_step(step).await.unwrap();
        }
        for step in [
            SurfpoolMarketStep::SimulateSwap,
            SurfpoolMarketStep::PriceUp,
            SurfpoolMarketStep::ClaimFees,
            SurfpoolMarketStep::InvestorWithdrawHealthy,
            SurfpoolMarketStep::LossAfterWithdrawal,
            SurfpoolMarketStep::FreezeAfterLoss,
        ] {
            state.apply_surfpool_market_step(step).await.unwrap();
        }

        let vault = state.get_vault(DEMO_VAULT_CONFIG).await.unwrap().unwrap();
        assert_eq!(vault.status, "frozen");
        assert_eq!(vault.trading_enabled, false);
        assert_eq!(vault.junior_capital, 0.0);
        assert_eq!(vault.senior_capital, 68200.0);
        assert_eq!(vault.wsol_exposure_value, 8500.0);

        state
            .apply_surfpool_market_step(SurfpoolMarketStep::InvestorWithdrawRemaining)
            .await
            .unwrap();
        state
            .apply_surfpool_market_step(SurfpoolMarketStep::TraderWithdrawBlocked)
            .await
            .unwrap();

        let vault = state.get_vault(DEMO_VAULT_CONFIG).await.unwrap().unwrap();
        assert_eq!(vault.status, "closed");
        assert_eq!(vault.current_nav, 0.0);

        let manager = state
            .get_manager(DEMO_MANAGER_PROFILE)
            .await
            .unwrap()
            .unwrap()
            .manager;
        assert_eq!(manager.claimed_fees, 300.0);
        assert_eq!(manager.frozen_vault_count, 1);
    }

    #[test]
    fn devnet_faucet_rejects_invalid_wallets() {
        assert!(is_base58_pubkey_like(
            "dEEv13eRjRQodutata5L5ammEh54mPTo3e8B4wNvjWy"
        ));
        assert!(!is_base58_pubkey_like("not a wallet"));
        assert!(!is_base58_pubkey_like(
            "0OIl111111111111111111111111111111111111111"
        ));
        assert!(!is_base58_pubkey_like("short"));
    }

    #[test]
    fn devnet_faucet_extracts_spl_token_signature() {
        let json = r#"{"signature":"4auPedUgcbboAvhJMkb2ZGci2U2oqVrrCL6sWT9NR8sbuQxTgYgJYWCquXB878HkomxGSYmdodhc54DPShM8BmNW"}"#;
        assert_eq!(
            extract_cli_signature(json).as_deref(),
            Some("4auPedUgcbboAvhJMkb2ZGci2U2oqVrrCL6sWT9NR8sbuQxTgYgJYWCquXB878HkomxGSYmdodhc54DPShM8BmNW")
        );
    }

    #[tokio::test]
    async fn devnet_faucet_returns_unavailable_when_disabled() {
        let app = test_app(None);
        let (status, _) = json_request(
            app,
            Method::POST,
            "/devnet/faucet/usdc",
            serde_json::json!({ "wallet": "dEEv13eRjRQodutata5L5ammEh54mPTo3e8B4wNvjWy" }),
        )
        .await;
        assert_eq!(status, StatusCode::SERVICE_UNAVAILABLE);
    }
}
