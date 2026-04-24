import { CandlestickChart } from "./CandlestickChart";
import { OrderBook } from "./OrderBook";
import { StatusBadge } from "./StatusBadge";
import { TierBadge } from "./TierBadge";
import { HealthMeter } from "./HealthMeter";
import { vaults, traders } from "@/lib/mockData";
import { fmtUSD, fmtPct } from "@/lib/format";
import { motion } from "framer-motion";
import { TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";

/**
 * TradingDashboardPreview
 * Hero-adjacent preview of the in-app vault trading UI. Inspired by
 * pro trading platforms but rendered with Kiln's institutional palette.
 */
export const TradingDashboardPreview = () => {
  const v = vaults[0];
  const trader = traders[0];

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-100px" }}
      transition={{ duration: 0.7 }}
      className="relative"
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
              <span className="text-success">●</span> kiln.fi/vault/ember-macro-i
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-[1fr_280px] gap-0">
          {/* Main */}
          <div className="p-5 border-r border-border">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-display font-bold text-lg">{v.name}</h3>
                  <StatusBadge status={v.status} />
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  by {trader.name} <TierBadge tier={trader.tier} showIcon={false} className="scale-90" />
                </div>
              </div>
              <div className="text-right">
                <div className="font-display font-bold text-2xl tabular">${fmtUSD(v.tvl)}</div>
                <div className="text-xs text-success tabular flex items-center gap-1 justify-end">
                  <TrendingUp className="w-3 h-3" /> {fmtPct(v.return30d)} 30d
                </div>
              </div>
            </div>

            {/* tab buttons */}
            <div className="flex gap-1 mb-3 text-[11px]">
              {["1H", "4H", "1D", "1W", "1M"].map((t, i) => (
                <button key={t} className={`px-2 py-1 rounded ${i === 2 ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>{t}</button>
              ))}
            </div>

            <CandlestickChart count={56} height={220} />

            <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
              <Stat label="Junior health" value={`${v.juniorHealth}%`} />
              <Stat label="Max position" value={`${v.maxPositionPct}%`} />
              <Stat label="Senior protected" value={`$${fmtUSD(v.seniorCapital, { compact: true })}`} />
            </div>
            <div className="mt-3">
              <HealthMeter health={v.juniorHealth} showLabel={false} size="sm" />
            </div>
          </div>

          {/* Side: order book + recent fills */}
          <div className="p-4 space-y-4 bg-background/40">
            <OrderBook />
            <div className="surface rounded-xl p-3 font-mono text-[11px]">
              <h4 className="font-display font-semibold text-sm mb-2 font-sans">Recent trades</h4>
              {[
                { side: "buy", pair: "SOL", a: 1200, p: 184.20, t: "2s ago" },
                { side: "sell", pair: "ETH", a: 18, p: 3340, t: "47s" },
                { side: "buy", pair: "SOL", a: 800, p: 184.16, t: "1m" },
                { side: "buy", pair: "BTC", a: 0.4, p: 67220, t: "3m" },
              ].map((t, i) => (
                <div key={i} className="flex justify-between items-center py-0.5">
                  <span className={`flex items-center gap-1 ${t.side === "buy" ? "text-success" : "text-destructive"}`}>
                    {t.side === "buy" ? <ArrowUpRight className="w-2.5 h-2.5" /> : <ArrowDownRight className="w-2.5 h-2.5" />}
                    {t.pair}
                  </span>
                  <span className="tabular">{t.a}</span>
                  <span className="tabular text-muted-foreground">${t.p.toLocaleString()}</span>
                  <span className="text-[10px] text-muted-foreground">{t.t}</span>
                </div>
              ))}
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
