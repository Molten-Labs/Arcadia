/// Performance metric computation.
///
/// All money intermediates use f64 — these are offchain scoring values, not
/// user-facing dollar figures. Money columns in the DB stay as rust_decimal.
use crate::twr::daily_returns;
use arcadia_core::types::Trade;
use chrono::NaiveDate;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use serde::{Deserialize, Serialize};

const ANNUALISATION: f64 = 252.0_f64;
const RISK_FREE: f64 = 0.0;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Metrics {
    /// Annualised Sortino ratio (downside deviation denominator)
    pub sortino: f64,
    /// Annualised Calmar ratio (annualised return / max drawdown)
    pub calmar: f64,
    /// Maximum drawdown (0-1, positive = loss)
    pub max_dd: f64,
    /// Ulcer Index (RMS of percentage drawdowns)
    pub ulcer: f64,
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
}

impl Metrics {
    pub fn zero() -> Self {
        Self {
            sortino: 0.0,
            calmar: 0.0,
            max_dd: 0.0,
            ulcer: 0.0,
            liq_rate: 0.0,
            pct_profitable: 0.0,
            avg_leverage: 0.0,
            trade_count: 0,
            days_active: 0,
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

    Metrics {
        sortino:       clamp(sortino, -50.0, 50.0),
        calmar:        clamp(calmar,  -50.0, 50.0),
        max_dd:        max_dd.min(1.0),
        ulcer:         ulcer.min(1.0),
        liq_rate:      liq_count as f64 / tc as f64,
        pct_profitable: profitable as f64 / tc as f64,
        avg_leverage:  avg_lev,
        trade_count:   tc,
        days_active:   days,
    }
}

fn clamp(v: f64, lo: f64, hi: f64) -> f64 {
    v.max(lo).min(hi)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    #[test]
    fn zero_trades_gives_zero() {
        let m = compute(&[], &[]);
        assert_eq!(m.trade_count, 0);
    }
}
