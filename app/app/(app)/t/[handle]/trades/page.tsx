"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, Download } from "lucide-react";

import { apiFetch, cn } from "@/lib/utils";
import { formatUSD, type TraderProfile } from "@/lib/types";
import { ErrorState } from "@/components/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageContainer, Panel, StatTile, signTone } from "@/components/pages/discovery/bits";
import { SideBadge, SolscanTxLink } from "@/components/pages/discovery/trade-cells";

type SortKey = "closed_at" | "pnl" | "size";

function SortIcon({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return <ArrowUpDown className="size-3 text-faint" aria-hidden />;
  return dir === "desc" ? (
    <ArrowDown className="size-3 text-acid" aria-hidden />
  ) : (
    <ArrowUp className="size-3 text-acid" aria-hidden />
  );
}

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
      <div className="min-h-full bg-void">
        <PageContainer>
          <Skeleton className="h-8 w-64" />
          <Skeleton className="mt-6 h-24 w-full" />
          <Skeleton className="mt-6 h-96 w-full" />
        </PageContainer>
      </div>
    );
  }

  if (error || !trader) {
    return (
      <div className="flex min-h-full items-center justify-center bg-void">
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
    else {
      setSort(key);
      setDir("desc");
    }
  };

  const handleExport = () => {
    const rows = [
      [
        "ID",
        "Market",
        "Side",
        "Size (USD)",
        "Leverage",
        "Entry",
        "Exit",
        "PnL (USD)",
        "Fees (USD)",
        "Opened",
        "Closed",
        "Signature",
      ],
      ...sorted.map((t) => [
        t.id,
        t.market,
        t.direction,
        t.size_usd.toFixed(2),
        t.leverage.toString(),
        t.entry_px.toFixed(4),
        t.exit_px.toFixed(4),
        t.realized_pnl.toFixed(2),
        t.fees_usd.toFixed(2),
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

  const stats: { label: string; value: string; tone?: string }[] = [
    { label: "Showing", value: sorted.length.toString() },
    {
      label: "Total P&L",
      value: `${totalPnl >= 0 ? "+" : ""}${formatUSD(totalPnl, 0)}`,
      tone: signTone(totalPnl),
    },
    { label: "Win Rate", value: `${winRate.toFixed(1)}%`, tone: signTone(winRate - 50) },
    { label: "Winners", value: `${wins}/${sorted.length}` },
  ];

  return (
    <div className="min-h-full bg-void">
      <PageContainer>
        {/* breadcrumb */}
        <div className="mb-8 flex items-center gap-3">
          <Link
            href={`/t/${handle}`}
            aria-label="Back to profile"
            className="grid size-8 place-items-center rounded-lg border border-line bg-panel text-faint transition-colors hover:bg-panel-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void"
          >
            <ArrowLeft className="size-3.5" aria-hidden />
          </Link>
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 font-mono text-[11px] font-bold tracking-[0.14em] text-faint uppercase"
          >
            <Link href="/traders" className="transition-colors hover:text-acid">
              Marketplace
            </Link>
            <span aria-hidden className="text-line">
              /
            </span>
            <Link href={`/t/${handle}`} className="transition-colors hover:text-acid">
              @{handle}
            </Link>
            <span aria-hidden className="text-line">
              /
            </span>
            <span className="text-ink">Trade History</span>
          </nav>
        </div>

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-extrabold tracking-tight text-ink">
              {`@${trader.handle} // Full Trade History`}
            </h1>
            <p className="mt-1 font-mono text-sm text-faint tabular-nums">
              {`${trader.trade_count.toLocaleString("en-US")} total trades // all closed positions`}
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel px-4 py-2 font-mono text-xs font-bold tracking-[0.08em] text-faint uppercase transition-colors hover:border-acid/40 hover:text-ink focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void"
          >
            <Download className="size-3.5" aria-hidden />
            Export CSV
          </button>
        </div>

        {/* stats strip */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          {stats.map((s) => (
            <StatTile key={s.label} label={s.label} valueClassName={s.tone} className="acid-int">
              {s.value}
            </StatTile>
          ))}
        </div>

        {/* market filter */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="Filter by market"
            className="flex flex-wrap gap-1 rounded-lg border border-line bg-panel p-1"
          >
            {markets.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMarketFilter(m)}
                aria-pressed={marketFilter === m}
                className={cn(
                  "rounded-md px-3 py-1.5 font-mono text-[10px] font-bold tracking-[0.14em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void",
                  marketFilter === m ? "bg-acid text-void" : "text-faint hover:text-ink",
                )}
              >
                {m === "all" ? "All" : m.replace("-PERP", "")}
              </button>
            ))}
          </div>
        </div>

        {/* table */}
        <Panel className="overflow-hidden">
          <Table className="min-w-[860px] text-xs">
            <TableHeader>
              <TableRow className="bg-panel-2 hover:bg-transparent">
                <TableHead>Market</TableHead>
                <TableHead>Side</TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => toggleSort("size")}
                    className="inline-flex items-center gap-1 uppercase focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                  >
                    Size <SortIcon active={sort === "size"} dir={dir} />
                  </button>
                </TableHead>
                <TableHead>Lev</TableHead>
                <TableHead>Entry</TableHead>
                <TableHead>Exit</TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => toggleSort("pnl")}
                    className="inline-flex items-center gap-1 uppercase focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                  >
                    PnL <SortIcon active={sort === "pnl"} dir={dir} />
                  </button>
                </TableHead>
                <TableHead>Fees</TableHead>
                <TableHead>
                  <button
                    type="button"
                    onClick={() => toggleSort("closed_at")}
                    className="inline-flex items-center gap-1 uppercase focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void"
                  >
                    Closed <SortIcon active={sort === "closed_at"} dir={dir} />
                  </button>
                </TableHead>
                <TableHead>Verify</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-bold text-ink">{t.market}</TableCell>
                  <TableCell>
                    <SideBadge direction={t.direction} />
                  </TableCell>
                  <TableCell className="text-muted tabular-nums">{formatUSD(t.size_usd, 0)}</TableCell>
                  <TableCell className="font-bold text-ink tabular-nums">{t.leverage}x</TableCell>
                  <TableCell className="text-muted tabular-nums">
                    {t.entry_px < 10 ? t.entry_px.toFixed(4) : t.entry_px.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-muted tabular-nums">
                    {t.exit_px < 10 ? t.exit_px.toFixed(4) : t.exit_px.toFixed(2)}
                  </TableCell>
                  <TableCell className={`font-bold tabular-nums ${signTone(t.realized_pnl)}`}>
                    {t.realized_pnl >= 0 ? "+" : ""}
                    {formatUSD(t.realized_pnl, 0)}
                  </TableCell>
                  <TableCell className="text-faint tabular-nums">{formatUSD(t.fees_usd, 2)}</TableCell>
                  <TableCell className="text-[10px] text-faint tabular-nums">
                    {new Date(t.closed_at * 1000).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <SolscanTxLink sig={t.sig} chars={4} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {sorted.length === 0 ? (
            <div className="py-16 text-center">
              <p className="text-sm text-faint">No trades match the current filter.</p>
            </div>
          ) : null}
        </Panel>

        <p className="mt-4 text-center font-mono text-[10px] text-faint">
          All transactions verifiable on Solana devnet via the on-chain column.
        </p>
      </PageContainer>
    </div>
  );
}
