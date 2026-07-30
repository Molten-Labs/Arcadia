pub mod classify;
pub mod events;
pub mod types;

pub use events::*;
pub use types::*;

use rust_decimal::Decimal;
use thiserror::Error;

// ── Money helpers ─────────────────────────────────────────────────────────────

/// Convert USDC minor units (u64, 6 decimals) to a Decimal dollar value.
pub fn minor_to_decimal(minor: u64) -> Decimal {
    Decimal::new(minor as i64, 6)
}

/// Convert a Decimal dollar value to USDC minor units (u64, 6 decimals).
/// Panics if the value is negative.
pub fn decimal_to_minor(d: Decimal) -> u64 {
    let scaled = d * Decimal::new(1_000_000, 0);
    scaled.floor().to_u64_checked().unwrap_or(0)
}

// ── Score tiers ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum ScoreTier {
    Verified    = 0,
    Established = 1,
    Advanced    = 2,
    Elite       = 3,
    Apex        = 4,
}

impl ScoreTier {
    pub fn from_score(score: u32) -> Self {
        match score {
            250..=499 => Self::Established,
            500..=749 => Self::Advanced,
            750..=949 => Self::Elite,
            950..=1000 => Self::Apex,
            _ => Self::Verified,
        }
    }

    pub fn multiplier(&self) -> u32 {
        match self {
            Self::Verified    => 1,
            Self::Established => 2,
            Self::Advanced    => 3,
            Self::Elite       => 5,
            Self::Apex        => 10,
        }
    }

    pub fn as_u8(self) -> u8 {
        self as u8
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Verified    => "Verified",
            Self::Established => "Established",
            Self::Advanced    => "Advanced",
            Self::Elite       => "Elite",
            Self::Apex        => "Apex",
        }
    }

    /// Profit-share percentage for the trader (20-40%).
    pub fn trader_profit_share(&self) -> Decimal {
        match self {
            Self::Verified    => Decimal::new(20, 2),
            Self::Established => Decimal::new(25, 2),
            Self::Advanced    => Decimal::new(30, 2),
            Self::Elite       => Decimal::new(35, 2),
            Self::Apex        => Decimal::new(40, 2),
        }
    }
}

impl std::fmt::Display for ScoreTier {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.as_str())
    }
}

// ── Common error ─────────────────────────────────────────────────────────────

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("invalid pubkey: {0}")]
    InvalidPubkey(String),
    #[error("arithmetic overflow")]
    Overflow,
    #[error("invalid data: {0}")]
    InvalidData(String),
}

// ── Trait extensions ─────────────────────────────────────────────────────────

pub trait DecimalExt {
    fn to_u64_checked(self) -> Option<u64>;
}

impl DecimalExt for Decimal {
    fn to_u64_checked(self) -> Option<u64> {
        if self < Decimal::ZERO { return None; }
        let trunc = self.trunc();
        let s = trunc.to_string();
        s.parse::<u64>().ok()
    }
}
