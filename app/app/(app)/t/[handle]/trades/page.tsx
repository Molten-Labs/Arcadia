"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import { pnlClass, formatUSD } from "@/lib/types";
import type { TraderProfile } from "@/lib/types";
import { ErrorState } from "@/components/ErrorState";
import { ArrowLeft, ExternalLink, Download } from "lucide-react";

type SortKey = "closed_at" | "pnl" | "size";

export default function TradeHistoryPage() {
  const params = useParams();
  const handle = params?.handle as string;
  const [sort, setSort] = useState<SortKey>("closed_at");
  const [dir, setDir] = useState<"asc" | "desc">("desc");
  const [marketFilter, setMarketFilter] = useState<string>("all");

  const { data: trader, isLoading, error, refetch } = useQuery<TraderProfile>({
    queryKey: ["trader", handle],
    queryFn: () => apiFetch(`/traders/${handle}`),
    enabled: !!handle,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg)" }}>
        <div className="animate-pulse h-8 w-48 rounded" style={{ background: "var(--color-panel-2)" }} />
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

  const markets = ["all", ...Array.from(new Set(trader.trades.map((t) => t.market)))];

  const sorted = [...trader.trades]
    .filter((t) => marketFilter === "all" || t.market === marketFilter)
    .sort((a, b) => {
      let diff = 0;
      if (sort === "closed_at") diff = a.closed_at - b.closed_at;
      if (sort === "pnl") diff = a.realized_pnl - b.realized_pnl;
      if (sort === "size") diff = a.size_usd - b.size_usd;
      return dir === "desc" ? -diff : diff;
    });

  const totalPnl = sorted.reduce((sum, t) => sum + t.realized_pnl, 0);
  const wins = sorted.filter((t) => t.realized_pnl > 0).length;
  const winRate = sorted.length > 0 ? (wins / sorted.length) * 100 : 0;

  const toggleSort = (key: SortKey) => {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSort(key); setDir("desc"); }
  };

  const sortIcon = (key: SortKey) => {
    if (sort !== key) return <span style={{ color: "var(--color-faint)" }}>⇅</span>;
    return <span style={{ color: "var(--color-accent)" }}>{dir === "desc" ? "↓" : "↑"}</span>;
  };

  const handleExport = () => {
    const rows = [
      ["ID", "Market", "Side", "Size (USD)", "Leverage", "Entry", "Exit", "PnL (USD)", "Fees (USD)", "Opened", "Closed", "Signature"],
      ...sorted.map((t) => [
        t.id, t.market, t.direction,
        t.size_usd.toFixed(2), t.leverage.toString(),
        t.entry_px.toFixed(4), t.exit_px.toFixed(4),
        t.realized_pnl.toFixed(2), t.fees_usd.toFixed(2),
        new Date(t.opened_at * 1000).toISOString(),
        new Date(t.closed_at * 1000).toISOString(),
        t.sig ?? "",
      ]),
    ];
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `arcadia_${handle}_trades.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-[1400px] mx-auto px-6 py-10">

        {/* Breadcrumb */}
        <div className="flex items-center gap-3 mb-8">
          <Link
            href={`/t/${handle}`}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-[var(--color-panel-2)]"
            style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)", color: "var(--color-faint)" }}
          >
            <ArrowLeft size={14} />
          </Link>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>
            <Link href="/traders" className="hover:text-[var(--color-mint)] transition-colors">Marketplace</Link>
            <span style={{ color: "var(--color-line)" }}>/</span>
            <Link href={`/t/${handle}`} className="hover:text-[var(--color-mint)] transition-colors">@{handle}</Link>
            <span style={{ color: "var(--color-line)" }}>/</span>
            <span style={{ color: "var(--color-ink)" }}>Trade History</span>
          </div>
        </div>

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black tracking-tight" style={{ color: "var(--color-ink)" }}>
              @{trader.handle} — Full Trade History
            </h1>
            <p className="text-sm mt-1" style={{ color: "var(--color-faint)" }}>
              {trader.trade_count.toLocaleString()} total trades · All closed positions
            </p>
          </div>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all"
            style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)", color: "var(--color-faint)" }}
          >
            <Download size={13} />
            Export CSV
          </button>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Showing", value: sorted.length.toString() },
            { label: "Total P&L", value: `${totalPnl >= 0 ? "+" : ""}${formatUSD(totalPnl, 0)}`, color: totalPnl >= 0 ? "var(--color-green)" : "var(--color-red)" },
            { label: "Win Rate", value: `${winRate.toFixed(1)}%`, color: winRate > 50 ? "var(--color-green)" : "var(--color-red)" },
            { label: "Winners", value: `${wins}/${sorted.length}` },
          ].map((s) => (
            <div key={s.label} className="rounded-xl p-4" style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}>
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--color-faint)" }}>{s.label}</p>
              <p className="text-xl font-black tnum" style={{ color: (s as { color?: string }).color ?? "var(--color-ink)" }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="flex gap-1 p-1 rounded-lg" style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}>
            {markets.map((m) => (
              <button
                key={m}
                onClick={() => setMarketFilter(m)}
                className="px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-widest transition-all"
                style={{
                  background: marketFilter === m ? "var(--color-accent)" : "transparent",
                  color: marketFilter === m ? "var(--color-bg)" : "var(--color-faint)",
                }}
              >
                {m === "all" ? "All" : m.replace("-PERP", "")}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--color-line)" }}>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ background: "var(--color-panel-2)", borderBottom: "1px solid var(--color-line)" }}>
                  <th className="py-3 px-4 text-left font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>Market</th>
                  <th className="py-3 px-4 text-left font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>Side</th>
                  <th
                    className="py-3 px-4 text-left font-bold uppercase tracking-widest cursor-pointer select-none"
                    style={{ color: "var(--color-faint)" }}
                    onClick={() => toggleSort("size")}
                  >
                    Size {sortIcon("size")}
                  </th>
                  <th className="py-3 px-4 text-left font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>Lev</th>
                  <th className="py-3 px-4 text-left font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>Entry</th>
                  <th className="py-3 px-4 text-left font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>Exit</th>
                  <th
                    className="py-3 px-4 text-left font-bold uppercase tracking-widest cursor-pointer select-none"
                    style={{ color: "var(--color-faint)" }}
                    onClick={() => toggleSort("pnl")}
                  >
                    PnL {sortIcon("pnl")}
                  </th>
                  <th className="py-3 px-4 text-left font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>Fees</th>
                  <th
                    className="py-3 px-4 text-left font-bold uppercase tracking-widest cursor-pointer select-none"
                    style={{ color: "var(--color-faint)" }}
                    onClick={() => toggleSort("closed_at")}
                  >
                    Closed {sortIcon("closed_at")}
                  </th>
                  <th className="py-3 px-4 text-left font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>Verify</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => (
                  <tr
                    key={t.id}
                    className="hover:bg-[var(--color-panel-2)] transition-colors"
                    style={{ background: "var(--color-panel)", borderBottom: "1px solid var(--color-line)" }}
                  >
                    <td className="py-2.5 px-4 font-bold font-mono" style={{ color: "var(--color-ink)" }}>{t.market}</td>
                    <td className="py-2.5 px-4">
                      <span
                        className="text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded"
                        style={{
                          background: t.direction === "long" ? "var(--color-green-dim)" : "var(--color-red-dim)",
                          color: t.direction === "long" ? "var(--color-green)" : "var(--color-red)",
                        }}
                      >
                        {t.direction}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 tnum">{formatUSD(t.size_usd, 0)}</td>
                    <td className="py-2.5 px-4 tnum font-bold" style={{ color: "var(--color-ink)" }}>{t.leverage}x</td>
                    <td className="py-2.5 px-4 tnum" style={{ color: "var(--color-muted)" }}>
                      {t.entry_px < 10 ? t.entry_px.toFixed(4) : t.entry_px.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 tnum" style={{ color: "var(--color-muted)" }}>
                      {t.exit_px < 10 ? t.exit_px.toFixed(4) : t.exit_px.toFixed(2)}
                    </td>
                    <td className={`py-2.5 px-4 tnum font-bold ${pnlClass(t.realized_pnl)}`}>
                      {t.realized_pnl >= 0 ? "+" : ""}{formatUSD(t.realized_pnl, 0)}
                    </td>
                    <td className="py-2.5 px-4 tnum" style={{ color: "var(--color-faint)" }}>
                      {formatUSD(t.fees_usd, 2)}
                    </td>
                    <td className="py-2.5 px-4 tnum font-mono text-[10px]" style={{ color: "var(--color-faint)" }}>
                      {new Date(t.closed_at * 1000).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-4">
                      {t.sig ? (
                        <a
                          href={`https://solscan.io/tx/${t.sig}?cluster=devnet`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 font-mono text-[10px] transition-opacity hover:opacity-70"
                          style={{ color: "var(--color-mint)" }}
                          title={`View on Solscan: ${t.sig}`}
                        >
                          <span>{t.sig.slice(0, 4)}…</span>
                          <ExternalLink size={9} />
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

          {sorted.length === 0 && (
            <div className="py-16 text-center">
              <p className="text-sm" style={{ color: "var(--color-faint)" }}>No trades match the current filter.</p>
            </div>
          )}
        </div>

        <p className="text-[10px] mt-4 text-center" style={{ color: "var(--color-faint)" }}>
          All transactions verifiable on Solana devnet · Click "Verify" column links to view on Solscan
        </p>
      </div>
    </div>
  );
}
