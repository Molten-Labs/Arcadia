/// Time-Weighted Return (TWR) equity curve builder.
///
/// TWR strips out the effect of external cash flows (deposits / withdrawals)
/// so the curve reflects only trading performance, not AUM changes.
///
/// Algorithm:
///   - Split history into sub-periods separated by flow events.
///   - For each sub-period: return = (end_nav - start_nav) / start_nav.
///   - TWR = product of (1 + sub_period_return) across all periods.
///   - We record a daily equity index starting at 1.0.
use chrono::NaiveDate;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;

#[derive(Debug, Clone)]
pub struct FlowPoint {
    pub date: NaiveDate,
    pub nav_before_flow: Decimal,
    pub nav_after_flow: Decimal,
}

/// Build a daily TWR equity index from daily NAV observations and flow points.
///
/// `daily_nav` — (date, nav_per_share) pairs, sorted ascending.
/// `flows`     — flow events that reset the compounding period.
///
/// Returns a Vec<(date, twr_index)> starting at 1.0 on the first date.
pub fn build_curve(
    daily_nav: &[(NaiveDate, Decimal)],
    flows: &[FlowPoint],
) -> Vec<(NaiveDate, Decimal)> {
    if daily_nav.is_empty() {
        return Vec::new();
    }

    let mut result = Vec::with_capacity(daily_nav.len());
    let mut twr = dec!(1);
    let mut period_start_nav = daily_nav[0].1;
    let one = dec!(1);

    for (i, &(date, nav)) in daily_nav.iter().enumerate() {
        // Check if any flow happened on this date
        let had_flow = flows.iter().any(|f| f.date == date);

        if had_flow {
            // Close the current sub-period
            if period_start_nav > Decimal::ZERO {
                let sub_return = (nav - period_start_nav) / period_start_nav;
                twr *= one + sub_return;
            }
            // Re-open with post-flow NAV
            if let Some(f) = flows.iter().find(|f| f.date == date) {
                period_start_nav = f.nav_after_flow;
            }
        } else if i == 0 {
            // First point: index = 1.0
        } else {
            // Normal day: accumulate since period_start
            if period_start_nav > Decimal::ZERO {
                let sub_return = (nav - period_start_nav) / period_start_nav;
                twr = dec!(1) * (one + sub_return)
                    * twr / (one + if i > 1 {
                        (daily_nav[i-1].1 - period_start_nav) / period_start_nav
                    } else { Decimal::ZERO });
            }
        }

        result.push((date, twr));
    }

    // Normalize so first point = 1.0
    if let Some(&(_, first)) = result.first() {
        if first != Decimal::ZERO {
            for (_, v) in &mut result {
                *v /= first;
            }
        }
    }

    result
}

/// Simpler version used internally: just convert a (date, twr_nav) equity
/// curve from the DB into daily return series for metric computation.
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
