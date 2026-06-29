/// Restart-with-backoff task supervisor.
///
/// If the inner future resolves with an Err, it is restarted after an
/// exponential delay (capped at 60 s). Panics inside the task are caught
/// by tokio and turn into JoinError::is_panic(), which also triggers a restart.
use std::future::Future;
use std::time::Duration;
use tokio::time::sleep;
use tracing::{error, info, warn};

pub async fn supervise<F, Fut>(name: &'static str, factory: F)
where
    F: Fn() -> Fut + Send + 'static,
    Fut: Future<Output = anyhow::Result<()>> + Send + 'static,
{
    let mut delay_secs = 1u64;
    loop {
        info!(worker = name, "starting");
        let handle = tokio::spawn(factory());
        match handle.await {
            Ok(Ok(())) => {
                info!(worker = name, "exited cleanly — restarting immediately");
                delay_secs = 1;
            }
            Ok(Err(e)) => {
                error!(worker = name, "error: {e:#} — restarting in {delay_secs}s");
            }
            Err(e) if e.is_panic() => {
                error!(worker = name, "panicked — restarting in {delay_secs}s");
            }
            Err(e) => {
                warn!(worker = name, "cancelled: {e} — restarting in {delay_secs}s");
            }
        }
        sleep(Duration::from_secs(delay_secs)).await;
        delay_secs = (delay_secs * 2).min(60);
    }
}
