use anchor_lang::prelude::*;

#[constant]
pub const SHARE_SCALE: u64 = 1_000_000;

#[constant]
pub const USDC_DECIMALS: u8 = 6;

#[constant]
pub const BPS_DENOMINATOR: u16 = 10_000;

#[constant]
pub const SECONDS_PER_YEAR: u64 = 31_557_600;

#[constant]
pub const PLATFORM_PERF_FEE_BPS: u16 = 500;

#[constant]
pub const PLATFORM_MGMT_FEE_BPS: u16 = 100;

#[constant]
pub const MAX_NOTIONAL_BPS: u16 = 2_000;

#[constant]
pub const INSTANT_WITHDRAW_BPS: u16 = 500;

#[constant]
pub const MAX_LEVERAGE_CEILING: u8 = 50;

#[constant]
pub const MAX_TIER_BPS: u16 = 3_500;

#[constant]
pub const NOT_FUNDABLE_TIER: u8 = 255;

#[constant]
pub const PROFILE_STATUS_ACTIVE: u8 = 0;

#[constant]
pub const PROFILE_STATUS_CLOSED: u8 = 1;

#[constant]
pub const DIRECTION_LONG: u8 = 0;

#[constant]
pub const DIRECTION_SHORT: u8 = 1;

#[constant]
pub const PLATFORM_SEED: &[u8] = b"platform";

#[constant]
pub const PROFILE_SEED: &[u8] = b"profile";

#[constant]
pub const INVESTOR_SEED: &[u8] = b"investor";

#[constant]
pub const POSITION_SEED: &[u8] = b"position";

pub fn tier_bps(score_tier: u8) -> Option<u16> {
    match score_tier {
        0 => Some(2_000),
        1 => Some(2_500),
        2 => Some(3_000),
        3 => Some(3_500),
        NOT_FUNDABLE_TIER => Some(0),
        _ => None,
    }
}

pub fn is_valid_score_tier(score_tier: u8) -> bool {
    tier_bps(score_tier).is_some()
}
