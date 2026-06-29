/// Arcadia event decoder.
///
/// Anchor events are encoded as base64 in program logs prefixed with
/// "Program data: ". The raw bytes are: [8-byte discriminator][borsh payload].
/// Discriminator = sha256("event:<EventName>")[..8].
use anyhow::{anyhow, Result};
use arcadia_core::events::*;
use base64::{engine::general_purpose, Engine as _};
use borsh::BorshDeserialize;
use sha2::{Digest, Sha256};
use std::sync::OnceLock;

// ── Discriminator computation ─────────────────────────────────────────────────

fn disc(name: &str) -> [u8; 8] {
    let mut hasher = Sha256::new();
    hasher.update(format!("event:{name}"));
    let hash = hasher.finalize();
    let mut out = [0u8; 8];
    out.copy_from_slice(&hash[..8]);
    out
}

macro_rules! cached_disc {
    ($name:ident, $event:literal) => {
        fn $name() -> &'static [u8; 8] {
            static DISC: OnceLock<[u8; 8]> = OnceLock::new();
            DISC.get_or_init(|| disc($event))
        }
    };
}

cached_disc!(disc_profile_initialized,  "ProfileInitialized");
cached_disc!(disc_investor_initialized, "InvestorInitialized");
cached_disc!(disc_deposited,            "Deposited");
cached_disc!(disc_withdraw_requested,   "WithdrawRequested");
cached_disc!(disc_withdrawn,            "Withdrawn");
cached_disc!(disc_trade_closed,         "TradeClosed");
cached_disc!(disc_settled,              "Settled");
cached_disc!(disc_profit_withdrawn,     "ProfitWithdrawn");

// ── Public API ────────────────────────────────────────────────────────────────

/// Attempt to decode an Arcadia event from raw log bytes.
/// Returns `Ok(None)` if the discriminator is not recognized.
pub fn decode_event(data: &[u8]) -> Result<Option<ArcadiaEvent>> {
    if data.len() < 8 {
        return Ok(None);
    }
    let (disc_bytes, payload) = data.split_at(8);
    let disc_arr: [u8; 8] = disc_bytes.try_into().unwrap();

    macro_rules! try_decode {
        ($disc_fn:ident, $raw:ty, $variant:ident) => {
            if &disc_arr == $disc_fn() {
                let raw = <$raw>::try_from_slice(payload)?;
                return Ok(Some(ArcadiaEvent::$variant(raw.into())));
            }
        };
    }

    try_decode!(disc_trade_closed,         RawTradeClosed,         TradeClosed);
    try_decode!(disc_deposited,            RawDeposited,           Deposited);
    try_decode!(disc_profile_initialized,  RawProfileInitialized,  ProfileInitialized);
    try_decode!(disc_investor_initialized, RawInvestorInitialized, InvestorInitialized);
    try_decode!(disc_withdraw_requested,   RawWithdrawRequested,   WithdrawRequested);
    try_decode!(disc_withdrawn,            RawWithdrawn,           Withdrawn);
    try_decode!(disc_settled,             RawSettled,              Settled);
    try_decode!(disc_profit_withdrawn,    RawProfitWithdrawn,      ProfitWithdrawn);

    Ok(None)
}

/// Decode events from a Solana transaction log line ("Program data: <base64>").
pub fn decode_log_line(line: &str) -> Result<Option<ArcadiaEvent>> {
    let prefix = "Program data: ";
    if !line.starts_with(prefix) {
        return Ok(None);
    }
    let b64 = &line[prefix.len()..];
    let bytes = general_purpose::STANDARD
        .decode(b64)
        .map_err(|e| anyhow!("base64 decode: {e}"))?;
    decode_event(&bytes)
}

// ── Raw borsh structs (mirror the onchain event layout) ───────────────────────

#[derive(BorshDeserialize)]
struct RawProfileInitialized {
    profile: [u8; 32],
    trader:  [u8; 32],
    ts:      i64,
}

#[derive(BorshDeserialize)]
struct RawInvestorInitialized {
    investor: [u8; 32],
    ts:       i64,
}

#[derive(BorshDeserialize)]
struct RawDeposited {
    profile:       [u8; 32],
    depositor:     [u8; 32],
    is_trader:     bool,
    amount_usd:    u64,
    shares_minted: u64,
    nav_per_share: u64,
    ts:            i64,
}

#[derive(BorshDeserialize)]
struct RawWithdrawRequested {
    profile:           [u8; 32],
    owner:             [u8; 32],
    shares:            u64,
    withdraw_ready_ts: i64,
}

#[derive(BorshDeserialize)]
struct RawWithdrawn {
    profile:       [u8; 32],
    owner:         [u8; 32],
    shares_burned: u64,
    amount_usd:    u64,
}

#[derive(BorshDeserialize)]
struct RawTradeClosed {
    profile:        [u8; 32],
    trader:         [u8; 32],
    market:         String,
    direction:      u8,
    size_usd:       u64,
    leverage_x100:  u16,
    entry_px:       u64,
    exit_px:        u64,
    realized_pnl:   i64,
    fees_usd:       u64,
    was_liquidated: bool,
    opened_at:      i64,
    closed_at:      i64,
}

#[derive(BorshDeserialize)]
struct RawSettled {
    profile:       [u8; 32],
    profit_usd:    u64,
    trader_cut:    u64,
    platform_cut:  u64,
    hwm_per_share: u64,
}

#[derive(BorshDeserialize)]
struct RawProfitWithdrawn {
    profile:    [u8; 32],
    trader:     [u8; 32],
    amount_usd: u64,
}

// ── Raw → domain type conversions ─────────────────────────────────────────────

fn pubkey_to_b58(bytes: &[u8; 32]) -> String {
    bs58::encode(bytes).into_string()
}

fn ts_to_dt(ts: i64) -> chrono::DateTime<chrono::Utc> {
    chrono::DateTime::from_timestamp(ts, 0).unwrap_or_default()
}

fn minor_to_dec(v: u64) -> rust_decimal::Decimal {
    rust_decimal::Decimal::new(v as i64, 6)
}

fn signed_minor_to_dec(v: i64) -> rust_decimal::Decimal {
    rust_decimal::Decimal::new(v, 6)
}

impl From<RawProfileInitialized> for ProfileInitialized {
    fn from(r: RawProfileInitialized) -> Self {
        Self {
            profile: pubkey_to_b58(&r.profile),
            trader:  pubkey_to_b58(&r.trader),
            ts:      ts_to_dt(r.ts),
        }
    }
}

impl From<RawInvestorInitialized> for InvestorInitialized {
    fn from(r: RawInvestorInitialized) -> Self {
        Self {
            investor: pubkey_to_b58(&r.investor),
            ts:       ts_to_dt(r.ts),
        }
    }
}

impl From<RawDeposited> for Deposited {
    fn from(r: RawDeposited) -> Self {
        Self {
            profile:       pubkey_to_b58(&r.profile),
            depositor:     pubkey_to_b58(&r.depositor),
            is_trader:     r.is_trader,
            amount_usd:    minor_to_dec(r.amount_usd),
            shares_minted: minor_to_dec(r.shares_minted),
            nav_per_share: minor_to_dec(r.nav_per_share),
            ts:            ts_to_dt(r.ts),
        }
    }
}

impl From<RawWithdrawRequested> for WithdrawRequested {
    fn from(r: RawWithdrawRequested) -> Self {
        Self {
            profile:          pubkey_to_b58(&r.profile),
            owner:            pubkey_to_b58(&r.owner),
            shares:           minor_to_dec(r.shares),
            withdraw_ready_ts: ts_to_dt(r.withdraw_ready_ts),
        }
    }
}

impl From<RawWithdrawn> for Withdrawn {
    fn from(r: RawWithdrawn) -> Self {
        Self {
            profile:       pubkey_to_b58(&r.profile),
            owner:         pubkey_to_b58(&r.owner),
            shares_burned: minor_to_dec(r.shares_burned),
            amount_usd:    minor_to_dec(r.amount_usd),
        }
    }
}

impl From<RawTradeClosed> for TradeClosed {
    fn from(r: RawTradeClosed) -> Self {
        Self {
            profile:        pubkey_to_b58(&r.profile),
            trader:         pubkey_to_b58(&r.trader),
            market:         r.market,
            direction:      r.direction,
            size_usd:       minor_to_dec(r.size_usd),
            leverage_x:     rust_decimal::Decimal::new(r.leverage_x100 as i64, 2),
            entry_px:       minor_to_dec(r.entry_px),
            exit_px:        minor_to_dec(r.exit_px),
            realized_pnl:   signed_minor_to_dec(r.realized_pnl),
            fees_usd:       minor_to_dec(r.fees_usd),
            was_liquidated: r.was_liquidated,
            opened_at:      ts_to_dt(r.opened_at),
            closed_at:      ts_to_dt(r.closed_at),
        }
    }
}

impl From<RawSettled> for Settled {
    fn from(r: RawSettled) -> Self {
        Self {
            profile:       pubkey_to_b58(&r.profile),
            profit_usd:    minor_to_dec(r.profit_usd),
            trader_cut:    minor_to_dec(r.trader_cut),
            platform_cut:  minor_to_dec(r.platform_cut),
            hwm_per_share: minor_to_dec(r.hwm_per_share),
        }
    }
}

impl From<RawProfitWithdrawn> for ProfitWithdrawn {
    fn from(r: RawProfitWithdrawn) -> Self {
        Self {
            profile:    pubkey_to_b58(&r.profile),
            trader:     pubkey_to_b58(&r.trader),
            amount_usd: minor_to_dec(r.amount_usd),
        }
    }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn discriminators_are_different() {
        let a = disc("TradeClosed");
        let b = disc("Deposited");
        assert_ne!(a, b);
    }

    #[test]
    fn unknown_disc_returns_none() {
        let data = [0u8; 16]; // all-zero discriminator → not recognized
        let result = decode_event(&data).unwrap();
        assert!(result.is_none());
    }
}
