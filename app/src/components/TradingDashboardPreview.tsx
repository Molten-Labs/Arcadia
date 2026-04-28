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

          {/* Side: Synq-style right panel */}
          <div className="p-4 space-y-3 bg-background/40 overflow-y-auto flex flex-col">
            {/* Vault hero */}
            <div className="surface rounded-lg p-3 text-sm border border-border/50">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display font-semibold">{v.name}</h3>
                <span className="text-[10px] px-2 py-0.5 rounded bg-primary/15 text-primary">PAPER</span>
              </div>
              <div className="h-1.5 bg-secondary rounded-full overflow-hidden mb-2">
                <div className="h-full bg-gradient-to-r from-primary to-primary/60" style={{ width: "40%" }} />
              </div>
              <div className="text-[10px] text-muted-foreground flex justify-between">
                <span>Day 12 / 30</span>
                <span>18 days left</span>
              </div>
            </div>

            {/* Position limits */}
            <div className="surface rounded-lg p-3 text-sm border border-border/50">
              <h4 className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold mb-2">Limits</h4>
              <div className="space-y-1.5 text-[10px]">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Max position</span>
                  <span className="font-mono text-foreground">{v.maxPositionPct}% of NAV</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Max trade</span>
                  <span className="font-mono text-foreground">{fmtUSD(v.tvl * (v.maxPositionPct / 100), { compact: true })} SOL</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Cooldown</span>
                  <span className="font-mono text-success">None</span>
                </div>
              </div>
            </div>

            {/* Trade feed - Synq style */}
            <div className="surface rounded-lg border border-border/50 flex-1 flex flex-col overflow-hidden">
              <div className="p-3 border-b border-border/30 flex items-center justify-between flex-shrink-0">
                <h4 className="text-[9px] uppercase tracking-widest text-muted-foreground font-semibold">Trade feed</h4>
                <span className="text-[9px] text-muted-foreground">5</span>
              </div>
              <div className="overflow-y-auto flex-1 p-2">
                {[
                  { pair: "AUDD → SOL", a: 800, pnl: 24.3, t: "14:32:11" },
                  { pair: "SOL → AUDD", a: 600, pnl: 11.8, t: "12:15:44" },
                  { pair: "AUDD → JUP", a: 300, pnl: -8.9, t: "11:03:22" },
                  { pair: "AUDD → SOL", a: 500, pnl: 31.2, t: "09:47:05" },
                  { pair: "JUP → AUDD", a: 200, pnl: 4.1, t: "08:22:33" },
                ].map((t, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex justify-between items-center py-1.5 px-1 border-b border-border/20 last:border-b-0 text-[10px] font-mono"
                  >
                    <span className="text-muted-foreground flex-1 truncate">{t.pair}</span>
                    <span className={t.pnl >= 0 ? "text-success" : "text-destructive"}>
                      {t.pnl >= 0 ? "+" : ""}{t.pnl.toFixed(1)}
                    </span>
                    <span className="text-[9px] text-muted-foreground/60 ml-1.5 flex-shrink-0">{t.t}</span>
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
