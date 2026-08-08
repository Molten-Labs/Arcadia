"use client";

import { useWalletCompat } from "@/lib/use-wallet-compat";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { useMe } from "@/lib/hooks";
import { type TraderProfile, type DailyPnL } from "@/lib/types";

function pnlTone(n: number) {
  if (n > 0) return "text-success";
  if (n < 0) return "text-danger";
  return "text-muted";
}

export default function AnalyticsPage() {
  const { connected } = useWalletCompat();
  const { data: me } = useMe();
  const handle = me?.handle;

  const { data: trader } = useQuery<TraderProfile>({
    queryKey: ["trader", handle],
    queryFn: () => apiFetch(`/traders/${handle}`),
    enabled: connected && !!handle,
  });

  const { data: dailyPnl } = useQuery<DailyPnL[]>({
    queryKey: ["pnl-history", handle],
    queryFn: () => apiFetch(`/traders/${handle}/pnl-history?days=365`),
    enabled: connected && !!handle,
  });

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

  if (!handle) {
    return (
      <div className="grid min-h-[70vh] place-items-center bg-void px-5">
        <Panel className="max-w-sm p-10 text-center">
          <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-acid/25 bg-acid/10">
            <Wallet size={24} className="text-acid" />
          </div>
          <p className="mb-2 text-base font-semibold text-ink">No trader profile yet</p>
          <p className="text-sm text-faint">
            Create your trader profile from the terminal to unlock your analytics.
          </p>
        </Panel>
      </div>
    );
  }

  const metrics = trader?.metrics;
  const equityCurve = trader?.equity_curve ?? [];

  if (!trader) {
    return (
      <div className="min-h-full bg-void">
        <div className="mx-auto max-w-7xl px-4 py-8">
          <PageHeader title="Analytics">
            <EnvChip>@{handle}</EnvChip>
          </PageHeader>
          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Panel key={i} className="p-5">
                <Skeleton className="mb-3 h-3 w-16" />
                <Skeleton className="h-6 w-20" />
              </Panel>
            ))}
          </div>
          <Panel className="p-10 text-center text-sm text-faint">
            No analytics data available yet.
          </Panel>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-void">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <PageHeader title="Analytics">
          <EnvChip>@{handle}</EnvChip>
        </PageHeader>

        {/* Headline metrics */}
        <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatTile label="Sharpe" value={metrics!.sharpe.toFixed(2)} />
          <StatTile label="Sortino" value={metrics!.sortino.toFixed(2)} />
          <StatTile label="Win Rate" value={`${metrics!.win_rate.toFixed(1)}%`} />
          <StatTile
            label="Avg Duration"
            value={`${metrics!.avg_trade_duration_hours.toFixed(1)}h`}
          />
        </div>

        {/* Equity + risk */}
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Panel className="group acid-int p-5 lg:col-span-2">
            <MicroLabel className="mb-4">Equity Curve — 90 days</MicroLabel>
            <EquityChart data={equityCurve} height={200} />
          </Panel>

          <Panel className="group acid-int p-5">
            <MicroLabel className="mb-2">Risk Metrics</MicroLabel>
            <RiskRadar
              items={[
                {
                  label: "Sortino",
                  value: metrics!.sortino,
                  max: 5,
                  display: metrics!.sortino.toFixed(2),
                },
                {
                  label: "Sharpe",
                  value: metrics!.sharpe,
                  max: 4,
                  display: metrics!.sharpe.toFixed(2),
                },
                {
                  label: "Win Rate",
                  value: metrics!.win_rate,
                  max: 100,
                  display: `${metrics!.win_rate.toFixed(1)}%`,
                },
                {
                  label: "Volatility",
                  value: metrics!.vol_30d,
                  max: 30,
                  display: `${metrics!.vol_30d.toFixed(1)}%`,
                  tone: "muted",
                },
                {
                  label: "Max DD",
                  value: Math.abs(metrics!.max_dd),
                  max: 30,
                  display: `-${Math.abs(metrics!.max_dd).toFixed(1)}%`,
                  invert: true,
                },
              ]}
            />
            <div className="mt-4 space-y-2 border-t border-white/10 pt-4 text-xs">
              {(
                [
                  ["7d Return", metrics!.return_7d],
                  ["30d Return", metrics!.return_30d],
                  ["90d Return", metrics!.return_90d],
                  ["All-time", metrics!.return_all],
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

        {/* P&L heatmap */}
        <Panel className="group acid-int p-5">
          <MicroLabel className="mb-5">Daily P&amp;L Heatmap</MicroLabel>
          <PnLHeatmap data={dailyPnl ?? []} />
        </Panel>
      </div>
    </div>
  );
}
