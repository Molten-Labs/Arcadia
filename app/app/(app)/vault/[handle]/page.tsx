"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { apiFetch } from "@/lib/utils";
import { formatUSD, tierColor, shortAddr } from "@/lib/types";
import type { TraderProfile, VaultInfo } from "@/lib/types";
import { TierBadge } from "@/components/TierBadge";
import { DepositsStatusBadge } from "@/components/DepositsStatusBadge";
import { CapacityBar } from "@/components/CapacityBar";
import { EmptyState } from "@/components/EmptyState";
import { NavHistoryChart } from "@/components/NavHistoryChart";
import { DepositModal } from "@/components/DepositModal";
import {
  ArrowUpRight, ArrowLeft, TrendingUp, TrendingDown,
  Users, DollarSign, BarChart3, Activity, ExternalLink,
  Zap, CheckCircle, X,
} from "lucide-react";

export default function VaultPage() {
  const { handle } = useParams<{ handle: string }>();
  const { connected, publicKey } = useWallet();
  const [showDeposit, setShowDeposit] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showWithdraw, setShowWithdraw] = useState(false);

  const { data: trader, isLoading: traderLoading } = useQuery<TraderProfile>({
    queryKey: ["trader", handle],
    queryFn: () => apiFetch(`/traders/${handle}`),
    enabled: !!handle,
  });

  const { data: vault, isLoading: vaultLoading } = useQuery<VaultInfo>({
    queryKey: ["vault", trader?.profile],
    queryFn: () => apiFetch(`/vaults/${trader!.profile}`),
    enabled: !!trader?.profile,
  });

  const loading = traderLoading || vaultLoading;
  const tc = trader ? tierColor(trader.tier) : "#6a6a6a";

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-6" style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
        <div className="h-6 w-32 rounded bg-[var(--color-panel)] animate-pulse" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-[var(--color-panel)] animate-pulse" />
          ))}
        </div>
        <div className="h-80 rounded-xl bg-[var(--color-panel)] animate-pulse" />
      </div>
    );
  }

  if (!trader) {
    return (
      <div className="flex flex-col items-center justify-center gap-4" style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
        <p className="text-lg font-bold" style={{ color: "var(--color-ink)" }}>Trader not found</p>
        <Link href="/traders" className="text-sm" style={{ color: "var(--color-mint)" }}>Browse traders</Link>
      </div>
    );
  }

  const vaultStatus = vault?.status ?? "active";
  const capacityLeft = trader.capacity.total - trader.capacity.used;
  const vaultAum = vault?.aum ?? trader.aum;
  const investorCount = trader.investors_count;
  const perfFee = vault ? vault.perf_fee_bps / 100 : 5;
  const mgmtFee = vault ? vault.mgmt_fee_bps / 100 : 1;

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh" }}>
      {/* ── Back nav ── */}
      <div className="flex items-center gap-3 px-6 py-3" style={{ borderBottom: "1px solid var(--color-line)" }}>
        <Link href="/traders" className="flex items-center gap-1.5 text-xs font-medium no-underline" style={{ color: "var(--color-faint)" }}>
          <ArrowLeft size={12} /> Traders
        </Link>
        <span style={{ color: "var(--color-faint)", fontSize: "0.625rem" }}>/</span>
        <span className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>@{handle}</span>
      </div>

      {/* ── Vault header ── */}
      <div className="px-6 py-6" style={{ borderBottom: "1px solid var(--color-line)" }}>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-black shrink-0"
              style={{ background: `${tc}18`, border: `2px solid ${tc}40`, color: tc }}
            >
              {trader.handle.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2.5 mb-1">
                <h1 className="text-xl font-extrabold m-0" style={{ color: "var(--color-ink)" }}>
                  @{trader.handle}
                </h1>
                <TierBadge tier={trader.tier} />
                <DepositsStatusBadge deposits_open={vault?.deposits_open ?? trader.deposits_open} />
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px]" style={{ color: "var(--color-faint)" }}>
                  {shortAddr(trader.wallet)}
                </span>
                <span className="font-mono text-[10px] capitalize" style={{ color: "var(--color-muted)" }}>
                  {vaultStatus}
                </span>
                <span className="font-mono text-[10px]" style={{ color: "var(--color-mint)" }}>
                  {perfFee}% perf / {mgmtFee}% mgmt
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {connected && (
              <button
                onClick={() => setShowDeposit(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: "var(--color-mint)", color: "#fff",
                  boxShadow: "0 4px 16px rgba(79,158,255,0.25)",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "#74b5ff")}
                onMouseLeave={e => (e.currentTarget.style.background = "var(--color-mint)")}
              >
                <Zap size={12} /> Deposit
              </button>
            )}
            <button
              onClick={() => setShowWithdraw(!showWithdraw)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all"
              style={{
                border: "1px solid var(--color-line)", color: "var(--color-muted)",
                background: "var(--color-panel)",
              }}
            >
              Withdraw
            </button>
          </div>
        </div>
      </div>

      {/* ── Stats grid ── */}
      <div className="grid grid-cols-4 gap-px" style={{ background: "var(--color-line)" }}>
        {[
          { label: "Net Asset Value",   value: formatUSD(vaultAum, 0),         icon: DollarSign,  color: "var(--color-ink)" },
          { label: "NAV per Share",     value: vault ? `$${(vault.nav_per_share / 1_000_000).toFixed(4)}` : "—", icon: BarChart3, color: "var(--color-mint)" },
          { label: "Capacity Left",     value: formatUSD(capacityLeft, 0),     icon: Activity,    color: capacityLeft > 0 ? "var(--color-green)" : "var(--color-red)" },
          { label: "Investors",         value: investorCount.toString(),       icon: Users,       color: "var(--color-ink)" },
        ].map((s) => (
          <div key={s.label} className="flex flex-col gap-1.5 p-5" style={{ background: "var(--color-bg)" }}>
            <div className="flex items-center gap-1.5">
              <s.icon size={10} style={{ color: "var(--color-faint)" }} />
              <span className="font-mono text-[9px] tracking-[0.15em] uppercase" style={{ color: "var(--color-faint)" }}>{s.label}</span>
            </div>
            <span className="font-mono text-lg font-black tracking-[-0.02em]" style={{ color: s.color }}>{s.value}</span>
          </div>
        ))}
      </div>

      {/* ── Capacity bar ── */}
      <div className="px-6 py-4" style={{ borderBottom: "1px solid var(--color-line)" }}>
        <CapacityBar aum={trader.capacity.used} capacity_usd={trader.capacity.total} />
      </div>

      {/* ── Main grid ── */}
      <div className="grid grid-cols-[1fr_360px] gap-px" style={{ minHeight: 400 }}>
        {/* Left: NAV chart + trades */}
        <div style={{ borderRight: "1px solid var(--color-line)" }}>
          {/* NAV History */}
          <div className="p-5" style={{ borderBottom: "1px solid var(--color-line)" }}>
            <h3 className="font-mono text-[9px] tracking-[0.2em] uppercase font-semibold mb-4" style={{ color: "var(--color-faint)" }}>
              NAV History (TWR)
            </h3>
            <div className="h-64">
              {trader.equity_curve.length > 0 ? (
                <NavHistoryChart data={trader.equity_curve} />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <span className="text-xs" style={{ color: "var(--color-faint)" }}>No history yet</span>
                </div>
              )}
            </div>
          </div>

          {/* Recent trades */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono text-[9px] tracking-[0.2em] uppercase font-semibold" style={{ color: "var(--color-faint)" }}>
                Trades ({trader.trades.length})
              </h3>
              <Link href={`/t/${handle}/trades`} className="font-mono text-[9px] tracking-[0.1em] uppercase no-underline flex items-center gap-1" style={{ color: "var(--color-mint)" }}>
                View all <ArrowUpRight size={9} />
              </Link>
            </div>
            {trader.trades.length === 0 ? (
              <div className="flex items-center justify-center h-24">
                <span className="text-xs" style={{ color: "var(--color-faint)" }}>No trades yet</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-line)" }}>
                      {["Market", "Dir.", "Size", "Entry", "Exit", "PnL"].map((h) => (
                        <th key={h} className="py-2 pr-3 text-left font-mono text-[9px] font-semibold uppercase tracking-[0.12em]" style={{ color: "var(--color-faint)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {trader.trades.slice(0, 8).map((t) => (
                      <tr key={t.id} style={{ borderBottom: "1px solid var(--color-line)" }}>
                        <td className="py-2 pr-3 font-semibold" style={{ color: "var(--color-ink)" }}>{t.market}</td>
                        <td className="py-2 pr-3">
                          <span className="font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded" style={{
                            background: t.direction === "long" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                            color: t.direction === "long" ? "var(--color-green)" : "var(--color-red)",
                          }}>{t.direction}</span>
                        </td>
                        <td className="py-2 pr-3 tnum" style={{ color: "var(--color-muted)" }}>{formatUSD(t.size_usd, 0)}</td>
                        <td className="py-2 pr-3 tnum" style={{ color: "var(--color-muted)" }}>{t.entry_px.toFixed(2)}</td>
                        <td className="py-2 pr-3 tnum" style={{ color: "var(--color-muted)" }}>{t.exit_px.toFixed(2)}</td>
                        <td className="py-2 pr-3 tnum font-semibold" style={{ color: t.realized_pnl >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
                          {t.realized_pnl >= 0 ? "+" : ""}{formatUSD(t.realized_pnl, 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right: vault details + withdraw panel */}
        <div className="p-5 flex flex-col gap-5">
          {/* Withdraw panel */}
          {showWithdraw && (
            <div className="rounded-xl p-4" style={{ border: "1px solid var(--color-line)", background: "var(--color-panel)" }}>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-bold" style={{ color: "var(--color-ink)" }}>Request Withdraw</h4>
                <button onClick={() => setShowWithdraw(false)} className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--color-panel-2)]">
                  <X size={10} style={{ color: "var(--color-faint)" }} />
                </button>
              </div>
              <p className="text-[10px] mb-3" style={{ color: "var(--color-faint)" }}>
                Withdrawals are subject to a settlement window.
              </p>
              <input
                type="number"
                value={withdrawAmount}
                onChange={e => setWithdrawAmount(e.target.value)}
                placeholder="Shares to withdraw"
                className="w-full rounded-lg px-3 py-2 text-xs outline-none mb-3"
                style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)", color: "var(--color-ink)" }}
              />
              <button
                className="w-full py-2 rounded-lg text-xs font-bold transition-all"
                style={{
                  background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)",
                  color: "var(--color-red)",
                }}
                disabled={!connected || !withdrawAmount || parseFloat(withdrawAmount) <= 0}
                onClick={() => {
                  setWithdrawAmount("");
                  setShowWithdraw(false);
                }}
              >
                Request Withdraw
              </button>
            </div>
          )}

          {/* Vault info */}
          <div>
            <h3 className="font-mono text-[9px] tracking-[0.2em] uppercase font-semibold mb-3" style={{ color: "var(--color-faint)" }}>
              Vault Details
            </h3>
            <div className="flex flex-col gap-2">
              {[
                { label: "Total Shares",   value: vault ? vault.total_shares.toLocaleString() : "—" },
                { label: "Trader Shares",  value: vault ? vault.trader_shares.toLocaleString() : "—" },
                { label: "HWM",            value: vault ? `$${(vault.hwm / 1_000_000).toFixed(4)}` : "—" },
                { label: "Perf Fee",       value: `${perfFee}%` },
                { label: "Mgmt Fee",       value: `${mgmtFee}%` },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--color-line)" }}>
                  <span className="text-[11px]" style={{ color: "var(--color-faint)" }}>{r.label}</span>
                  <span className="text-[11px] font-semibold tnum" style={{ color: "var(--color-ink)" }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Performance summary */}
          <div>
            <h3 className="font-mono text-[9px] tracking-[0.2em] uppercase font-semibold mb-3" style={{ color: "var(--color-faint)" }}>
              Performance
            </h3>
            <div className="flex flex-col gap-2">
              {[
                { label: "30d Return",  value: `+${trader.metrics.return_30d.toFixed(1)}%`, color: "var(--color-green)" },
                { label: "90d Return",  value: `+${trader.metrics.return_90d.toFixed(1)}%`, color: "var(--color-green)" },
                { label: "Max DD",      value: `${trader.metrics.max_dd.toFixed(1)}%`,     color: trader.metrics.max_dd < -10 ? "var(--color-red)" : "var(--color-gold)" },
                { label: "Sortino",     value: trader.metrics.sortino.toFixed(2),           color: "var(--color-ink)" },
                { label: "Win Rate",    value: `${trader.metrics.win_rate.toFixed(1)}%`,    color: "var(--color-mint)" },
              ].map((r) => (
                <div key={r.label} className="flex items-center justify-between py-1.5" style={{ borderBottom: "1px solid var(--color-line)" }}>
                  <span className="text-[11px]" style={{ color: "var(--color-faint)" }}>{r.label}</span>
                  <span className="text-[11px] font-semibold tnum" style={{ color: r.color }}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Trader profile link */}
          <Link
            href={`/t/${handle}`}
            className="flex items-center justify-between rounded-lg px-4 py-3 text-xs font-semibold no-underline transition-all hover:bg-[var(--color-panel-2)]"
            style={{ border: "1px solid var(--color-line)", color: "var(--color-ink)" }}
          >
            <span>View full trader profile</span>
            <ArrowUpRight size={11} style={{ color: "var(--color-faint)" }} />
          </Link>
        </div>
      </div>

      {/* ── Deposit modal ── */}
      {showDeposit && trader && (
        <DepositModal trader={trader} onClose={() => setShowDeposit(false)} />
      )}
    </div>
  );
}
