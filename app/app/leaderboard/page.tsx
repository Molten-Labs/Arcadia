"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import type { LeaderboardEntry } from "@/lib/types";
import { Trophy, ChevronDown } from "lucide-react";

const PRIZES = [
  { place: "1st", amount: "$3,000", color: "#f0c040", bg: "rgba(240,196,64,0.1)" },
  { place: "2nd", amount: "$2,000", color: "#a0a0b8", bg: "rgba(160,160,184,0.08)" },
  { place: "3rd", amount: "$1,400", color: "#c87941", bg: "rgba(200,121,65,0.1)" },
  { place: "4th", amount: "$900",   color: "var(--color-faint)", bg: "transparent" },
  { place: "5th", amount: "$700",   color: "var(--color-faint)", bg: "transparent" },
  { place: "6th", amount: "$600",   color: "var(--color-faint)", bg: "transparent" },
  { place: "7th", amount: "$500",   color: "var(--color-faint)", bg: "transparent" },
  { place: "8th", amount: "$400",   color: "var(--color-faint)", bg: "transparent" },
  { place: "9th", amount: "$300",   color: "var(--color-faint)", bg: "transparent" },
  { place: "10th", amount: "$200",  color: "var(--color-faint)", bg: "transparent" },
];

function Avatar({ name, size = 64, color }: { name: string; size?: number; color?: string }) {
  const initials = name.slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: color ? `${color}20` : "var(--color-panel-2)",
        border: `2px solid ${color ?? "var(--color-line)"}`,
        color: color ?? "var(--color-muted)",
        fontSize: size > 48 ? "1.1rem" : "0.875rem",
      }}
    >
      {initials}
    </div>
  );
}

function PodiumCard({ entry, rank }: { entry: LeaderboardEntry; rank: 1 | 2 | 3 }) {
  const isFirst = rank === 1;
  const colors = {
    1: { ring: "#f0c040", badge: "1st" },
    2: { ring: "#a0a0b8", badge: "2nd" },
    3: { ring: "#c87941", badge: "3rd" },
  };
  const cfg = colors[rank];

  return (
    <div
      className={`rounded p-4 flex flex-col items-center gap-2 relative ${isFirst ? "pt-6 pb-5" : "pt-4 pb-4"}`}
      style={{
        background: "var(--color-panel)",
        border: `1px solid ${cfg.ring}30`,
        order: rank === 1 ? 0 : rank === 2 ? -1 : 1,
      }}
    >
      {/* Rank badge */}
      {isFirst && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Trophy size={18} color={cfg.ring} />
        </div>
      )}
      <div
        className="absolute top-3 right-3 text-[9px] font-bold px-1.5 py-0.5 rounded"
        style={{ background: `${cfg.ring}15`, color: cfg.ring, border: `1px solid ${cfg.ring}30` }}
      >
        {cfg.badge}
      </div>

      <Avatar name={entry.handle} size={isFirst ? 64 : 52} color={cfg.ring} />

      <div className="text-center">
        <p className="text-sm font-bold" style={{ color: "var(--color-ink)" }}>
          {entry.handle}
          <span className="text-[10px] font-normal ml-1" style={{ color: "var(--color-faint)" }}>· x</span>
        </p>
      </div>

      <div
        className="w-full rounded p-2.5"
        style={{ background: "var(--color-panel-2)" }}
      >
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-[9px] uppercase tracking-wider font-medium mb-0.5" style={{ color: "var(--color-faint)" }}>PnL</p>
            <p className="text-sm font-bold tnum" style={{ color: "var(--color-green)" }}>
              ${(entry.score * 210).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-wider font-medium mb-0.5" style={{ color: "var(--color-faint)" }}>Win Rate</p>
            <p className="text-sm font-bold tnum" style={{ color: "var(--color-ink)" }}>
              {(60 + rank * 3).toFixed(2)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"traders" | "pnl" | "roe">("traders");
  const [termsOpen, setTermsOpen] = useState(false);
  const { data } = useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard"],
    queryFn: () => apiFetch("/leaderboard"),
  });

  const top3 = data?.slice(0, 3) ?? [];
  const rest = data ?? [];

  return (
    <div className="min-h-full" style={{ background: "var(--color-bg)" }}>
      <div className="px-8 py-6">
        <h1 className="text-xl font-bold mb-0.5" style={{ color: "var(--color-ink)" }}>Leaderboard</h1>
        <p className="text-xs mb-5" style={{ color: "var(--color-faint)" }}>
          Ranking the top funded account traders — only verified funded accounts are eligible to compete.
        </p>

        <div className="flex gap-4">
          {/* Main */}
          <div className="flex-1 min-w-0">

            {/* Tabs */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-0">
                {(["traders","pnl","roe"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="px-4 py-2 text-xs font-semibold capitalize"
                    style={{
                      color: tab === t ? "var(--color-ink)" : "var(--color-faint)",
                      borderBottom: tab === t ? "2px solid var(--color-purple-bright)" : "2px solid transparent",
                    }}
                  >
                    {t === "traders" ? "Top Traders" : t.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button className="btn-ghost text-[10px] px-2 py-1 h-7">Global ▾</button>
                <button className="btn-ghost text-[10px] px-2 py-1 h-7">Past Competitions</button>
              </div>
            </div>

            {/* Podium */}
            {top3.length >= 3 && (
              <div className="grid grid-cols-3 gap-3 mb-4 items-end">
                <PodiumCard entry={top3[1]} rank={2} />
                <PodiumCard entry={top3[0]} rank={1} />
                <PodiumCard entry={top3[2]} rank={3} />
              </div>
            )}

            {/* Season info */}
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-[11px]" style={{ color: "var(--color-faint)" }}>
                🕐 Season ends in <span style={{ color: "var(--color-ink)" }}>14d 6h 51m 20s</span>
              </p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--color-green)" }} />
                <span className="text-[11px]" style={{ color: "var(--color-faint)" }}>Updated 3m ago</span>
              </div>
            </div>
            <div
              className="rounded px-4 py-2 mb-3"
              style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)" }}
            >
              <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>April 2026 Championship</p>
            </div>

            {/* Table */}
            <div className="rounded card overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ background: "var(--color-panel-2)", borderBottom: "1px solid var(--color-line)" }}>
                    {["#","Trader","PnL","Win Rate","Volume","Trading Days"].map((h) => (
                      <th key={h} className="py-2.5 px-4 text-left font-medium" style={{ color: "var(--color-faint)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rest.slice(3).map((entry, i) => (
                    <tr
                      key={entry.handle}
                      className="hover:bg-[var(--color-panel-2)] transition-colors"
                      style={{ borderBottom: "1px solid var(--color-line)" }}
                    >
                      <td className="py-2.5 px-4 tnum font-mono" style={{ color: "var(--color-faint)" }}>{i + 4}</td>
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-2">
                          <Avatar name={entry.handle} size={24} />
                          <span className="font-semibold" style={{ color: "var(--color-ink)" }}>
                            {entry.handle}
                          </span>
                          <span className="text-[10px]" style={{ color: "var(--color-faint)" }}>· x</span>
                        </div>
                      </td>
                      <td className="py-2.5 px-4 tnum font-semibold" style={{ color: "var(--color-green)" }}>
                        $859,731
                      </td>
                      <td className="py-2.5 px-4 tnum" style={{ color: "var(--color-ink)" }}>
                        {(60 + Math.random() * 25).toFixed(2)}%
                      </td>
                      <td className="py-2.5 px-4 tnum" style={{ color: "var(--color-muted)" }}>$12.4M</td>
                      <td className="py-2.5 px-4 tnum" style={{ color: "var(--color-muted)" }}>324 Days</td>
                    </tr>
                  ))}
                  {/* "Me" row */}
                  <tr style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)" }}>
                    <td className="py-2.5 px-4 tnum font-bold" style={{ color: "var(--color-purple-bright)" }}>67</td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center gap-2">
                        <Avatar name="Me" size={24} color="var(--color-purple)" />
                        <span className="font-bold" style={{ color: "var(--color-ink)" }}>Me</span>
                        <span className="text-[10px]" style={{ color: "var(--color-faint)" }}>· x</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-4 tnum font-semibold" style={{ color: "var(--color-green)" }}>$2,044</td>
                    <td className="py-2.5 px-4 tnum" style={{ color: "var(--color-ink)" }}>54.47%</td>
                    <td className="py-2.5 px-4 tnum" style={{ color: "var(--color-muted)" }}>$12.4M</td>
                    <td className="py-2.5 px-4 tnum" style={{ color: "var(--color-muted)" }}>324 Days</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Right panel */}
          <div className="w-52 flex-shrink-0 flex flex-col gap-3">
            {/* Prize pool */}
            <div className="rounded card p-4">
              <div className="flex items-center gap-2 mb-1">
                <Trophy size={16} color="#f0c040" />
                <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>Prize Pool</p>
              </div>
              <p className="text-2xl font-black tnum mb-1" style={{ color: "var(--color-ink)" }}>
                $10,000 <span className="text-xs font-normal" style={{ color: "var(--color-faint)" }}>USDC</span>
              </p>
              <p className="text-[10px] mb-4 leading-relaxed" style={{ color: "var(--color-faint)" }}>
                Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor
              </p>

              <p className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--color-faint)" }}>
                Distribution
              </p>
              <div className="space-y-1">
                {PRIZES.map((p) => (
                  <div
                    key={p.place}
                    className="flex items-center justify-between px-2 py-1.5 rounded"
                    style={{ background: p.bg }}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                        style={{ background: `${p.color}20`, color: p.color }}>
                        {p.place.slice(0, -2)}
                      </div>
                      <span className="text-[11px]" style={{ color: "var(--color-faint)" }}>Place</span>
                    </div>
                    <span className="text-[11px] font-semibold tnum" style={{ color: p.color }}>{p.amount}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Terms */}
            <div className="rounded card overflow-hidden">
              <button
                className="w-full flex items-center justify-between px-4 py-3"
                onClick={() => setTermsOpen(!termsOpen)}
              >
                <p className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>Terms and Conditions</p>
                <ChevronDown size={13} style={{ color: "var(--color-faint)", transform: termsOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
              </button>
              {termsOpen && (
                <div className="px-4 pb-4 text-[11px] leading-relaxed" style={{ color: "var(--color-faint)" }}>
                  <p className="font-semibold mb-1" style={{ color: "var(--color-muted)" }}>1. Overview</p>
                  <p>The Leaderboard Competition is organized by Hypernova. By participating, traders agree to the following terms and conditions.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
