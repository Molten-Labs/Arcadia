"use client";

import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { ScoreDial } from "@/components/ScoreDial";
import { TierBadge } from "@/components/TierBadge";
import { RiskBars } from "@/components/RiskBars";
import { ScoreHistoryChart } from "@/components/ScoreHistoryChart";
import { PnLHeatmap } from "@/components/PnLHeatmap";
import { Wallet, Shield, ChevronRight, TrendingUp, Bell } from "lucide-react";
import { MOCK_SCORE_HISTORY, MOCK_DAILY_PNL } from "@/lib/mock-data";

const DEMO = {
  handle: "nova",
  score: 912,
  tier: "Elite" as const,
  confidence: "high" as const,
  ci: { lo: 895, point: 912, hi: 928 },
  days_active: 127,
  trade_count: 847,
  capacity_usd: 912000,
  sub_scores: {
    consistency: 94,
    risk_adjusted: 91,
    drawdown: 88,
    volume: 82,
  },
};

const TIERS = [
  { tier: "Verified",    range: "600–699", profit: 20, capacity: "×$1k/pt", color: "var(--color-tier-verified)" },
  { tier: "Established", range: "700–799", profit: 25, capacity: "×$1k/pt", color: "var(--color-tier-established)" },
  { tier: "Advanced",    range: "800–899", profit: 30, capacity: "×$1k/pt", color: "var(--color-tier-advanced)" },
  { tier: "Elite",       range: "900+",    profit: 35, capacity: "×$1k/pt", color: "var(--color-tier-elite)" },
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

export default function ReputationPage() {
  const { connected } = useWallet();
  const [tab, setTab] = useState<"overview" | "history" | "heatmap">("overview");

  if (!connected) {
    return (
      <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
        <div className="flex items-center justify-center min-h-[70vh]">
          <div
            className="text-center rounded-2xl p-10 max-w-sm"
            style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ background: "var(--color-mint-dim)", border: "1px solid rgba(79,158,255,0.3)" }}
            >
              <Wallet size={24} style={{ color: "var(--color-mint)" }} />
            </div>
            <p className="text-base font-semibold mb-2" style={{ color: "var(--color-ink)" }}>Connect wallet</p>
            <p className="text-sm" style={{ color: "var(--color-faint)" }}>
              Connect Phantom or Solflare to view your reputation.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      <div className="max-w-5xl mx-auto px-5 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-7">
          <div className="flex items-center gap-2">
            <Shield size={18} style={{ color: "var(--color-mint)" }} />
            <h1 className="text-xl font-bold" style={{ color: "var(--color-ink)" }}>Reputation</h1>
          </div>
          <div className="flex items-center gap-2 text-[10px] px-3 py-1.5 rounded-full font-bold"
            style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)", color: "var(--color-faint)" }}>
            <Bell size={11} />
            <span>Milestone alerts on</span>
          </div>
        </div>

        {/* Score hero + capacity */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          <div
            className="rounded-2xl p-6 flex flex-col items-center justify-center gap-3"
            style={{
              background: "var(--color-panel)",
              border: "1px solid var(--color-line)",
              backgroundImage: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(79,158,255,0.08) 0%, transparent 70%)",
            }}
          >
            <ScoreDial score={DEMO.score} tier={DEMO.tier} size={120} />
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <TierBadge tier={DEMO.tier} />
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(79,158,255,0.1)", color: "var(--color-green)", border: "1px solid rgba(79,158,255,0.2)" }}
              >
                {DEMO.confidence} confidence
              </span>
            </div>
            <p className="text-[11px] tnum" style={{ color: "var(--color-faint)" }}>
              95% CI: [{DEMO.ci.lo} – {DEMO.ci.hi}]
            </p>
          </div>

          <div className="md:col-span-2 grid grid-cols-2 gap-3">
            {[
              { label: "Arcadia Score", value: DEMO.score.toString(), accent: "var(--color-accent)" },
              { label: "Vault Capacity", value: `$${(DEMO.capacity_usd / 1000).toFixed(0)}k`, sub: `${DEMO.score} × $1,000`, accent: "var(--color-mint)" },
              { label: "Total Trades", value: DEMO.trade_count.toString(), accent: null },
              { label: "Profit Share", value: "35%", sub: "Elite tier", accent: "var(--color-gold)" },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl p-4"
                style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
              >
                <p className="text-[10px] uppercase tracking-wider mb-1.5 font-medium" style={{ color: "var(--color-faint)" }}>
                  {s.label}
                </p>
                <p className="text-xl font-bold tnum" style={{ color: s.accent ?? "var(--color-ink)" }}>
                  {s.value}
                </p>
                {s.sub && <p className="text-[11px] mt-0.5" style={{ color: "var(--color-faint)" }}>{s.sub}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* Milestone strip */}
        <div
          className="rounded-xl p-4 mb-6 flex items-center gap-1 overflow-x-auto"
          style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
        >
          {MILESTONES.map((m, i) => (
            <div key={m.score} className="flex items-center gap-1 shrink-0">
              <div
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-lg transition-all"
                style={{
                  background: m.reached ? "rgba(79,158,255,0.08)" : "var(--color-panel-2)",
                  border: `1px solid ${m.reached ? "rgba(79,158,255,0.2)" : "var(--color-line)"}`,
                }}
              >
                <span
                  className="text-[10px] font-black tnum"
                  style={{ color: m.reached ? "var(--color-mint)" : "var(--color-faint)" }}
                >
                  {m.score}
                </span>
                <span
                  className="text-[9px] font-bold uppercase tracking-wider"
                  style={{ color: m.reached ? "var(--color-ink)" : "var(--color-faint)" }}
                >
                  {m.label}
                </span>
                {m.reached && (
                  <span className="text-[8px]" style={{ color: "var(--color-green)" }}>✓ Reached</span>
                )}
              </div>
              {i < MILESTONES.length - 1 && (
                <div
                  className="w-6 h-px shrink-0"
                  style={{ background: m.reached && MILESTONES[i + 1].reached ? "var(--color-mint)" : "var(--color-line)" }}
                />
              )}
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 rounded-xl w-fit" style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}>
          {(["overview", "history", "heatmap"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all"
              style={{
                background: tab === t ? "var(--color-accent)" : "transparent",
                color: tab === t ? "var(--color-bg)" : "var(--color-faint)",
              }}
            >
              {t === "overview" ? "Overview" : t === "history" ? "Score History" : "P&L Heatmap"}
            </button>
          ))}
        </div>

        {tab === "overview" && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Score breakdown */}
            <div
              className="rounded-xl p-5"
              style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--color-faint)" }}>
                Score Breakdown
              </p>
              <div className="space-y-4">
                {SCORE_WEIGHTS.map((s) => {
                  const pts = Math.round((s.value / 100) * s.weight * 10);
                  return (
                    <div key={s.label}>
                      <div className="flex justify-between items-center mb-1">
                        <div>
                          <span className="text-xs font-semibold" style={{ color: "var(--color-ink)" }}>{s.label}</span>
                          <span className="text-[10px] ml-2" style={{ color: "var(--color-faint)" }}>{s.weight}% weight</span>
                        </div>
                        <div className="text-right">
                          <span className="text-xs font-black tnum" style={{ color: "var(--color-accent)" }}>{pts} pts</span>
                        </div>
                      </div>
                      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--color-panel-2)" }}>
                        <div
                          className="h-full rounded-full transition-all"
                          style={{ width: `${s.value}%`, background: "var(--color-accent)" }}
                        />
                      </div>
                      <p className="text-[10px] mt-1" style={{ color: "var(--color-faint)" }}>{s.desc}</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 pt-4 flex justify-between items-center" style={{ borderTop: "1px solid var(--color-line)" }}>
                <span className="text-xs font-medium" style={{ color: "var(--color-faint)" }}>Total Score</span>
                <span className="text-xl font-black tnum" style={{ color: "var(--color-accent)" }}>{DEMO.score}</span>
              </div>
            </div>

            {/* Tier progression */}
            <div
              className="rounded-xl p-5"
              style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--color-faint)" }}>
                Tier Progression
              </p>
              <div className="space-y-2">
                {TIERS.map((t) => {
                  const active = DEMO.tier === t.tier;
                  return (
                    <div
                      key={t.tier}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-xl transition-all"
                      style={{
                        background: active ? `${t.color}12` : "var(--color-panel-2)",
                        border: `1px solid ${active ? `${t.color}40` : "transparent"}`,
                      }}
                    >
                      {active && (
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: t.color }} />
                      )}
                      <TierBadge tier={t.tier as never} size="sm" />
                      <span className="text-xs tnum flex-1" style={{ color: "var(--color-faint)" }}>
                        {t.range}
                      </span>
                      <div className="text-right">
                        <div className="text-xs font-semibold tnum" style={{ color: active ? t.color : "var(--color-muted)" }}>
                          {t.profit}% share
                        </div>
                        <div className="text-[10px]" style={{ color: "var(--color-faint)" }}>
                          Cap {t.capacity}
                        </div>
                      </div>
                      {active && <ChevronRight size={12} style={{ color: t.color }} />}
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] mt-4 leading-relaxed" style={{ color: "var(--color-faint)" }}>
                All traders are fundable. Vault capacity = score × $1,000 USD. Computed by the Arcadia indexer from on-chain TradeClosed events.
              </p>
            </div>
          </div>
        )}

        {tab === "history" && (
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
          >
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp size={14} style={{ color: "var(--color-mint)" }} />
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-faint)" }}>
                Score History — 180 days
              </p>
            </div>
            <ScoreHistoryChart data={MOCK_SCORE_HISTORY["nova"] ?? []} height={280} />
            <p className="text-[10px] mt-3 leading-relaxed" style={{ color: "var(--color-faint)" }}>
              Score is recomputed after every trade settlement. Tier bands shown as shaded regions.
            </p>
          </div>
        )}

        {tab === "heatmap" && (
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: "var(--color-faint)" }}>
              Daily P&L Heatmap
            </p>
            <PnLHeatmap data={MOCK_DAILY_PNL["nova"] ?? []} />
          </div>
        )}

      </div>
    </div>
  );
}
