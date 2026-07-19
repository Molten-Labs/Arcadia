/// Pure-Rust trader classification engine.
///
/// Ported from perps-observatory's `lib/traderProfile.ts`. Takes position-level
/// trade records (single close event per position) and produces qualitative
/// signals: bot/human, size tier, trading style, wash trading flags.
///
/// Timezone inference was intentionally removed — personal profiling (deducing
/// where a trader lives from activity patterns) is inappropriate for a vault
/// platform where traders court investor capital.
use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

// ── Input data ────────────────────────────────────────────────────────────────

/// Minimal trade record needed for classification.
/// Arcadia's `trade` table has all these fields.
#[derive(Debug, Clone)]
pub struct TradeSample {
    pub direction: i16,        // 0 = long (buy), 1 = short (sell)
    pub size_usd: Decimal,
    pub realized_pnl: Decimal,
    pub fees_usd: Decimal,
    pub market: String,
    pub closed_at_ts: i64,     // epoch seconds
}

// ── Feature output ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TraderFeatures {
    pub trade_count: u32,
    pub sample_span_days: f64,
    pub trades_per_day: f64,
    pub median_gap_sec: Option<f64>,
    pub gap_cv: Option<f64>,
    pub hour_histogram: Vec<u32>,
    pub active_hours: u32,
    pub top_hour_share: f64,
    pub median_trade_usd: f64,
    pub p90_trade_usd: f64,
    pub flip_rate: Option<f64>,
    pub total_volume_usd: f64,
    pub per_market: Vec<MarketStats>,
    pub quick_opposite_share: Option<f64>,
    pub min_net_gross_ratio: Option<f64>,
    pub net_pnl_usd: f64,
    pub total_fees_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketStats {
    pub market: String,
    pub volume_usd: f64,
    pub trades: u32,
    pub net_usd: f64,
}

// ── Classification output ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BotVerdict {
    pub verdict: String, // "bot" | "human" | "uncertain"
    pub evidence: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SizeTier {
    pub tier: String, // "shrimp" | "fish" | "dolphin" | "shark" | "whale"
    pub median_trade_usd: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WashVerdict {
    pub fired: u32,
    pub total: u32,
    pub evidence: Vec<String>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Classification {
    pub bot: BotVerdict,
    pub size_tier: SizeTier,
    pub profile: ProfileLabel,
    pub wash: WashVerdict,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProfileLabel {
    pub label: String,
    pub evidence: Vec<String>,
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn quantile(sorted_asc: &[f64], q: f64) -> f64 {
    if sorted_asc.is_empty() {
        return 0.0;
    }
    let idx = ((q * (sorted_asc.len() - 1) as f64).floor() as usize).min(sorted_asc.len() - 1);
    sorted_asc[idx]
}

fn fmt_usd(v: f64) -> String {
    if v >= 1_000_000.0 {
        format!("${:.1}M", v / 1_000_000.0)
    } else if v >= 1_000.0 {
        format!("${:.1}K", v / 1_000.0)
    } else {
        format!("${:.0}", v)
    }
}

// ── Feature building ──────────────────────────────────────────────────────────

pub fn build_features(trades: &[TradeSample]) -> TraderFeatures {
    let n = trades.len() as u32;
    if n == 0 {
        return TraderFeatures {
            trade_count: 0,
            sample_span_days: 0.0,
            trades_per_day: 0.0,
            median_gap_sec: None,
            gap_cv: None,
            hour_histogram: vec![0; 24],
            active_hours: 0,
            top_hour_share: 0.0,
            median_trade_usd: 0.0,
            p90_trade_usd: 0.0,
            flip_rate: None,
            total_volume_usd: 0.0,
            per_market: vec![],
            quick_opposite_share: None,
            min_net_gross_ratio: None,
            net_pnl_usd: 0.0,
            total_fees_usd: 0.0,
        };
    }

    let mut sorted: Vec<&TradeSample> = trades.iter().collect();
    sorted.sort_by_key(|t| t.closed_at_ts);

    let mut hour_histogram = vec![0u32; 24];
    let mut total_volume_usd = 0.0_f64;
    let mut total_fees = 0.0_f64;
    let mut total_pnl = 0.0_f64;
    let mut per_market: std::collections::HashMap<&str, (f64, u32, f64)> =
        std::collections::HashMap::new();
    let mut sizes: Vec<f64> = Vec::with_capacity(n as usize);

    for t in &sorted {
        let ts_secs = t.closed_at_ts;
        let hour = ((ts_secs % 86400) / 3600) as usize;
        if hour < 24 {
            hour_histogram[hour] += 1;
        }

        let size = t.size_usd.to_f64().unwrap_or(0.0);
        total_volume_usd += size;
        total_fees += t.fees_usd.to_f64().unwrap_or(0.0);
        total_pnl += t.realized_pnl.to_f64().unwrap_or(0.0);
        sizes.push(size);

        let entry = per_market.entry(&t.market).or_insert((0.0, 0, 0.0));
        entry.0 += size;
        entry.1 += 1;
        // Long = positive exposure, short = negative
        let net = if t.direction == 0 { size } else { -size };
        entry.2 += net;
    }

    sizes.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    // Inter-trade gaps (in seconds)
    let mut gaps: Vec<f64> = Vec::new();
    for i in 1..sorted.len() {
        let gap = (sorted[i].closed_at_ts - sorted[i - 1].closed_at_ts) as f64;
        gaps.push(gap);
    }
    let mut gaps_sorted = gaps.clone();
    gaps_sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

    let median_gap = if gaps_sorted.is_empty() {
        None
    } else {
        Some(quantile(&gaps_sorted, 0.5))
    };

    let gap_cv = if gaps.len() >= 10 {
        let mean = gaps.iter().sum::<f64>() / gaps.len() as f64;
        if mean > 0.0 {
            let variance = gaps.iter().map(|g| (g - mean).powi(2)).sum::<f64>() / gaps.len() as f64;
            Some(variance.sqrt() / mean)
        } else {
            None
        }
    } else {
        None
    };

    // Direction flips & quick opposite-side pairs (W2 proxy at position level)
    let mut flips = 0u32;
    let mut sided_pairs = 0u32;
    for i in 1..sorted.len() {
        sided_pairs += 1;
        if sorted[i].direction != sorted[i - 1].direction {
            flips += 1;
        }
    }

    // Wash W4: per-market |net| / gross
    let min_net_gross: Option<f64> = {
        let mut best: Option<f64> = None;
        for (_market, (vol, _trades, net)) in &per_market {
            if *vol < 10_000.0 || *vol < total_volume_usd * 0.05 {
                continue;
            }
            let ratio = net.abs() / vol;
            if best.map_or(true, |b| ratio < b) {
                best = Some(ratio);
            }
        }
        best
    };

    let span_secs = if sorted.len() >= 2 {
        (sorted[sorted.len() - 1].closed_at_ts - sorted[0].closed_at_ts) as f64
    } else {
        0.0
    };
    let sample_span_days = span_secs / 86_400.0;
    let active_hours = hour_histogram.iter().filter(|&&c| c > 0).count() as u32;
    let max_hour = *hour_histogram.iter().max().unwrap_or(&0);

    TraderFeatures {
        trade_count: n,
        sample_span_days,
        trades_per_day: if sample_span_days > 0.01 {
            n as f64 / sample_span_days
        } else {
            n as f64
        },
        median_gap_sec: median_gap,
        gap_cv,
        hour_histogram,
        active_hours,
        top_hour_share: if n > 0 {
            max_hour as f64 / n as f64
        } else {
            0.0
        },
        median_trade_usd: quantile(&sizes, 0.5),
        p90_trade_usd: quantile(&sizes, 0.9),
        flip_rate: if sided_pairs >= 10 {
            Some(flips as f64 / sided_pairs as f64)
        } else {
            None
        },
        total_volume_usd,
        per_market: per_market
            .into_iter()
            .map(|(market, (vol, trades, net))| MarketStats {
                market: market.to_string(),
                volume_usd: vol,
                trades,
                net_usd: net,
            })
            .collect(),
        quick_opposite_share: None, // Not available at position level
        min_net_gross_ratio: min_net_gross,
        net_pnl_usd: total_pnl,
        total_fees_usd: total_fees,
    }
}

// ── Classification ────────────────────────────────────────────────────────────

pub fn classify(feature_sets: &[TraderFeatures]) -> Classification {
    let total_trades: u32 = feature_sets.iter().map(|f| f.trade_count).sum();
    let _max_span_days = feature_sets
        .iter()
        .map(|f| f.sample_span_days)
        .fold(0.0_f64, f64::max);

    // ── Bot vs human ──
    let mut bot_signals: Vec<String> = Vec::new();
    for f in feature_sets {
        // Metronomic cadence: very consistent inter-trade gaps
        if let Some(cv) = f.gap_cv {
            if cv < 0.5 && f.trade_count >= 200 {
                bot_signals.push(format!(
                    "metronomic cadence (gap CV {:.2} over {} trades)",
                    cv, f.trade_count
                ));
            }
        }

        // Always-on: active >=22/24 hours with no sleep window
        if f.active_hours >= 22 && f.sample_span_days >= 3.0 {
            let mean = f.trade_count as f64 / 24.0;
            // Check if the 5-hour lowest window is above 20% of expected
            let min_sum = circular_min_window(&f.hour_histogram, 5);
            if (min_sum as f64) >= 0.2 * mean * 5.0 {
                bot_signals.push(format!(
                    "active {}/24 UTC hours with no sleep lull",
                    f.active_hours
                ));
            }
        }

        // Rapid-fire: median gap < 60s
        if let Some(gap) = f.median_gap_sec {
            if gap < 60.0 && f.trade_count >= 50 {
                bot_signals.push(format!(
                    "median gap between trades {:.0}s",
                    gap
                ));
            }
        }

        // High volume: >500 trades/day
        if f.trades_per_day > 500.0 && f.sample_span_days >= 1.0 {
            bot_signals.push(format!(
                "{:.0} trades/day",
                f.trades_per_day
            ));
        }
    }

    let bot_verdict = if bot_signals.len() >= 2 {
        BotVerdict {
            verdict: "bot".into(),
            evidence: bot_signals,
        }
    } else if bot_signals.is_empty() {
        BotVerdict {
            verdict: "human".into(),
            evidence: vec!["no automation signals".into()],
        }
    } else {
        let mut evidence = bot_signals;
        evidence.push("only one automation signal — inconclusive".into());
        BotVerdict {
            verdict: "uncertain".into(),
            evidence,
        }
    };

    // ── Size tier ──
    let mut median_trade_usd = 0.0_f64;
    if feature_sets.len() == 1 {
        median_trade_usd = feature_sets[0].median_trade_usd;
    } else if !feature_sets.is_empty() {
        let tot_vol: f64 = feature_sets.iter().map(|f| f.total_volume_usd).sum();
        if tot_vol > 0.0 {
            median_trade_usd = feature_sets
                .iter()
                .map(|f| f.median_trade_usd * f.total_volume_usd)
                .sum::<f64>()
                / tot_vol;
        }
    }

    let tier_label = if median_trade_usd >= 100_000.0 {
        "whale"
    } else if median_trade_usd >= 10_000.0 {
        "shark"
    } else if median_trade_usd >= 1_000.0 {
        "dolphin"
    } else if median_trade_usd >= 100.0 {
        "fish"
    } else {
        "shrimp"
    };

    // ── Wash signals ──
    let mut wash_evidence: Vec<String> = Vec::new();
    let wash_notes: Vec<String> = Vec::new();
    let mut wash_fired: u32 = 0;

    for f in feature_sets {
        // W1: high volume with near-zero PnL
        if f.total_volume_usd > 1_000_000.0 && f.trade_count > 0 {
            let pnl_ratio = f.net_pnl_usd.abs() / f.total_volume_usd;
            if pnl_ratio < 0.001 {
                wash_fired += 1;
                wash_evidence.push(format!(
                    "{} volume with near-zero net PnL ({})",
                    fmt_usd(f.total_volume_usd),
                    fmt_usd(f.net_pnl_usd),
                ));
            }
        }

        // W4: net directional exposure < 2% of gross
        if let Some(ratio) = f.min_net_gross_ratio {
            if ratio < 0.02 && f.total_volume_usd > 100_000.0 {
                wash_fired += 1;
                wash_evidence.push(format!(
                    "net directional exposure < 2% of gross volume in a top market"
                ));
            }
        }
    }

    // ── Profile label ──
    let now_ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    let last_trade_ts = feature_sets
        .iter()
        .filter_map(|f| {
            // Approximate last trade from sample span + trade count
            if f.trade_count > 0 && f.sample_span_days > 0.0 {
                Some((f.sample_span_days * 86_400.0) as i64)
            } else {
                None
            }
        })
        .max()
        .unwrap_or(0);

    let days_since_last = if last_trade_ts > 0 {
        (now_ts - last_trade_ts) as f64 / 86_400.0
    } else {
        0.0
    };

    // Combine per-platform stats for profile classification
    let median_gap_min = feature_sets
        .iter()
        .filter_map(|f| f.median_gap_sec)
        .fold(f64::MAX, f64::min);

    let best_flip = feature_sets
        .iter()
        .filter_map(|f| f.flip_rate)
        .fold(0.0_f64, f64::max);

    let is_bot = bot_verdict.verdict == "bot";
    let combined_trades_per_day: f64 = feature_sets.iter().map(|f| f.trades_per_day).sum();

    let profile = if total_trades == 0 {
        ProfileLabel {
            label: "No activity".into(),
            evidence: vec![],
        }
    } else if days_since_last > 30.0 {
        ProfileLabel {
            label: "Dormant".into(),
            evidence: vec![format!("last trade {:.0} days ago", days_since_last)],
        }
    } else if total_trades <= 5 {
        ProfileLabel {
            label: "One-shot punter".into(),
            evidence: vec![format!("only {} lifetime trades", total_trades)],
        }
    } else if is_bot && median_gap_min < 60.0 && best_flip > 0.4 {
        ProfileLabel {
            label: "HFT / market-maker bot".into(),
            evidence: vec![
                format!("median trade gap {:.0}s", median_gap_min),
                format!("direction flip rate {:.0}%", best_flip * 100.0),
            ],
        }
    } else if wash_fired >= 2 {
        ProfileLabel {
            label: "Wash trader / points farmer".into(),
            evidence: wash_evidence.clone(),
        }
    } else if median_gap_min < 900.0 && best_flip > 0.3 {
        ProfileLabel {
            label: "Scalper".into(),
            evidence: vec![
                format!("median gap {:.0}min with {:.0}% flips", median_gap_min / 60.0, best_flip * 100.0),
            ],
        }
    } else if combined_trades_per_day < 3.0 {
        ProfileLabel {
            label: "Position / swing holder".into(),
            evidence: vec![format!("{:.1} trades/day", combined_trades_per_day)],
        }
    } else {
        ProfileLabel {
            label: "Active trader".into(),
            evidence: vec![],
        }
    };

    Classification {
        bot: bot_verdict,
        size_tier: SizeTier {
            tier: tier_label.into(),
            median_trade_usd,
        },
        profile,
        wash: WashVerdict {
            fired: wash_fired,
            total: 4,
            evidence: wash_evidence,
            notes: wash_notes,
        },
    }
}

/// Sum of a circular window of width `w` in the histogram.
fn circular_window_sum(hist: &[u32], start: usize, w: usize) -> u32 {
    let n = hist.len();
    let mut sum = 0u32;
    for k in 0..w {
        sum += hist[(start + k) % n];
    }
    sum
}

/// Minimum circular window sum, returns the sum value.
fn circular_min_window(hist: &[u32], w: usize) -> u32 {
    let n = hist.len();
    let mut best = u32::MAX;
    for i in 0..n {
        let s = circular_window_sum(hist, i, w);
        if s < best {
            best = s;
        }
    }
    best
}
