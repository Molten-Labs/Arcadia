"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { TierBadge } from "@/components/TierBadge";
import { DepositsStatusBadge } from "@/components/DepositsStatusBadge";
import { NavHistoryChart } from "@/components/NavHistoryChart";
import { EmptyState } from "@/components/EmptyState";
import { apiFetch } from "@/lib/utils";
import { formatUSD, pnlClass, pnlArrow } from "@/lib/types";
import type { PortfolioItem } from "@/lib/types";
import { MOCK_TRADERS } from "@/lib/mock-data";

export default function InvestmentsPage() {
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
            Connect wallet to view your investments
          </p>
        </div>
      </div>
    );
  }

  if (!isLoading && (!data || data.length === 0)) {
    return (
      <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
        
        <div className="max-w-5xl mx-auto px-4 py-8">
          <h1 className="text-xl font-bold mb-6" style={{ color: "var(--color-ink)" }}>My Investments</h1>
          <EmptyState title="No investments yet" description="" cta={{ label: "Browse Traders", href: "/traders" }} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold mb-6" style={{ color: "var(--color-ink)" }}>
          My Investments
        </h1>

        <div className="space-y-4">
          {isLoading
            ? Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-xl h-40 animate-pulse"
                  style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
                />
              ))
            : data?.map((pos) => {
                const trader = MOCK_TRADERS.find((t) => t.handle === pos.trader_handle);
                const nav = (1.0 + (trader?.metrics.return_all ?? 0) / 100).toFixed(6);
                return (
                  <div
                    key={pos.profile}
                    className="rounded-xl p-5"
                    style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/t/${pos.trader_handle}`}
                            className="text-base font-bold hover:underline"
                            style={{ color: "var(--color-ink)" }}
                          >
                            @{pos.trader_handle}
                          </Link>
                          {trader && <TierBadge tier={trader.tier} />}
                          {trader && <DepositsStatusBadge deposits_open={trader.deposits_open} />}
                        </div>
                        <p className="text-xs" style={{ color: "var(--color-faint)" }}>
                          NAV {nav} · HWM {(parseFloat(nav) + 0.05).toFixed(6)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-bold tnum ${pnlClass(pos.roi_pct)}`}>
                          {pnlArrow(pos.roi_pct)} {Math.abs(pos.roi_pct).toFixed(1)}%
                        </p>
                        <p className="text-xs tnum" style={{ color: "var(--color-muted)" }}>
                          {formatUSD(pos.value_usd, 0)}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-xs mb-4">
                      {[
                        ["Shares", `${pos.shares.toLocaleString()} (your stake)`],
                        ["Cost", formatUSD(pos.cost_basis_usd, 0)],
                        ["PnL", (pos.pnl_usd >= 0 ? "+" : "") + formatUSD(pos.pnl_usd, 0)],
                      ].map(([k, v]) => (
                        <div key={k as string}>
                          <p style={{ color: "var(--color-faint)" }}>{k}</p>
                          <p
                            className="tnum font-medium"
                            style={{ color: k === "PnL" ? (pos.pnl_usd >= 0 ? "var(--color-green)" : "var(--color-red)") : "var(--color-ink)" }}
                          >
                            {v}
                          </p>
                        </div>
                      ))}
                    </div>

                    {trader && (
                      <NavHistoryChart
                        data={trader.equity_curve}
                        height={80}
                      />
                    )}

                    <div className="flex gap-2 mt-3">
                      {trader?.deposits_open && (
                        <Link
                          href={`/vault/${pos.profile}`}
                          className="text-xs px-3 py-1.5 rounded font-medium"
                          style={{ background: "var(--color-mint)", color: "#ffffff" }}
                        >
                          Deposit more
                        </Link>
                      )}
                      <Link
                        href={`/vault/${pos.profile}`}
                        className="text-xs px-3 py-1.5 rounded font-medium"
                        style={{ border: "1px solid var(--color-line)", color: "var(--color-muted)" }}
                      >
                        Withdraw
                      </Link>
                    </div>
                  </div>
                );
              })}
        </div>
      </div>
    </div>
  );
}
