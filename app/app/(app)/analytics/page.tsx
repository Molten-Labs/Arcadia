"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { ExternalLink, Wallet } from "lucide-react";

import { EquityChart } from "@/components/EquityChart";
import { PnLHeatmap } from "@/components/PnLHeatmap";
import {
  EnvChip,
  MicroLabel,
  PageHeader,
  Panel,
  StatTile,
} from "@/components/pages/trader/trader-ui";
import { RiskRadar } from "@/components/pages/discovery/RiskRadar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MOCK_DAILY_PNL, MOCK_TRADERS } from "@/lib/mock-data";
import { formatUSD } from "@/lib/types";

const DEMO = MOCK_TRADERS[0];

function pnlTone(n: number) {
  if (n > 0) return "text-success";
  if (n < 0) return "text-danger";
  return "text-muted";
}

export default function AnalyticsPage() {
  const { connected } = useWallet();

  if (!connected) {
    return (
      <div className="grid min-h-[70vh] place-items-center bg-void px-5">
        <Panel className="max-w-sm p-10 text-center">
          <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-acid/25 bg-acid/10">
            <Wallet size={24} className="text-acid" />
          </div>
          <p className="mb-2 text-base font-semibold text-ink">Connect wallet</p>
          <p className="text-sm text-faint">Connect your wallet to view analytics.</p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-void">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader title="Analytics">
          <EnvChip>@{DEMO.handle} — devnet simulation</EnvChip>
        </PageHeader>

        {/* Headline metrics */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Sharpe" value={DEMO.metrics.sharpe.toFixed(2)} />
          <StatTile label="Sortino" value={DEMO.metrics.sortino.toFixed(2)} />
          <StatTile label="Win Rate" value={`${DEMO.metrics.win_rate.toFixed(1)}%`} />
          <StatTile
            label="Avg Duration"
            value={`${DEMO.metrics.avg_trade_duration_hours.toFixed(1)}h`}
          />
        </div>

        {/* Equity + risk */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Panel className="group acid-int p-5 lg:col-span-2">
            <MicroLabel className="mb-4">Equity Curve — 90 days</MicroLabel>
            <EquityChart data={DEMO.equity_curve} height={200} />
          </Panel>

          <Panel className="group acid-int p-5">
            <MicroLabel className="mb-2">Risk Metrics</MicroLabel>
            <RiskRadar
              items={[
                {
                  label: "Sortino",
                  value: DEMO.metrics.sortino,
                  max: 5,
                  display: DEMO.metrics.sortino.toFixed(2),
                },
                {
                  label: "Sharpe",
                  value: DEMO.metrics.sharpe,
                  max: 4,
                  display: DEMO.metrics.sharpe.toFixed(2),
                },
                {
                  label: "Win Rate",
                  value: DEMO.metrics.win_rate,
                  max: 100,
                  display: `${DEMO.metrics.win_rate.toFixed(1)}%`,
                },
                {
                  label: "Volatility",
                  value: DEMO.metrics.vol_30d,
                  max: 30,
                  display: `${DEMO.metrics.vol_30d.toFixed(1)}%`,
                  tone: "muted",
                },
                {
                  label: "Max DD",
                  value: Math.abs(DEMO.metrics.max_dd),
                  max: 30,
                  display: `-${Math.abs(DEMO.metrics.max_dd).toFixed(1)}%`,
                  invert: true,
                },
              ]}
            />
            <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs">
              {(
                [
                  ["7d Return", DEMO.metrics.return_7d],
                  ["30d Return", DEMO.metrics.return_30d],
                  ["90d Return", DEMO.metrics.return_90d],
                  ["All-time", DEMO.metrics.return_all],
                ] as const
              ).map(([label, val]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-faint">{label}</span>
                  <span className={`font-mono font-medium tabular-nums ${pnlTone(val)}`}>
                    {val > 0 ? "▲" : val < 0 ? "▼" : "–"} {Math.abs(val).toFixed(1)}%
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* Trades / heatmap */}
        <Tabs defaultValue="trades">
          <TabsList>
            <TabsTrigger value="trades">Trade History</TabsTrigger>
            <TabsTrigger value="heatmap">P&amp;L Heatmap</TabsTrigger>
          </TabsList>

          <TabsContent value="trades">
            <Panel className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/10 bg-panel-2 px-4 py-3">
                <MicroLabel>Trade History</MicroLabel>
                <span className="rounded border border-white/10 bg-panel px-2 py-1 font-mono text-[0.6rem] text-faint">
                  {DEMO.trades.length} trades
                </span>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    {["Market", "Side", "Size", "Lev", "Entry", "Exit", "PnL", "Closed", "On-chain"].map(
                      (h) => (
                        <TableHead key={h}>{h}</TableHead>
                      ),
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {DEMO.trades.map((t) => (
                    <TableRow key={t.id} className="group">
                      <TableCell className="font-bold text-ink">{t.market}</TableCell>
                      <TableCell
                        className={`text-[0.65rem] font-black tracking-wider uppercase ${
                          t.direction === "long" ? "text-success" : "text-danger"
                        }`}
                      >
                        {t.direction}
                      </TableCell>
                      <TableCell className="tabular-nums">{formatUSD(t.size_usd, 0)}</TableCell>
                      <TableCell className="tabular-nums">{t.leverage}x</TableCell>
                      <TableCell className="tabular-nums text-muted transition-colors group-hover:text-ink motion-reduce:transition-none">
                        {t.entry_px < 10 ? t.entry_px.toFixed(4) : t.entry_px.toFixed(2)}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted transition-colors group-hover:text-ink motion-reduce:transition-none">
                        {t.exit_px < 10 ? t.exit_px.toFixed(4) : t.exit_px.toFixed(2)}
                      </TableCell>
                      <TableCell className={`font-bold tabular-nums ${pnlTone(t.realized_pnl)}`}>
                        {t.realized_pnl >= 0 ? "+" : ""}
                        {formatUSD(t.realized_pnl, 0)}
                      </TableCell>
                      <TableCell className="tabular-nums text-faint">
                        {new Date(t.closed_at * 1000).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {t.sig ? (
                          <a
                            href={`https://solscan.io/tx/${t.sig}?cluster=devnet`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 font-mono text-[0.6rem] text-cyan transition-opacity hover:opacity-70"
                            title={t.sig}
                          >
                            <span>{t.sig.slice(0, 6)}…</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span className="text-faint">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Panel>
          </TabsContent>

          <TabsContent value="heatmap">
            <Panel className="group acid-int p-5">
              <MicroLabel className="mb-5">Daily P&amp;L Heatmap</MicroLabel>
              <PnLHeatmap data={MOCK_DAILY_PNL["nova"] ?? []} />
            </Panel>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
