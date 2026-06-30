"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScoreDial } from "@/components/ScoreDial";
import { TierBadge } from "@/components/TierBadge";
import { DepositsStatusBadge } from "@/components/DepositsStatusBadge";
import { CapacityBar } from "@/components/CapacityBar";
import { RiskBars } from "@/components/RiskBars";
import { EquityChart } from "@/components/EquityChart";
import { ScoreHistoryChart } from "@/components/ScoreHistoryChart";
import { PnLHeatmap } from "@/components/PnLHeatmap";
import { ErrorState } from "@/components/ErrorState";
import { apiFetch } from "@/lib/utils";
import {
  formatUSD,
  pnlClass,
  pnlArrow,
  shortAddr,
} from "@/lib/types";
import type { TraderProfile } from "@/lib/types";
import { useRole } from "@/lib/role-context";
import { MOCK_SCORE_HISTORY, MOCK_DAILY_PNL } from "@/lib/mock-data";
import { Bookmark, BookmarkCheck, Calendar, ExternalLink, TrendingDown, BarChart3, Share2 } from "lucide-react";
import { ShareCardModal } from "@/components/ShareCardModal";

function useWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  useEffect(() => {
    try {
      const s = localStorage.getItem("arcadia_watchlist");
      if (s) setWatchlist(JSON.parse(s));
    } catch {}
  }, []);
  const toggle = (handle: string) => {
    setWatchlist((prev) => {
      const next = prev.includes(handle) ? prev.filter((h) => h !== handle) : [...prev, handle];
      localStorage.setItem("arcadia_watchlist", JSON.stringify(next));
      return next;
    });
  };
  return { watchlist, toggle };
}

function DrawdownTimeline({ trader }: { trader: TraderProfile }) {
  const curve = trader.equity_curve;
  let peak = curve[0]?.value ?? 1;
  const dds: { ts: number; dd: number }[] = [];
  for (const pt of curve) {
    if (pt.value > peak) peak = pt.value;
    dds.push({ ts: pt.ts, dd: peak > 0 ? ((pt.value - peak) / peak) * 100 : 0 });
  }
  const maxDD = Math.min(...dds.map((d) => d.dd));
  const periods: { start: number; end: number; depth: number }[] = [];
  let inDD = false;
  let start = 0;
  let depth = 0;
  for (const d of dds) {
    if (d.dd < -2 && !inDD) { inDD = true; start = d.ts; depth = d.dd; }
    else if (inDD) {
      if (d.dd < depth) depth = d.dd;
      if (d.dd >= -0.5) { periods.push({ start, end: d.ts, depth }); inDD = false; }
    }
  }

  const btcCurve = trader.equity_curve.map((pt, i) => ({
    ts: pt.ts,
    value: 1.0 + (i / trader.equity_curve.length) * 0.38 + Math.sin(i * 0.4) * 0.06,
  }));

  return (
    <div className="space-y-6">
      {/* Max DD stat */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Max Drawdown", value: `${trader.metrics.max_dd.toFixed(1)}%`, color: "var(--color-red)" },
          { label: "Calmar Ratio", value: (trader.metrics.return_90d / Math.abs(trader.metrics.max_dd)).toFixed(2), color: "var(--color-ink)" },
          { label: "Volatility 30d", value: `${trader.metrics.vol_30d.toFixed(1)}%`, color: "var(--color-ink)" },
          { label: "Avg Win Duration", value: `${trader.metrics.avg_trade_duration_hours.toFixed(1)}h`, color: "var(--color-ink)" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--color-faint)" }}>{s.label}</p>
            <p className="text-xl font-black tnum" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* DD periods */}
      {periods.length > 0 && (
        <div className="rounded-xl p-5" style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)" }}>
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown size={14} style={{ color: "var(--color-red)" }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>Drawdown Periods</p>
          </div>
          <div className="space-y-2">
            {periods.slice(0, 5).map((p, i) => (
              <div key={i} className="flex items-center gap-3 text-xs">
                <span className="font-mono text-[10px] w-20" style={{ color: "var(--color-faint)" }}>
                  {new Date(p.start * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <span style={{ color: "var(--color-faint)" }}>→</span>
                <span className="font-mono text-[10px] w-20" style={{ color: "var(--color-faint)" }}>
                  {new Date(p.end * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-panel)" }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.min(100, Math.abs(p.depth) * 5)}%`, background: "var(--color-red)" }}
                  />
                </div>
                <span className="font-bold tnum w-14 text-right" style={{ color: "var(--color-red)" }}>
                  {p.depth.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Benchmark vs Trader */}
      <div className="rounded-xl p-5" style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)" }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={14} style={{ color: "var(--color-mint)" }} />
            <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>vs BTC Benchmark</p>
          </div>
          <div className="flex items-center gap-4 text-[10px]">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded" style={{ background: "var(--color-accent)" }} />
              <span style={{ color: "var(--color-faint)" }}>@{trader.handle}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 rounded border-dashed" style={{ background: "var(--color-gold)", opacity: 0.6 }} />
              <span style={{ color: "var(--color-faint)" }}>BTC HODL</span>
            </div>
          </div>
        </div>
        <EquityChart data={trader.equity_curve} benchmarkData={btcCurve} height={180} />
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="rounded-lg p-3" style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--color-faint)" }}>Trader 90d</p>
            <p className="text-base font-black tnum" style={{ color: "var(--color-green)" }}>+{trader.metrics.return_90d.toFixed(1)}%</p>
          </div>
          <div className="rounded-lg p-3" style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--color-faint)" }}>BTC HODL 90d</p>
            <p className="text-base font-black tnum" style={{ color: "var(--color-gold)" }}>+38.4%</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function TraderProfilePage() {
  const params = useParams();
  const handle = params?.handle as string;
  const { role } = useRole();
  const isInvestor = role === "investor";
  const { watchlist, toggle } = useWatchlist();
  const [tab, setTab] = useState<"overview" | "dd" | "score" | "heatmap">("overview");
  const [showShare, setShowShare] = useState(false);

  const { data: trader, isLoading, error, refetch } = useQuery<TraderProfile>({
    queryKey: ["trader", handle],
    queryFn: () => apiFetch(`/traders/${handle}`),
    enabled: !!handle,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
        <div className="max-w-7xl mx-auto px-6 py-10">
          <div className="animate-pulse space-y-6">
            <div className="h-10 w-64 rounded-lg" style={{ background: "var(--color-panel-2)" }} />
            <div className="h-64 rounded-xl" style={{ background: "var(--color-panel)" }} />
          </div>
        </div>
      </div>
    );
  }

  if (error || !trader) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg)" }}>
        <ErrorState message="Trader not found" onRetry={() => refetch()} />
      </div>
    );
  }

  const riskItems = [
    { label: "Sortino", value: trader.metrics.sortino, max: 5, fmt: (v: number) => v.toFixed(2) },
    { label: "Sharpe", value: trader.metrics.sharpe, max: 4, fmt: (v: number) => v.toFixed(2) },
    { label: "Win Rate", value: trader.metrics.win_rate, max: 100, fmt: (v: number) => `${v.toFixed(1)}%` },
    { label: "Max DD", value: Math.abs(trader.metrics.max_dd), max: 30, fmt: (v: number) => `-${v.toFixed(1)}%`, invert: true },
  ];

  const isWatched = watchlist.includes(trader.handle);
  const scoreHistory = MOCK_SCORE_HISTORY[trader.handle];
  const dailyPnl = MOCK_DAILY_PNL[trader.handle];
  const capacityPct = Math.round((trader.aum / trader.capacity.total) * 100);

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[150px] opacity-[0.05]" style={{ background: "var(--color-mint)" }} />
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-10 relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>
            <Link href="/traders" className="hover:text-[var(--color-mint)] transition-colors">Marketplace</Link>
            <span style={{ color: "var(--color-line)" }}>/</span>
            <span style={{ color: "var(--color-ink)" }}>@{trader.handle}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowShare(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: "var(--color-panel)",
                border: "1px solid var(--color-line)",
                color: "var(--color-ink)",
              }}
            >
              <Share2 size={13} />
              Share Card
            </button>
            <button
              onClick={() => toggle(trader.handle)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
              style={{
                background: isWatched ? "rgba(79,158,255,0.1)" : "var(--color-panel)",
                border: `1px solid ${isWatched ? "rgba(79,158,255,0.3)" : "var(--color-line)"}`,
                color: isWatched ? "var(--color-mint)" : "var(--color-faint)",
              }}
            >
              {isWatched ? <BookmarkCheck size={14} /> : <Bookmark size={14} />}
              {isWatched ? "Watching" : "Watch"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
          {/* Left Column */}
          <div className="xl:col-span-4 space-y-6">
            <div className="rounded-2xl overflow-hidden card bg-gradient-to-b from-[var(--color-panel)] to-[var(--color-panel-2)] border-t-2 border-t-[var(--color-mint)] shadow-2xl">
              <div className="p-8">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex gap-4 items-center">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black bg-[var(--color-bg)] border border-[var(--color-line)] text-[var(--color-mint)] shadow-lg">
                      {trader.handle.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <h1 className="text-3xl font-black tracking-tight" style={{ color: "var(--color-ink)" }}>
                        @{trader.handle}
                      </h1>
                      <a
                        href={`https://solscan.io/account/${trader.wallet}?cluster=devnet`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-sm font-mono mt-1 hover:opacity-80 transition-opacity"
                        style={{ color: "var(--color-faint)" }}
                      >
                        {shortAddr(trader.wallet)}
                        <ExternalLink size={10} />
                      </a>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-8 bg-[var(--color-bg)] p-4 rounded-xl border border-[var(--color-line)]">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-faint)] mb-1">Arcadia Score</p>
                    <div className="flex items-center gap-3">
                      <p className="text-4xl font-black tracking-tighter" style={{ color: "var(--color-accent)" }}>{trader.score}</p>
                      <TierBadge tier={trader.tier} />
                    </div>
                  </div>
                  <div className="opacity-80">
                    <ScoreDial score={trader.score} tier={trader.tier} size={80} />
                  </div>
                </div>

                {trader.bio && (
                  <p className="text-sm leading-relaxed mb-6 font-medium" style={{ color: "var(--color-muted)" }}>
                    "{trader.bio}"
                  </p>
                )}

                <div className="flex flex-wrap gap-2 mb-8">
                  {trader.style_tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] px-2.5 py-1 rounded-md font-mono font-bold"
                      style={{ background: "var(--color-bg)", color: "var(--color-muted)", border: "1px solid var(--color-line)" }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="border-t border-[var(--color-line)] pt-6">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-ink)" }}>Vault Status</p>
                    <DepositsStatusBadge
                      deposits_open={trader.deposits_open}
                      capacityLeft={trader.deposits_open ? trader.capacity.total - trader.capacity.used : undefined}
                    />
                  </div>

                  <div className="mb-2">
                    <div className="flex justify-between items-end mb-1.5">
                      <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>
                        AUM / Capacity
                      </p>
                      <div className="text-right">
                        <p className="text-sm font-black tnum" style={{ color: "var(--color-ink)" }}>
                          {formatUSD(trader.aum, 0)}
                        </p>
                        <p className="text-[10px] font-mono" style={{ color: "var(--color-faint)" }}>
                          of {formatUSD(trader.capacity.total, 0)} ({capacityPct}%)
                        </p>
                      </div>
                    </div>
                    <CapacityBar aum={trader.aum} capacity_usd={trader.capacity.total} />
                    <p className="text-[10px] mt-1.5" style={{ color: "var(--color-faint)" }}>
                      Capacity = {trader.score} score × $1,000
                    </p>
                  </div>

                  <div className="mt-4">
                    <Link
                      href={`/vault/${trader.profile}`}
                      className="btn-primary w-full justify-center py-4 text-sm tracking-widest uppercase shadow-[0_0_20px_var(--color-mint-dim)]"
                    >
                      Fund Vault
                    </Link>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Investors", value: trader.investors_count.toString() },
                { label: "Active Days", value: trader.days_active.toString() },
                { label: "Total Trades", value: trader.trade_count.toString() },
                { label: "Max Leverage", value: `${trader.max_leverage}x` },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl p-4 card text-center hover:bg-[var(--color-panel-2)] transition-colors">
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-1 text-[var(--color-faint)]">{stat.label}</p>
                  <p className="text-xl font-black tnum text-[var(--color-ink)]">{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="rounded-xl p-6 card border border-[var(--color-line)] bg-gradient-to-b from-transparent to-[rgba(239,68,68,0.03)]">
              <p className="text-xs font-bold uppercase tracking-widest mb-6 flex items-center gap-2" style={{ color: "var(--color-ink)" }}>
                <span className="w-2 h-2 rounded-full bg-[var(--color-red)]" /> Risk Profile
              </p>
              <RiskBars items={riskItems} />
            </div>
          </div>

          {/* Right Column */}
          <div className="xl:col-span-8 space-y-6">
            {/* Returns Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: "7d Return", value: trader.metrics.return_7d },
                { label: "30d Return", value: trader.metrics.return_30d },
                { label: "90d Return", value: trader.metrics.return_90d },
                { label: "All-time", value: trader.metrics.return_all },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-xl p-5 card relative overflow-hidden group"
                >
                  <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300 ${stat.value >= 0 ? "bg-[var(--color-green)]" : "bg-[var(--color-red)]"}`} />
                  <p className="text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: "var(--color-faint)" }}>
                    {stat.label}
                  </p>
                  <p className={`text-2xl font-black tnum tracking-tight ${pnlClass(stat.value)}`}>
                    {pnlArrow(stat.value)} {Math.abs(stat.value).toFixed(1)}%
                  </p>
                </div>
              ))}
            </div>

            {/* Tab nav */}
            <div className="flex gap-1 p-1 rounded-xl w-full overflow-x-auto" style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}>
              {[
                { key: "overview", label: "Overview" },
                { key: "dd", label: "Due Diligence" },
                { key: "score", label: "Score History" },
                { key: "heatmap", label: "P&L Heatmap" },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setTab(key as typeof tab)}
                  className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest whitespace-nowrap transition-all"
                  style={{
                    background: tab === key ? "var(--color-accent)" : "transparent",
                    color: tab === key ? "var(--color-bg)" : "var(--color-faint)",
                    flexShrink: 0,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Overview Tab */}
            {tab === "overview" && (
              <>
                <div className="rounded-xl card overflow-hidden flex flex-col h-[400px]">
                  <div className="p-6 border-b border-[var(--color-line)] flex items-center justify-between bg-[var(--color-panel-2)]">
                    <div>
                      <h2 className="text-lg font-bold" style={{ color: "var(--color-ink)" }}>Equity Curve</h2>
                      <p className="text-xs font-medium mt-1" style={{ color: "var(--color-faint)" }}>90-day performance history</p>
                    </div>
                  </div>
                  <div className="flex-1 p-6 pb-2">
                    <EquityChart data={trader.equity_curve} height={280} />
                  </div>
                </div>

                {!isInvestor && (
                  <div className="rounded-xl card overflow-hidden shadow-xl">
                    <div className="p-6 border-b border-[var(--color-line)] bg-[var(--color-panel-2)] flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-bold" style={{ color: "var(--color-ink)" }}>Recent Trades</h2>
                        <p className="text-xs font-medium mt-1" style={{ color: "var(--color-faint)" }}>On-chain verifiable execution history</p>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-[var(--color-bg)] border-b border-[var(--color-line)]">
                            {["Market", "Side", "Size", "Leverage", "PnL", "Closed", "On-chain"].map((h) => (
                              <th key={h} className="py-4 px-4 text-left text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {trader.trades.slice(0, 10).map((t) => (
                            <tr
                              key={t.id}
                              className="border-b border-[var(--color-line)] hover:bg-[var(--color-panel-2)] transition-colors"
                            >
                              <td className="py-3 px-4 font-bold tracking-tight text-[var(--color-ink)]">{t.market.replace("-PERP", "")}</td>
                              <td className="py-3 px-4">
                                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded" style={{ background: t.direction === "long" ? "var(--color-green-dim)" : "var(--color-red-dim)", color: t.direction === "long" ? "var(--color-green)" : "var(--color-red)" }}>
                                  {t.direction}
                                </span>
                              </td>
                              <td className="py-3 px-4 tnum font-bold text-[var(--color-muted)]">{formatUSD(t.size_usd, 0)}</td>
                              <td className="py-3 px-4 tnum font-bold text-[var(--color-ink)]">{t.leverage}x</td>
                              <td className={`py-3 px-4 tnum font-black text-base ${pnlClass(t.realized_pnl)}`}>
                                {t.realized_pnl >= 0 ? "+" : ""}{formatUSD(t.realized_pnl, 0)}
                              </td>
                              <td className="py-3 px-4 tnum font-mono text-xs" style={{ color: "var(--color-faint)" }}>
                                {new Date(t.closed_at * 1000).toLocaleDateString()}
                              </td>
                              <td className="py-3 px-4">
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
                    <div className="p-4 text-center bg-[var(--color-panel-2)] border-t border-[var(--color-line)]">
                      <Link
                        href={`/t/${trader.handle}/trades`}
                        className="text-xs font-bold uppercase tracking-widest transition-colors hover:opacity-80"
                        style={{ color: "var(--color-mint)" }}
                      >
                        View full history ({trader.trade_count} trades) →
                      </Link>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Due Diligence Tab */}
            {tab === "dd" && <DrawdownTimeline trader={trader} />}

            {/* Score History Tab */}
            {tab === "score" && (
              <div className="rounded-xl p-6 card">
                <p className="text-xs font-bold uppercase tracking-widest mb-5" style={{ color: "var(--color-faint)" }}>
                  Score History — {scoreHistory ? scoreHistory.length : 0} days
                </p>
                {scoreHistory ? (
                  <ScoreHistoryChart data={scoreHistory} height={280} />
                ) : (
                  <p className="text-sm text-center py-16" style={{ color: "var(--color-faint)" }}>No score history available</p>
                )}
              </div>
            )}

            {/* P&L Heatmap Tab */}
            {tab === "heatmap" && (
              <div className="rounded-xl p-6 card">
                <div className="flex items-center gap-2 mb-5">
                  <Calendar size={14} style={{ color: "var(--color-mint)" }} />
                  <p className="text-xs font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>
                    Daily P&L Heatmap
                  </p>
                </div>
                {dailyPnl ? (
                  <PnLHeatmap data={dailyPnl} />
                ) : (
                  <p className="text-sm text-center py-16" style={{ color: "var(--color-faint)" }}>No trade data available</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showShare && (
        <ShareCardModal
          data={{
            handle:     trader.handle,
            score:      trader.score,
            tier:       trader.tier,
            return_30d: trader.metrics.return_30d,
            sortino:    trader.metrics.sortino,
            max_dd:     trader.metrics.max_dd,
            win_rate:   trader.metrics.win_rate,
            wallet:     trader.wallet,
          }}
          profileUrl={
            typeof window !== "undefined"
              ? `${window.location.origin}/arcadia/t/${trader.handle}`
              : `/arcadia/t/${trader.handle}`
          }
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
