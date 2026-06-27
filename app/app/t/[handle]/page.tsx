"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ScoreDial } from "@/components/ScoreDial";
import { TierBadge } from "@/components/TierBadge";
import { DepositsStatusBadge } from "@/components/DepositsStatusBadge";
import { CapacityBar } from "@/components/CapacityBar";
import { RiskBars } from "@/components/RiskBars";
import { EquityChart } from "@/components/EquityChart";
import { ErrorState } from "@/components/ErrorState";
import { apiFetch } from "@/lib/utils";
import {
  formatUSD,
  formatPct,
  pnlClass,
  pnlArrow,
  shortAddr,
} from "@/lib/types";
import type { TraderProfile } from "@/lib/types";

export default function TraderProfilePage() {
  const params = useParams();
  const handle = params?.handle as string;

  const { data: trader, isLoading, error, refetch } = useQuery<TraderProfile>({
    queryKey: ["trader", handle],
    queryFn: () => apiFetch(`/traders/${handle}`),
    enabled: !!handle,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
        
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 rounded" style={{ background: "var(--color-panel)" }} />
            <div className="h-40 rounded-xl" style={{ background: "var(--color-panel)" }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !trader) {
    return (
      <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
        
        <div className="max-w-7xl mx-auto px-4 py-8">
          <ErrorState message="Trader not found" onRetry={() => refetch()} />
        </div>
      </div>
    );
  }

  const riskItems = [
    { label: "Sortino", value: trader.metrics.sortino, max: 5, fmt: (v: number) => v.toFixed(2) },
    { label: "Sharpe", value: trader.metrics.sharpe, max: 4, fmt: (v: number) => v.toFixed(2) },
    { label: "Win Rate", value: trader.metrics.win_rate, max: 100, fmt: (v: number) => `${v.toFixed(1)}%` },
    { label: "Max DD", value: Math.abs(trader.metrics.max_dd), max: 30, fmt: (v: number) => `-${v.toFixed(1)}%` },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6 text-xs" style={{ color: "var(--color-faint)" }}>
          <Link href="/traders" style={{ color: "var(--color-muted)" }}>Traders</Link>
          <span>/</span>
          <span>@{trader.handle}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 space-y-4">
            <div
              className="rounded-xl p-6"
              style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h1 className="text-xl font-bold" style={{ color: "var(--color-ink)" }}>
                    @{trader.handle}
                  </h1>
                  <p className="text-xs font-mono mt-0.5" style={{ color: "var(--color-faint)" }}>
                    {shortAddr(trader.wallet)}
                  </p>
                </div>
                <ScoreDial score={trader.score} tier={trader.tier} size={80} />
              </div>

              <div className="flex items-center gap-2 flex-wrap mb-4">
                <TierBadge tier={trader.tier} />
                <DepositsStatusBadge
                  deposits_open={trader.deposits_open}
                  capacityLeft={trader.deposits_open ? trader.capacity.total - trader.capacity.used : undefined}
                />
              </div>

              {trader.bio && (
                <p className="text-xs leading-relaxed mb-4" style={{ color: "var(--color-muted)" }}>
                  {trader.bio}
                </p>
              )}

              <div className="flex flex-wrap gap-1 mb-4">
                {trader.style_tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5 rounded"
                    style={{ background: "var(--color-panel-2)", color: "var(--color-faint)" }}
                  >
                    {tag}
                  </span>
                ))}
              </div>

              <div
                className="rounded-lg p-3 mb-4"
                style={{ background: "var(--color-panel-2)" }}
              >
                <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--color-faint)" }}>
                  Capacity
                </p>
                <CapacityBar aum={trader.aum} capacity_usd={trader.capacity.total} />
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                {[
                  { label: "AUM", value: formatUSD(trader.aum, 0) },
                  { label: "Investors", value: trader.investors_count.toString() },
                  { label: "Days Active", value: trader.days_active.toString() },
                  { label: "Trades", value: trader.trade_count.toString() },
                ].map((stat) => (
                  <div key={stat.label} className="rounded-lg p-2.5" style={{ background: "var(--color-panel-2)" }}>
                    <p className="text-[10px] text-[var(--color-faint)]">{stat.label}</p>
                    <p className="text-sm font-semibold tnum text-[var(--color-ink)]">{stat.value}</p>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-xl p-5"
              style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--color-faint)" }}>
                Risk Metrics
              </p>
              <RiskBars items={riskItems} />
            </div>

            <Link
              href={`/vault/${trader.profile}`}
              className="block w-full text-center py-3 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: "var(--color-purple)",
                color: "white",
                boxShadow: "0 0 20px rgba(124,58,237,0.35)",
              }}
            >
              Fund this vault →
            </Link>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div
              className="rounded-xl p-5"
              style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--color-faint)" }}>
                Equity Curve (90d)
              </p>
              <EquityChart data={trader.equity_curve} height={180} />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "7d Return", value: trader.metrics.return_7d, pct: true },
                { label: "30d Return", value: trader.metrics.return_30d, pct: true },
                { label: "90d Return", value: trader.metrics.return_90d, pct: true },
                { label: "All-time", value: trader.metrics.return_all, pct: true },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-lg p-3"
                  style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
                >
                  <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--color-faint)" }}>
                    {stat.label}
                  </p>
                  <p className={`text-base font-semibold tnum ${pnlClass(stat.value)}`}>
                    {pnlArrow(stat.value)} {Math.abs(stat.value).toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>

            <div
              className="rounded-xl p-5"
              style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--color-faint)" }}>
                Recent Trades
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-line)" }}>
                      {["Market", "Side", "Size", "Leverage", "PnL", "Closed"].map((h) => (
                        <th key={h} className="py-2 px-3 text-left font-medium" style={{ color: "var(--color-faint)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trader.trades.slice(0, 10).map((t) => (
                      <tr
                        key={t.id}
                        style={{ borderBottom: "1px solid var(--color-line)" }}
                        className="hover:bg-[var(--color-panel-2)]"
                      >
                        <td className="py-2 px-3 font-mono">{t.market}</td>
                        <td
                          className="py-2 px-3 font-medium"
                          style={{ color: t.direction === "long" ? "var(--color-green)" : "var(--color-red)" }}
                        >
                          {t.direction.toUpperCase()}
                        </td>
                        <td className="py-2 px-3 tnum">{formatUSD(t.size_usd, 0)}</td>
                        <td className="py-2 px-3 tnum">{t.leverage}x</td>
                        <td className={`py-2 px-3 tnum font-medium ${pnlClass(t.realized_pnl)}`}>
                          {t.realized_pnl >= 0 ? "+" : ""}{formatUSD(t.realized_pnl, 0)}
                        </td>
                        <td className="py-2 px-3 tnum" style={{ color: "var(--color-faint)" }}>
                          {new Date(t.closed_at * 1000).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
