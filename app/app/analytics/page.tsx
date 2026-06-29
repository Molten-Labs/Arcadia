"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { RiskBars } from "@/components/RiskBars";
import { EquityChart } from "@/components/EquityChart";
import { StatCard } from "@/components/StatCard";
import { PnLHeatmap } from "@/components/PnLHeatmap";
import { MOCK_TRADERS, MOCK_DAILY_PNL } from "@/lib/mock-data";
import { pnlClass, pnlArrow, formatUSD, shortAddr } from "@/lib/types";
import { ExternalLink } from "lucide-react";

const DEMO = MOCK_TRADERS[0];

export default function AnalyticsPage() {
  const { connected } = useWallet();
  const [tab, setTab] = useState<"trades" | "heatmap">("trades");

  if (!connected) {
    return (
      <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Connect wallet to view analytics
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={{ color: "var(--color-ink)" }}>Analytics</h1>
          <div className="flex items-center gap-2 text-[10px] px-3 py-1.5 rounded-lg font-mono"
            style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)", color: "var(--color-faint)" }}>
            @{DEMO.handle} — devnet simulation
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Sharpe", value: DEMO.metrics.sharpe.toFixed(2) },
            { label: "Sortino", value: DEMO.metrics.sortino.toFixed(2) },
            { label: "Win Rate", value: `${DEMO.metrics.win_rate.toFixed(1)}%` },
            { label: "Avg Duration", value: `${DEMO.metrics.avg_trade_duration_hours.toFixed(1)}h` },
          ].map((s) => (
            <StatCard key={s.label} label={s.label} value={s.value} />
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          <div
            className="lg:col-span-2 rounded-xl p-5"
            style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--color-faint)" }}>
              Equity Curve — 90 days
            </p>
            <EquityChart data={DEMO.equity_curve} height={200} />
          </div>
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--color-faint)" }}>
              Risk Metrics
            </p>
            <RiskBars
              items={[
                { label: "Sortino", value: DEMO.metrics.sortino, max: 5, fmt: (v) => v.toFixed(2) },
                { label: "Sharpe", value: DEMO.metrics.sharpe, max: 4, fmt: (v) => v.toFixed(2) },
                { label: "Win Rate", value: DEMO.metrics.win_rate, max: 100, fmt: (v) => `${v.toFixed(1)}%` },
                { label: "Volatility", value: DEMO.metrics.vol_30d, max: 30, fmt: (v) => `${v.toFixed(1)}%` },
                { label: "Max DD", value: Math.abs(DEMO.metrics.max_dd), max: 30, fmt: (v) => `-${v.toFixed(1)}%` },
              ]}
            />
            <div className="mt-4 pt-4 space-y-2 text-xs" style={{ borderTop: "1px solid var(--color-line)" }}>
              {[
                ["7d Return", DEMO.metrics.return_7d],
                ["30d Return", DEMO.metrics.return_30d],
                ["90d Return", DEMO.metrics.return_90d],
                ["All-time", DEMO.metrics.return_all],
              ].map(([label, val]) => (
                <div key={label as string} className="flex justify-between">
                  <span style={{ color: "var(--color-faint)" }}>{label}</span>
                  <span className={`tnum font-medium ${pnlClass(val as number)}`}>
                    {pnlArrow(val as number)} {Math.abs(val as number).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Tab row */}
        <div className="flex gap-1 mb-4 p-1 rounded-xl w-fit" style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}>
          {(["trades", "heatmap"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
              style={{
                background: tab === t ? "var(--color-accent)" : "transparent",
                color: tab === t ? "var(--color-bg)" : "var(--color-faint)",
              }}
            >
              {t === "trades" ? "Trade History" : "P&L Heatmap"}
            </button>
          ))}
        </div>

        {tab === "heatmap" && (
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: "var(--color-faint)" }}>
              Daily P&L Heatmap
            </p>
            <PnLHeatmap data={MOCK_DAILY_PNL["nova"] ?? []} />
          </div>
        )}

        {tab === "trades" && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--color-line)" }}
          >
            <div className="px-4 py-3 flex items-center justify-between" style={{ background: "var(--color-panel-2)", borderBottom: "1px solid var(--color-line)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-faint)" }}>
                Trade History
              </p>
              <span className="text-[10px] px-2 py-1 rounded font-mono" style={{ background: "var(--color-panel)", color: "var(--color-faint)", border: "1px solid var(--color-line)" }}>
                {DEMO.trades.length} trades
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--color-line)", background: "var(--color-panel)" }}>
                    {["Market", "Side", "Size", "Lev", "Entry", "Exit", "PnL", "Closed", "On-chain"].map((h) => (
                      <th key={h} className="py-2.5 px-3 text-left font-medium whitespace-nowrap" style={{ color: "var(--color-faint)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {DEMO.trades.map((t) => (
                    <tr
                      key={t.id}
                      style={{ background: "var(--color-panel)", borderBottom: "1px solid var(--color-line)" }}
                      className="hover:bg-[var(--color-panel-2)] transition-colors group"
                    >
                      <td className="py-2.5 px-3 font-mono font-bold" style={{ color: "var(--color-ink)" }}>{t.market}</td>
                      <td
                        className="py-2.5 px-3 font-black text-[10px] uppercase tracking-wider"
                        style={{ color: t.direction === "long" ? "var(--color-green)" : "var(--color-red)" }}
                      >
                        {t.direction}
                      </td>
                      <td className="py-2.5 px-3 tnum">{formatUSD(t.size_usd, 0)}</td>
                      <td className="py-2.5 px-3 tnum">{t.leverage}x</td>
                      <td className="py-2.5 px-3 tnum" style={{ color: "var(--color-muted)" }}>
                        {t.entry_px < 10 ? t.entry_px.toFixed(4) : t.entry_px.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-3 tnum" style={{ color: "var(--color-muted)" }}>
                        {t.exit_px < 10 ? t.exit_px.toFixed(4) : t.exit_px.toFixed(2)}
                      </td>
                      <td className={`py-2.5 px-3 tnum font-bold ${pnlClass(t.realized_pnl)}`}>
                        {t.realized_pnl >= 0 ? "+" : ""}{formatUSD(t.realized_pnl, 0)}
                      </td>
                      <td className="py-2.5 px-3 tnum" style={{ color: "var(--color-faint)" }}>
                        {new Date(t.closed_at * 1000).toLocaleDateString()}
                      </td>
                      <td className="py-2.5 px-3">
                        {t.sig ? (
                          <a
                            href={`https://solscan.io/tx/${t.sig}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 font-mono text-[10px] transition-colors hover:opacity-80"
                            style={{ color: "var(--color-mint)" }}
                            title={t.sig}
                          >
                            <span>{t.sig.slice(0, 6)}…</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span style={{ color: "var(--color-faint)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
