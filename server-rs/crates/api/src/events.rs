/// POST /v1/events — accept on-chain events pushed from the frontend.
///
/// This bridges the gap between frontend-initiated Anchor transactions and
/// the backend's DB (which the scoring engine reads). When the frontend
/// executes a deposit / withdraw / initialize on Solana, it calls this
/// endpoint so the backend has the data for TWR computation and scoring.
use crate::{auth::verify_jwt, error::ApiError, state::AppState};
use arcadia_core::events::*;
use axum::{extract::State, http::HeaderMap, Json};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Deserialize)]
pub struct EventsReq {
    pub events: Vec<ArcadiaEvent>,
}

#[derive(Serialize)]
pub struct EventsRes {
    pub accepted: usize,
    pub errors: Vec<String>,
}

pub async fn handler(
    State(ctx): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<EventsReq>,
) -> Result<Json<Value>, ApiError> {
    let wallet = extract_wallet(&headers, &ctx.jwt_secret)?;

    let mut accepted = 0usize;
    let mut errors: Vec<String> = Vec::new();

    for event in &body.events {
        match process_event(&ctx, event, &wallet).await {
            Ok(()) => accepted += 1,
            Err(e) => errors.push(format!("{event:?}: {e}")),
        }
    }

    Ok(Json(json!(EventsRes { accepted, errors })))
}

async fn process_event(ctx: &AppState, event: &ArcadiaEvent, authed_wallet: &str) -> Result<(), ApiError> {
    use arcadia_db::queries;

    match event {
        ArcadiaEvent::ProfileInitialized(e) => {
            if e.trader != authed_wallet {
                return Err(ApiError::Forbidden);
            }
            queries::upsert_trader_profile(
                &ctx.db,
                &e.profile,
                &e.trader,
                &e.trader, // use wallet as handle initially
                e.ts,
            ).await?;
        }

        ArcadiaEvent::InvestorInitialized(e) => {
            queries::upsert_investor_account(
                &ctx.db,
                &e.investor,
                e.ts,
            ).await?;
        }

        ArcadiaEvent::Deposited(e) => {
            if e.depositor != authed_wallet {
                return Err(ApiError::Forbidden);
            }
            queries::insert_flow(
                &ctx.db,
                &arcadia_db::models::DbFlow {
                    signature:       "frontend".into(),
                    event_index:     0,
                    slot:            0,
                    profile:         e.profile.clone(),
                    owner:           e.depositor.clone(),
                    is_trader:       e.is_trader,
                    kind:            "deposit".into(),
                    amount_usd:      e.amount_usd,
                    shares:          e.shares_minted,
                    nav_per_share:   e.nav_per_share,
                    ts:              e.ts,
                },
            ).await?;
            queries::upsert_investor_position(
                &ctx.db,
                &e.depositor,
                &e.profile,
                e.shares_minted,
                e.amount_usd,
            ).await?;
        }

        ArcadiaEvent::Withdrawn(e) => {
            if e.owner != authed_wallet {
                return Err(ApiError::Forbidden);
            }
            queries::insert_flow(
                &ctx.db,
                &arcadia_db::models::DbFlow {
                    signature:       "frontend".into(),
                    event_index:     0,
                    slot:            0,
                    profile:         e.profile.clone(),
                    owner:           e.owner.clone(),
                    is_trader:       false,
                    kind:            "withdraw".into(),
                    amount_usd:      e.amount_usd,
                    shares:          e.shares_burned,
                    nav_per_share:   Decimal::ZERO,
                    ts:              chrono::Utc::now(),
                },
            ).await?;
        }

        ArcadiaEvent::TradeClosed(_e) => {
            // Trades are already recorded via /v1/trades/simulate — skip
        }

        ArcadiaEvent::Settled(..) |
        ArcadiaEvent::WithdrawRequested(..) |
        ArcadiaEvent::ProfitWithdrawn(..) => {
            // These are derived state changes tracked by the scoring worker
        }
    }

    Ok(())
}

fn extract_wallet(headers: &HeaderMap, secret: &str) -> Result<String, ApiError> {
    let bearer = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(ApiError::Unauthorized)?;
    verify_jwt(bearer, secret)
}
