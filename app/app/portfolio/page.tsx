"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { TierBadge } from "@/components/TierBadge";
import { DepositsStatusBadge } from "@/components/DepositsStatusBadge";
import { NavHistoryChart } from "@/components/NavHistoryChart";
import { EmptyState } from "@/components/EmptyState";
import { StatCard } from "@/components/StatCard";
import { SkeletonStatCard } from "@/components/SkeletonCard";
import { apiFetch } from "@/lib/utils";
import { formatUSD, pnlClass, pnlArrow } from "@/lib/types";
import type { PortfolioItem } from "@/lib/types";
import { MOCK_TRADERS } from "@/lib/mock-data";
import { ArrowUpRight, Zap } from "lucide-react";

type Tab = "overview" | "positions" | "activity";

const TX_HISTORY = [
  { type: "Deposit",          trader: "@nova", amount: 6000,  status: "Confirmed",      sig: "3aZ…", ts: "32d ago", positive: true  },
  { type: "Deposit",          trader: "@vega", amount: 6000,  status: "Confirmed",      sig: "5pN…", ts: "28d ago", positive: true  },
  { type: "Settle",           trader: "@nova", amount: 590,   status: "Settled",        sig: "8mC…", ts: "1d ago",  positive: true  },
  { type: "Withdraw request", trader: "@vega", amount: 1000,  status: "Awaiting window",sig: "—",    ts: "2h ago",  positive: false },
];

/* ── Sliding tab component ── */
function SlidingTabs({ tabs, active, onChange }: {
  tabs: { id: Tab; label: string }[];
  active: Tab;
  onChange: (id: Tab) => void;
}) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const barRef  = useRef<HTMLDivElement>(null);

  function snapPill(animate: boolean) {
    const bar = barRef.current;
    const pill = pillRef.current;
    if (!bar || !pill) return;
    const activeBtn = bar.querySelector<HTMLButtonElement>(`[data-tab="${active}"]`);
    if (!activeBtn) return;
    if (!animate) {
      const prev = pill.style.transition;
      pill.style.transition = "none";
      pill.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
      pill.style.width = `${activeBtn.offsetWidth}px`;
      pill.getBoundingClientRect(); // force reflow
      pill.style.transition = prev;
    } else {
      pill.style.transform = `translateX(${activeBtn.offsetLeft}px)`;
      pill.style.width = `${activeBtn.offsetWidth}px`;
    }
  }

  useEffect(() => { snapPill(true); });
  useEffect(() => { snapPill(false); }, []);

  return (
    <div ref={barRef} className="t-tabs">
      <span ref={pillRef} className="t-tabs-pill" />
      {tabs.map((t) => (
        <button
          key={t.id}
          data-tab={t.id}
          role="tab"
          aria-selected={active === t.id}
          className="t-tab"
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ── Page ── */
export default function PortfolioPage() {
  const { connected, publicKey } = useWallet();
  const [tab, setTab] = useState<Tab>("overview");

  const { data, isLoading } = useQuery<PortfolioItem[]>({
    queryKey: ["portfolio", publicKey?.toBase58()],
    queryFn: () => apiFetch(`/investors/${publicKey?.toBase58()}/portfolio`),
    enabled: !!publicKey,
  });

  if (!connected) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: "var(--color-bg)" }}>
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5" style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}>
          <Zap size={22} style={{ color: "var(--color-mint)" }} />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: "var(--color-ink)" }}>Connect your wallet</h2>
        <p className="text-sm text-center max-w-sm" style={{ color: "var(--color-muted)" }}>
          Connect to view your portfolio, positions, and transaction activity.
        </p>
      </div>
    );
  }

  const totalInvested = data?.reduce((a, p) => a + p.cost_basis_usd, 0) ?? 0;
  const totalValue    = data?.reduce((a, p) => a + p.value_usd, 0) ?? 0;
  const totalPnl      = totalValue - totalInvested;
  const totalRoi      = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const pendingSettle = 1000;

  const TABS: { id: Tab; label: string }[] = [
    { id: "overview",  label: "Overview"  },
    { id: "positions", label: "Positions" },
    { id: "activity",  label: "Activity"  },
  ];

  return (
    <div className="min-h-full" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-black mb-1 tracking-tight" style={{ color: "var(--color-ink)", letterSpacing: "-0.03em" }}>
            Portfolio
          </h1>
          <p className="text-sm" style={{ color: "var(--color-faint)" }}>
            All your vault positions in one place
          </p>
        </div>

        {/* Stat summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
            : [
                { label: "Invested",           value: formatUSD(totalInvested, 0)                                                      },
                { label: "Current value",      value: formatUSD(totalValue, 0),     deltaPositive: totalValue >= totalInvested          },
                { label: "Total PnL",          value: (totalPnl >= 0 ? "+" : "") + formatUSD(totalPnl, 0), deltaPositive: totalPnl >= 0 },
                { label: "ROI",                value: (totalRoi >= 0 ? "+" : "") + totalRoi.toFixed(2) + "%", deltaPositive: totalRoi >= 0 },
              ].map((s) => <StatCard key={s.label} {...s} />)
          }
        </div>

        {/* Tabs */}
        <div className="mb-6">
          <SlidingTabs tabs={TABS} active={tab} onChange={setTab} />
        </div>

        {/* ── OVERVIEW ── */}
        {tab === "overview" && (
          <div className="space-y-4" style={{ animation: "fade-in 0.2s ease" }}>
            {isLoading
              ? Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="rounded-xl h-40 animate-pulse" style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }} />
              ))
              : !data || data.length === 0
                ? <EmptyState title="No positions yet" description="You haven't funded any traders yet" cta={{ label: "Browse Traders", href: "/traders" }} />
                : data.map((pos) => {
                  const trader = MOCK_TRADERS.find((t) => t.handle === pos.trader_handle);
                  const nav = (1.0 + (trader?.metrics.return_all ?? 0) / 100).toFixed(6);
                  return (
                    <div key={pos.profile} className="rounded-xl overflow-hidden" style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)", transition: "border-color 0.2s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.borderColor = "rgba(79,158,255,0.3)")}
                      onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--color-line)")}
                    >
                      <div className="p-5">
                        <div className="flex items-start justify-between mb-4 gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <Link href={`/t/${pos.trader_handle}`} className="text-base font-bold hover:underline" style={{ color: "var(--color-ink)" }}>
                                @{pos.trader_handle}
                              </Link>
                              {trader && <TierBadge tier={trader.tier} />}
                              {trader && <DepositsStatusBadge deposits_open={trader.deposits_open} />}
                            </div>
                            <p className="text-xs" style={{ fontFamily: "var(--font-mono)", color: "var(--color-faint)" }}>
                              NAV {nav} · HWM {(parseFloat(nav) + 0.05).toFixed(6)}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <p className={`text-xl font-black tnum ${pnlClass(pos.roi_pct)}`} style={{ letterSpacing: "-0.03em" }}>
                              {pnlArrow(pos.roi_pct)}{Math.abs(pos.roi_pct).toFixed(1)}%
                            </p>
                            <p className="text-xs tnum" style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted)" }}>
                              {formatUSD(pos.value_usd, 0)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 text-xs mb-4 pb-4" style={{ borderBottom: "1px solid var(--color-line)" }}>
                          {[
                            ["Shares",  `${pos.shares.toLocaleString()}`],
                            ["Cost",    formatUSD(pos.cost_basis_usd, 0)],
                            ["PnL",     (pos.pnl_usd >= 0 ? "+" : "") + formatUSD(pos.pnl_usd, 0)],
                          ].map(([k, v]) => (
                            <div key={k as string}>
                              <p className="mb-1" style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-faint)" }}>
                                {k}
                              </p>
                              <p className="tnum font-semibold" style={{
                                fontFamily: "var(--font-mono)",
                                color: k === "PnL" ? (pos.pnl_usd >= 0 ? "var(--color-green)" : "var(--color-red)") : "var(--color-ink)",
                              }}>
                                {v}
                              </p>
                            </div>
                          ))}
                        </div>

                        {trader && <NavHistoryChart data={trader.equity_curve} height={72} />}

                        <div className="flex gap-2 mt-4 flex-wrap">
                          {trader?.deposits_open && (
                            <Link href={`/vault/${pos.profile}`} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-bold" style={{ background: "var(--color-mint)", color: "#ffffff" }}>
                              Deposit more <ArrowUpRight size={11} />
                            </Link>
                          )}
                          <Link href={`/vault/${pos.profile}`} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium" style={{ border: "1px solid var(--color-line)", color: "var(--color-muted)" }}>
                            Withdraw
                          </Link>
                          <Link href={`/t/${pos.trader_handle}`} className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium" style={{ border: "1px solid var(--color-line)", color: "var(--color-muted)" }}>
                            Profile <ArrowUpRight size={11} />
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })
            }
          </div>
        )}

        {/* ── POSITIONS ── */}
        {tab === "positions" && (
          <div style={{ animation: "fade-in 0.2s ease" }}>
            {!data || data.length === 0
              ? <EmptyState title="No positions" description="" cta={{ label: "Browse Traders", href: "/traders" }} />
              : (
                <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-line)" }}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ background: "var(--color-panel-2)", borderBottom: "1px solid var(--color-line)" }}>
                          {["Trader", "Shares", "Cost basis", "Value", "PnL", "ROI", ""].map((h) => (
                            <th key={h} className="py-3 px-4 text-left font-semibold" style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--color-faint)" }}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {isLoading
                          ? Array.from({ length: 3 }).map((_, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid var(--color-line)" }}>
                              {Array.from({ length: 7 }).map((_, j) => (
                                <td key={j} className="py-3 px-4">
                                  <div className="h-3 rounded" style={{ background: "var(--color-panel)", width: "60%" }} />
                                </td>
                              ))}
                            </tr>
                          ))
                          : data?.map((pos) => (
                            <tr key={pos.profile} style={{ background: "var(--color-panel)", borderBottom: "1px solid var(--color-line)", transition: "background 0.12s" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-panel-2)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-panel)")}
                            >
                              <td className="py-3 px-4">
                                <Link href={`/t/${pos.trader_handle}`} className="font-semibold hover:underline" style={{ color: "var(--color-ink)" }}>
                                  @{pos.trader_handle}
                                </Link>
                              </td>
                              <td className="py-3 px-4 tnum" style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted)" }}>
                                {pos.shares.toLocaleString()}
                              </td>
                              <td className="py-3 px-4 tnum" style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted)" }}>
                                {formatUSD(pos.cost_basis_usd, 0)}
                              </td>
                              <td className="py-3 px-4 tnum font-semibold" style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink)" }}>
                                {formatUSD(pos.value_usd, 0)}
                              </td>
                              <td className={`py-3 px-4 tnum font-semibold ${pnlClass(pos.pnl_usd)}`} style={{ fontFamily: "var(--font-mono)" }}>
                                {pnlArrow(pos.pnl_usd)}{formatUSD(Math.abs(pos.pnl_usd), 0)}
                              </td>
                              <td className={`py-3 px-4 tnum font-semibold ${pnlClass(pos.roi_pct)}`} style={{ fontFamily: "var(--font-mono)" }}>
                                {pnlArrow(pos.roi_pct)}{Math.abs(pos.roi_pct).toFixed(1)}%
                              </td>
                              <td className="py-3 px-4">
                                <Link href={`/vault/${pos.profile}`} className="text-xs px-2.5 py-1 rounded-md" style={{ border: "1px solid var(--color-line)", color: "var(--color-muted)" }}>
                                  Manage
                                </Link>
                              </td>
                            </tr>
                          ))
                        }
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
          </div>
        )}

        {/* ── ACTIVITY ── */}
        {tab === "activity" && (
          <div style={{ animation: "fade-in 0.2s ease" }}>
            {/* Returns summary */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
              <StatCard label="Total PnL" value={(totalPnl >= 0 ? "+" : "") + formatUSD(totalPnl, 0)} deltaPositive={totalPnl >= 0} />
              <StatCard label="ROI" value={(totalRoi >= 0 ? "+" : "") + totalRoi.toFixed(1) + "%"} deltaPositive={totalRoi >= 0} />
              <StatCard label="Pending settlement" value={formatUSD(pendingSettle, 0)} delta="Next daily window" />
            </div>

            <div className="rounded-xl overflow-hidden mb-6" style={{ border: "1px solid var(--color-line)" }}>
              <div className="px-4 py-3" style={{ background: "var(--color-panel-2)", borderBottom: "1px solid var(--color-line)" }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-faint)" }}>
                  Transaction History
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "var(--color-panel)", borderBottom: "1px solid var(--color-line)" }}>
                      {["Type", "Trader", "Amount", "Status", "Signature", "When"].map((h) => (
                        <th key={h} className="py-2.5 px-4 text-left font-medium" style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--color-faint)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TX_HISTORY.map((row, i) => (
                      <tr key={i} style={{ background: "var(--color-panel)", borderBottom: "1px solid var(--color-line)", transition: "background 0.12s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-panel-2)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-panel)")}
                      >
                        <td className="py-3 px-4 font-medium" style={{ color: "var(--color-muted)" }}>{row.type}</td>
                        <td className="py-3 px-4">
                          <Link href={`/t/${row.trader.replace("@", "")}`} className="hover:underline" style={{ color: "var(--color-mint)" }}>
                            {row.trader}
                          </Link>
                        </td>
                        <td className={`py-3 px-4 tnum font-semibold ${pnlClass(row.positive ? 1 : -1)}`} style={{ fontFamily: "var(--font-mono)" }}>
                          {row.positive ? "+" : "-"}{formatUSD(row.amount, 0)}
                        </td>
                        <td className="py-3 px-4" style={{
                          color: row.status === "Confirmed" || row.status === "Settled"
                            ? "var(--color-green)"
                            : "var(--color-gold)",
                        }}>
                          {row.status}
                        </td>
                        <td className="py-3 px-4" style={{ fontFamily: "var(--font-mono)", color: row.sig !== "—" ? "var(--color-mint)" : "var(--color-faint)" }}>
                          {row.sig}
                        </td>
                        <td className="py-3 px-4 tnum" style={{ fontFamily: "var(--font-mono)", color: "var(--color-faint)" }}>
                          {row.ts}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-xl p-4 text-xs leading-relaxed" style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)", color: "var(--color-muted)" }}>
              <strong style={{ color: "var(--color-ink)" }}>Withdrawal policy:</strong> Any portion, anytime, at prevailing NAV.
              Value &lt;5% of vault AUM = instant (next tick). Larger = next daily settlement window.
              No lockups, no penalties. Queued withdrawals show "Awaiting window" until the settlement window is reached.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
