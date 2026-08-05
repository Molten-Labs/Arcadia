/// Performance metric computation.
///
/// All money intermediates use f64 — these are offchain scoring values, not
/// user-facing dollar figures. Money columns in the DB stay as rust_decimal.
use crate::twr::daily_returns;
use arcadia_core::classify::{self, TradeSample};
use arcadia_core::types::Trade;
use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

const ANNUALISATION: f64 = 252.0_f64;
const RISK_FREE: f64 = 0.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metrics {
    /// Annualised Sortino ratio (downside deviation denominator)
    pub sortino: f64,
    /// Annualised Calmar ratio (annualised return / max drawdown)
    pub calmar: f64,
    /// Annualised Sharpe ratio (total std_dev denominator)
    pub sharpe: f64,
    /// Maximum drawdown (0-1, positive = loss)
    pub max_dd: f64,
    /// Ulcer Index (RMS of percentage drawdowns)
    pub ulcer: f64,
    /// Annualized volatility (std dev of returns × sqrt(252))
    pub volatility: f64,
    /// Daily mean return
    pub mean_return: f64,
    /// Annualized downside deviation
    pub downside_deviation: f64,
    /// Liquidation rate (liq_trades / total_trades)
    pub liq_rate: f64,
    /// Fraction of profitable trades
    pub pct_profitable: f64,
    /// Mean leverage across all trades
    pub avg_leverage: f64,
    /// Total number of closed trades
    pub trade_count: usize,
    /// Days in the equity curve
    pub days_active: usize,
    /// Wash-trading signals fired (out of `wash_total`) by the classifier
    pub wash_fired: u32,
    /// Wash-trading signal hypotheses the classifier evaluates
    pub wash_total: u32,
    /// Track-record duration in calendar months (anti-farm gate)
    pub months_active: f64,
}

impl Metrics {
    pub fn zero() -> Self {
        Self {
            sortino: 0.0,
            calmar: 0.0,
            sharpe: 0.0,
            max_dd: 0.0,
            ulcer: 0.0,
            volatility: 0.0,
            mean_return: 0.0,
            downside_deviation: 0.0,
            liq_rate: 0.0,
            pct_profitable: 0.0,
            avg_leverage: 0.0,
            trade_count: 0,
            days_active: 0,
            wash_fired: 0,
            wash_total: 0,
            months_active: 0.0,
        }
    }
}

pub fn compute(
    equity_curve: &[(NaiveDate, Decimal)],
    trades: &[Trade],
) -> Metrics {
    let returns = daily_returns(equity_curve);
    let n = returns.len();
    let days = equity_curve.len();

    if n == 0 || trades.is_empty() {
        return Metrics::zero();
    }

    let mean_ret = returns.iter().sum::<f64>() / n as f64;
    let ann_ret  = (1.0 + mean_ret).powf(ANNUALISATION) - 1.0;

    // ── Total std dev & Sharpe ──────────────────────────────────────────────
    let variance = returns.iter().map(|&r| (r - mean_ret).powi(2)).sum::<f64>() / n as f64;
    let daily_std = variance.sqrt();
    let ann_vol = daily_std * ANNUALISATION.sqrt();
    let sharpe = if daily_std < 1e-10 { 0.0 } else { mean_ret / daily_std * ANNUALISATION.sqrt() };

    // ── Sortino ────────────────────────────────────────────────────────────
    let downside: Vec<f64> = returns
        .iter()
        .filter(|&&r| r < RISK_FREE)
        .map(|&r| (r - RISK_FREE).powi(2))
        .collect();
    let downside_dev = if downside.is_empty() {
        1e-10
    } else {
        (downside.iter().sum::<f64>() / downside.len() as f64).sqrt() * ANNUALISATION.sqrt()
    };
    let sortino = (ann_ret - RISK_FREE) / downside_dev;

    // ── Max Drawdown & Ulcer ───────────────────────────────────────────────
    let mut peak = 1.0_f64;
    let mut max_dd = 0.0_f64;
    let mut dd_sq_sum = 0.0_f64;
    let mut nav = 1.0_f64;

    for &r in &returns {
        nav *= 1.0 + r;
        if nav > peak {
            peak = nav;
        }
        let dd = (peak - nav) / peak;
        if dd > max_dd {
            max_dd = dd;
        }
        dd_sq_sum += dd * dd;
    }
    let ulcer = (dd_sq_sum / n as f64).sqrt();

    // ── Calmar ────────────────────────────────────────────────────────────
    let calmar = if max_dd < 1e-10 {
        ann_ret.max(0.0) / 1e-10
    } else {
        ann_ret / max_dd
    };

    // ── Trade-level metrics ───────────────────────────────────────────────
    let tc = trades.len();
    let liq_count = trades.iter().filter(|t| t.was_liquidated).count();
    let profitable = trades.iter().filter(|t| t.realized_pnl > Decimal::ZERO).count();
    let avg_lev: f64 = trades.iter()
        .map(|t| t.leverage_x.try_into().unwrap_or(0.0_f64))
        .sum::<f64>()
        / tc as f64;

    // ── Wash-trading signals from the classifier ───────────────────────────
    let samples: Vec<TradeSample> = trades.iter().map(to_sample).collect();
    let features = classify::build_features(&samples);
    let verdict = classify::classify(std::slice::from_ref(&features)).wash;

    // ── Track-record duration (calendar months across the trade window) ────
    let months_active = span_months(trades);

    Metrics {
        sortino:           clamp(sortino, -50.0, 50.0),
        calmar:            clamp(calmar,  -50.0, 50.0),
        sharpe:            clamp(sharpe,  -50.0, 50.0),
        max_dd:            max_dd.min(1.0),
        ulcer:             ulcer.min(1.0),
        volatility:        ann_vol.min(10.0),
        mean_return:       mean_ret,
        downside_deviation: downside_dev.min(10.0),
        liq_rate:          liq_count as f64 / tc as f64,
        pct_profitable:    profitable as f64 / tc as f64,
        avg_leverage:      avg_lev,
        trade_count:       tc,
        days_active:       days,
        wash_fired:        verdict.fired,
        wash_total:        verdict.total.max(1),
        months_active,
    }
}

fn to_sample(t: &Trade) -> TradeSample {
    TradeSample {
        direction:    t.direction,
        size_usd:     t.size_usd,
        realized_pnl: t.realized_pnl,
        fees_usd:     t.fees_usd,
        market:       t.market.clone(),
        closed_at_ts: t.closed_at.timestamp(),
    }
}

/// Derive a daily equity curve from closed trades alone (seed path).
///
/// Used when the DB has no `equity_point` rows yet — e.g. a fresh execution
/// pipeline profile. NAV starts at 1.0 and compounds the realized-PnL return
/// for each trading day, so the Score engine always has ≥2 curve points.
pub fn derive_equity_curve(trades: &[Trade]) -> Vec<(NaiveDate, Decimal)> {
    use std::collections::BTreeMap;

    let mut by_day: BTreeMap<NaiveDate, (Decimal, Decimal)> = BTreeMap::new();
    for t in trades {
        let day = t.closed_at.date_naive();
        let e = by_day.entry(day).or_default();
        e.0 += t.realized_pnl;
        e.1 += (t.size_usd * t.leverage_x).abs();
    }

    let mut nav = Decimal::ONE;
    let mut out = Vec::with_capacity(by_day.len());
    for (day, (pnl, deployed)) in by_day {
        if deployed > Decimal::ZERO {
            let ret = pnl / deployed;
            nav *= Decimal::ONE + ret;
        }
        out.push((day, nav));
    }
    out
}

fn span_months(trades: &[Trade]) -> f64 {
    let (Some(min), Some(max)) = (trades.iter().map(|t| t.closed_at).min(), trades.iter().map(|t| t.closed_at).max()) else {
        return 0.0;
    };
    (max - min).num_days() as f64 / 30.4375
}

fn clamp(v: f64, lo: f64, hi: f64) -> f64 {
    v.max(lo).min(hi)
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, TimeZone, Utc};
    use rust_decimal::prelude::FromStr;

    fn trade(signature: &str, day: i64, pnl: &str, size: &str, lev: &str) -> Trade {
        Trade {
            signature: signature.to_string(),
            event_index: 0,
            slot: 0,
            profile: "p".to_string(),
            trader: "t".to_string(),
            market: "SOL/USDC".to_string(),
            direction: 0,
            size_usd: Decimal::from_str(size).unwrap(),
            leverage_x: Decimal::from_str(lev).unwrap(),
            entry_px: Decimal::from_str("100").unwrap(),
            exit_px: Decimal::from_str("101").unwrap(),
            realized_pnl: Decimal::from_str(pnl).unwrap(),
            fees_usd: Decimal::ZERO,
            was_liquidated: false,
            opened_at: Utc.timestamp_opt(day * 86_400, 0).unwrap(),
            closed_at: Utc.timestamp_opt(day * 86_400, 0).unwrap(),
        }
    }

    fn days(d0: i64, n: usize) -> Vec<(NaiveDate, Decimal)> {
        let mut out = Vec::new();
        let mut nav = Decimal::ONE;
        for i in 0..n {
            let d = Utc
                .timestamp_opt((d0 + i as i64) * 86_400, 0)
                .unwrap()
                .date_naive();
            out.push((d, nav));
        }
        out
    }

    #[test]
    fn zero_trades_gives_zero() {
        let m = compute(&[], &[]);
        assert_eq!(m.trade_count, 0);
    }

    #[test]
    fn identical_inputs_yield_identical_metrics() {
        let curve = days(1_700_000, 60);
        let trades = vec![trade("s1", 1_700_000, "500", "10000", "2")];
        let a = compute(&curve, &trades);
        let b = compute(&curve, &trades);
        assert_eq!(a.sortino, b.sortino);
        assert_eq!(a.max_dd, b.max_dd);
        assert_eq!(a.trade_count, b.trade_count);
        assert_eq!(a.pct_profitable, b.pct_profitable);
    }

    #[test]
    fn profitable_sequence_improves_metrics_over_losing_sequence() {
        let gain_trades: Vec<Trade> = (0..40)
            .map(|i| trade(&format!("g{i}"), 1_700_000 + i as i64, "300", "10000", "2"))
            .collect();
        let loss_trades: Vec<Trade> = (0..40)
            .map(|i| trade(&format!("l{i}"), 1_700_000 + i as i64, "-300", "10000", "2"))
            .collect();
        let gain = compute(&derive_equity_curve(&gain_trades), &gain_trades);
        let loss = compute(&derive_equity_curve(&loss_trades), &loss_trades);
        assert!(gain.mean_return > loss.mean_return);
        assert!(gain.pct_profitable > loss.pct_profitable);
        assert!(gain.max_dd < loss.max_dd);
    }

    #[test]
    fn mixed_sequence_is_bounded() {
        let mut trades = Vec::new();
        for i in 0..40 {
            let pnl = if i % 3 == 0 { "300" } else { "-100" };
            trades.push(trade(&format!("s{i}"), 1_700_000 + i as i64, pnl, "5000", "3"));
        }
        let curve = derive_equity_curve(&trades);
        let m = compute(&curve, &trades);
        assert_eq!(m.trade_count, 40);
        assert!(m.pct_profitable > 0.0 && m.pct_profitable < 1.0);
        assert!(m.months_active > 0.0);
    }
}
