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

const HALF_LIFE_DAYS: f64 = 180.0;

pub(crate) fn exponential_weight(age_days: f64) -> f64 {
    2f64.powf(-age_days / HALF_LIFE_DAYS)
}


#[derive(Debug, Clone)]
pub struct FlowPoint {
    pub date: NaiveDate,
    pub nav_before_flow: Decimal,
    pub nav_after_flow: Decimal,
}

#[derive(Debug, Clone)]
pub struct WeightedReturn {
    pub date: NaiveDate,
    pub value: f64,
    pub weight: f64,
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


/// Returns daily returns with exponentially decaying weights.
///
/// The most recent return has weight 1.0. Older returns decay according to
/// the configured half-life.
pub fn weighted_daily_returns(
    curve: &[(NaiveDate, Decimal)],
) -> Vec<WeightedReturn> {
    if curve.len() < 2 {
        return Vec::new();
    }

    let newest = curve.last().unwrap().0;

    curve
        .windows(2)
        .filter_map(|w| {
            let prev = w[0].1;
            let curr = w[1].1;

            if prev.is_zero() {
                return None;
            }

            let age_days = (newest - w[1].0).num_days() as f64;
            let weight = exponential_weight(age_days);

            Some(WeightedReturn {
                date: w[1].0,
                value: ((curr - prev) / prev).try_into().unwrap_or(0.0),
                weight,
            })
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

        assert_eq!(r.len(), 1);
        assert!((r[0] - 0.1).abs() < 1e-9);
    }

    #[test]
    fn weighted_returns_newest_has_weight_one() {
        let curve = vec![
            (NaiveDate::from_ymd_opt(2026, 1, 1).unwrap(), dec!(1.0)),
            (NaiveDate::from_ymd_opt(2026, 1, 2).unwrap(), dec!(1.1)),
        ];

        let weighted = weighted_daily_returns(&curve);

        assert_eq!(weighted.len(), 1);
        assert!((weighted[0].weight - 1.0).abs() < 1e-9);
    }

    #[test]
    fn older_returns_have_smaller_weight() {
        let curve = vec![
            (NaiveDate::from_ymd_opt(2026, 1, 1).unwrap(), dec!(1.00)),
            (NaiveDate::from_ymd_opt(2026, 1, 2).unwrap(), dec!(1.05)),
            (NaiveDate::from_ymd_opt(2026, 4, 1).unwrap(), dec!(1.10)),
            (NaiveDate::from_ymd_opt(2026, 7, 1).unwrap(), dec!(1.15)),
        ];

        let weighted = weighted_daily_returns(&curve);

        assert_eq!(weighted.len(), 3);

        // Weights should increase as we get closer to the newest return.
        assert!(weighted[0].weight < weighted[1].weight);
        assert!(weighted[1].weight < weighted[2].weight);

        // The newest return always has full weight.
        assert!((weighted[2].weight - 1.0).abs() < 1e-9);
    }

    #[test]
    fn return_values_are_unchanged() {
        let curve = vec![
            (NaiveDate::from_ymd_opt(2026, 1, 1).unwrap(), dec!(1.00)),
            (NaiveDate::from_ymd_opt(2026, 1, 2).unwrap(), dec!(1.10)),
            (NaiveDate::from_ymd_opt(2026, 1, 3).unwrap(), dec!(1.21)),
        ];

        let weighted = weighted_daily_returns(&curve);

        assert!((weighted[0].value - 0.10).abs() < 1e-9);
        assert!((weighted[1].value - 0.10).abs() < 1e-9);
    }


}

