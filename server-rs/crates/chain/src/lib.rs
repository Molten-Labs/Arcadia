/// Chain interaction: build and sign set_capacity + record_trade instructions.
///
/// This crate provides stub implementations that compile and run without any
/// Solana SDK dependency. To enable live on-chain transactions, see the
/// instructions in server-rs/crates/chain/Cargo.toml.
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone)]
pub struct OracleConfig {
    /// Oracle keypair path (env: ORACLE_KEYPAIR_PATH).
    pub keypair_path: String,
    /// Solana RPC URL (env: SOLANA_RPC_URL).
    pub rpc_url: String,
    /// The arcadia_vault program ID (env: PROGRAM_ID).
    pub program_id: String,
}

impl OracleConfig {
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            keypair_path: std::env::var("ORACLE_KEYPAIR_PATH")
                .unwrap_or_else(|_| "/run/secrets/oracle_keypair.json".into()),
            rpc_url: std::env::var("SOLANA_RPC_URL")
                .unwrap_or_else(|_| "https://api.devnet.solana.com".into()),
            program_id: std::env::var("PROGRAM_ID")
                .unwrap_or_else(|_| "ArcadiaVau1tProgramId11111111111111111111111".into()),
        })
    }
}

#[derive(Debug, Clone)]
pub struct SimTradeRequest {
    pub profile:       String,
    pub market:        String,
    pub direction:     u8,
    pub size_usd:      u64,
    pub leverage_x100: u16,
    pub entry_px:      u64,
    pub exit_px:       u64,
}

/// Result of submitting a transaction.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxResult {
    pub signature: String,
    pub confirmed: bool,
}

// ── set_capacity ──────────────────────────────────────────────────────────────

/// Push the computed capacity ceiling to the on-chain program.
///
/// `cap_usd_u64`: USDC minor units (6 decimals).
/// `score_tier`:  0=Verified, 1=Established, 2=Advanced, 3=Elite.
///
/// Stub implementation — logs the action and returns an unconfirmed result.
/// See Cargo.toml for instructions on enabling live Solana signing.
pub async fn push_set_capacity(
    _cfg: &OracleConfig,
    profile: &str,
    cap_usd_u64: u64,
    score_tier: u8,
) -> Result<TxResult> {
    tracing::warn!(
        profile,
        cap_usd_u64,
        score_tier,
        "set_capacity: stub (add solana-sdk dep + uncomment solana_impl to enable)"
    );
    Ok(TxResult {
        signature: format!("STUB_SET_CAP_{profile}_{cap_usd_u64}_{score_tier}"),
        confirmed: false,
    })
}

// ── record_trade ──────────────────────────────────────────────────────────────

/// Co-sign a simulated trade with real market prices.
///
/// Stub implementation — see Cargo.toml for enabling live Solana signing.
pub async fn submit_record_trade(
    _cfg: &OracleConfig,
    req: &SimTradeRequest,
) -> Result<TxResult> {
    tracing::warn!(
        profile = req.profile,
        market  = req.market,
        size    = req.size_usd,
        "record_trade: stub (add solana-sdk dep + uncomment solana_impl to enable)"
    );
    Ok(TxResult {
        signature: format!("STUB_RECORD_TRADE_{}_{}_{}", req.profile, req.market, req.size_usd),
        confirmed: false,
    })
}

// ── Helpers exposed for future full implementation ────────────────────────────

/// Compute the 8-byte Anchor instruction discriminator for a given name.
/// Used by the full Solana implementation: sha256("global:<name>")[..8].
pub fn instruction_discriminator(name: &str) -> [u8; 8] {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(format!("global:{name}"));
    let hash = h.finalize();
    let mut d = [0u8; 8];
    d.copy_from_slice(&hash[..8]);
    d
}
