"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Trophy } from "lucide-react";

import { apiFetch, cn } from "@/lib/utils";
import type { LeaderboardEntry } from "@/lib/types";
import { Reveal } from "@/components/acid";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  HeaderAura,
  Kicker,
  MonoLabel,
  PageContainer,
  Panel,
  SectionTitle,
  signTone,
} from "@/components/pages/discovery/bits";
import { Avatar } from "@/components/pages/discovery/Avatar";

type MetricTab = "traders" | "pnl" | "roe";

const TABS: { key: MetricTab; label: string }[] = [
  { key: "traders", label: "Top Score" },
  { key: "pnl", label: "PNL" },
  { key: "roe", label: "ROE" },
];

/** Medal accent per podium rank, token-only. */
const MEDAL: Record<1 | 2 | 3, { color: string; label: string }> = {
  1: { color: "var(--color-acid)", label: "Champion" },
  2: { color: "var(--color-cyan)", label: "2nd" },
  3: { color: "var(--color-pink)", label: "3rd" },
};

const PRIZES: { place: string; amount: string; color: string }[] = [
  { place: "1st", amount: "$3,000", color: "var(--color-acid)" },
  { place: "2nd", amount: "$2,000", color: "var(--color-cyan)" },
  { place: "3rd", amount: "$1,400", color: "var(--color-pink)" },
  { place: "4th", amount: "$900", color: "var(--color-faint)" },
  { place: "5th", amount: "$700", color: "var(--color-faint)" },
  { place: "6th", amount: "$600", color: "var(--color-faint)" },
  { place: "7th", amount: "$500", color: "var(--color-faint)" },
  { place: "8th", amount: "$400", color: "var(--color-faint)" },
  { place: "9th", amount: "$300", color: "var(--color-faint)" },
  { place: "10th", amount: "$200", color: "var(--color-faint)" },
];

/** Stable non-negative hash so row fill-metrics are deterministic (SSR-safe). */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic estimated metrics for the ranked table (replaces Math.random). */
function rowMetrics(entry: LeaderboardEntry) {
  const h = hashString(entry.handle);
  return {
    estPnl: Math.round(entry.score * 120 + (h % 5000)),
    winRate: 50 + ((h >> 4) % 150) / 10,
    volumeM: 5 + ((h >> 8) % 460) / 10,
  };
}

function PodiumCard({ entry, rank }: { entry: LeaderboardEntry; rank: 1 | 2 | 3 }) {
  const isFirst = rank === 1;
  const { color, label } = MEDAL[rank];
  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-4 rounded-2xl border bg-panel p-5 text-center transition-transform hover:-translate-y-1 motion-reduce:transition-none",
        isFirst ? "z-10 scale-[1.04] pt-8" : "",
      )}
      style={{
        borderColor: `color-mix(in srgb, ${color} 40%, transparent)`,
        boxShadow: isFirst ? `0 0 40px color-mix(in srgb, ${color} 20%, transparent)` : undefined,
      }}
    >
      <span
        className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 font-mono text-[10px] font-bold tracking-[0.14em] text-void uppercase"
        style={{ background: color }}
      >
        {label}
      </span>

      <Avatar
        handle={entry.handle}
        size={isFirst ? 76 : 60}
        chars={2}
        className="rounded-2xl"
        style={{ boxShadow: `0 0 0 2px color-mix(in srgb, ${color} 55%, transparent)` }}
      />

      <div>
        <p className={cn("font-bold tracking-tight text-ink", isFirst ? "text-2xl" : "text-lg")}>
          @{entry.handle}
        </p>
        <p className="mt-1 font-mono text-[10px] text-faint">
          Score <span className="font-bold text-acid">{entry.score}</span>
        </p>
      </div>

      <div className="grid w-full grid-cols-2 gap-4 rounded-xl border border-line bg-void/50 p-4">
        <div>
          <MonoLabel>Est. PnL</MonoLabel>
          <p className="mt-1 font-mono text-lg font-bold text-success tabular-nums">
            ${(entry.score * 210).toLocaleString("en-US")}
          </p>
        </div>
        <div>
          <MonoLabel>Win Rate</MonoLabel>
          <p className="mt-1 font-mono text-lg font-bold text-ink tabular-nums">
            {(60 + rank * 3).toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<MetricTab>("traders");
  const { data } = useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard"],
    queryFn: () => apiFetch("/leaderboard"),
  });

  const top3 = data?.slice(0, 3) ?? [];
  const rest = data ?? [];

  return (
    <div className="relative min-h-full bg-void">
      <PageContainer>
        {/* header */}
        <div className="relative text-center">
          <HeaderAura />
          <Reveal>
            <div className="flex flex-col items-center">
              <Kicker>Season Rankings</Kicker>
              <SectionTitle className="mt-4">Global Leaderboard</SectionTitle>
              <p className="mt-3 max-w-[62ch] text-sm text-muted">
                Ranking the top funded traders. Only verified accounts are eligible to compete.
              </p>
            </div>
          </Reveal>
        </div>

        <div className="mt-10 flex flex-col gap-8 xl:flex-row">
          {/* main */}
          <div className="min-w-0 flex-1">
            {/* podium */}
            {top3.length >= 3 ? (
              <div className="mb-12 grid grid-cols-3 items-end gap-4 px-2">
                <PodiumCard entry={top3[1]} rank={2} />
                <PodiumCard entry={top3[0]} rank={1} />
                <PodiumCard entry={top3[2]} rank={3} />
              </div>
            ) : null}

            {/* controls */}
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-line bg-panel p-2">
              <div role="group" aria-label="Ranking metric" className="flex gap-1">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setTab(t.key)}
                    aria-pressed={tab === t.key}
                    className={cn(
                      "rounded-lg px-5 py-2 font-mono text-[11px] font-bold tracking-[0.14em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void",
                      tab === t.key
                        ? "border border-acid/30 bg-acid/10 text-acid"
                        : "border border-transparent text-faint hover:text-ink",
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <span className="flex items-center gap-2 rounded-lg border border-line bg-panel-2 px-4 py-2">
                <span
                  aria-hidden
                  className="acid-animate size-2 rounded-full bg-success"
                  style={{ animation: "acid-pulse 2s infinite" }}
                />
                <span className="font-mono text-[10px] font-bold tracking-[0.14em] text-faint uppercase">
                  Live
                </span>
              </span>
            </div>

            {/* table */}
            <div className="overflow-hidden rounded-xl border border-acid/20 bg-void/70">
              <Table className="min-w-[720px]">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Rank</TableHead>
                    <TableHead>Trader</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead className="text-right">Est. PnL</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                    <TableHead className="text-right">Volume</TableHead>
                    <TableHead className="text-right">Active Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {/* the current user's row */}
                  <TableRow className="bg-acid/[0.06] shadow-[inset_2px_0_0_var(--color-acid)] hover:bg-acid/10">
                    <TableCell className="text-lg font-bold text-acid tabular-nums">147</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-2.5">
                        <Avatar handle="darc" size={28} chars={2} className="rounded-lg" />
                        <span className="font-sans font-bold text-ink">You</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right font-bold text-acid tabular-nums">642</TableCell>
                    <TableCell className="text-right font-bold text-success tabular-nums">
                      $2,044
                    </TableCell>
                    <TableCell className="text-right text-ink tabular-nums">54.4%</TableCell>
                    <TableCell className="text-right text-muted tabular-nums">$12.4M</TableCell>
                    <TableCell className="text-right text-muted tabular-nums">124</TableCell>
                  </TableRow>

                  {rest.slice(3).map((entry, i) => {
                    const m = rowMetrics(entry);
                    return (
                      <TableRow key={entry.handle} className="group">
                        <TableCell className="text-lg font-bold text-muted tabular-nums transition-colors group-hover:text-acid motion-reduce:transition-none">
                          {i + 4}
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/t/${entry.handle}`}
                            className="inline-flex items-center gap-2.5 text-ink transition-colors hover:text-acid"
                          >
                            <Avatar handle={entry.handle} size={28} chars={2} className="rounded-lg" />
                            <span className="font-sans font-bold">@{entry.handle}</span>
                          </Link>
                        </TableCell>
                        <TableCell className="text-right font-bold text-acid tabular-nums">
                          {entry.score}
                        </TableCell>
                        <TableCell className={`text-right font-bold tabular-nums ${signTone(m.estPnl)}`}>
                          ${m.estPnl.toLocaleString("en-US")}
                        </TableCell>
                        <TableCell className="text-right text-ink tabular-nums">
                          {m.winRate.toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right text-muted tabular-nums">
                          ${m.volumeM.toFixed(1)}M
                        </TableCell>
                        <TableCell className="text-right text-muted tabular-nums">
                          {entry.days_active}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </div>

          {/* right rail */}
          <div className="flex w-full flex-col gap-6 xl:w-72 xl:shrink-0">
            {/* season */}
            <Panel className="relative overflow-hidden p-5">
              <MonoLabel className="text-acid">Current Season</MonoLabel>
              <p className="mt-1 text-xl font-bold text-ink">April 2026 Championship</p>
              <div className="mt-4 flex items-center justify-between rounded-lg border border-line bg-void/60 p-3">
                <div>
                  <MonoLabel>Ends In</MonoLabel>
                  <p className="mt-1 font-mono text-sm font-bold text-ink tabular-nums">14d 6h 51m</p>
                </div>
                <Trophy aria-hidden className="size-5 text-faint" />
              </div>
            </Panel>

            {/* prize pool */}
            <Panel className="relative overflow-hidden p-5">
              <div className="flex items-center gap-2">
                <Trophy aria-hidden className="size-4 text-acid" />
                <MonoLabel>Prize Pool</MonoLabel>
              </div>
              <p className="mt-2 font-mono text-3xl font-bold tracking-tight text-acid tabular-nums">
                $10,000 <span className="text-sm font-bold text-muted">USDC</span>
              </p>
              <p className="mt-1 mb-6 text-[11px] leading-relaxed text-muted">
                Top 10 traders split the prize pool at the end of the season.
              </p>

              <MonoLabel>Distribution</MonoLabel>
              <div className="mt-3 space-y-1.5">
                {PRIZES.map((p) => (
                  <div
                    key={p.place}
                    className="flex items-center justify-between rounded-lg px-3 py-2"
                    style={{
                      border:
                        p.place === "1st"
                          ? "1px solid color-mix(in srgb, var(--color-acid) 30%, transparent)"
                          : "1px solid transparent",
                      background:
                        p.place === "1st"
                          ? "color-mix(in srgb, var(--color-acid) 6%, transparent)"
                          : "transparent",
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="grid size-5 place-items-center rounded font-mono text-[10px] font-bold"
                        style={{
                          color: p.color,
                          background: `color-mix(in srgb, ${p.color} 15%, transparent)`,
                          border: `1px solid color-mix(in srgb, ${p.color} 35%, transparent)`,
                        }}
                      >
                        {p.place.slice(0, -2)}
                      </span>
                      <span className="font-mono text-xs font-bold tracking-[0.08em] text-ink uppercase">
                        {p.place}
                      </span>
                    </div>
                    <span
                      className="font-mono text-sm font-bold tracking-tight tabular-nums"
                      style={{ color: p.color }}
                    >
                      {p.amount}
                    </span>
                  </div>
                ))}
              </div>
            </Panel>
          </div>
        </div>
      </PageContainer>
    </div>
  );
}
