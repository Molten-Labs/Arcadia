"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { RiskBars } from "@/components/RiskBars";
import { EquityChart } from "@/components/EquityChart";
import { StatCard } from "@/components/StatCard";
import { MOCK_TRADERS } from "@/lib/mock-data";
import { pnlClass, pnlArrow, formatUSD } from "@/lib/types";

const DEMO = MOCK_TRADERS[0];

export default function AnalyticsPage() {
  const { connected } = useWallet();

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
        <h1 className="text-xl font-bold mb-6" style={{ color: "var(--color-ink)" }}>
          Analytics
        </h1>

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
              Equity Curve
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

        <div
          className="rounded-xl overflow-hidden"
          style={{ border: "1px solid var(--color-line)" }}
        >
          <div className="px-4 py-3" style={{ background: "var(--color-panel-2)", borderBottom: "1px solid var(--color-line)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-faint)" }}>
              Trade History
            </p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-line)", background: "var(--color-panel)" }}>
                {["Market", "Side", "Size", "Leverage", "Entry", "Exit", "PnL", "Closed"].map((h) => (
                  <th key={h} className="py-2.5 px-4 text-left font-medium" style={{ color: "var(--color-faint)" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEMO.trades.slice(0, 15).map((t) => (
                <tr
                  key={t.id}
                  style={{ background: "var(--color-panel)", borderBottom: "1px solid var(--color-line)" }}
                  className="hover:bg-[var(--color-panel-2)]"
                >
                  <td className="py-2.5 px-4 font-mono">{t.market}</td>
                  <td
                    className="py-2.5 px-4 font-medium"
                    style={{ color: t.direction === "long" ? "var(--color-green)" : "var(--color-red)" }}
                  >
                    {t.direction.toUpperCase()}
                  </td>
                  <td className="py-2.5 px-4 tnum">{formatUSD(t.size_usd, 0)}</td>
                  <td className="py-2.5 px-4 tnum">{t.leverage}x</td>
                  <td className="py-2.5 px-4 tnum" style={{ color: "var(--color-muted)" }}>
                    {t.entry_px.toFixed(2)}
                  </td>
                  <td className="py-2.5 px-4 tnum" style={{ color: "var(--color-muted)" }}>
                    {t.exit_px.toFixed(2)}
                  </td>
                  <td className={`py-2.5 px-4 tnum font-medium ${pnlClass(t.realized_pnl)}`}>
                    {t.realized_pnl >= 0 ? "+" : ""}{formatUSD(t.realized_pnl, 0)}
                  </td>
                  <td className="py-2.5 px-4 tnum" style={{ color: "var(--color-faint)" }}>
                    {new Date(t.closed_at * 1000).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
