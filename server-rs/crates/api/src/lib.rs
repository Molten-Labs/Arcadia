pub mod auth;
pub mod error;
pub mod routes;
pub mod simulate;
pub mod state;

pub use axum::serve;

use axum::{
    routing::{get, post},
    Router,
};
use state::AppState;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
    trace::TraceLayer,
};

/// Build the Axum router for all /v1 endpoints.
pub fn build_router(state: AppState) -> Router {
    let public = Router::new()
        .route("/v1/health",                      get(routes::health))
        .route("/v1/auth/challenge",              post(auth::challenge))
        .route("/v1/auth/verify",                 post(auth::verify))
        .route("/v1/traders",                     get(routes::list_traders))
        .route("/v1/traders/:handle",             get(routes::get_trader))
        .route("/v1/vaults/:profile",             get(routes::get_vault))
        .route("/v1/vaults/:profile/trades",      get(routes::get_vault_trades))
        .route("/v1/leaderboard",                 get(routes::leaderboard))
        .route("/v1/prices",                      get(routes::prices))
        .route("/v1/score",                       get(routes::get_score));

    let protected = Router::new()
        .route("/v1/investors/:wallet/account",   get(routes::get_investor_account))
        .route("/v1/investors/:wallet/portfolio", get(routes::get_investor_portfolio))
        .route("/v1/trades/simulate",             post(simulate::handler));

    Router::new()
        .merge(public)
        .merge(protected)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_headers(Any)
                .allow_methods(Any),
        )
        .layer(CompressionLayer::new())
        .layer(TraceLayer::new_for_http())
        .with_state(state)
}
