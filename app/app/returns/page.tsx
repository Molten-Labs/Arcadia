"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { StatCard } from "@/components/StatCard";
import { apiFetch } from "@/lib/utils";
import { formatUSD, pnlClass, pnlArrow } from "@/lib/types";
import type { PortfolioItem } from "@/lib/types";

const TX_HISTORY = [
  { type: "Deposit", trader: "@nova", amount: 6000, status: "Confirmed", sig: "3aZ…", ts: "32d ago", is_positive: true },
  { type: "Deposit", trader: "@vega", amount: 6000, status: "Confirmed", sig: "5pN…", ts: "28d ago", is_positive: true },
  { type: "Settle", trader: "@nova", amount: 590, status: "Settled", sig: "8mC…", ts: "1d ago", is_positive: true },
  { type: "Withdraw request", trader: "@vega", amount: 1000, status: "Awaiting window", sig: "—", ts: "2h ago", is_positive: false },
];

export default function ReturnsPage() {
  const { connected, publicKey } = useWallet();

  const { data } = useQuery<PortfolioItem[]>({
    queryKey: ["portfolio", publicKey?.toBase58()],
    queryFn: () => apiFetch(`/investors/${publicKey?.toBase58()}/portfolio`),
    enabled: !!publicKey,
  });

  const totalPnl = data?.reduce((a, p) => a + p.pnl_usd, 0) ?? 0;
  const totalRoi = data?.length
    ? (totalPnl / data.reduce((a, p) => a + p.cost_basis_usd, 0)) * 100
    : 0;

  if (!connected) {
    return (
      <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
        
        <div className="flex items-center justify-center min-h-[60vh]">
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Connect wallet to view returns
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-xl font-bold mb-6" style={{ color: "var(--color-ink)" }}>
          Returns
        </h1>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <StatCard
            label="Total PnL"
            value={(totalPnl >= 0 ? "+" : "") + formatUSD(totalPnl, 0)}
            deltaPositive={totalPnl >= 0}
          />
          <StatCard
            label="ROI"
            value={(totalRoi >= 0 ? "+" : "") + totalRoi.toFixed(1) + "%"}
            deltaPositive={totalRoi >= 0}
          />
          <StatCard
            label="Pending settlement"
            value={formatUSD(1000)}
            delta="≈11% of vault → daily window"
          />
        </div>

        <div
          className="rounded-xl overflow-hidden mb-6"
          style={{ border: "1px solid var(--color-line)" }}
        >
          <div className="px-4 py-3" style={{ background: "var(--color-panel-2)", borderBottom: "1px solid var(--color-line)" }}>
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-faint)" }}>
              Transaction History
            </p>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--color-line)", background: "var(--color-panel)" }}>
                {["Type", "Trader", "Amount", "Status", "Signature", "When"].map((h) => (
                  <th key={h} className="py-2.5 px-4 text-left font-medium" style={{ color: "var(--color-faint)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TX_HISTORY.map((row, i) => (
                <tr
                  key={i}
                  style={{ background: "var(--color-panel)", borderBottom: "1px solid var(--color-line)" }}
                >
                  <td className="py-3 px-4">{row.type}</td>
                  <td className="py-3 px-4">
                    <Link
                      href={`/t/${row.trader.replace("@", "")}`}
                      className="hover:underline"
                      style={{ color: "var(--color-muted)" }}
                    >
                      {row.trader}
                    </Link>
                  </td>
                  <td className={`py-3 px-4 tnum font-medium ${pnlClass(row.is_positive ? 1 : -1)}`}>
                    {row.is_positive ? "+" : "-"}{formatUSD(row.amount, 0)}
                  </td>
                  <td className="py-3 px-4" style={{ color: row.status === "Confirmed" || row.status === "Settled" ? "var(--color-green)" : "var(--color-gold)" }}>
                    {row.status}
                  </td>
                  <td className="py-3 px-4 font-mono" style={{ color: "var(--color-mint)" }}>
                    {row.sig !== "—" ? (
                      <span>{row.sig}→explorer</span>
                    ) : (
                      <span style={{ color: "var(--color-faint)" }}>—</span>
                    )}
                  </td>
                  <td className="py-3 px-4 tnum" style={{ color: "var(--color-faint)" }}>
                    {row.ts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div
          className="rounded-xl p-4 text-xs leading-relaxed"
          style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)", color: "var(--color-muted)" }}
        >
          <strong style={{ color: "var(--color-ink)" }}>Withdrawal policy:</strong> Any portion, anytime, at prevailing NAV. Value &lt;5% of vault AUM = instant (next tick). Larger = next daily settlement window. No lockups, no penalties. Queued withdrawals show "Awaiting window" until the settlement window is reached, then{" "}
          <code className="font-mono" style={{ color: "var(--color-mint)" }}>process_withdraw()</code> becomes available.
        </div>
      </div>
    </div>
  );
}
