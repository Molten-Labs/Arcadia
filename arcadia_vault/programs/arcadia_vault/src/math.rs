use anchor_lang::prelude::*;

use crate::{
    ArcadiaError, BPS_DENOMINATOR, DIRECTION_LONG, DIRECTION_SHORT, INSTANT_WITHDRAW_BPS,
    MAX_TIER_BPS, SECONDS_PER_YEAR, SHARE_SCALE,
};

pub const SECONDS_PER_DAY: i64 = 86_400;

fn math_error() -> anchor_lang::error::Error {
    ArcadiaError::MathOverflow.into()
}

pub fn checked_add_u64(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_add(rhs).ok_or_else(math_error)
}

pub fn checked_sub_u64(lhs: u64, rhs: u64) -> Result<u64> {
    lhs.checked_sub(rhs).ok_or_else(math_error)
}

pub fn checked_mul_div_u64(lhs: u64, rhs: u64, divisor: u64) -> Result<u64> {
    let quotient = (lhs as u128)
        .checked_mul(rhs as u128)
        .ok_or_else(math_error)?
        .checked_div(divisor as u128)
        .ok_or_else(math_error)?;

    quotient.try_into().map_err(|_| math_error())
}

pub fn nav_bearing_assets(total_assets: u64, trader_claimable: u64) -> Result<u64> {
    checked_sub_u64(total_assets, trader_claimable)
}

pub fn nav_per_share(total_assets: u64, trader_claimable: u64, total_shares: u64) -> Result<u64> {
    require!(total_shares > 0, ArcadiaError::NoShares);
    checked_mul_div_u64(
        nav_bearing_assets(total_assets, trader_claimable)?,
        SHARE_SCALE,
        total_shares,
    )
}

pub fn shares_for_deposit(amount: u64, total_shares: u64, total_assets: u64) -> Result<u64> {
    if total_shares == 0 {
        return Ok(amount);
    }

    checked_mul_div_u64(amount, total_shares, total_assets)
}

pub fn assets_for_shares(shares: u64, nav_bearing_assets: u64, total_shares: u64) -> Result<u64> {
    checked_mul_div_u64(shares, nav_bearing_assets, total_shares)
}

pub fn trade_notional_cap(total_assets: u64, max_notional_bps: u16) -> Result<u64> {
    checked_mul_div_u64(
        total_assets,
        max_notional_bps as u64,
        BPS_DENOMINATOR as u64,
    )
}

pub fn fee_from_bps(amount: u64, bps: u16) -> Result<u64> {
    checked_mul_div_u64(amount, bps as u64, BPS_DENOMINATOR as u64)
}

pub fn profit_assets(
    current_nav_per_share: u64,
    hwm_per_share: u64,
    total_shares: u64,
) -> Result<u64> {
    if current_nav_per_share <= hwm_per_share {
        return Ok(0);
    }

    checked_mul_div_u64(
        current_nav_per_share - hwm_per_share,
        total_shares,
        SHARE_SCALE,
    )
}

pub fn management_fee(total_assets: u64, mgmt_fee_bps: u16, elapsed_seconds: u64) -> Result<u64> {
    let numerator = (total_assets as u128)
        .checked_mul(mgmt_fee_bps as u128)
        .ok_or_else(math_error)?
        .checked_mul(elapsed_seconds as u128)
        .ok_or_else(math_error)?;
    let denominator = (BPS_DENOMINATOR as u128)
        .checked_mul(SECONDS_PER_YEAR as u128)
        .ok_or_else(math_error)?;
    let quotient = numerator.checked_div(denominator).ok_or_else(math_error)?;

    quotient.try_into().map_err(|_| math_error())
}

pub fn next_daily_settlement_window(now: i64) -> Result<i64> {
    let day = now.checked_div(SECONDS_PER_DAY).ok_or_else(math_error)?;
    day.checked_add(1)
        .and_then(|next| next.checked_mul(SECONDS_PER_DAY))
        .ok_or_else(math_error)
}

pub fn withdrawal_ready_ts(
    shares: u64,
    total_assets: u64,
    trader_claimable: u64,
    total_shares: u64,
    now: i64,
) -> Result<i64> {
    let nav_excl = nav_bearing_assets(total_assets, trader_claimable)?;
    let withdraw_value = assets_for_shares(shares, nav_excl, total_shares)? as u128;
    let aum = nav_excl as u128;

    let lhs = withdraw_value
        .checked_mul(BPS_DENOMINATOR as u128)
        .ok_or_else(math_error)?;
    let rhs = aum
        .checked_mul(INSTANT_WITHDRAW_BPS as u128)
        .ok_or_else(math_error)?;

    if lhs < rhs {
        Ok(now)
    } else {
        next_daily_settlement_window(now)
    }
}

pub fn is_fee_config_safe(perf_fee_bps: u16, mgmt_fee_bps: u16) -> bool {
    perf_fee_bps <= BPS_DENOMINATOR
        && mgmt_fee_bps <= BPS_DENOMINATOR
        && (perf_fee_bps as u32 + MAX_TIER_BPS as u32) <= BPS_DENOMINATOR as u32
}

pub fn validate_trade_params(
    direction: u8,
    size_usd: u64,
    entry_px: u64,
    exit_px: u64,
    opened_at: i64,
    closed_at: i64,
) -> Result<()> {
    require!(
        direction == DIRECTION_LONG || direction == DIRECTION_SHORT,
        ArcadiaError::InvalidTradeParams
    );
    require!(
        size_usd > 0 && entry_px > 0 && exit_px > 0 && closed_at >= opened_at,
        ArcadiaError::InvalidTradeParams
    );

    Ok(())
}

pub fn realized_pnl(
    direction: u8,
    size_usd: u64,
    leverage_x100: u16,
    entry_px: u64,
    exit_px: u64,
    fees_usd: u64,
) -> Result<i64> {
    require!(
        direction == DIRECTION_LONG || direction == DIRECTION_SHORT,
        ArcadiaError::InvalidTradeParams
    );
    require!(
        size_usd > 0 && leverage_x100 > 0 && entry_px > 0 && exit_px > 0,
        ArcadiaError::InvalidTradeParams
    );

    let dir_sign: i128 = if direction == DIRECTION_LONG { 1 } else { -1 };
    let px_diff = (exit_px as i128)
        .checked_sub(entry_px as i128)
        .ok_or_else(math_error)?;
    let denominator = (entry_px as i128).checked_mul(100).ok_or_else(math_error)?;
    let gross = dir_sign
        .checked_mul(size_usd as i128)
        .ok_or_else(math_error)?
        .checked_mul(leverage_x100 as i128)
        .ok_or_else(math_error)?
        .checked_mul(px_diff)
        .ok_or_else(math_error)?
        .checked_div(denominator)
        .ok_or_else(math_error)?;
    let realized = gross.checked_sub(fees_usd as i128).ok_or_else(math_error)?;

    realized.try_into().map_err(|_| math_error())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::MAX_NOTIONAL_BPS;

    #[test]
    fn share_math_uses_spec_flooring() {
        assert_eq!(
            shares_for_deposit(5_000_000_000, 0, 0).unwrap(),
            5_000_000_000
        );
        assert_eq!(
            shares_for_deposit(1_100_000_000, 5_000_000_000, 5_500_000_000).unwrap(),
            1_000_000_000
        );
        assert_eq!(
            assets_for_shares(1_000_000_000, 5_500_000_000, 5_000_000_000).unwrap(),
            1_100_000_000
        );
    }

    #[test]
    fn nav_excludes_trader_claimable() {
        assert_eq!(
            nav_per_share(1_200_000_000, 100_000_000, 1_000_000_000).unwrap(),
            1_100_000
        );
        assert!(nav_per_share(1_200_000_000, 100_000_000, 0).is_err());
        assert!(nav_bearing_assets(100, 101).is_err());
    }

    #[test]
    fn withdrawal_threshold_is_strictly_under_five_percent() {
        let now = 1_000_000;
        assert_eq!(withdrawal_ready_ts(49, 1_000, 0, 1_000, now).unwrap(), now);
        assert_eq!(
            withdrawal_ready_ts(50, 1_000, 0, 1_000, now).unwrap(),
            next_daily_settlement_window(now).unwrap()
        );
    }

    #[test]
    fn pnl_math_matches_long_short_direction() {
        assert_eq!(
            realized_pnl(DIRECTION_LONG, 1_000_000, 200, 100, 110, 10_000).unwrap(),
            190_000
        );
        assert_eq!(
            realized_pnl(DIRECTION_SHORT, 1_000_000, 200, 100, 90, 10_000).unwrap(),
            190_000
        );
        assert_eq!(
            realized_pnl(DIRECTION_LONG, 1_000_000, 200, 100, 90, 10_000).unwrap(),
            -210_000
        );
    }

    #[test]
    fn fees_caps_and_profit_are_checked() {
        assert!(is_fee_config_safe(500, 100));
        assert!(!is_fee_config_safe(7_000, 100));
        assert_eq!(fee_from_bps(1_000_000, 500).unwrap(), 50_000);
        assert_eq!(
            trade_notional_cap(10_000_000, MAX_NOTIONAL_BPS).unwrap(),
            2_000_000
        );
        assert_eq!(
            profit_assets(1_100_000, 1_000_000, 5_000_000_000).unwrap(),
            500_000_000
        );
        assert_eq!(
            management_fee(10_000_000, 100, SECONDS_PER_YEAR).unwrap(),
            100_000
        );
    }
}
