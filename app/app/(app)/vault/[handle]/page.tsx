"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWalletCompat } from "@/lib/use-wallet-compat";
import { Activity, AlertCircle, ArrowLeft, ArrowUpRight, BarChart3, CheckCircle, DollarSign, Loader2, Users, X, Zap } from "lucide-react";

import { NavHistoryChart } from "@/components/NavHistoryChart";
import { DepositModal } from "@/components/DepositModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CountUp } from "@/components/acid";
import { Kicker } from "@/components/pages/investor/chrome";
import { Panel, PanelLabel } from "@/components/pages/investor/surfaces";
import { CapacityMeter } from "@/components/pages/investor/CapacityMeter";
import { DepositsBadge, TierChip, TraderAvatar } from "@/components/pages/investor/tier";
import { apiFetch, cn } from "@/lib/utils";
import { formatUSD, shortAddr } from "@/lib/types";
import { useArcadiaVault } from "@/lib/use-arcadia-vault";
import type { TraderProfile, VaultInfo, TraderClassification } from "@/lib/types";
import { ClassificationBadgeSet } from "@/components/pages/trader/trader-ui";

const TOP_GLOW = {
  background:
    "radial-gradient(120% 90% at 50% -10%, color-mix(in srgb, var(--color-acid) 7%, transparent), transparent 60%)",
};

export default function VaultPage() {
  const { handle } = useParams<{ handle: string }>();
  const { connected } = useWalletCompat();
  const [showDeposit, setShowDeposit] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showWithdraw, setShowWithdraw] = useState(false);

  const { requestWithdraw, txState, resetTx } = useArcadiaVault();

  const withdrawPhase = txState.phase;
  const withdrawPending = withdrawPhase === "signing" || withdrawPhase === "confirming" || withdrawPhase === "checking";
  const withdrawDone = withdrawPhase === "success";
  const withdrawError = withdrawPhase === "error";

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

  const { data: classification } = useQuery<TraderClassification>({
    queryKey: ["classification", handle],
    queryFn: () => apiFetch(`/traders/${handle}/classification`),
    enabled: !!handle,
    staleTime: 120_000,
  });

  const loading = traderLoading || vaultLoading;

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col gap-4 bg-void p-6">
        <Skeleton className="h-6 w-32" />
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
      </div>
    );
  }

  if (!trader) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-void">
        <p className="font-display text-lg font-bold text-ink uppercase">Trader not found</p>
        <Link href="/traders" className="text-sm text-acid hover:underline">
          Browse traders
        </Link>
      </div>
    );
  }

  const vaultStatus = vault?.status ?? "active";
  const capacityLeft = trader.capacity.total - trader.capacity.used;
  const vaultAum = vault?.aum ?? trader.aum;
  const investorCount = trader.investors_count;
  const perfFee = vault ? vault.perf_fee_bps / 100 : 5;
  const mgmtFee = vault ? vault.mgmt_fee_bps / 100 : 1;

  const stats = [
    { label: "Net Asset Value", value: <CountUp value={vaultAum} prefix="$" />, icon: DollarSign, accent: "text-ink" },
    {
      label: "NAV per Share",
      value: vault ? `$${(vault.nav_per_share / 1_000_000).toFixed(4)}` : "—",
      icon: BarChart3,
      accent: "text-acid",
    },
    {
      label: "Capacity Left",
      value: formatUSD(capacityLeft, 0),
      icon: Activity,
      accent: capacityLeft > 0 ? "text-success" : "text-danger",
    },
    { label: "Investors", value: <CountUp value={investorCount} />, icon: Users, accent: "text-ink" },
  ];

  return (
    <div className="relative min-h-screen bg-void">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-64" style={TOP_GLOW} />

      <div className="relative">
        {/* Back nav */}
        <div className="flex items-center gap-3 border-b border-line px-6 py-3">
          <Link href="/traders" className="flex items-center gap-1.5 text-xs font-medium text-faint hover:text-ink">
            <ArrowLeft className="size-3" /> Traders
          </Link>
          <span className="text-[0.625rem] text-faint">/</span>
          <span className="text-xs font-semibold text-ink">@{handle}</span>
        </div>

        {/* Header */}
        <div className="border-b border-line px-6 py-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <TraderAvatar handle={trader.handle} tier={trader.tier} size={56} />
              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2.5">
                  <h1 className="font-display text-xl font-extrabold tracking-tight text-ink uppercase">
                    @{trader.handle}
                  </h1>
                  <TierChip tier={trader.tier} />
                  <DepositsBadge open={vault?.deposits_open ?? trader.deposits_open} />
                  {classification ? <ClassificationBadgeSet data={classification} /> : null}
                </div>
                <div className="flex flex-wrap items-center gap-3 font-mono text-[0.625rem]">
                  <span className="text-faint">{shortAddr(trader.wallet)}</span>
                  <span className="text-muted capitalize">{vaultStatus}</span>
                  <span className="text-acid">
                    {perfFee}% perf / {mgmtFee}% mgmt
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {connected ? (
                <Button size="sm" onClick={() => setShowDeposit(true)}>
                  <Zap className="size-3" /> Deposit
                </Button>
              ) : null}
              <Button size="sm" variant="secondary" onClick={() => setShowWithdraw((v) => !v)}>
                Withdraw
              </Button>
            </div>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-px bg-line md:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="group flex flex-col gap-1.5 bg-void p-5 transition-colors duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] hover:bg-white/[0.02] motion-reduce:transition-none"
            >
              <div className="flex items-center gap-1.5">
                <s.icon className="size-2.5 text-faint transition-colors duration-300 group-hover:text-muted motion-reduce:transition-none" />
                <PanelLabel className="transition-colors duration-300 group-hover:text-muted motion-reduce:transition-none">
                  {s.label}
                </PanelLabel>
              </div>
              <span className={`font-mono text-lg font-bold tracking-tight tabular-nums ${s.accent}`}>{s.value}</span>
            </div>
          ))}
        </div>

        {/* Capacity */}
        <div className="border-b border-line px-6 py-4">
          <CapacityMeter aum={trader.capacity.used} capacity_usd={trader.capacity.total} />
        </div>

        {/* Main grid */}
        <div className="grid grid-cols-1 gap-px lg:grid-cols-[1fr_360px]">
          {/* Left: NAV chart + trades */}
          <div className="lg:border-r lg:border-line">
            <div className="border-b border-line p-5">
              <h3 className="mb-4">
                <Kicker>NAV History (TWR)</Kicker>
              </h3>
              <div className="h-64">
                {trader.equity_curve.length > 0 ? (
                  <NavHistoryChart data={trader.equity_curve} />
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <span className="text-xs text-faint">No history yet</span>
                  </div>
                )}
              </div>
            </div>

            <div className="p-5">
              <div className="mb-4 flex items-center justify-between">
                <PanelLabel>Trades ({trader.trades.length})</PanelLabel>
                <Link
                  href={`/t/${handle}/trades`}
                  className="flex items-center gap-1 font-mono text-[0.625rem] tracking-[0.1em] text-acid uppercase hover:underline"
                >
                  View all <ArrowUpRight className="size-2.5" />
                </Link>
              </div>
              {trader.trades.length === 0 ? (
                <div className="flex h-24 items-center justify-center">
                  <span className="text-xs text-faint">No trades yet</span>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Market</TableHead>
                      <TableHead>Dir.</TableHead>
                      <TableHead className="text-right">Size</TableHead>
                      <TableHead className="text-right">Entry</TableHead>
                      <TableHead className="text-right">Exit</TableHead>
                      <TableHead className="text-right">PnL</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trader.trades.slice(0, 8).map((t) => (
                      <TableRow key={t.id} className="group">
                        <TableCell className="font-semibold text-ink">{t.market}</TableCell>
                        <TableCell>
                          <span
                            className={`rounded px-1.5 py-0.5 font-mono text-[0.625rem] font-bold uppercase ${
                              t.direction === "long"
                                ? "bg-success/12 text-success"
                                : "bg-danger/12 text-danger"
                            }`}
                          >
                            {t.direction}
                          </span>
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-muted transition-colors group-hover:text-ink motion-reduce:transition-none">{formatUSD(t.size_usd, 0)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted transition-colors group-hover:text-ink motion-reduce:transition-none">{t.entry_px.toFixed(2)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted transition-colors group-hover:text-ink motion-reduce:transition-none">{t.exit_px.toFixed(2)}</TableCell>
                        <TableCell
                          className={`text-right font-semibold tabular-nums ${
                            t.realized_pnl >= 0 ? "text-success" : "text-danger"
                          }`}
                        >
                          {t.realized_pnl >= 0 ? "+" : ""}
                          {formatUSD(t.realized_pnl, 0)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </div>

          {/* Right: withdraw + details */}
          <div className="flex flex-col gap-5 p-5">
            {showWithdraw ? (
              <Panel className="p-4">
                <div className="mb-3 flex items-center justify-between">
                  <h4 className="text-xs font-bold text-ink">Request Withdraw</h4>
                  <button
                    type="button"
                    onClick={() => setShowWithdraw(false)}
                    aria-label="Close withdraw panel"
                    className="flex size-5 items-center justify-center rounded text-faint hover:bg-panel-2 hover:text-ink"
                  >
                    <X className="size-2.5" />
                  </button>
                </div>
                <p className="mb-3 text-[0.625rem] text-faint">
                  Withdrawals are subject to a settlement window.
                </p>
                    {withdrawDone ? (
                    <div className="rounded-lg border border-success/25 bg-success/10 p-3 text-center">
                      <CheckCircle size={16} className="mx-auto mb-2 text-success" />
                      <p className="text-xs font-bold text-success">
                        {txState.simulated ? "Withdraw simulated (devnet)" : "Withdraw requested"}
                      </p>
                      {txState.sig && (
                        <p className="mt-1 font-mono text-[0.55rem] text-faint break-all">
                          {txState.sig.slice(0, 8)}…
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={() => { resetTx(); setShowWithdraw(false); }}
                        className="mt-2 w-full rounded border border-white/10 py-1 text-[0.6rem] text-faint"
                      >
                        Close
                      </button>
                    </div>
                  ) : withdrawError ? (
                    <div className="rounded-lg border border-danger/25 bg-danger/10 p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <AlertCircle size={12} className="text-danger" />
                        <span className="text-xs font-bold text-danger">Withdraw failed</span>
                      </div>
                      <p className="text-[0.6rem] text-faint">{txState.message}</p>
                      <button
                        type="button"
                        onClick={resetTx}
                        className="mt-2 w-full rounded border border-white/10 py-1 text-[0.6rem] text-faint"
                      >
                        Try again
                      </button>
                    </div>
                  ) : (
                    <>
                      <Input
                        type="number"
                        value={withdrawAmount}
                        onChange={(e) => setWithdrawAmount(e.target.value)}
                        placeholder="Shares to withdraw"
                        className="mb-3"
                      />
                      <Button
                        variant="destructive"
                        className="w-full"
                        disabled={!connected || !withdrawAmount || parseFloat(withdrawAmount) <= 0 || withdrawPending}
                        onClick={async () => {
                          const shares = parseFloat(withdrawAmount);
                          if (!shares || shares <= 0) return;
                          resetTx();
                          await requestWithdraw(trader.wallet, shares);
                          if (txState.phase !== "error") {
                            setWithdrawAmount("");
                          }
                        }}
                      >
                        {withdrawPending ? (
                          <><Loader2 size={14} className="mr-1 animate-spin" /> Processing…</>
                        ) : (
                          "Request Withdraw"
                        )}
                      </Button>
                      {withdrawPending && (
                        <div className="mt-2 flex items-center gap-1.5 text-[0.6rem] text-faint">
                          <Loader2 size={10} className="animate-spin" />
                          {txState.message}
                        </div>
                      )}
                    </>
                  )}
              </Panel>
            ) : null}

            <div>
              <PanelLabel className="mb-3">Vault Details</PanelLabel>
              <dl className="flex flex-col gap-2">
                {(
                  [
                    ["Total Shares", vault ? vault.total_shares.toLocaleString() : "—"],
                    ["Trader Shares", vault ? vault.trader_shares.toLocaleString() : "—"],
                    ["HWM", vault ? `$${(vault.hwm / 1_000_000).toFixed(4)}` : "—"],
                    ["Perf Fee", `${perfFee}%`],
                    ["Mgmt Fee", `${mgmtFee}%`],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between border-b border-line py-1.5">
                    <dt className="text-[0.6875rem] text-faint">{label}</dt>
                    <dd className="text-[0.6875rem] font-semibold tabular-nums text-ink">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div>
              <PanelLabel className="mb-3">Performance</PanelLabel>
              <dl className="flex flex-col gap-2">
                {(
                  [
                    ["30d Return", `+${trader.metrics.return_30d.toFixed(1)}%`, "text-success"],
                    ["90d Return", `+${trader.metrics.return_90d.toFixed(1)}%`, "text-success"],
                    [
                      "Max DD",
                      `${trader.metrics.max_dd.toFixed(1)}%`,
                      trader.metrics.max_dd < -10 ? "text-danger" : "text-tier-advanced",
                    ],
                    ["Sortino", trader.metrics.sortino.toFixed(2), "text-ink"],
                    ["Win Rate", `${trader.metrics.win_rate.toFixed(1)}%`, "text-acid"],
                  ] as const
                ).map(([label, value, color]) => (
                  <div key={label} className="flex items-center justify-between border-b border-line py-1.5">
                    <dt className="text-[0.6875rem] text-faint">{label}</dt>
                    <dd className={`text-[0.6875rem] font-semibold tabular-nums ${color}`}>{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <Link
              href={`/t/${handle}`}
              className="group acid-int flex items-center justify-between rounded-lg border border-line px-4 py-3 text-xs font-semibold text-ink"
            >
              <span>View full trader profile</span>
              <ArrowUpRight className="size-3 text-faint transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:transform-none" />
            </Link>
          </div>
        </div>
      </div>

      {showDeposit && trader ? <DepositModal trader={trader} onClose={() => setShowDeposit(false)} /> : null}
    </div>
  );
}
