"use client";

import Link from "next/link";
import { useWalletCompat } from "@/lib/use-wallet-compat";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight } from "lucide-react";

import { NavHistoryChart } from "@/components/NavHistoryChart";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CountUp } from "@/components/acid";
import { ConnectGate, PageHeader, PageShell } from "@/components/pages/investor/chrome";
import {
  InvestorEmptyState,
  Panel,
  PanelLabel,
  StatTile,
} from "@/components/pages/investor/surfaces";
import { DepositsBadge, TierChip } from "@/components/pages/investor/tier";
import { apiFetch } from "@/lib/utils";
import { formatUSD } from "@/lib/types";
import type { PortfolioItem, TraderProfile } from "@/lib/types";

function useTraderByHandle(handle: string | undefined) {
  return useQuery<TraderProfile>({
    queryKey: ["trader", handle],
    queryFn: () => apiFetch(`/traders/${handle}`),
    enabled: !!handle,
  });
}

function PositionPanel({ pos }: { pos: PortfolioItem }) {
  const { data: trader } = useTraderByHandle(pos.trader_handle);
  const nav = (1.0 + (trader?.metrics.return_all ?? 0) / 100).toFixed(6);
  return (
    <Panel key={pos.profile} className="group acid-int overflow-hidden p-5">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Link
              href={`/t/${pos.trader_handle}`}
              className="text-base font-bold text-ink hover:text-acid"
            >
              @{pos.trader_handle}
            </Link>
            {trader ? <TierChip tier={trader.tier} /> : null}
            {trader ? <DepositsBadge open={trader.deposits_open} /> : null}
          </div>
          <p className="font-mono text-xs tabular-nums text-faint">
            NAV {nav} · HWM {(parseFloat(nav) + 0.05).toFixed(6)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p
            className={`font-mono text-xl font-bold tracking-tight tabular-nums ${
              pos.roi_pct >= 0 ? "text-success" : "text-danger"
            }`}
          >
            {pos.roi_pct >= 0 ? "+" : "-"}
            {Math.abs(pos.roi_pct).toFixed(1)}%
          </p>
          <p className="font-mono text-xs tabular-nums text-muted">{formatUSD(pos.value_usd, 0)}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-3 gap-4 border-b border-line pb-4">
        {(
          [
            ["Shares", pos.shares.toLocaleString(), false],
            ["Cost", formatUSD(pos.cost_basis_usd, 0), false],
            ["PnL", (pos.pnl_usd >= 0 ? "+" : "") + formatUSD(pos.pnl_usd, 0), true],
          ] as const
        ).map(([label, val, isPnl]) => (
          <div key={label}>
            <PanelLabel className="mb-1">{label}</PanelLabel>
            <p
              className={`font-mono text-sm font-semibold tabular-nums ${
                isPnl ? (pos.pnl_usd >= 0 ? "text-success" : "text-danger") : "text-ink"
              }`}
            >
              {val}
            </p>
          </div>
        ))}
      </div>

      {trader ? <NavHistoryChart data={trader.equity_curve} height={72} /> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {trader?.deposits_open ? (
          <Button asChild size="sm">
            <Link href={`/vault/${pos.trader_handle}`}>
              Deposit more <ArrowUpRight className="size-3" />
            </Link>
          </Button>
        ) : null}
        <Button asChild size="sm" variant="secondary">
          <Link href={`/vault/${pos.trader_handle}`}>Withdraw</Link>
        </Button>
        <Button asChild size="sm" variant="secondary">
          <Link href={`/t/${pos.trader_handle}`}>
            Profile <ArrowUpRight className="size-3" />
          </Link>
        </Button>
      </div>
    </Panel>
  );
}

interface FlowRecord {
  signature: string;
  profile: string;
  trader_handle: string;
  is_trader: boolean;
  kind: string;
  amount_usd: string;
  shares: string;
  nav_per_share: string;
  ts: string;
}

function signed(value: string, positive: boolean) {
  return <span className={positive ? "text-success" : "text-danger"}>{value}</span>;
}

export default function PortfolioPage() {
  const { connected, publicKey } = useWalletCompat();

  const { data, isLoading } = useQuery<PortfolioItem[]>({
    queryKey: ["portfolio", publicKey?.toBase58()],
    queryFn: () => apiFetch(`/investors/${publicKey?.toBase58()}/portfolio`),
    enabled: !!publicKey,
  });

  const { data: flows } = useQuery<FlowRecord[]>({
    queryKey: ["flows", publicKey?.toBase58()],
    queryFn: () => apiFetch(`/investors/${publicKey?.toBase58()}/flows`),
    enabled: !!publicKey,
  });

  if (!connected) {
    return (
      <ConnectGate
        title="Connect your wallet"
        description="Connect to view your portfolio, positions, and transaction activity."
      />
    );
  }

  const totalInvested = data?.reduce((a, p) => a + p.cost_basis_usd, 0) ?? 0;
  const totalValue = data?.reduce((a, p) => a + p.value_usd, 0) ?? 0;
  const totalPnl = totalValue - totalInvested;
  const totalRoi = totalInvested > 0 ? (totalPnl / totalInvested) * 100 : 0;
  const pendingSettle = 1000;

  return (
    <PageShell width="mid">
      <PageHeader
        kicker="Investor"
        title="Portfolio"
        subtitle="All your vault positions in one place"
      />

      {/* Summary */}
      <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Panel key={i} className="p-5">
              <Skeleton className="mb-3 h-3 w-20" />
              <Skeleton className="h-7 w-28" />
            </Panel>
          ))
        ) : (
          <>
            <StatTile label="Invested" value={<CountUp value={totalInvested} prefix="$" />} />
            <StatTile label="Current value" value={<CountUp value={totalValue} prefix="$" />} />
            <StatTile
              label="Total PnL"
              value={signed((totalPnl >= 0 ? "+" : "") + formatUSD(totalPnl, 0), totalPnl >= 0)}
            />
            <StatTile
              label="ROI"
              value={signed((totalRoi >= 0 ? "+" : "") + totalRoi.toFixed(2) + "%", totalRoi >= 0)}
            />
          </>
        )}
      </div>

      <Tabs defaultValue="overview" className="gap-0">
        <TabsList className="mb-6">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="positions">Positions</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        {/* ── Overview ── */}
        <TabsContent value="overview" className="space-y-4">
          {isLoading ? (
            Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)
          ) : !data || data.length === 0 ? (
            <InvestorEmptyState
              title="No positions yet"
              description="You haven't funded any traders yet"
              cta={{ label: "Browse Traders", href: "/traders" }}
            />
          ) : (
            data.map((pos) => (
              <PositionPanel key={pos.profile} pos={pos} />
            ))
          )}
        </TabsContent>

        {/* ── Positions ── */}
        <TabsContent value="positions">
          {!data || data.length === 0 ? (
            <InvestorEmptyState title="No positions" cta={{ label: "Browse Traders", href: "/traders" }} />
          ) : (
            <Panel className="overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trader</TableHead>
                    <TableHead className="text-right">Shares</TableHead>
                    <TableHead className="text-right">Cost basis</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                    <TableHead className="text-right">PnL</TableHead>
                    <TableHead className="text-right">ROI</TableHead>
                    <TableHead className="text-right" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading
                    ? Array.from({ length: 3 }).map((_, i) => (
                        <TableRow key={i}>
                          {Array.from({ length: 7 }).map((__, j) => (
                            <TableCell key={j}>
                              <Skeleton className="h-3 w-3/5" />
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    : data.map((pos) => (
                        <TableRow key={pos.profile} className="group">
                          <TableCell>
                            <Link href={`/t/${pos.trader_handle}`} className="font-semibold text-ink hover:text-acid">
                              @{pos.trader_handle}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted transition-colors group-hover:text-ink motion-reduce:transition-none">
                            {pos.shares.toLocaleString()}
                          </TableCell>
                          <TableCell className="text-right tabular-nums text-muted transition-colors group-hover:text-ink motion-reduce:transition-none">
                            {formatUSD(pos.cost_basis_usd, 0)}
                          </TableCell>
                          <TableCell className="text-right font-semibold tabular-nums text-ink">
                            {formatUSD(pos.value_usd, 0)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold tabular-nums ${
                              pos.pnl_usd >= 0 ? "text-success" : "text-danger"
                            }`}
                          >
                            {pos.pnl_usd >= 0 ? "+" : "-"}
                            {formatUSD(Math.abs(pos.pnl_usd), 0)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-semibold tabular-nums ${
                              pos.roi_pct >= 0 ? "text-success" : "text-danger"
                            }`}
                          >
                            {pos.roi_pct >= 0 ? "+" : "-"}
                            {Math.abs(pos.roi_pct).toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right">
                            <Button asChild size="sm" variant="secondary">
                              <Link href={`/vault/${pos.profile}`}>Manage</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                </TableBody>
              </Table>
            </Panel>
          )}
        </TabsContent>

        {/* ── Activity ── */}
        <TabsContent value="activity">
          <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3">
            <StatTile
              label="Total PnL"
              value={signed((totalPnl >= 0 ? "+" : "") + formatUSD(totalPnl, 0), totalPnl >= 0)}
            />
            <StatTile
              label="ROI"
              value={signed((totalRoi >= 0 ? "+" : "") + totalRoi.toFixed(1) + "%", totalRoi >= 0)}
            />
            <StatTile label="Pending settlement" value={formatUSD(pendingSettle, 0)} delta="Next daily window" />
          </div>

          <Panel className="mb-6 overflow-hidden">
            <div className="border-b border-line bg-panel-2 px-4 py-3">
              <PanelLabel>Transaction History</PanelLabel>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Trader</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Signature</TableHead>
                  <TableHead className="text-right">When</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {!flows || flows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-faint">
                      No activity yet
                    </TableCell>
                  </TableRow>
                ) : flows.map((row, i) => {
                  const positive = row.kind !== "withdraw";
                  const kindLabel = row.kind === "deposit" ? "Deposit" : row.kind === "withdraw" ? "Withdraw" : row.kind === "settle" ? "Settle" : row.kind;
                  const status = row.kind === "withdraw" ? "Awaiting window" : "Confirmed";
                  const ts = row.ts ? new Date(row.ts).toLocaleDateString() : "—";
                  const sig = row.signature ?? "—";
                  return (
                    <TableRow key={i} className="group">
                      <TableCell className="font-sans text-muted transition-colors group-hover:text-ink motion-reduce:transition-none">{kindLabel}</TableCell>
                      <TableCell>
                        <Link href={`/t/${row.trader_handle}`} className="text-acid hover:underline">
                          @{row.trader_handle}
                        </Link>
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold tabular-nums ${
                          positive ? "text-success" : "text-danger"
                        }`}
                      >
                        {positive ? "+" : "-"}
                        {formatUSD(parseFloat(row.amount_usd), 0)}
                      </TableCell>
                      <TableCell
                        className={positive ? "text-success" : "text-tier-advanced"}
                      >
                        {status}
                      </TableCell>
                      <TableCell className={sig !== "—" ? "text-acid" : "text-faint"}>{sig.slice(0, 8)}…</TableCell>
                      <TableCell className="text-right tabular-nums text-faint">{ts}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Panel>

          <Panel className="p-4 text-xs leading-relaxed text-muted">
            <strong className="text-ink">Withdrawal policy:</strong> Any portion, anytime, at prevailing NAV.
            Value &lt;5% of vault AUM = instant (next tick). Larger = next daily settlement window. No lockups, no
            penalties. Queued withdrawals show &quot;Awaiting window&quot; until the settlement window is reached.
          </Panel>
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
