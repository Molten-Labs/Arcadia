"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { TierBadge } from "@/components/TierBadge";
import { DepositsStatusBadge } from "@/components/DepositsStatusBadge";
import { NavHistoryChart } from "@/components/NavHistoryChart";
import { StatCard } from "@/components/StatCard";
import { SkeletonStatCard } from "@/components/SkeletonCard";
import { ErrorState } from "@/components/ErrorState";
import { apiFetch } from "@/lib/utils";
import { formatUSD, navFrom1e6, shortAddr } from "@/lib/types";
import type { VaultInfo, TraderProfile } from "@/lib/types";
import { MOCK_TRADERS } from "@/lib/mock-data";

export default function VaultPage() {
  const params = useParams();
  const profile = params?.profile as string;
  const { connected, publicKey } = useWallet();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [txStatus, setTxStatus] = useState<string | null>(null);

  const trader = MOCK_TRADERS.find((t) => t.profile === profile);

  const { data: vault, isLoading: vaultLoading, error: vaultError, refetch } = useQuery<VaultInfo>({
    queryKey: ["vault", profile],
    queryFn: () => apiFetch(`/vaults/${profile}`),
    enabled: !!profile,
    refetchInterval: 15000,
  });

  const navDisplay = vault ? navFrom1e6(vault.nav_per_share).toFixed(6) : "–";
  const hwmDisplay = vault ? navFrom1e6(vault.hwm).toFixed(6) : "–";
  const aumDisplay = vault ? formatUSD(vault.aum, 0) : "–";

  const handleDeposit = () => {
    if (!connected) return;
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) return;
    setTxStatus(`Simulating deposit of ${formatUSD(amount)}… (devnet simulation)`);
    setTimeout(() => setTxStatus("Deposit recorded. Shares minted (devnet simulation)."), 2000);
  };

  const handleWithdrawRequest = () => {
    if (!connected) return;
    setTxStatus("Withdraw request recorded. Processing in next settlement window.");
    setTimeout(() => setTxStatus(null), 4000);
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6 text-xs" style={{ color: "var(--color-faint)" }}>
          {trader && (
            <>
              <Link href={`/t/${trader.handle}`} style={{ color: "var(--color-muted)" }}>
                @{trader.handle}
              </Link>
              <span>/</span>
            </>
          )}
          <span>Vault</span>
          <span className="font-mono text-[10px]">{shortAddr(profile)}</span>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold" style={{ color: "var(--color-ink)" }}>
              {trader ? `@${trader.handle}'s Vault` : "Vault"}
            </h1>
            {vault && (
              <div className="flex items-center gap-2 mt-1">
                <TierBadge tier={vault.score_tier} />
                <DepositsStatusBadge deposits_open={vault.deposits_open} />
              </div>
            )}
          </div>
        </div>

        {vaultError && <ErrorState message="Failed to load vault" onRetry={() => refetch()} />}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {vaultLoading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
            : [
                { label: "NAV / Share", value: navDisplay },
                { label: "HWM / Share", value: hwmDisplay },
                { label: "AUM", value: aumDisplay },
                { label: "Total Shares", value: vault?.total_shares.toLocaleString() ?? "–" },
              ].map((stat) => (
                <StatCard key={stat.label} label={stat.label} value={stat.value} />
              ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div
              className="rounded-xl p-5"
              style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--color-faint)" }}>
                NAV History
              </p>
              {trader && (
                <NavHistoryChart
                  data={trader.equity_curve.map((pt) => ({
                    ts: pt.ts,
                    value: pt.value,
                  }))}
                  hwm={vault ? navFrom1e6(vault.hwm) : undefined}
                  height={160}
                />
              )}
            </div>

            <div
              className="rounded-xl p-5"
              style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--color-faint)" }}>
                Vault Economics
              </p>
              <div className="space-y-2 text-xs">
                {[
                  ["Performance Fee", `${((vault?.perf_fee_bps ?? 500) / 100).toFixed(1)}% of profit above HWM`],
                  ["Management Fee", `${((vault?.mgmt_fee_bps ?? 100) / 100).toFixed(2)}%/yr`],
                  ["Trader Cut (Elite)", "35% of profit above HWM"],
                  ["Withdrawal", "Any portion, anytime. <5% AUM = instant; larger = next daily window"],
                  ["Shares", "Data — not a token. Represents your proportional stake."],
                ].map(([k, v]) => (
                  <div key={k} className="flex gap-3">
                    <span className="w-36 flex-shrink-0" style={{ color: "var(--color-faint)" }}>{k}</span>
                    <span style={{ color: "var(--color-muted)" }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div
              className="rounded-xl p-5"
              style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--color-faint)" }}>
                Deposit
              </p>
              {!connected ? (
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                  Connect wallet to deposit
                </p>
              ) : !vault?.deposits_open ? (
                <p className="text-xs" style={{ color: "var(--color-gold)" }}>
                  Deposits closed — capacity full
                </p>
              ) : (
                <>
                  <div className="mb-3">
                    <label className="text-xs mb-1 block" style={{ color: "var(--color-faint)" }}>
                      Amount (USDC)
                    </label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0.00"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none tnum"
                      style={{
                        background: "var(--color-panel-2)",
                        border: "1px solid var(--color-line)",
                        color: "var(--color-ink)",
                      }}
                    />
                  </div>
                  {vault && parseFloat(depositAmount) > 0 && (
                    <p className="text-xs mb-3 tnum" style={{ color: "var(--color-muted)" }}>
                      ≈ {(parseFloat(depositAmount) / navFrom1e6(vault.nav_per_share)).toFixed(2)} shares
                      (your stake in this vault)
                    </p>
                  )}
                  <button
                    onClick={handleDeposit}
                    className="w-full py-2 rounded-lg text-sm font-semibold"
                    style={{ background: "var(--color-purple)", color: "white" }}
                  >
                    Deposit
                  </button>
                </>
              )}
            </div>

            <div
              className="rounded-xl p-5"
              style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--color-faint)" }}>
                Withdraw
              </p>
              {!connected ? (
                <p className="text-xs" style={{ color: "var(--color-muted)" }}>
                  Connect wallet to withdraw
                </p>
              ) : (
                <>
                  <div className="mb-3">
                    <label className="text-xs mb-1 block" style={{ color: "var(--color-faint)" }}>
                      Shares to withdraw (your stake)
                    </label>
                    <input
                      type="number"
                      min={0}
                      placeholder="0"
                      value={withdrawShares}
                      onChange={(e) => setWithdrawShares(e.target.value)}
                      className="w-full rounded-lg px-3 py-2 text-sm outline-none tnum"
                      style={{
                        background: "var(--color-panel-2)",
                        border: "1px solid var(--color-line)",
                        color: "var(--color-ink)",
                      }}
                    />
                  </div>
                  <p className="text-xs mb-3 leading-relaxed" style={{ color: "var(--color-faint)" }}>
                    Any portion, anytime. &lt;5% of vault = instant (next tick). Larger = next daily settlement window.
                  </p>
                  <button
                    onClick={handleWithdrawRequest}
                    className="w-full py-2 rounded-lg text-sm font-medium"
                    style={{
                      border: "1px solid var(--color-line)",
                      color: "var(--color-muted)",
                    }}
                  >
                    Request Withdraw
                  </button>
                </>
              )}
            </div>

            {txStatus && (
              <div
                className="rounded-lg p-3 text-xs"
                style={{
                  background: "var(--color-panel-2)",
                  border: "1px solid var(--color-line)",
                  color: "var(--color-muted)",
                }}
              >
                {txStatus}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
