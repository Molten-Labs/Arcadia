/// Time-Weighted Return (TWR) daily return series.
///
/// TWR strips out the effect of external cash flows (deposits / withdrawals)
/// so the curve reflects only trading performance, not AUM changes.
use chrono::NaiveDate;
use rust_decimal::Decimal;

/// Convert a (date, twr_nav) equity curve from the DB into a daily return
/// series for metric computation.
pub fn daily_returns(curve: &[(NaiveDate, Decimal)]) -> Vec<f64> {
    if curve.len() < 2 {
        return Vec::new();
    }
    curve
        .windows(2)
        .filter_map(|w| {
            let prev = w[0].1;
            let curr = w[1].1;
            if prev.is_zero() {
                None
            } else {
                let ret = (curr - prev) / prev;
                Some(ret.try_into().unwrap_or(0.0_f64))
            }
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn returns_two_points() {
        let curve = vec![
            (NaiveDate::from_ymd_opt(2026, 1, 1).unwrap(), dec!(1.0)),
            (NaiveDate::from_ymd_opt(2026, 1, 2).unwrap(), dec!(1.1)),
        ];
        let r = daily_returns(&curve);
        assert!((r[0] - 0.1).abs() < 1e-9);
    }
}
