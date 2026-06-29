/// Ingest worker: subscribe to Yellowstone gRPC, decode events, upsert DB.
///
/// This is a stub implementation that runs a no-op loop.
/// To enable live event ingestion, see the instructions in
/// server-rs/crates/workers/Cargo.toml (enable the `grpc` feature and
/// add the yellowstone deps).
use crate::WorkerCtx;
use anyhow::Result;
use tokio::time::{sleep, Duration};
use tracing::warn;

pub async fn run(_ctx: WorkerCtx) -> Result<()> {
    warn!(
        endpoint = "YELLOWSTONE_ENDPOINT env var",
        "ingest worker: Yellowstone gRPC not enabled. \
         See server-rs/crates/workers/Cargo.toml to enable --features grpc. \
         No on-chain events will be ingested in this build."
    );

    // Keep the supervisor from restarting in a tight loop.
    loop {
        sleep(Duration::from_secs(3600)).await;
    }
}

// ── gRPC implementation template ─────────────────────────────────────────────
// To enable, add the yellowstone deps to workers/Cargo.toml (see the
// instructions there), add `grpc` to [features], then uncomment and adapt:
//
// use arcadia_decode::decode_event;
// use arcadia_core::events::ArcadiaEvent;
// use yellowstone_grpc_client::GeyserGrpcClient;
// use yellowstone_grpc_proto::prelude::*;
//
// pub async fn run(ctx: WorkerCtx) -> Result<()> {
//     let last_slot = arcadia_db::queries::get_ingest_cursor(&ctx.db).await?;
//     let mut client = GeyserGrpcClient::connect(
//         ctx.cfg.yellowstone_endpoint.clone(),
//         Some(ctx.cfg.yellowstone_token.clone()),
//         None,
//     ).await?;
//
//     let mut request = SubscribeRequest::default();
//     request.transactions.insert("arcadia_vault".to_string(), SubscribeRequestFilterTransactions {
//         account_include: vec![ctx.cfg.program_id.clone()],
//         ..Default::default()
//     });
//
//     let (_, mut stream) = client.subscribe_with_request(Some(request)).await?;
//     while let Some(Ok(update)) = stream.next().await {
//         handle_update(&ctx, update).await?;
//     }
//     Ok(())
// }
