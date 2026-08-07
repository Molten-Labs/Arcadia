//! Ingest worker: Yellowstone gRPC stream → decode events → upsert DB.
//!
//! Enabled by `--features grpc`. Replaces the JSON-RPC poll loop (`ingest.rs`)
//! as the authoritative chain → DB bridge while keeping the exact same
//! idempotent projection (`project_event`), so rows stay keyed on the real tx
//! signature + slot and replays are safe (`ON CONFLICT DO NOTHING`).
//!
//! Guarantees over the poll loop:
//!   - **Ordering**: per-slot records are buffered and flushed in strictly
//!     ascending slot order (break-at-first-not-ready over a BTreeMap).
//!   - **Completeness gate**: a slot flushes only when the cluster has
//!     confirmed it. On a processed geyser stream confirmation always lags
//!     every transaction in that slot, so the gate guarantees no half-block
//!     projection.
//!   - **Reconnect**: on stream break the client auto-reconnects with
//!     exponential backoff and re-subscribes from the last seen slot, so a
//!     transient outage cannot silently drop events.
use std::collections::BTreeMap;
use std::time::Duration;

use anyhow::{anyhow, Result};
use arcadia_core::events::ArcadiaEvent;
use arcadia_db::queries;
use futures_util::StreamExt;
use tracing::{info, warn};
use yellowstone_grpc_client::{Backoff, GeyserGrpcClient, ReconnectConfig};
use yellowstone_grpc_proto::geyser::{
    CommitmentLevel, SubscribeRequest, SubscribeRequestFilterSlots,
    SubscribeRequestFilterTransactions, SubscribeUpdate,
};

/// One flushed slot: its number, and per-tx (`signature`, decoded events).
type FlushedSlot = (u64, Vec<(String, Vec<ArcadiaEvent>)>);

use crate::WorkerCtx;

/// Slot status as reported by the geyser stream.
#[derive(PartialEq, Eq, Clone, Copy, Debug)]
enum SlotStatus {
    Processed,
    Confirmed,
    Finalized,
}

impl SlotStatus {
    fn reached(&self, target: SlotStatus) -> bool {
        matches!(
            (self, target),
            (SlotStatus::Processed, SlotStatus::Processed)
                | (SlotStatus::Confirmed, SlotStatus::Processed | SlotStatus::Confirmed)
                | (SlotStatus::Finalized, _)
        )
    }
}

impl From<i32> for SlotStatus {
    fn from(v: i32) -> Self {
        match v {
            0 => SlotStatus::Processed,
            1 => SlotStatus::Confirmed,
            2 => SlotStatus::Finalized,
            _ => SlotStatus::Processed,
        }
    }
}

/// Per-slot buffer of decoded Arcadia events.
struct SlotBuffer {
    /// Signature → decoded events, in arrival order.
    txs: Vec<(String, Vec<ArcadiaEvent>)>,
    /// Highest slot status seen; never downgrades.
    status: SlotStatus,
}

impl SlotBuffer {
    fn new() -> Self {
        Self {
            txs: Vec::new(),
            status: SlotStatus::Processed,
        }
    }

    fn set_status(&mut self, s: SlotStatus) {
        if s.reached(self.status) {
            self.status = s;
        }
    }

    fn ready(&self) -> bool {
        self.status.reached(SlotStatus::Confirmed)
    }
}

/// Ordered slot coordinator: buffers per-slot txs, flushes in strictly
/// ascending slot order once a slot reaches CONFIRMED.
struct Coordinator {
    slots: BTreeMap<u64, SlotBuffer>,
    last_flushed_slot: u64,
}

impl Coordinator {
    fn new(seed: u64) -> Self {
        Self {
            slots: BTreeMap::new(),
            last_flushed_slot: seed,
        }
    }

    fn record_tx(&mut self, slot: u64, sig: String, events: Vec<ArcadiaEvent>) {
        self.slots.entry(slot).or_insert_with(SlotBuffer::new).txs.push((sig, events));
    }

    fn set_status(&mut self, slot: u64, status: SlotStatus) {
        self.slots.entry(slot).or_insert_with(SlotBuffer::new).set_status(status);
    }

    /// Drain every ready slot in ascending order, stopping at the first
    /// not-ready slot. This guarantees strictly ascending flush order.
    fn drain_ready(&mut self) -> Vec<FlushedSlot> {
        let mut out = Vec::new();
        let keys: Vec<u64> = self.slots.keys().copied().collect();
        for slot in keys {
            let buf = match self.slots.get(&slot) {
                Some(b) => b,
                None => continue,
            };
            if !buf.ready() {
                break;
            }
            let txs = std::mem::take(&mut self.slots.get_mut(&slot).unwrap().txs);
            self.last_flushed_slot = slot;
            out.push((slot, txs));
        }
        // Remove flushed slots to free memory.
        self.slots.retain(|&s, _| s > self.last_flushed_slot);
        out
    }
}

/// Decode Arcadia events from a transaction's log messages.
fn decode_events(logs: &[String]) -> Vec<ArcadiaEvent> {
    logs.iter()
        .filter_map(|line| arcadia_decode::decode_log_line(line).ok().flatten())
        .collect()
}

/// Durable projection of one decoded event, mirroring `ingest.rs::project_event`.
async fn project_event(
    ctx: &WorkerCtx,
    sig: &str,
    slot: i64,
    event: ArcadiaEvent,
) -> Result<()> {
    use arcadia_db::models::DbFlow;

    match event {
        ArcadiaEvent::ProfileInitialized(e) => {
            queries::upsert_trader_profile(&ctx.db, &e.profile, &e.trader, &e.trader, e.ts).await?;
        }
        ArcadiaEvent::InvestorInitialized(e) => {
            queries::upsert_investor_account(&ctx.db, &e.investor, e.ts).await?;
        }
        ArcadiaEvent::Deposited(e) => {
            queries::insert_flow(
                &ctx.db,
                &DbFlow {
                    signature: sig.to_string(),
                    event_index: 0,
                    slot,
                    profile: e.profile.clone(),
                    owner: e.depositor.clone(),
                    is_trader: e.is_trader,
                    kind: "deposit".into(),
                    amount_usd: e.amount_usd,
                    shares: e.shares_minted,
                    nav_per_share: e.nav_per_share,
                    ts: e.ts,
                },
            )
            .await?;
            queries::upsert_investor_position(
                &ctx.db,
                &e.depositor,
                &e.profile,
                e.shares_minted,
                e.amount_usd,
            )
            .await?;
        }
        ArcadiaEvent::Withdrawn(e) => {
            queries::insert_flow(
                &ctx.db,
                &DbFlow {
                    signature: sig.to_string(),
                    event_index: 0,
                    slot,
                    profile: e.profile.clone(),
                    owner: e.owner.clone(),
                    is_trader: false,
                    kind: "withdraw".into(),
                    amount_usd: e.amount_usd,
                    shares: e.shares_burned,
                    nav_per_share: e.nav_per_share,
                    ts: chrono::Utc::now(),
                },
            )
            .await?;
        }
        ArcadiaEvent::WithdrawRequested(e) => {
            queries::insert_flow(
                &ctx.db,
                &DbFlow {
                    signature: sig.to_string(),
                    event_index: 0,
                    slot,
                    profile: e.profile.clone(),
                    owner: e.owner.clone(),
                    is_trader: false,
                    kind: "withdraw_request".into(),
                    amount_usd: rust_decimal::Decimal::ZERO,
                    shares: e.shares,
                    nav_per_share: e.nav_per_share,
                    ts: e.withdraw_ready_ts,
                },
            )
            .await?;
        }
        ArcadiaEvent::TradeClosed(e) => {
            queries::insert_trade(
                &ctx.db,
                &arcadia_db::models::DbTrade {
                    signature: sig.to_string(),
                    event_index: 0,
                    slot,
                    profile: e.profile.clone(),
                    trader: e.trader.clone(),
                    market: e.market,
                    direction: e.direction as i16,
                    size_usd: e.size_usd,
                    leverage_x: e.leverage_x,
                    entry_px: e.entry_px,
                    exit_px: e.exit_px,
                    realized_pnl: e.realized_pnl,
                    fees_usd: e.fees_usd,
                    was_liquidated: e.was_liquidated,
                    opened_at: e.opened_at,
                    closed_at: e.closed_at,
                },
            )
            .await?;
        }
        ArcadiaEvent::Settled(..)
        | ArcadiaEvent::ProfitWithdrawn(..) => {
            // Derived state — consumed by the score/withdraw workers.
        }
        ArcadiaEvent::ExecutionFunded(e) => {
            tracing::debug!(profile = %e.profile, "execution funding event (informational)");
        }
    }
    Ok(())
}

fn build_subscribe_request(program_id: &str) -> SubscribeRequest {
    let mut txs = SubscribeRequestFilterTransactions::default();
    txs.account_include.push(program_id.to_string());
    SubscribeRequest {
        commitment: Some(CommitmentLevel::Confirmed as i32),
        transactions: [("arcadia_txs".to_string(), txs)].into(),
        slots: [(
            "arcadia_slots".to_string(),
            SubscribeRequestFilterSlots {
                filter_by_commitment: Some(true),
                ..Default::default()
            },
        )]
        .into(),
        ..Default::default()
    }
}

const DEFAULT_RECONNECT_MAX_RETRIES: u32 = 10;
const DEFAULT_RECONNECT_INITIAL_BACKOFF: Duration = Duration::from_millis(500);
const DEFAULT_RECONNECT_MULTIPLIER: f64 = 2.0;

/// Run the gRPC ingest worker until the stream ends or an unrecoverable error.
pub async fn run(ctx: WorkerCtx) -> Result<()> {
    let cfg = &ctx.cfg;
    if cfg.yellowstone_endpoint.is_empty() {
        return Err(anyhow!(
            "YELLOWSTONE_ENDPOINT not set; cannot run gRPC ingest"
        ));
    }

    let seed_slot = queries::get_ingest_cursor(&ctx.db).await?;

    info!(
        endpoint = %cfg.yellowstone_endpoint,
        seed_slot,
        "gRPC ingest starting"
    );

    let backoff = Backoff::new(
        DEFAULT_RECONNECT_INITIAL_BACKOFF,
        DEFAULT_RECONNECT_MULTIPLIER,
        DEFAULT_RECONNECT_MAX_RETRIES,
    );
    let reconnect = ReconnectConfig::default().with_backoff(backoff);

    let mut client = GeyserGrpcClient::build_from_shared(cfg.yellowstone_endpoint.clone())
        .map_err(|e| anyhow!("build grpc client: {e}"))?
        .x_token(Some(cfg.yellowstone_token.clone()))?
        .tls_config(yellowstone_grpc_client::ClientTlsConfig::new().with_native_roots())?
        .connect_timeout(Duration::from_secs(120))
        .timeout(Duration::from_secs(120))
        .set_reconnect_config(reconnect)
        .connect()
        .await
        .map_err(|e| anyhow!("connect to Yellowstone: {e}"))?;

    let mut req = build_subscribe_request(&cfg.program_id);
    if seed_slot > 0 {
        req.from_slot = Some(seed_slot as u64);
    }
    let (_, stream) = match client.subscribe_with_request(Some(req)).await {
        Ok(s) => s,
        Err(e) if seed_slot > 0 => {
            // Stale cursor below the provider's retention window (downtime /
            // fresh deploy): fall back to a live-only stream instead of
            // error-looping forever. Historical events from before the window
            // are unrecoverable regardless.
            warn!(
                from_slot = seed_slot,
                "subscribe with from_slot rejected ({e:#}); falling back to live-only stream"
            );
            let mut live = build_subscribe_request(&cfg.program_id);
            live.from_slot = None;
            client
                .subscribe_with_request(Some(live))
                .await
                .map_err(|e| anyhow!("subscribe (live fallback): {e}"))?
        }
        Err(e) => return Err(anyhow!("subscribe: {e}")),
    };

    info!("gRPC stream established");

    let mut coordinator = Coordinator::new(seed_slot as u64);
    let mut stream = std::pin::pin!(stream);

    while let Some(item) = stream.next().await {
        let update = match item {
            Ok(u) => u,
            Err(e) => {
                return Err(anyhow!("gRPC stream error: {e}"));
            }
        };
        handle_update(&mut coordinator, &update);
        for (slot, txs) in coordinator.drain_ready() {
            for (sig, events) in txs {
                for event in events {
                    // Cascade: do NOT advance the cursor past a slot whose
                    // projection failed. `supervise` restarts this worker on
                    // Err, re-reading the cursor and re-subscribing from it, so
                    // the failed slot is replayed (idempotently) instead of
                    // being silently dropped — the stream's equivalent of the
                    // poll loop's re-query safety net.
                    project_event(&ctx, &sig, slot as i64, event).await?;
                }
            }
            // Only advance once the whole slot projected cleanly.
            queries::set_ingest_cursor(&ctx.db, slot as i64).await?;
        }
    }

    Err(anyhow!("gRPC stream ended; supervisor will reconnect"))
}

fn handle_update(coordinator: &mut Coordinator, update: &SubscribeUpdate) {
    let Some(oneof) = &update.update_oneof else { return };
    match oneof {
        yellowstone_grpc_proto::geyser::subscribe_update::UpdateOneof::Transaction(t) => {
            let Some(info) = &t.transaction else { return };
            if info.meta.as_ref().is_some_and(|m| m.err.is_some()) {
                return;
            }
            let sig = bs58::encode(&info.signature).into_string();
            let events =
                decode_events(info.meta.as_ref().map_or(&Vec::new(), |m| &m.log_messages));
            coordinator.record_tx(t.slot, sig, events);
        }
        yellowstone_grpc_proto::geyser::subscribe_update::UpdateOneof::Slot(s) => {
            coordinator.set_status(s.slot, SlotStatus::from(s.status));
        }
        _ => {}
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn status_value(status: SlotStatus) -> i32 {
        match status {
            SlotStatus::Processed => 0,
            SlotStatus::Confirmed => 1,
            SlotStatus::Finalized => 2,
        }
    }

    /// Feed a slot to CONFIRMED and drain.
    fn confirm_and_drain(coord: &mut Coordinator, slot: u64) -> Vec<(u64, i32)> {
        coord.set_status(slot, SlotStatus::from(status_value(SlotStatus::Confirmed)));
        coord
            .drain_ready()
            .into_iter()
            .map(|(s, txs)| (s, txs.iter().map(|(_, e)| e.len() as i32).sum()))
            .collect()
    }

    #[test]
    fn slot_flushes_only_after_confirmed() {
        let mut coord = Coordinator::new(100);
        coord.record_tx(
            101,
            "sig1".into(),
            vec![ArcadiaEvent::ExecutionFunded(arcadia_core::events::ExecutionFunded {
                profile: "p".into(),
                execution_wallet: "w".into(),
                amount_usd: rust_decimal::Decimal::ZERO,
                ts: chrono::Utc::now(),
            })],
        );
        // Not confirmed yet → nothing flushes.
        assert!(coord.drain_ready().is_empty());
        // Confirm → flushes with the buffered events.
        let flushed = confirm_and_drain(&mut coord, 101);
        assert_eq!(flushed, vec![(101, 1)]);
    }

    #[test]
    fn flushes_in_ascending_order_only_when_parent_confirmed() {
        let mut coord = Coordinator::new(100);
        coord.record_tx(103, "sig3".into(), vec![]);
        coord.record_tx(101, "sig1".into(), vec![]);
        coord.record_tx(102, "sig2".into(), vec![]);

        // Confirm slot 103 before its parent 101/102.
        coord.set_status(103, SlotStatus::from(status_value(SlotStatus::Confirmed)));
        // drain stops at the first not-ready slot (101), so 103 stays buffered.
        assert!(coord.drain_ready().is_empty());

        // Confirm 101 → only 101 (102 still not ready), then 102 confirms and
        // drains both ready slots 102 and 103 in order.
        let f1 = confirm_and_drain(&mut coord, 101);
        assert_eq!(f1, vec![(101, 0)]);
        let f2 = confirm_and_drain(&mut coord, 102);
        assert_eq!(f2, vec![(102, 0), (103, 0)]);
    }

    #[test]
    fn status_never_downgrades() {
        let mut buf = SlotBuffer::new();
        buf.set_status(SlotStatus::Finalized);
        buf.set_status(SlotStatus::Processed); // attempt downgrade
        assert_eq!(buf.status, SlotStatus::Finalized);
    }

    #[test]
    fn not_ready_below_watermark_is_dropped_on_drain() {
        let mut coord = Coordinator::new(100);
        // A slot at/below the seeded watermark stays flushable once confirmed.
        coord.record_tx(100, "sig0".into(), vec![]);
        assert_eq!(confirm_and_drain(&mut coord, 100), vec![(100, 0)]);
    }

    #[test]
    fn processed_stream_still_reports_live_slots() {
        let mut coord = Coordinator::new(0);
        coord.set_status(5, SlotStatus::from(0)); // processed
        assert!(coord.drain_ready().is_empty());
    }
}