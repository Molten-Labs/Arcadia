"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronRight, Shield, TrendingUp, Wallet } from "lucide-react";

import { CountUp } from "@/components/acid/CountUp";
import { ScoreDial } from "@/components/acid/ScoreDial";
import { PnLHeatmap } from "@/components/PnLHeatmap";
import { ScoreHistoryChart } from "@/components/ScoreHistoryChart";
import { TierChip } from "@/components/pages/trader/TierChip";
import {
  EnvChip,
  MicroLabel,
  PageHeader,
  Panel,
  StatTile,
} from "@/components/pages/trader/trader-ui";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/utils";
import { useMe } from "@/lib/hooks";
import type { ScoreTier, ScorePoint, DailyPnL, TraderProfile, TraderClassification } from "@/lib/types";
import { ClassificationBadgeSet } from "@/components/pages/trader/trader-ui";

const TIERS = [
  { tier: "Verified" as const, range: "600–699", profit: 20, capacity: "×$1k/pt" },
  { tier: "Established" as const, range: "700–799", profit: 25, capacity: "×$1k/pt" },
  { tier: "Advanced" as const, range: "800–899", profit: 30, capacity: "×$1k/pt" },
  { tier: "Elite" as const, range: "900+", profit: 35, capacity: "×$1k/pt" },
];

const SCORE_WEIGHTS = [
  { label: "Win consistency", weight: 30, value: 94, desc: "Win-rate stability across 90-day rolling windows" },
  { label: "Risk-adjusted return", weight: 30, value: 91, desc: "Sortino ratio normalized against peer cohort" },
  { label: "Drawdown control", weight: 25, value: 88, desc: "Max DD & recovery speed vs. cohort average" },
  { label: "Trade volume", weight: 15, value: 82, desc: "Trade count weighted by market diversity" },
];

const MILESTONES = [
  { score: 600, label: "Fundable", reached: true },
  { score: 700, label: "Established", reached: true },
  { score: 800, label: "Advanced", reached: true },
  { score: 900, label: "Elite", reached: true },
  { score: 950, label: "Top 1%", reached: false },
];

const TIER_ACCENT: Record<ScoreTier, { text: string; dot: string; ring: string }> = {
  Verified: { text: "text-tier-verified", dot: "bg-tier-verified", ring: "border-tier-verified/40 bg-tier-verified/[0.07]" },
  Established: { text: "text-tier-established", dot: "bg-tier-established", ring: "border-tier-established/40 bg-tier-established/[0.07]" },
  Advanced: { text: "text-tier-advanced", dot: "bg-tier-advanced", ring: "border-tier-advanced/40 bg-tier-advanced/[0.07]" },
  Elite: { text: "text-tier-elite", dot: "bg-tier-elite", ring: "border-tier-elite/40 bg-tier-elite/[0.07]" },
};

export default function ReputationPage() {
  const { connected } = useWallet();
  const { data: me } = useMe();
  const handle = me?.handle;

  const { data: trader } = useQuery<TraderProfile>({
    queryKey: ["trader", handle],
    queryFn: () => apiFetch(`/traders/${handle}`),
    enabled: !!handle,
  });

  const { data: scoreHistory } = useQuery<ScorePoint[]>({
    queryKey: ["score-history", handle],
    queryFn: () => apiFetch(`/traders/${handle}/score-history?limit=180`),
    enabled: !!handle,
  });

  const { data: dailyPnl } = useQuery<DailyPnL[]>({
    queryKey: ["pnl-history", handle],
    queryFn: () => apiFetch(`/traders/${handle}/pnl-history?days=365`),
    enabled: !!handle,
  });

  const { data: classification } = useQuery<TraderClassification>({
    queryKey: ["classification", handle],
    queryFn: () => apiFetch(`/traders/${handle}/classification`),
    enabled: !!handle,
    staleTime: 120_000,
  });

  const score = trader?.score ?? 0;
  const tier = trader?.tier ?? "Verified";
  const confidence = trader?.confidence ?? "low";
  const ci = trader?.ci ?? { lo: 0, point: 0, hi: 0 };
  const capacity_usd = trader?.capacity.total ?? 0;
  const tradeCount = trader?.trades.length ?? 0;
  const tierLabel = tier as ScoreTier;

  if (!connected) {
    return (
      <div className="grid min-h-[70vh] place-items-center bg-void px-5">
        <Panel className="max-w-sm p-10 text-center">
          <div className="mx-auto mb-5 grid size-14 place-items-center rounded-full border border-acid/25 bg-acid/10">
            <Wallet size={24} className="text-acid" />
          </div>
          <p className="mb-2 text-base font-semibold text-ink">Connect wallet</p>
          <p className="text-sm text-faint">
            Connect Phantom or Solflare to view your reputation.
          </p>
        </Panel>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-void">
      <div className="mx-auto max-w-5xl px-5 py-8">
        <PageHeader title="Reputation" icon={<Shield size={18} />}>
          <EnvChip>
            <Bell size={11} className="text-acid" />
            Milestone alerts on
          </EnvChip>
        </PageHeader>

        {/* Score hero + capacity */}
        <div className="mb-6 grid grid-cols-1 gap-5 md:grid-cols-3">
          <Panel
            className="group acid-int flex flex-col items-center justify-center gap-3 p-6"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(204,255,0,0.08) 0%, transparent 70%)",
            }}
          >
            <ScoreDial value={score} tier={tier.toLowerCase() as "elite" | "advanced" | "established" | "verified"} size={140} />
            <div className="flex flex-wrap items-center justify-center gap-2">
              <TierChip tier={tierLabel} />
              <span className="rounded-full border border-success/25 bg-success/10 px-2 py-0.5 font-mono text-[0.6rem] tracking-wider text-success uppercase">
                {confidence} confidence
              </span>
            </div>
            {classification ? (
              <ClassificationBadgeSet data={classification} className="mt-2 justify-center" />
            ) : null}
            <p className="font-mono text-[0.7rem] tabular-nums text-faint">
              95% CI: [{ci.lo} – {ci.hi}]
            </p>
          </Panel>

          <div className="grid grid-cols-2 gap-3 md:col-span-2">
            <StatTile label="Arcadia Score" value={<CountUp value={score} />} accent />
            <StatTile
              label="Vault Capacity"
              value={<CountUp value={capacity_usd / 1000} prefix="$" suffix="k" />}
              sub={`${score} × $1,000`}
            />
            <StatTile label="Total Trades" value={<CountUp value={tradeCount} />} />
            <StatTile label="Profit Share" value={`${tier === "Elite" ? 35 : tier === "Advanced" ? 30 : tier === "Established" ? 25 : 20}%`} sub={`${tier} tier`} accent />
          </div>
        </div>

        {/* Milestone strip */}
        <Panel className="group acid-int mb-6 flex items-center gap-1 overflow-x-auto p-4">
          {MILESTONES.map((m, i) => (
            <div key={m.score} className="flex shrink-0 items-center gap-1">
              <div
                className={`flex flex-col items-center gap-1 rounded-lg border px-4 py-2 ${
                  score >= m.score ? "border-acid/25 bg-acid/[0.06]" : "border-white/10 bg-panel-2"
                }`}
              >
                <span
                  className={`font-mono text-[0.65rem] font-black tabular-nums ${
                    score >= m.score ? "text-acid" : "text-faint"
                  }`}
                >
                  {m.score}
                </span>
                <span
                  className={`text-[0.55rem] font-bold tracking-wider uppercase ${
                    score >= m.score ? "text-ink" : "text-faint"
                  }`}
                >
                  {m.label}
                </span>
                {score >= m.score && (
                  <span className="text-[0.5rem] text-success">✓ Reached</span>
                )}
              </div>
              {i < MILESTONES.length - 1 && (
                <div
                  className={`h-px w-6 shrink-0 ${
                    score >= m.score && score >= MILESTONES[i + 1].score ? "bg-acid" : "bg-white/10"
                  }`}
                />
              )}
            </div>
          ))}
        </Panel>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="history">Score History</TabsTrigger>
            <TabsTrigger value="heatmap">P&amp;L Heatmap</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {/* Score breakdown */}
              <Panel className="group acid-int p-5">
                <MicroLabel className="mb-4">Score Breakdown</MicroLabel>
                <div className="space-y-4">
                  {SCORE_WEIGHTS.map((s) => {
                    const pts = Math.round((s.value / 100) * s.weight * 10);
                    return (
                      <div key={s.label}>
                        <div className="mb-1 flex items-center justify-between">
                          <div>
                            <span className="text-xs font-semibold text-ink">{s.label}</span>
                            <span className="ml-2 text-[0.6rem] text-faint">
                              {s.weight}% weight
                            </span>
                          </div>
                          <span className="font-mono text-xs font-black tabular-nums text-acid">
                            {pts} pts
                          </span>
                        </div>
                        <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
                          <div
                            className="acid-bar h-full rounded-full bg-gradient-to-r from-acid to-cyan"
                            style={{ width: `${s.value}%` }}
                          />
                        </div>
                        <p className="mt-1 text-[0.6rem] text-faint">{s.desc}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="text-xs font-medium text-faint">Total Score</span>
                  <span className="font-mono text-xl font-black tabular-nums text-acid">
                    {score}
                  </span>
                </div>
              </Panel>

              {/* Tier progression */}
              <Panel className="group acid-int p-5">
                <MicroLabel className="mb-4">Tier Progression</MicroLabel>
                <div className="space-y-2">
                  {TIERS.map((t) => {
                    const active = tier === t.tier;
                    const accent = TIER_ACCENT[t.tier];
                    return (
                      <div
                        key={t.tier}
                        className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] motion-reduce:transition-none ${
                          active ? accent.ring : "border-transparent bg-panel-2 hover:border-white/15"
                        }`}
                      >
                        {active && (
                          <div className={`size-1.5 shrink-0 rounded-full ${accent.dot}`} />
                        )}
                        <TierChip tier={t.tier} size="sm" />
                        <span className="flex-1 font-mono text-xs tabular-nums text-faint">
                          {t.range}
                        </span>
                        <div className="text-right">
                          <div
                            className={`font-mono text-xs font-semibold tabular-nums ${
                              active ? accent.text : "text-muted"
                            }`}
                          >
                            {t.profit}% share
                          </div>
                          <div className="text-[0.6rem] text-faint">Cap {t.capacity}</div>
                        </div>
                        {active && <ChevronRight size={12} className={accent.text} />}
                      </div>
                    );
                  })}
                </div>
                <p className="mt-4 text-[0.6rem] leading-relaxed text-faint">
                  All traders are fundable. Vault capacity = score × $1,000 USD. Computed by
                  the Arcadia indexer from on-chain TradeClosed events.
                </p>
              </Panel>
            </div>
          </TabsContent>

          <TabsContent value="history">
            <Panel className="group acid-int p-5">
              <div className="mb-5 flex items-center gap-2">
                <TrendingUp size={14} className="text-acid" />
                <MicroLabel>Score History — 180 days</MicroLabel>
              </div>
              <ScoreHistoryChart data={scoreHistory ?? []} height={280} />
              <p className="mt-3 text-[0.6rem] leading-relaxed text-faint">
                Score is recomputed after every trade settlement. Tier bands shown as shaded
                regions.
              </p>
            </Panel>
          </TabsContent>

          <TabsContent value="heatmap">
            <Panel className="group acid-int p-5">
              <MicroLabel className="mb-5">Daily P&amp;L Heatmap</MicroLabel>
              <PnLHeatmap data={dailyPnl ?? []} />
            </Panel>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
