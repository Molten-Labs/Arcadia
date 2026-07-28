use anyhow::Result;
use std::time::Duration;
use tokio::time::sleep;

/// Configuration for the execution orchestrator.
#[derive(Clone, Debug)]
pub struct ExecutionConfig {
    pub rpc_url: String,
    pub master_password: String,
    pub sidecar_url: String,
}

impl ExecutionConfig {
    pub fn from_env() -> Self {
        Self {
            rpc_url: std::env::var("SOLANA_RPC_URL")
                .unwrap_or_else(|_| "https://api.devnet.solana.com".into()),
            master_password: std::env::var("AGENT_WALLET_MASTER_PASSWORD")
                .unwrap_or_default(),
            sidecar_url: std::env::var("SIDECAR_URL")
                .unwrap_or_else(|_| "http://127.0.0.1:3001".into()),
        }
    }
}

/// The supervised orchestrator loop.
///
/// Checks for profiles that are ready to trade and manages the full lifecycle:
/// wallet creation → vault fund → sidecar open → WS monitor → sidecar close → sweep → record.
pub async fn run(
    db: sqlx::PgPool,
    redis: redis::Client,
    cfg: ExecutionConfig,
) -> Result<()> {
    tracing::info!(
        sidecar = %cfg.sidecar_url,
        "execution orchestrator started"
    );

    loop {
        if let Err(e) = tick(&db, &redis, &cfg).await {
            tracing::error!("orchestrator tick error: {e:#}");
        }
        sleep(Duration::from_secs(30)).await;
    }
}

async fn tick(
    db: &sqlx::PgPool,
    _redis: &redis::Client,
    _cfg: &ExecutionConfig,
) -> Result<()> {
    // 1. Find ready profiles
    let ready = arcadia_db::queries::list_execution_wallets_by_status(db, 0).await?;
    // In the future, also check for profiles with new deposits that need a wallet created.

    for ew in &ready {
        tracing::info!(profile = ew.profile, pubkey = ew.pubkey, "processing ready wallet");

        // TODO: full trade lifecycle
        //
        // 1. Decrypt seed
        //    let seed = wallet::load_decrypted_seed(db, &ew.profile, &cfg.master_password).await?;
        //
        // 2. Build fund_execution instruction
        //    let ix = vault::fund_execution(amount, &admin, &config_pda, &profile_pda,
        //                                    &vault_token, &exec_ata);
        //
        // 3. Send instruction + seed to sidecar -> POST /trade/open
        //    Sidecar builds + signs the TX, deposits to FlashTrade, opens position.
        //
        // 4. Spawn WS monitor for this owner
        //    tokio::spawn(flash_ws::stream_position(redis, &owner, 1000));
        //
        // 5. Wait for close signal (check Redis position data)
        //    let pos = flash_ws::wait_for_position(redis, &owner, 60, 1000).await?;
        //
        // 6. Send seed to sidecar -> POST /trade/close
        //
        // 7. Build sweep instruction + send to sidecar to sign
        //    let sweep_ix = vault::sweep(remaining, &exec_ata, &vault_token, &exec_owner);
        //
        // 8. Record trade via POST /v1/trades/simulate on our own API
        //
        // 9. Update wallet status
        //    arcadia_db::queries::update_execution_wallet_status(db, &ew.profile, 2).await?;
    }

    Ok(())
}
