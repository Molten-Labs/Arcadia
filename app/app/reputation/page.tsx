"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { ScoreDial } from "@/components/ScoreDial";
import { TierBadge } from "@/components/TierBadge";
import { RiskBars } from "@/components/RiskBars";
import { Wallet, Shield, ChevronRight } from "lucide-react";

const DEMO = {
  score: 912,
  tier: "Elite" as const,
  confidence: "high" as const,
  ci: { lo: 895, point: 912, hi: 928 },
  days_active: 127,
  trade_count: 847,
  sub_scores: {
    consistency: 94,
    risk_adjusted: 91,
    drawdown: 88,
    volume: 82,
  },
};

const TIERS = [
  { tier: "Verified",    range: "600–699", profit: 20, color: "var(--color-tier-verified)" },
  { tier: "Established", range: "700–799", profit: 25, color: "var(--color-tier-established)" },
  { tier: "Advanced",    range: "800–899", profit: 30, color: "var(--color-tier-advanced)" },
  { tier: "Elite",       range: "900+",    profit: 35, color: "var(--color-tier-elite)" },
];

export default function ReputationPage() {
  const { connected } = useWallet();

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
              style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.3)" }}
            >
              <Wallet size={24} style={{ color: "var(--color-purple-bright)" }} />
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
        <div className="flex items-center gap-2 mb-7">
          <Shield size={18} style={{ color: "var(--color-purple-bright)" }} />
          <h1 className="text-xl font-bold" style={{ color: "var(--color-ink)" }}>Reputation</h1>
        </div>

        {/* Score hero + stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
          {/* Score dial card */}
          <div
            className="rounded-2xl p-6 flex flex-col items-center justify-center gap-3"
            style={{
              background: "var(--color-panel)",
              border: "1px solid var(--color-line)",
              backgroundImage: "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(124,58,237,0.1) 0%, transparent 70%)",
            }}
          >
            <ScoreDial score={DEMO.score} tier={DEMO.tier} size={120} />
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <TierBadge tier={DEMO.tier} />
              <span
                className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                style={{ background: "rgba(34,211,160,0.1)", color: "var(--color-green)", border: "1px solid rgba(34,211,160,0.2)" }}
              >
                {DEMO.confidence} confidence
              </span>
            </div>
            <p className="text-[11px] tnum" style={{ color: "var(--color-faint)" }}>
              95% CI: [{DEMO.ci.lo} – {DEMO.ci.hi}]
            </p>
          </div>

          {/* Stats grid */}
          <div className="md:col-span-2 grid grid-cols-2 gap-3">
            {[
              { label: "Arcadia Score", value: DEMO.score.toString(), accent: "var(--color-purple-bright)" },
              { label: "Days Active", value: DEMO.days_active.toString(), accent: null },
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

        {/* Sub-scores + tier progression */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Sub-scores */}
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--color-faint)" }}>
              Sub-scores
            </p>
            <RiskBars
              items={[
                { label: "Consistency",     value: DEMO.sub_scores.consistency,   max: 100, fmt: (v) => `${v}/100` },
                { label: "Risk-adjusted",   value: DEMO.sub_scores.risk_adjusted, max: 100, fmt: (v) => `${v}/100` },
                { label: "Drawdown control",value: DEMO.sub_scores.drawdown,      max: 100, fmt: (v) => `${v}/100` },
                { label: "Volume",          value: DEMO.sub_scores.volume,        max: 100, fmt: (v) => `${v}/100` },
              ]}
            />
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
                    <span className="text-xs font-semibold tnum" style={{ color: active ? t.color : "var(--color-muted)" }}>
                      {t.profit}% share
                    </span>
                    {active && <ChevronRight size={12} style={{ color: t.color }} />}
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] mt-4 leading-relaxed" style={{ color: "var(--color-faint)" }}>
              Score &lt; 600 = not fundable. Computed off-chain by the Arcadia indexer from on-chain TradeClosed events.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
