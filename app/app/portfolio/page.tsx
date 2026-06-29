"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/StatCard";
import { SkeletonStatCard } from "@/components/SkeletonCard";
import { EmptyState } from "@/components/EmptyState";
import { apiFetch } from "@/lib/utils";
import { formatUSD, pnlClass, pnlArrow } from "@/lib/types";
import type { PortfolioItem } from "@/lib/types";

export default function PortfolioPage() {
  const { connected, publicKey } = useWallet();

  const { data, isLoading } = useQuery<PortfolioItem[]>({
    queryKey: ["portfolio", publicKey?.toBase58()],
    queryFn: () => apiFetch(`/investors/${publicKey?.toBase58()}/portfolio`),
    enabled: !!publicKey,
  });

  if (!connected) {
    return (
      <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
        
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Connect wallet to view your portfolio
          </p>
        </div>
      </div>
    );
  }

  const totalInvested = data?.reduce((a, p) => a + p.cost_basis_usd, 0) ?? 0;
  const totalValue = data?.reduce((a, p) => a + p.value_usd, 0) ?? 0;
  const totalPnl = totalValue - totalInvested;
  const totalRoi = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold mb-6" style={{ color: "var(--color-ink)" }}>
          Portfolio
          <span className="text-xs font-normal ml-2" style={{ color: "var(--color-faint)" }}>
            one account · many traders
          </span>
        </h1>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {isLoading
            ? Array.from({ length: 4 }).map((_, i) => <SkeletonStatCard key={i} />)
            : [
                { label: "Invested", value: formatUSD(totalInvested, 0) },
                { label: "Value", value: formatUSD(totalValue, 0) },
                { label: "Total PnL", value: (totalPnl >= 0 ? "+" : "") + formatUSD(totalPnl, 0), delta: totalPnl >= 0 ? undefined : undefined, deltaPositive: totalPnl >= 0 },
                { label: "ROI", value: (totalRoi >= 0 ? "+" : "") + totalRoi.toFixed(1) + "%", deltaPositive: totalRoi >= 0 },
              ].map((s) => (
                <StatCard key={s.label} label={s.label} value={s.value} deltaPositive={s.deltaPositive} />
              ))}
        </div>

        {!isLoading && (!data || data.length === 0) ? (
          <EmptyState
            title="No positions yet"
            description="You haven't funded any traders yet"
            cta={{ label: "Browse Traders", href: "/traders" }}
          />
        ) : (
          <div
            className="rounded-xl overflow-hidden"
            style={{ border: "1px solid var(--color-line)" }}
          >
            <div className="px-4 py-3" style={{ background: "var(--color-panel-2)", borderBottom: "1px solid var(--color-line)" }}>
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-faint)" }}>
                Positions (one row per trader you fund)
              </p>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--color-line)", background: "var(--color-panel)" }}>
                  {["Trader", "Shares (your stake)", "Cost", "Value", "PnL", "ROI", ""].map((h) => (
                    <th key={h} className="py-2.5 px-4 text-left font-medium" style={{ color: "var(--color-faint)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data?.map((pos) => (
                  <tr
                    key={pos.profile}
                    style={{ background: "var(--color-panel)", borderBottom: "1px solid var(--color-line)" }}
                    className="hover:bg-[var(--color-panel-2)]"
                  >
                    <td className="py-3 px-4">
                      <Link href={`/t/${pos.trader_handle}`} className="font-medium hover:underline" style={{ color: "var(--color-ink)" }}>
                        @{pos.trader_handle}
                      </Link>
                    </td>
                    <td className="py-3 px-4 tnum">{pos.shares.toLocaleString()}</td>
                    <td className="py-3 px-4 tnum">{formatUSD(pos.cost_basis_usd, 0)}</td>
                    <td className="py-3 px-4 tnum font-medium" style={{ color: "var(--color-ink)" }}>
                      {formatUSD(pos.value_usd, 0)}
                    </td>
                    <td className={`py-3 px-4 tnum font-medium ${pnlClass(pos.pnl_usd)}`}>
                      {pnlArrow(pos.pnl_usd)} {formatUSD(Math.abs(pos.pnl_usd), 0)}
                    </td>
                    <td className={`py-3 px-4 tnum font-medium ${pnlClass(pos.roi_pct)}`}>
                      {pnlArrow(pos.roi_pct)} {Math.abs(pos.roi_pct).toFixed(1)}%
                    </td>
                    <td className="py-3 px-4">
                      <Link
                        href={`/vault/${pos.profile}`}
                        className="text-xs px-2.5 py-1 rounded"
                        style={{ border: "1px solid var(--color-line)", color: "var(--color-muted)" }}
                      >
                        Manage
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
