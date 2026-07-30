/// Capacity engine — maps score to a capacity multiplier and tier byte.
///
/// The USD ceiling is computed outside this crate by the caller:
///   `capacity_usd = trader_shares × multiplier`
///
/// Every score ≥ 100 gets a tier. No more 600+ gate.
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CapacityResult {
    /// Capacity multiplier (1×, 2×, 3×, 5×, or 10×).
    pub multiplier: u32,
    /// Tier byte for on-chain / DB (0=Verified … 4=Apex).
    pub tier_u8: u8,
}

pub fn compute(score: u32) -> CapacityResult {
    match score {
        250..=499   => CapacityResult { multiplier: 2,  tier_u8: 1 },
        500..=749   => CapacityResult { multiplier: 3,  tier_u8: 2 },
        750..=949   => CapacityResult { multiplier: 5,  tier_u8: 3 },
        950..=1000  => CapacityResult { multiplier: 10, tier_u8: 4 },
        _           => CapacityResult { multiplier: 1,  tier_u8: 0 },
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shrimp_gets_1x() {
        let c = compute(100);
        assert_eq!(c.multiplier, 1);
        assert_eq!(c.tier_u8, 0);
    }

    #[test]
    fn established_gets_2x() {
        let c = compute(300);
        assert_eq!(c.multiplier, 2);
        assert_eq!(c.tier_u8, 1);
    }

    #[test]
    fn advanced_gets_3x() {
        let c = compute(600);
        assert_eq!(c.multiplier, 3);
        assert_eq!(c.tier_u8, 2);
    }

    #[test]
    fn elite_gets_5x() {
        let c = compute(800);
        assert_eq!(c.multiplier, 5);
        assert_eq!(c.tier_u8, 3);
    }

    #[test]
    fn apex_gets_10x() {
        let c = compute(950);
        assert_eq!(c.multiplier, 10);
        assert_eq!(c.tier_u8, 4);
    }

    #[test]
    fn score_250_boundary() {
        assert_eq!(compute(249).multiplier, 1);
        assert_eq!(compute(250).multiplier, 2);
    }
}
