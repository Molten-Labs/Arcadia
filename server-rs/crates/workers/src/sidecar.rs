/// Sidecar supervisor worker.
///
/// Launches the execution-worker (Node/Express, FlashTrade SDK bridge) as a
/// supervised subprocess. If the subprocess exits it is restarted with
/// exponential backoff by the outer supervisor; here we re-exec it in-place
/// with the same delay semantics.
use crate::WorkerCtx;
use anyhow::Result;
use std::process::Stdio;
use std::time::Duration;
use tokio::process::Command;
use tokio::time::sleep;
use tracing::{error, info, warn};

pub async fn run(ctx: WorkerCtx) -> Result<()> {
    let mut delay = 1u64;
    loop {
        info!("sidecar: launching execution-worker");
        match launch(&ctx).await {
            Ok(()) => {
                info!("sidecar: execution-worker exited cleanly — restarting");
                delay = 1;
            }
            Err(e) => {
                error!("sidecar: execution-worker failed: {e:#} — restarting in {delay}s");
            }
        }
        sleep(Duration::from_secs(delay)).await;
        delay = (delay * 2).min(60);
    }
}

async fn launch(ctx: &WorkerCtx) -> Result<()> {
    let exec_root = std::env::var("EXECUTION_WORKER_DIR")
        .unwrap_or_else(|_| concat!(env!("CARGO_MANIFEST_DIR"), "/../../execution-worker").into());

    let tsx = format!("{exec_root}/node_modules/.bin/tsx");
    let mut cmd = Command::new(&tsx);
    cmd.current_dir(&exec_root)
        .arg("src/index.ts")
        .env("SIDECAR_PORT", std::env::var("SIDECAR_PORT").unwrap_or_else(|_| "3001".into()))
        .env("SIDECAR_TOKEN", std::env::var("SIDECAR_TOKEN").unwrap_or_default())
        .env("RUST_LOG", std::env::var("RUST_LOG").unwrap_or_default())
        .stdin(Stdio::null());

    info!(root = %exec_root, "sidecar: spawning execution-worker");
    let mut child = cmd.spawn()?;

    // Health-check until the subprocess dies.
    let sidecar_url = ctx.cfg.sidecar_url.clone();
    let mut healthy = false;
    let deadline = tokio::time::Instant::now() + Duration::from_secs(30);
    while tokio::time::Instant::now() < deadline {
        if let Ok(resp) = reqwest::Client::new()
            .get(format!("{sidecar_url}/health"))
            .timeout(Duration::from_secs(2))
            .send()
            .await
        {
            if resp.status().is_success() {
                healthy = true;
                info!("sidecar: healthy at {sidecar_url}");
                break;
            }
        }
        sleep(Duration::from_millis(500)).await;
    }
    if !healthy {
        warn!("sidecar: never became healthy before deadline");
    }

    let status = child.wait().await?;
    info!("sidecar: execution-worker exited with {status}");
    Ok(())
}
