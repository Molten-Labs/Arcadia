"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import type { LeaderboardEntry } from "@/lib/types";
import { Trophy, Crown, Medal } from "lucide-react";

const PRIZES = [
  { place: "1st", amount: "$3,000", color: "#f0b429", bg: "rgba(240,180,41,0.1)" },
  { place: "2nd", amount: "$2,000", color: "#e8eaf0", bg: "rgba(232,234,240,0.08)" },
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
      className="rounded-xl flex items-center justify-center font-black flex-shrink-0 shadow-lg"
      style={{
        width: size,
        height: size,
        background: color ? `${color}15` : "var(--color-panel-2)",
        border: `2px solid ${color ?? "var(--color-line)"}`,
        color: color ?? "var(--color-muted)",
        fontSize: size > 48 ? "1.5rem" : "0.875rem",
        boxShadow: color ? `0 0 20px ${color}30, inset 0 0 10px ${color}20` : undefined,
      }}
    >
      {initials}
    </div>
  );
}

function PodiumCard({ entry, rank }: { entry: LeaderboardEntry; rank: 1 | 2 | 3 }) {
  const isFirst = rank === 1;
  const colors = {
    1: { ring: "#f0b429", badge: "1st", bg: "linear-gradient(to top, rgba(240,180,41,0.15), rgba(240,180,41,0.02))", icon: Crown },
    2: { ring: "#e8eaf0", badge: "2nd", bg: "linear-gradient(to top, rgba(232,234,240,0.1), rgba(232,234,240,0.02))", icon: Medal },
    3: { ring: "#c87941", badge: "3rd", bg: "linear-gradient(to top, rgba(200,121,65,0.1), rgba(200,121,65,0.02))", icon: Medal },
  };
  const cfg = colors[rank];
  const Icon = cfg.icon;

  return (
    <div
      className={`rounded-2xl p-5 flex flex-col items-center gap-4 relative transition-transform hover:-translate-y-2 ${isFirst ? "pt-8 pb-6 z-10 scale-105" : "pt-5 pb-5"}`}
      style={{
        background: "var(--color-panel)",
        backgroundImage: cfg.bg,
        border: `1px solid ${cfg.ring}40`,
        order: rank === 1 ? 0 : rank === 2 ? -1 : 1,
        boxShadow: isFirst ? `0 20px 40px -10px ${cfg.ring}30` : undefined,
      }}
    >
      {isFirst && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-[var(--color-panel)] rounded-full p-2 border border-[var(--color-gold)] shadow-[0_0_15px_var(--color-gold)]">
          <Icon size={24} color={cfg.ring} />
        </div>
      )}
      
      {!isFirst && (
        <div
          className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-black px-3 py-1 rounded-full shadow-md uppercase tracking-widest"
          style={{ background: cfg.ring, color: "#000" }}
        >
          {cfg.badge}
        </div>
      )}
      
      {isFirst && (
        <div
          className="text-[10px] font-black px-4 py-1 rounded-full shadow-md uppercase tracking-widest mb-2"
          style={{ background: cfg.ring, color: "#000" }}
        >
          Champion
        </div>
      )}

      <Avatar name={entry.handle} size={isFirst ? 80 : 60} color={cfg.ring} />

      <div className="text-center">
        <p className={`font-black ${isFirst ? "text-2xl" : "text-lg"} tracking-tight`} style={{ color: "var(--color-ink)" }}>
          @{entry.handle}
        </p>
        <p className="text-[10px] font-mono mt-1" style={{ color: "var(--color-faint)" }}>
          Score <span style={{ color: "var(--color-accent)", fontWeight: "bold" }}>{entry.score}</span>
        </p>
      </div>

      <div
        className="w-full rounded-xl p-4 mt-2"
        style={{ background: "rgba(15, 17, 23, 0.5)", border: `1px solid ${cfg.ring}20` }}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: "var(--color-faint)" }}>Est. PnL</p>
            <p className="text-lg font-black tnum" style={{ color: "var(--color-green)" }}>
              ${(entry.score * 210).toLocaleString()}
            </p>
          </div>
          <div className="text-center">
            <p className="text-[9px] uppercase tracking-widest font-bold mb-1" style={{ color: "var(--color-faint)" }}>Win Rate</p>
            <p className="text-lg font-black tnum" style={{ color: "var(--color-ink)" }}>
              {(60 + rank * 3).toFixed(1)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LeaderboardPage() {
  const [tab, setTab] = useState<"traders" | "pnl" | "roe">("traders");
  const { data } = useQuery<LeaderboardEntry[]>({
    queryKey: ["leaderboard"],
    queryFn: () => apiFetch("/leaderboard"),
  });

  const top3 = data?.slice(0, 3) ?? [];
  const rest = data ?? [];

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-[1400px] mx-auto px-6 py-10">
        
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black mb-3 tracking-tight uppercase" style={{ color: "var(--color-ink)" }}>
            Global <span style={{ color: "var(--color-gold)" }}>Leaderboard</span>
          </h1>
          <p className="text-base font-medium" style={{ color: "var(--color-muted)" }}>
            Ranking the top funded traders — only verified accounts are eligible to compete.
          </p>
        </div>

        <div className="flex flex-col xl:flex-row gap-8">
          {/* Main */}
          <div className="flex-1 min-w-0">

            {/* Podium */}
            {top3.length >= 3 && (
              <div className="grid grid-cols-3 gap-4 mb-12 items-end px-4 mt-8">
                <PodiumCard entry={top3[1]} rank={2} />
                <PodiumCard entry={top3[0]} rank={1} />
                <PodiumCard entry={top3[2]} rank={3} />
              </div>
            )}

            {/* Controls */}
            <div className="flex items-center justify-between mb-4 bg-[var(--color-panel)] p-2 rounded-xl border border-[var(--color-line)]">
              <div className="flex gap-1">
                {(["traders","pnl","roe"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="px-6 py-2 text-[11px] font-bold uppercase tracking-widest rounded-lg transition-all"
                    style={{
                      background: tab === t ? "var(--color-mint-dim)" : "transparent",
                      color: tab === t ? "var(--color-mint)" : "var(--color-faint)",
                      border: tab === t ? "1px solid rgba(79,158,255,0.3)" : "1px solid transparent",
                    }}
                  >
                    {t === "traders" ? "Top Score" : t.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-panel-2)] border border-[var(--color-line)]">
                  <div className="w-2 h-2 rounded-full bg-[var(--color-green)] animate-pulse" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--color-faint)]">Live</span>
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="rounded-xl card overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "var(--color-panel-2)", borderBottom: "1px solid var(--color-line)" }}>
                      {["Rank","Trader","Score","Est. PnL","Win Rate","Volume","Active Days"].map((h) => (
                        <th key={h} className="py-4 px-6 text-left text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {/* "Me" row */}
                    <tr className="bg-gradient-to-r from-[rgba(79,158,255,0.15)] to-[rgba(79,158,255,0.02)] border-b border-[rgba(79,158,255,0.3)] shadow-[inset_4px_0_0_var(--color-mint)]">
                      <td className="py-4 px-6 tnum font-black text-lg" style={{ color: "var(--color-mint)" }}>147</td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-3">
                          <Avatar name="darc" size={32} color="var(--color-mint)" />
                          <span className="font-bold text-base" style={{ color: "var(--color-ink)" }}>You</span>
                        </div>
                      </td>
                      <td className="py-4 px-6 tnum font-bold" style={{ color: "var(--color-accent)" }}>642</td>
                      <td className="py-4 px-6 tnum font-bold" style={{ color: "var(--color-green)" }}>$2,044</td>
                      <td className="py-4 px-6 tnum font-medium" style={{ color: "var(--color-ink)" }}>54.4%</td>
                      <td className="py-4 px-6 tnum font-mono" style={{ color: "var(--color-muted)" }}>$12.4M</td>
                      <td className="py-4 px-6 tnum font-mono" style={{ color: "var(--color-muted)" }}>124</td>
                    </tr>
                    
                    {rest.slice(3).map((entry, i) => (
                      <tr
                        key={entry.handle}
                        className="hover:bg-[var(--color-panel-2)] transition-colors group"
                        style={{ borderBottom: "1px solid var(--color-line)" }}
                      >
                        <td className="py-4 px-6 tnum font-bold text-lg" style={{ color: "var(--color-muted)" }}>{i + 4}</td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <Avatar name={entry.handle} size={32} />
                            <span className="font-bold text-[var(--color-ink)] group-hover:text-[var(--color-mint)] transition-colors">
                              @{entry.handle}
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6 tnum font-bold" style={{ color: "var(--color-accent)" }}>{entry.score}</td>
                        <td className="py-4 px-6 tnum font-bold" style={{ color: "var(--color-green)" }}>
                          ${Math.round(entry.score * 120 + Math.random() * 5000).toLocaleString()}
                        </td>
                        <td className="py-4 px-6 tnum font-medium" style={{ color: "var(--color-ink)" }}>
                          {(50 + Math.random() * 15).toFixed(1)}%
                        </td>
                        <td className="py-4 px-6 tnum font-mono" style={{ color: "var(--color-muted)" }}>
                          ${(Math.random() * 50 + 5).toFixed(1)}M
                        </td>
                        <td className="py-4 px-6 tnum font-mono" style={{ color: "var(--color-muted)" }}>{entry.days_active}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right panel */}
          <div className="w-full xl:w-72 flex-shrink-0 flex flex-col gap-6 mt-8 xl:mt-0">
            
            {/* Season info */}
            <div className="rounded-xl card p-5 bg-gradient-to-br from-[var(--color-panel-2)] to-[var(--color-panel)] border-[var(--color-line)] relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[var(--color-mint)] opacity-[0.03] rounded-full blur-2xl" />
              <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: "var(--color-mint)" }}>Current Season</p>
              <p className="text-xl font-black mb-4" style={{ color: "var(--color-ink)" }}>April 2026 Championship</p>
              
              <div className="bg-[var(--color-bg)] rounded-lg p-3 border border-[var(--color-line)] flex items-center justify-between">
                <div>
                  <p className="text-[9px] uppercase tracking-widest font-bold text-[var(--color-faint)] mb-1">Ends In</p>
                  <p className="font-mono font-bold text-sm" style={{ color: "var(--color-ink)" }}>14d 6h 51m</p>
                </div>
                <Trophy size={20} style={{ color: "var(--color-faint)" }} />
              </div>
            </div>

            {/* Prize pool */}
            <div className="rounded-xl card p-5 relative overflow-hidden">
              <div className="absolute -right-4 -top-4 opacity-10">
                <Trophy size={100} color="var(--color-gold)" />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Trophy size={16} color="var(--color-gold)" />
                  <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>Prize Pool</p>
                </div>
                <p className="text-3xl font-black tnum tracking-tight mb-1" style={{ color: "var(--color-gold)", textShadow: "0 0 20px rgba(240,180,41,0.3)" }}>
                  $10,000 <span className="text-sm font-bold" style={{ color: "var(--color-muted)" }}>USDC</span>
                </p>
                <p className="text-[11px] mb-6 font-medium leading-relaxed" style={{ color: "var(--color-muted)" }}>
                  Top 10 traders split the prize pool at the end of the season.
                </p>

                <p className="text-[9px] font-bold uppercase tracking-widest mb-3" style={{ color: "var(--color-faint)" }}>
                  Distribution
                </p>
                <div className="space-y-1.5">
                  {PRIZES.map((p) => (
                    <div
                      key={p.place}
                      className="flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{ background: p.bg, border: p.place === "1st" ? "1px solid rgba(240,180,41,0.3)" : "1px solid transparent" }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-5 h-5 rounded flex items-center justify-center text-[10px] font-black"
                          style={{ background: `${p.color}20`, color: p.color, border: `1px solid ${p.color}40` }}>
                          {p.place.slice(0, -2)}
                        </div>
                        <span className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--color-ink)" }}>{p.place}</span>
                      </div>
                      <span className="text-sm font-black tnum tracking-tight" style={{ color: p.color }}>{p.amount}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}