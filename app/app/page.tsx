"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { TraderCard } from "@/components/TraderCard";
import { SkeletonTraderCard } from "@/components/SkeletonCard";
import { apiFetch } from "@/lib/utils";
import type { TraderListItem } from "@/lib/types";
import { formatUSD } from "@/lib/types";
import { ArrowRight, ArrowUpRight, Activity, Lock, Globe } from "lucide-react";

const TICKER_ITEMS = [
  { label: "Network", value: "Solana Devnet" },
  { label: "Program", value: "Anchor 1.0" },
  { label: "Score Range", value: "0 – 1000" },
  { label: "HWM Enforced", value: "On-chain" },
  { label: "Profit Split", value: "20–35% trader" },
  { label: "Platform Fee", value: "5%" },
  { label: "Elite Threshold", value: "900+" },
  { label: "Settlement", value: "USDC" },
];

function ProtocolTicker() {
  const items = [...TICKER_ITEMS, ...TICKER_ITEMS];
  return (
    <div
      className="overflow-hidden py-3 relative"
      style={{ borderBottom: "1px solid var(--color-line)", background: "var(--color-panel)" }}
    >
      <div
        className="flex gap-10 whitespace-nowrap"
        style={{ animation: "ticker-scroll 30s linear infinite" }}
      >
        {items.map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2.5 flex-shrink-0">
            <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: "var(--color-faint)" }}>
              {item.label}
            </span>
            <span className="text-[11px] font-mono font-bold" style={{ color: "var(--color-accent)" }}>
              {item.value}
            </span>
            <span className="w-px h-3 inline-block opacity-30" style={{ background: "var(--color-faint)" }} />
          </span>
        ))}
      </div>
    </div>
  );
}

const TIERS = [
  { name: "Verified",    range: "600–699", color: "#60a5fa", pct: 60 },
  { name: "Established", range: "700–799", color: "#34d399", pct: 72 },
  { name: "Advanced",    range: "800–899", color: "#f59e0b", pct: 84 },
  { name: "Elite",       range: "900+",    color: "#a855f7", pct: 100 },
];

export default function LandingPage() {
  const { data: traders, isLoading } = useQuery<TraderListItem[]>({
    queryKey: ["traders"],
    queryFn: () => apiFetch("/traders"),
  });

  const totalAUM  = traders?.reduce((a, t) => a + t.aum, 0) ?? 0;
  const topReturn = traders ? Math.max(...traders.map((t) => t.return_30d)) : 0;
  const avgScore  = traders?.length
    ? Math.round(traders.reduce((a, t) => a + t.score, 0) / traders.length)
    : 0;

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>

      <ProtocolTicker />

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative min-h-[92dvh] grid grid-cols-1 lg:grid-cols-[1fr_380px] overflow-hidden">

        {/* Left — copy */}
        <div className="flex flex-col justify-center px-8 md:px-14 py-20 relative z-10">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(rgba(178,255,0,0.016) 1px, transparent 1px), linear-gradient(90deg, rgba(178,255,0,0.016) 1px, transparent 1px)",
              backgroundSize: "72px 72px",
            }}
          />
          <div className="relative">
            <div
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded text-[10px] font-bold mb-10 uppercase tracking-widest"
              style={{
                background: "var(--color-accent-dim)",
                border: "1px solid rgba(178,255,0,0.2)",
                color: "var(--color-accent)",
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: "var(--color-accent)", animation: "pulse 2s ease-in-out infinite" }}
              />
              Devnet live · Solana
            </div>

            <h1
              className="font-black leading-none tracking-tight mb-7"
              style={{ fontSize: "clamp(3rem, 8vw, 7.5rem)", letterSpacing: "-0.04em" }}
            >
              <span style={{ color: "var(--color-ink)" }}>On-chain</span>
              <br />
              <span style={{ color: "var(--color-accent)" }}>reputation.</span>
            </h1>

            <p
              className="text-base md:text-lg mb-10 leading-relaxed max-w-[420px]"
              style={{ color: "var(--color-muted)" }}
            >
              Every trade scored immutably. Fund the best traders, earn proportional returns — on Solana.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link href="/traders" className="btn-accent">
                Explore Traders <ArrowRight size={14} />
              </Link>
              <Link href="/leaderboard" className="btn-ghost">
                Leaderboard
              </Link>
            </div>
          </div>
        </div>

        {/* Right — live stats panel */}
        <div
          className="hidden lg:flex flex-col justify-center px-8 py-20 gap-0"
          style={{ borderLeft: "1px solid var(--color-line)", background: "var(--color-panel)" }}
        >
          <p className="text-[10px] font-mono uppercase tracking-widest mb-4" style={{ color: "var(--color-faint)" }}>
            Protocol · Live
          </p>

          {[
            { label: "Total AUM",      value: isLoading ? "—" : formatUSD(totalAUM, 0),                        accent: false },
            { label: "Active Traders", value: isLoading ? "—" : (traders?.length ?? "—").toString(),           accent: false },
            { label: "Top 30d Return", value: isLoading ? "—" : topReturn ? `+${topReturn.toFixed(1)}%` : "—", accent: true  },
            { label: "Avg Score",      value: isLoading ? "—" : avgScore ? avgScore.toString() : "—",          accent: false },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-baseline justify-between py-4"
              style={{ borderBottom: "1px solid var(--color-line)" }}
            >
              <p className="text-xs font-semibold" style={{ color: "var(--color-faint)" }}>{s.label}</p>
              <p
                className="text-2xl font-black tnum"
                style={{ color: s.accent ? "var(--color-accent)" : "var(--color-ink)", letterSpacing: "-0.03em" }}
              >
                {s.value}
              </p>
            </div>
          ))}

          {/* Score tier bars */}
          <div className="mt-8">
            <p className="text-[10px] font-mono uppercase tracking-widest mb-4" style={{ color: "var(--color-faint)" }}>
              Score Tiers
            </p>
            <div className="flex flex-col gap-3">
              {TIERS.map((t) => (
                <div key={t.name} className="flex items-center gap-3">
                  <span className="text-[10px] font-bold w-24 flex-shrink-0" style={{ color: t.color }}>
                    {t.name}
                  </span>
                  <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: "var(--color-line)" }}>
                    <div className="h-full rounded-full" style={{ width: `${t.pct}%`, background: t.color }} />
                  </div>
                  <span className="text-[10px] font-mono w-12 text-right flex-shrink-0" style={{ color: "var(--color-faint)" }}>
                    {t.range}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom accent rule */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: "linear-gradient(90deg, var(--color-accent), transparent 55%)" }}
        />
        {/* Glow */}
        <div
          className="pointer-events-none absolute bottom-0 left-0"
          style={{
            width: 500,
            height: 350,
            background: "radial-gradient(ellipse at 0% 100%, rgba(178,255,0,0.07) 0%, transparent 70%)",
          }}
        />
      </section>

      {/* ── Top Traders ──────────────────────────────────────── */}
      <section
        className="px-8 md:px-14 py-16"
        style={{ borderTop: "1px solid var(--color-line)" }}
      >
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2
              className="text-2xl font-black tracking-tight"
              style={{ color: "var(--color-ink)", letterSpacing: "-0.03em" }}
            >
              Top Traders
            </h2>
            <p className="text-sm mt-1" style={{ color: "var(--color-faint)" }}>
              Ranked by Arcadia Score
            </p>
          </div>
          <Link
            href="/traders"
            className="inline-flex items-center gap-1.5 text-xs font-bold"
            style={{ color: "var(--color-accent)" }}
          >
            View all <ArrowUpRight size={12} />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {isLoading
            ? Array.from({ length: 3 }).map((_, i) => <SkeletonTraderCard key={i} />)
            : traders
                ?.sort((a, b) => b.score - a.score)
                .slice(0, 3)
                .map((t) => <TraderCard key={t.handle} trader={t} />)}
        </div>
      </section>

      {/* ── Protocol steps ───────────────────────────────────── */}
      <section style={{ borderTop: "1px solid var(--color-line)" }}>
        <div className="px-8 md:px-14 py-10" style={{ borderBottom: "1px solid var(--color-line)" }}>
          <h2
            className="text-2xl font-black tracking-tight"
            style={{ color: "var(--color-ink)", letterSpacing: "-0.03em" }}
          >
            Protocol
          </h2>
        </div>

        {[
          {
            Icon: Activity,
            n: "01",
            title: "Build on-chain rep",
            desc: "Every trade emits a TradeClosed event via the Anchor program. Arcadia scores traders on sharpe, sortino, drawdown control, and consistency. Your score is immutable, public, and lives on Solana.",
            href: "/reputation",
            cta: "View Score",
          },
          {
            Icon: Globe,
            n: "02",
            title: "Fund vaults",
            desc: "Each trader profile IS their vault. Deposit USDC, receive proportional shares tracked by InvestorPosition PDAs. Your exposure is always pro-rata. No custodian.",
            href: "/traders",
            cta: "Browse Vaults",
          },
          {
            Icon: Lock,
            n: "03",
            title: "Transparent splits",
            desc: "20–35% to the trader by score tier. 5% platform fee. Remainder accrues to investor NAV above the high-water mark. Every split enforced by the Anchor program — no trust required.",
            href: "/leaderboard",
            cta: "Leaderboard",
          },
        ].map((step) => {
          const Icon = step.Icon;
          return (
            <div
              key={step.n}
              className="grid grid-cols-1 lg:grid-cols-[140px_1fr_200px] items-start px-8 md:px-14 py-10 gap-8"
              style={{ borderBottom: "1px solid var(--color-line)" }}
            >
              <div className="flex items-center gap-4 lg:flex-col lg:items-start lg:gap-3 pt-0.5">
                <span
                  className="text-4xl font-black tnum leading-none"
                  style={{ color: "var(--color-line)", letterSpacing: "-0.06em" }}
                >
                  {step.n}
                </span>
                <div
                  className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--color-accent-dim)", border: "1px solid rgba(178,255,0,0.18)" }}
                >
                  <Icon size={14} style={{ color: "var(--color-accent)" }} />
                </div>
              </div>

              <div>
                <h3
                  className="text-lg font-black mb-3 tracking-tight"
                  style={{ color: "var(--color-ink)", letterSpacing: "-0.02em" }}
                >
                  {step.title}
                </h3>
                <p className="text-sm leading-relaxed max-w-xl" style={{ color: "var(--color-muted)" }}>
                  {step.desc}
                </p>
              </div>

              <div className="flex lg:justify-end items-start">
                <Link
                  href={step.href}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-4 py-2 rounded"
                  style={{
                    border: "1px solid rgba(178,255,0,0.2)",
                    color: "var(--color-accent)",
                    background: "var(--color-accent-dim)",
                  }}
                >
                  {step.cta} <ArrowRight size={11} />
                </Link>
              </div>
            </div>
          );
        })}
      </section>

      {/* ── CTA Banner ───────────────────────────────────────── */}
      <section
        className="px-8 md:px-14 py-16 flex flex-col md:flex-row md:items-center md:justify-between gap-8"
        style={{ borderTop: "1px solid var(--color-line)", background: "var(--color-panel)" }}
      >
        <div>
          <h2
            className="text-2xl font-black tracking-tight mb-2"
            style={{ color: "var(--color-ink)", letterSpacing: "-0.03em" }}
          >
            Ready to trade with receipts?
          </h2>
          <p className="text-sm" style={{ color: "var(--color-muted)" }}>
            Connect a wallet and start building your on-chain reputation on Solana devnet.
          </p>
        </div>
        <div className="flex flex-wrap gap-3 flex-shrink-0">
          <Link href="/terminal" className="btn-accent">
            Open Terminal <ArrowRight size={14} />
          </Link>
          <Link href="/dashboard" className="btn-ghost">
            Dashboard
          </Link>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer
        className="px-8 md:px-14 py-6 flex items-center justify-between"
        style={{ borderTop: "1px solid var(--color-line)" }}
      >
        <p
          className="text-sm font-black tracking-widest uppercase"
          style={{ color: "var(--color-accent)" }}
        >
          ARCADIA
        </p>
        <p className="text-[11px] font-mono" style={{ color: "var(--color-faint)" }}>
          Built on Solana · Anchor 1.0 · Devnet
        </p>
      </footer>
    </div>
  );
}
