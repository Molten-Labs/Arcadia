/// Execution orchestrator worker: manages execution wallet lifecycle,
/// vault TX signing, FlashTrade coordination via sidecar, and WS monitoring.
use crate::WorkerCtx;
use anyhow::Result;
use arcadia_executor::orchestrator::ExecutionConfig;
use tokio::time::{sleep, Duration};
use tracing::error;

pub async fn run(ctx: WorkerCtx) -> Result<()> {
    let exec_cfg = ExecutionConfig::from_env();

    // Run the orchestrator — when it exits, restart after delay.
    loop {
        if let Err(e) = arcadia_executor::orchestrator::run(
            ctx.db.clone(),
            ctx.redis.clone(),
            exec_cfg.clone(),
        )
        .await
        {
            error!("executor orchestrator exited: {e:#}");
        }
        sleep(Duration::from_secs(5)).await;
    }
}
