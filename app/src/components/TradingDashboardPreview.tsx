import React from "react";
import { CandlestickChart } from "./CandlestickChart";
import { OrderBook } from "./OrderBook";
import { StatusBadge } from "./StatusBadge";
import { TierBadge } from "./TierBadge";
import { HealthMeter } from "./HealthMeter";
import { fmtUSD, fmtPct } from "@/lib/format";
import { motion } from "framer-motion";
import { TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";

const previewVault = {
  name: "Ember Macro I",
  status: "active" as const,
  tvl: 1_240_000,
  return30d: 6.2,
  juniorHealth: 78,
  maxPositionPct: 18,
  seniorCapital: 960_000,
};
const previewTrader = { name: "Aria Volkov", tier: "elite" as const };

export const TradingDashboardPreview = () => {
  const v = previewVault;
  const trader = previewTrader;

  // Simulate dynamic data updates
  const [displayMetrics, setDisplayMetrics] = React.useState({
    return30d: v.return30d,
    juniorHealth: v.juniorHealth,
    timestamp: new Date(),
  });

  React.useEffect(() => {
    const interval = setInterval(() => {
      // Simulate small fluctuations in metrics
      setDisplayMetrics((prev) => ({
        return30d: prev.return30d + (Math.random() - 0.5) * 0.3,
        juniorHealth: Math.min(100, Math.max(0, prev.juniorHealth + (Math.random() - 0.5) * 2)),
        timestamp: new Date(),
      }));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 50 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7, type: "spring", damping: 20 }}
      className="relative mt-8"
    >
      {/* glow */}
      <div className="absolute -inset-x-20 -top-20 h-64 bg-primary/15 blur-3xl rounded-full pointer-events-none" />

      <div className="surface-elevated rounded-2xl shadow-card overflow-hidden relative">
        {/* fake browser chrome */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-background-secondary/60">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-destructive/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-warning/70" />
            <span className="w-2.5 h-2.5 rounded-full bg-success/70" />
          </div>
          <div className="flex-1 mx-3">
            <div className="bg-background rounded-md px-3 py-1 text-[11px] font-mono text-muted-foreground inline-flex items-center gap-1">
              <span className="text-success">●</span> synq.fi/vault/ember-macro-i
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_310px] gap-0">
          {/* Main - Synq chart section */}
          <div className="chart-sec">
            <div className="chart-hdr">
              <div>
                <div className="ch-label">VAULT NAV · SOL</div>
                <div className="ch-nav">${fmtUSD(v.tvl, { compact: true })}</div>
                <div className="ch-row">
                  <motion.span
                    key={displayMetrics.timestamp.getTime()}
                    initial={{ opacity: 0.5 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="ch-pct up-b"
                  >
                    {fmtPct(displayMetrics.return30d)}
                  </motion.span>
                  <span className="ch-abs">+{fmtUSD(displayMetrics.return30d * v.tvl / 100, { compact: true })} since inception</span>
                </div>
              </div>
              <div className="time-row">
                {["1H", "4H", "1D", "1W", "1M"].map((t, i) => (
                  <button key={t} className={`tbtn ${i === 2 ? "active" : ""}`}>{t}</button>
                ))}
              </div>
            </div>
            <div className="chart-wrap">
              <CandlestickChart count={56} height={220} />
            </div>
          </div>

          {/* Side: Synq-style right panel - vault hero, limits, feed */}
          <div className="rp">
            {/* Vault hero section */}
            <div className="vh">
              <div className="vh-top">
                <div className="vh-name">{v.name}</div>
                <div className="vh-badge">PAPER MODE</div>
              </div>
              <div className="prog-track">
                <div className="prog-fill" style={{ width: "40%" }} />
              </div>
              <div className="prog-labels">
                <span>Day 12 / 30</span>
                <span>18 days left</span>
              </div>
              <div className="vh-bot">
                <div className="vhb-l">JUNIOR HEALTH</div>
                <motion.div
                  key={displayMetrics.timestamp.getTime()}
                  initial={{ opacity: 0.5 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="vhb-v up"
                >
                  {Math.round(displayMetrics.juniorHealth)}%
                </motion.div>
              </div>
            </div>

            {/* Limits section */}
            <div className="lim-sec">
              <div className="sec-title">POSITION LIMITS</div>
              <div className="gauge-t">
                <div className="gauge-f" style={{ width: "100%", background: "hsl(142, 71%, 45%)" }} />
              </div>
              <div className="lrow">
                <span className="lk">Max position</span>
                <span className="lv up">{v.maxPositionPct}% of NAV</span>
              </div>
              <div className="lrow">
                <span className="lk">Max trade</span>
                <span className="lv">{fmtUSD(v.tvl * (v.maxPositionPct / 100), { compact: true })} SOL</span>
              </div>
              <div className="lrow">
                <span className="lk">Cooldown</span>
                <span className="lv up">None active</span>
              </div>
              <div className="lrow">
                <span className="lk">Instant exit</span>
                <span className="lv nu">Locked</span>
              </div>
            </div>

            {/* Trade feed - Synq style */}
            <div className="feed-sec">
              <div className="feed-hdr">
                <div className="feed-title">TRADE FEED</div>
                <div className="feed-cnt">5</div>
              </div>
              <div className="feed-list">
                {[
                  { pair: "AUDD → SOL", pnl: 24.3, t: "14:32:11" },
                  { pair: "SOL → AUDD", pnl: 11.8, t: "12:15:44" },
                  { pair: "AUDD → JUP", pnl: -8.9, t: "11:03:22" },
                  { pair: "AUDD → SOL", pnl: 31.2, t: "09:47:05" },
                  { pair: "JUP → AUDD", pnl: 4.1, t: "08:22:33" },
                ].map((t, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="fi"
                  >
                    <div className="fi-pair">{t.pair}</div>
                    <div className={`fi-pnl ${t.pnl >= 0 ? "up" : "dn"}`}>
                      {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(1)}
                    </div>
                    <div className="fi-meta">800 SOL in</div>
                    <div className="fi-time">{t.t}</div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className="font-display font-semibold text-sm mt-0.5 tabular">{value}</div>
  </div>
);
