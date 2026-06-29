/// Dynamic capacity engine.
///
/// Computes the USD ceiling the indexer will push onchain via set_capacity.
///
/// Formula (from spec — "Capacity base / divisor: 2500 / 140"):
///   capacity_usd = BASE_USD * exp((score - SCORE_FLOOR) / DIVISOR)
///
/// Only traders with score ≥ 600 (Verified) get a capacity assignment.
/// The returned `cap_u64` is the onchain value: capacity in USDC minor units
/// (× 1,000,000) for the set_capacity instruction handler.
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use serde::{Deserialize, Serialize};

const BASE_USD: f64   = 2_500.0;
const SCORE_FLOOR: f64 = 600.0;
const DIVISOR: f64    = 140.0;

/// Maximum capacity ceiling regardless of score.
const MAX_CAP_USD: f64 = 10_000_000.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapacityResult {
    /// Computed capacity ceiling in USD (Decimal for display).
    pub capacity_usd: Decimal,
    /// Ready to push onchain: USDC minor units (6 decimals).
    pub cap_u64: u64,
    /// Tier byte for the set_capacity instruction (0=Verified … 3=Elite).
    pub tier_u8: u8,
}

pub fn compute(score: u32) -> CapacityResult {
    let tier_u8 = match score {
        600..=699  => 0u8,
        700..=799  => 1,
        800..=899  => 2,
        900..=1000 => 3,
        _          => {
            // Below tier — return a zero capacity.
            return CapacityResult {
                capacity_usd: Decimal::ZERO,
                cap_u64:      0,
                tier_u8:      0,
            };
        }
    };

    let exp_arg = (score as f64 - SCORE_FLOOR) / DIVISOR;
    let cap_f64 = (BASE_USD * exp_arg.exp()).min(MAX_CAP_USD);

    // Round down to whole cents to avoid float drift, then to minor units.
    let cap_cents = (cap_f64 * 100.0).floor() as u64;
    let capacity_usd = Decimal::new(cap_cents as i64, 2);

    // USDC minor units (6 decimals): multiply dollars by 1_000_000
    let cap_u64 = cap_cents * 10_000; // cents → minor units (* 10000)

    CapacityResult { capacity_usd, cap_u64, tier_u8 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn below_600_gives_zero() {
        let c = compute(590);
        assert_eq!(c.cap_u64, 0);
    }

    #[test]
    fn score_600_gives_base() {
        let c = compute(600);
        // exp(0) = 1, so capacity = BASE_USD = $2500
        assert!(c.capacity_usd >= rust_decimal_macros::dec!(2490)); // allow small rounding
        assert!(c.capacity_usd <= rust_decimal_macros::dec!(2510));
    }

    #[test]
    fn higher_score_gives_higher_cap() {
        let c600 = compute(600);
        let c700 = compute(700);
        let c900 = compute(900);
        assert!(c700.capacity_usd > c600.capacity_usd);
        assert!(c900.capacity_usd > c700.capacity_usd);
    }

    #[test]
    fn elite_score_tier_byte() {
        assert_eq!(compute(950).tier_u8, 3);
        assert_eq!(compute(750).tier_u8, 1);
    }
}
