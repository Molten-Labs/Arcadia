"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import type { TraderListItem } from "@/lib/types";
import { formatUSD } from "@/lib/types";
import { ChevronDown, ArrowRight, ArrowUpRight, TrendingUp, Users, Shield, Zap } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRole } from "@/lib/role-context";

/* ─── SCROLL REVEAL ─────────────────────────────────────────────────── */
function useReveal(threshold = 0.12) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { el.classList.add("is-visible"); obs.disconnect(); } },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return ref;
}

/* ─── COUNTER ANIMATION ─────────────────────────────────────────────── */
function useCounter(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      obs.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min((now - start) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        setValue(Math.round(ease * target));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);
  return { ref, value };
}

/* ─── FAQ DATA ───────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: "Can the trader run off with my money?",
    a: "No. Your USDC stays inside an on-chain Program Derived Address (PDA) — a smart-contract vault the trader can never withdraw from directly. Only profit above the high-water mark can be claimed by anyone, and only through the protocol's verified payout instruction.",
  },
  {
    q: "How do I know the score isn't made up?",
    a: "Every trade is a TradeClosed event permanently written to Solana — a public, immutable ledger anyone can verify. The score is computed from those receipts by an open-source formula. Screenshots can be faked; on-chain events cannot. There is no override mechanism.",
  },
  {
    q: "What is the Arcadia Score, in plain English?",
    a: "It's a 0–1000 number that measures how consistently and safely a trader makes money. Higher scores mean steadier returns with fewer blow-ups — not just big wins. It's closer to a risk-adjusted credit score than a raw profit leaderboard.",
  },
  {
    q: "How does profit-sharing work?",
    a: "Profit above the high-water mark (the vault's all-time peak) is split: traders keep 20–35% depending on their tier, the platform takes 5%, and the rest stays with investors as appreciation in vault share value. Nothing is charged on flat or losing periods.",
  },
  {
    q: "Do I need to be a trader to participate?",
    a: "No. Investors only need a Solana wallet with USDC. Browse the marketplace, pick a trader whose score and strategy match your risk appetite, and deposit — the protocol handles everything else on-chain.",
  },
  {
    q: "What is a high-water mark?",
    a: "A high-water mark (HWM) means the trader can only claim profit when the vault reaches a new all-time high. If a vault drops 20% then recovers 20%, no payout is triggered until it surpasses the previous peak. This protects investors from paying fees twice on the same gains.",
  },
];

/* ─── TIER DATA ─────────────────────────────────────────────────────── */
const TIERS = [
  { name: "Verified",    min: 0,    pct: 20, color: "#60a5fa" },
  { name: "Established", min: 700,  pct: 25, color: "#818cf8" },
  { name: "Advanced",    min: 800,  pct: 30, color: "#f59e0b" },
  { name: "Elite",       min: 900,  pct: 35, color: "#a855f7" },
];

const TIER_COLOR: Record<string, string> = {
  Elite: "#a855f7", Advanced: "#f59e0b", Established: "#818cf8", Verified: "#60a5fa",
};

const SCORE_BARS = [
  { label: "Sortino Ratio",    weight: 30, color: "#4f9eff", val: 91 },
  { label: "Sharpe Ratio",     weight: 25, color: "#818cf8", val: 84 },
  { label: "Consistency",      weight: 25, color: "#22c55e", val: 88 },
  { label: "Drawdown Control", weight: 20, color: "#f0b429", val: 72 },
];

const HOW_STEPS = [
  { n: "01", title: "Trade on Solana",       body: "Use Drift, Jupiter, or any supported venue. Every position you open and close is a permanent on-chain event." },
  { n: "02", title: "Get scored instantly",  body: "Our indexer reads each TradeClosed event and updates your Arcadia Score — a 0–1000 risk-adjusted performance number — within seconds." },
  { n: "03", title: "Earn a tier",           body: "Cross a score threshold and your tier upgrades automatically. Higher tier = higher profit split: from 20% (Verified) up to 35% (Elite)." },
  { n: "04", title: "Open your vault",       body: "Your vault opens to investors proportional to your score. They deposit USDC. You trade with the combined capital — no extra effort required." },
  { n: "05", title: "Get paid on-chain",     body: "When the vault beats its high-water mark, you request a payout. The split executes instantly on Solana, straight to your wallet in under 2 seconds." },
];

/* ─── FLOATING HERO CARDS ───────────────────────────────────────────── */
function HeroCards() {
  return (
    <div style={{
      position: "relative",
      width: "100%",
      height: "100%",
      minHeight: 460,
    }}>
      {/* Card 1: Trader profile */}
      <div style={{
        position: "absolute", top: "8%", left: "5%",
        background: "#0c0c0c", border: "1px solid #1c1c1c",
        borderRadius: 12, padding: "1rem 1.25rem", width: 220,
        animation: "float-a 6s ease-in-out infinite",
        boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "rgba(79,158,255,0.15)", border: "1px solid rgba(79,158,255,0.3)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 800, color: "#4f9eff",
          }}>NO</div>
          <div>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700, color: "#f0f0f0", margin: 0 }}>@nova</p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#a855f7", margin: 0 }}>● Elite tier</p>
          </div>
          <div style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9, color: "#22c55e" }}>+41.2%</div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "2rem", fontWeight: 800, color: "#f0f0f0", letterSpacing: "-0.04em", lineHeight: 1 }}>912</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "#363636" }}>/1000</span>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase", color: "#363636", marginTop: 4, marginBottom: 0 }}>Arcadia Score</p>
        <div style={{ marginTop: 10, height: 4, borderRadius: 2, background: "#1c1c1c", overflow: "hidden" }}>
          <div style={{ width: "91.2%", height: "100%", background: "linear-gradient(90deg, #4f9eff, #a855f7)", borderRadius: 2 }} />
        </div>
      </div>

      {/* Card 2: Vault / investor card */}
      <div style={{
        position: "absolute", top: "30%", right: "8%",
        background: "#0c0c0c", border: "1px solid #1c1c1c",
        borderRadius: 12, padding: "1rem 1.25rem", width: 200,
        animation: "float-b 7s ease-in-out infinite",
        boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
      }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: "#363636", marginBottom: 8, marginTop: 0 }}>Vault · @nova</p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 900, color: "#22c55e", letterSpacing: "-0.03em", margin: 0 }}>$387K</p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#6a6a6a", marginTop: 4, marginBottom: 12 }}>of $912K capacity</p>
        <div style={{ height: 3, background: "#1c1c1c", borderRadius: 2, marginBottom: 10, overflow: "hidden" }}>
          <div style={{ width: "42%", height: "100%", background: "#22c55e", borderRadius: 2 }} />
        </div>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 5,
          background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
          borderRadius: 4, padding: "3px 8px",
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#22c55e", fontWeight: 700 }}>OPEN · $525K left</span>
        </div>
      </div>

      {/* Card 3: Payout receipt */}
      <div style={{
        position: "absolute", bottom: "12%", left: "12%",
        background: "#0c0c0c", border: "1px solid #1c1c1c",
        borderRadius: 12, padding: "0.875rem 1.25rem", width: 210,
        animation: "float-c 5.5s ease-in-out infinite",
        boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Zap size={12} style={{ color: "#4f9eff" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase", color: "#363636" }}>Payout · Solana</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#22c55e", marginLeft: "auto" }}>1.8s</span>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 900, color: "#f0f0f0", letterSpacing: "-0.03em", margin: 0 }}>+$6,810</p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#6a6a6a", marginTop: 4, marginBottom: 8 }}>35% of profit above HWM</p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#363636", margin: 0 }}>4PqRtLv9Xw…M3kN ↗</p>
      </div>

      {/* Card 4: Score breakdown mini */}
      <div style={{
        position: "absolute", top: "55%", left: "32%",
        background: "#0c0c0c", border: "1px solid #1c1c1c",
        borderRadius: 12, padding: "0.875rem 1rem", width: 160,
        animation: "float-a 8s ease-in-out infinite 1s",
        boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
      }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase", color: "#363636", margin: "0 0 8px" }}>Score components</p>
        {[{ l: "Sortino", v: 91, c: "#4f9eff" }, { l: "Sharpe", v: 84, c: "#818cf8" }, { l: "Consistency", v: 88, c: "#22c55e" }].map(b => (
          <div key={b.l} style={{ marginBottom: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: "#6a6a6a" }}>{b.l}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 7, color: b.c, fontWeight: 700 }}>{b.v}</span>
            </div>
            <div style={{ height: 2, background: "#1c1c1c", borderRadius: 1 }}>
              <div style={{ width: `${b.v}%`, height: "100%", background: b.c, borderRadius: 1 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── FAQ ACCORDION ─────────────────────────────────────────────────── */
function FAQ() {
  const [active, setActive] = useState<number | null>(null);
  return (
    <div>
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = active === i;
        return (
          <div key={i} onClick={() => setActive(isOpen ? null : i)} style={{
            borderBottom: "1px solid #1c1c1c",
            cursor: "pointer",
          }}>
            <div style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "1.375rem 0",
              color: isOpen ? "#f0f0f0" : "#6a6a6a",
              transition: "color 0.15s",
              fontSize: "0.9375rem", fontWeight: 500,
            }}>
              <span>{item.q}</span>
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                border: "1px solid #1c1c1c",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, marginLeft: 16,
                transition: "border-color 0.15s",
              }}>
                <ChevronDown size={12} style={{ transition: "transform 0.2s", transform: isOpen ? "rotate(180deg)" : "none", color: isOpen ? "#4f9eff" : "#363636" }} />
              </div>
            </div>
            {isOpen && (
              <p style={{
                paddingBottom: "1.375rem",
                fontSize: "0.875rem", color: "#6a6a6a", lineHeight: 1.75,
                animation: "fade-in 0.18s ease",
                margin: 0,
              }}>
                {item.a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ─── PAGE ───────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const router = useRouter();
  const { connected } = useWallet();
  const { role } = useRole();

  const problemRef  = useReveal();
  const stepsRef    = useReveal();
  const scoreRef    = useReveal();
  const flowRef     = useReveal();
  const faqRef      = useReveal();

  const score912   = useCounter(912);
  const traders8   = useCounter(8);
  const aum2m      = useCounter(2140000, 2000);

  useEffect(() => {
    if (connected && role) {
      router.replace(role === "trader" ? "/terminal" : "/dashboard");
    }
  }, [connected, role, router]);

  const { data: traders, isLoading } = useQuery<TraderListItem[]>({
    queryKey: ["traders"],
    queryFn: () => apiFetch("/traders"),
  });

  const topTraders   = [...(traders ?? [])].sort((a, b) => b.score - a.score).slice(0, 6);
  const totalAUM     = traders?.reduce((a, t) => a + t.aum, 0) ?? 0;

  return (
    <div style={{ background: "#000", minHeight: "100vh", fontFamily: "var(--font-sans)" }}>

      {/* ═══ HERO ════════════════════════════════════════════════════════ */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        minHeight: "calc(100vh - 3rem)",
        borderBottom: "1px solid #1c1c1c",
      }}>
        {/* Left */}
        <div style={{
          padding: "clamp(4rem, 8vw, 7rem) clamp(2rem, 5vw, 5rem)",
          display: "flex", flexDirection: "column", justifyContent: "center",
          position: "relative", overflow: "hidden",
        }}>
          {/* Subtle dot grid */}
          <div aria-hidden style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "radial-gradient(circle, #1c1c1c 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            WebkitMaskImage: "radial-gradient(ellipse at 10% 50%, black 0%, transparent 65%)",
            maskImage: "radial-gradient(ellipse at 10% 50%, black 0%, transparent 65%)",
          }} />

          {/* Status pill */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: "clamp(2rem, 5vw, 3.5rem)", position: "relative" }}>
            <span style={{
              width: 6, height: 6, borderRadius: "50%", background: "#22c55e",
              animation: "glow-pulse 2s ease-in-out infinite",
              boxShadow: "0 0 6px rgba(34,197,94,0.5)",
            }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "#363636" }}>
              Solana · Devnet · Live
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontWeight: 800,
            fontSize: "clamp(2.5rem, 5.5vw, 5rem)",
            lineHeight: 1.05, letterSpacing: "-0.045em",
            color: "#f0f0f0", margin: 0, position: "relative",
          }}>
            Trading talent,<br />
            <span style={{ color: "#4f9eff" }}>finally</span>{" "}
            investable.
          </h1>

          <p style={{
            marginTop: "clamp(1.25rem, 3vw, 2rem)",
            fontSize: "clamp(0.9375rem, 1.5vw, 1.0625rem)",
            color: "#6a6a6a", maxWidth: "44ch", lineHeight: 1.7,
            position: "relative",
          }}>
            Arcadia turns every on-chain trade into a permanent, tamper-proof reputation score.
            Skilled traders earn capital. Investors back them — safely, transparently, on Solana.
          </p>

          {/* CTAs */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "clamp(2rem, 4vw, 2.5rem)", flexWrap: "wrap", position: "relative" }}>
            <Link href="/traders" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "#4f9eff", color: "#ffffff",
              fontWeight: 700, fontSize: "0.875rem",
              padding: "11px 22px", borderRadius: 8,
              textDecoration: "none", transition: "background 0.15s, transform 0.15s",
              letterSpacing: "-0.01em",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#74b5ff"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#4f9eff"; e.currentTarget.style.transform = "none"; }}
            >
              Browse vaults <ArrowUpRight size={14} />
            </Link>
            <Link href="/terminal" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "transparent", border: "1px solid #1c1c1c",
              color: "#6a6a6a",
              fontWeight: 600, fontSize: "0.875rem",
              padding: "10px 20px", borderRadius: 8,
              textDecoration: "none", transition: "border-color 0.15s, color 0.15s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(79,158,255,0.35)"; e.currentTarget.style.color = "#f0f0f0"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1c1c1c"; e.currentTarget.style.color = "#6a6a6a"; }}
            >
              Start trading
            </Link>
          </div>

          {/* Stat row */}
          <div style={{ display: "flex", gap: "clamp(1.5rem, 3vw, 2.5rem)", marginTop: "clamp(3rem, 6vw, 5rem)", flexWrap: "wrap", position: "relative" }}>
            {[
              { label: "Total AUM",      value: isLoading ? "—" : formatUSD(totalAUM, 0)             },
              { label: "Active traders", value: isLoading ? "—" : String(traders?.length ?? "—")     },
              { label: "Avg payout",     value: "1.8s"                                               },
            ].map((s) => (
              <div key={s.label}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: "#363636", marginBottom: 4 }}>{s.label}</p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, color: "#f0f0f0", letterSpacing: "-0.02em" }}>{s.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — floating cards */}
        <div style={{
          borderLeft: "1px solid #1c1c1c",
          padding: "4rem 3rem",
          display: "flex", alignItems: "center",
          background: "radial-gradient(ellipse at 70% 40%, rgba(79,158,255,0.04) 0%, transparent 60%)",
        }}>
          <HeroCards />
        </div>
      </section>

      {/* ═══ TRUST STRIP ════════════════════════════════════════════════ */}
      <div style={{
        borderBottom: "1px solid #1c1c1c",
        padding: "1.25rem clamp(2rem, 5vw, 5rem)",
        display: "flex", alignItems: "center", gap: "2rem", flexWrap: "wrap",
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: "#2a2a2a", flexShrink: 0 }}>
          Built on
        </span>
        {[
          { name: "Solana", dot: "#a855f7"  },
          { name: "Drift",  dot: "#4f9eff"  },
          { name: "Jupiter",dot: "#22c55e"  },
        ].map((p, i) => (
          <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {i > 0 && <span style={{ color: "#1c1c1c", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>·</span>}
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: p.dot }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontWeight: 700, color: "#363636" }}>{p.name}</span>
          </div>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#363636", letterSpacing: "0.1em" }}>All trades verified on-chain</span>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", animation: "glow-pulse 2s ease-in-out infinite" }} />
        </div>
      </div>

      {/* ═══ THE PROBLEM ════════════════════════════════════════════════ */}
      <section
        ref={problemRef}
        className="section-reveal"
        style={{ borderBottom: "1px solid #1c1c1c" }}
      >
        {/* Section label row */}
        <div style={{ padding: "0.875rem clamp(2rem, 5vw, 5rem)", borderBottom: "1px solid #1c1c1c", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.25em", textTransform: "uppercase", color: "#363636" }}>The Problem</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          {/* Trader problem */}
          <div style={{
            borderRight: "1px solid #1c1c1c",
            padding: "clamp(3rem, 6vw, 5rem) clamp(2rem, 5vw, 5rem)",
          }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(79,158,255,0.08)", border: "1px solid rgba(79,158,255,0.18)",
              borderRadius: 4, padding: "3px 10px", marginBottom: "2rem",
            }}>
              <TrendingUp size={10} style={{ color: "#4f9eff" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: "#4f9eff", fontWeight: 700 }}>For Traders</span>
            </div>

            <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.04em", color: "#f0f0f0", lineHeight: 1.15, margin: "0 0 1.25rem" }}>
              Great traders are<br /><span style={{ color: "#ef4444" }}>invisible.</span>
            </h2>

            <p style={{ fontSize: "1rem", color: "#6a6a6a", lineHeight: 1.75, maxWidth: "42ch", margin: "0 0 2rem" }}>
              You've been profitable for two years but nobody knows. Every exchange shows your history in a private dashboard. Every claim you make requires a screenshot — and screenshots are trivially faked.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                "Track record lives in a private dashboard nobody can verify",
                "Screenshots can be edited in 30 seconds",
                "No way to turn performance into real investment capital",
              ].map((txt) => (
                <div key={txt} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#ef4444", flexShrink: 0, marginTop: 8 }} />
                  <span style={{ fontSize: "0.875rem", color: "#6a6a6a", lineHeight: 1.6 }}>{txt}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Investor problem */}
          <div style={{
            padding: "clamp(3rem, 6vw, 5rem) clamp(2rem, 5vw, 5rem)",
          }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(240,180,41,0.07)", border: "1px solid rgba(240,180,41,0.18)",
              borderRadius: 4, padding: "3px 10px", marginBottom: "2rem",
            }}>
              <Users size={10} style={{ color: "#f0b429" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: "#f0b429", fontWeight: 700 }}>For Investors</span>
            </div>

            <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)", fontWeight: 800, letterSpacing: "-0.04em", color: "#f0f0f0", lineHeight: 1.15, margin: "0 0 1.25rem" }}>
              Investors are<br /><span style={{ color: "#ef4444" }}>flying blind.</span>
            </h2>

            <p style={{ fontSize: "1rem", color: "#6a6a6a", lineHeight: 1.75, maxWidth: "42ch", margin: "0 0 2rem" }}>
              You want exposure to skilled crypto traders. But every allocation relies on trust — trust in screenshots, trust in backtests, trust in a stranger's claim. One edited screenshot and your money is gone.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                "No way to verify claimed performance is real",
                "Funds sent to a wallet = the trader can disappear",
                "No custody protection, no on-chain audit trail",
              ].map((txt) => (
                <div key={txt} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#ef4444", flexShrink: 0, marginTop: 8 }} />
                  <span style={{ fontSize: "0.875rem", color: "#6a6a6a", lineHeight: 1.6 }}>{txt}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══ NO CUSTODY CALLOUT ══════════════════════════════════════════ */}
      <section style={{
        borderBottom: "1px solid #1c1c1c",
        background: "#050505",
        padding: "clamp(4rem, 8vw, 7rem) clamp(2rem, 5vw, 5rem)",
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: "4rem",
        alignItems: "center",
      }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1.5rem" }}>
            <Shield size={13} style={{ color: "#22c55e" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.25em", textTransform: "uppercase", color: "#363636" }}>Non-Custodial</span>
          </div>
          <h2 style={{ fontSize: "clamp(2rem, 4.5vw, 3.5rem)", fontWeight: 800, letterSpacing: "-0.045em", color: "#f0f0f0", lineHeight: 1.1, margin: "0 0 1.25rem" }}>
            Your funds never<br />leave the chain.
          </h2>
          <p style={{ fontSize: "1rem", color: "#6a6a6a", lineHeight: 1.75, maxWidth: "44ch", margin: 0 }}>
            Investor USDC sits inside an on-chain vault — a smart-contract account that only the protocol can instruct.
            The trader uses it to trade. They cannot withdraw it. Nobody can.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[
            { label: "Funds held by",       value: "Smart contract (PDA)",  ok: true  },
            { label: "Trader can withdraw",  value: "Profit above HWM only", ok: true  },
            { label: "Arcadia can withdraw", value: "Never",                 ok: true  },
            { label: "Platform fee",         value: "5% of profit only",     ok: true  },
            { label: "Losing periods",       value: "No fees charged",       ok: true  },
          ].map((row) => (
            <div key={row.label} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "0.875rem 1.25rem",
              background: "#0c0c0c", border: "1px solid #1c1c1c",
              borderRadius: 8,
            }}>
              <span style={{ fontSize: "0.875rem", color: "#6a6a6a" }}>{row.label}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#f0f0f0" }}>{row.value}</span>
                <span style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#22c55e" }}>✓</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ HOW IT WORKS ════════════════════════════════════════════════ */}
      <section
        ref={stepsRef}
        className="section-reveal"
        style={{ borderBottom: "1px solid #1c1c1c" }}
      >
        <div style={{ padding: "0.875rem clamp(2rem, 5vw, 5rem)", borderBottom: "1px solid #1c1c1c", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.25em", textTransform: "uppercase", color: "#363636" }}>How It Works</span>
        </div>

        <div style={{ padding: "clamp(3rem, 6vw, 5rem) clamp(2rem, 5vw, 5rem)" }}>
          <h2 style={{ fontSize: "clamp(1.5rem, 3vw, 2.25rem)", fontWeight: 800, letterSpacing: "-0.04em", color: "#f0f0f0", marginBottom: "3rem", maxWidth: "30ch" }}>
            Five steps from first trade to first payout.
          </h2>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "1.5rem" }}>
            {HOW_STEPS.map((step, i) => (
              <div key={step.n} style={{
                position: "relative",
                animation: `fade-in 0.4s ease ${i * 100}ms both`,
              }}>
                {/* Connector line */}
                {i < HOW_STEPS.length - 1 && (
                  <div style={{
                    position: "absolute", top: "1.5rem", left: "calc(100% + 0.5rem)",
                    width: "calc(1.5rem - 1px)", height: 1,
                    background: "linear-gradient(90deg, #1c1c1c, transparent)",
                    zIndex: 1,
                  }} />
                )}
                <div style={{
                  fontFamily: "var(--font-mono)", fontSize: "0.6875rem", fontWeight: 900,
                  color: "#4f9eff", letterSpacing: "0.05em",
                  marginBottom: "1rem",
                }}>
                  {step.n}
                </div>
                <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#f0f0f0", letterSpacing: "-0.02em", marginBottom: "0.75rem", lineHeight: 1.3 }}>
                  {step.title}
                </h3>
                <p style={{ fontSize: "0.8125rem", color: "#6a6a6a", lineHeight: 1.65 }}>
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ THE SCORE ═══════════════════════════════════════════════════ */}
      <section
        ref={scoreRef}
        className="section-reveal"
        style={{ borderBottom: "1px solid #1c1c1c" }}
      >
        <div style={{ padding: "0.875rem clamp(2rem, 5vw, 5rem)", borderBottom: "1px solid #1c1c1c" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.25em", textTransform: "uppercase", color: "#363636" }}>The Score</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
          {/* Big number */}
          <div style={{
            padding: "clamp(2.5rem, 5vw, 4rem) clamp(2rem, 5vw, 5rem)",
            borderRight: "1px solid #1c1c1c",
            display: "flex", flexDirection: "column", justifyContent: "center",
          }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase", color: "#363636", marginBottom: "1.25rem" }}>
              Example score
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span ref={score912.ref} suppressHydrationWarning style={{ fontFamily: "var(--font-mono)", fontWeight: 900, fontSize: "clamp(4rem, 7vw, 6rem)", lineHeight: 1, letterSpacing: "-0.05em", color: "#f0f0f0" }}>
                {score912.value}
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", color: "#363636", fontWeight: 300 }}>/1000</span>
            </div>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)",
              borderRadius: 4, padding: "3px 10px", marginTop: "1rem", alignSelf: "flex-start",
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#a855f7" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#a855f7", fontWeight: 700 }}>Elite Tier</span>
            </div>
            <p style={{ fontSize: "0.875rem", color: "#6a6a6a", lineHeight: 1.7, maxWidth: "34ch", marginTop: "1.25rem" }}>
              A risk-adjusted 0–1000 number anchored on immutable Solana trade receipts.
              No curator. No appeals. No override.
            </p>
          </div>

          {/* Score bars */}
          <div style={{
            padding: "clamp(2.5rem, 5vw, 4rem) clamp(2rem, 5vw, 4rem)",
            borderRight: "1px solid #1c1c1c",
            display: "flex", flexDirection: "column", justifyContent: "center",
            gap: "2rem",
          }}>
            {SCORE_BARS.map((b, i) => (
              <div key={b.label}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <span style={{ width: 7, height: 7, borderRadius: 2, background: b.color, flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "#6a6a6a" }}>{b.label}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#363636" }}>{b.weight}% weight</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 700, color: "#f0f0f0" }}>
                      {b.val}<span style={{ color: "#363636", fontWeight: 300, fontSize: "0.75rem" }}>/100</span>
                    </span>
                  </div>
                </div>
                <div className="progress-track">
                  <div
                    className="score-bar"
                    style={{
                      height: "100%",
                      width: `${b.val}%`,
                      background: b.color,
                      borderRadius: 3,
                      opacity: 0.8,
                      "--delay": `${i * 120}ms`,
                    } as React.CSSProperties}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Tier table */}
          <div style={{
            padding: "clamp(2.5rem, 5vw, 4rem) clamp(2rem, 5vw, 4rem)",
            display: "flex", flexDirection: "column", justifyContent: "center",
          }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase", color: "#363636", marginBottom: "1.25rem" }}>
              Profit split · by tier
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {TIERS.map((t) => (
                <div key={t.name} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "0.875rem 1rem",
                  background: "#0c0c0c", border: "1px solid #1c1c1c",
                  borderRadius: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontWeight: 700, color: "#f0f0f0", margin: 0, lineHeight: 1.3 }}>{t.name}</p>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#363636", margin: 0 }}>{t.min === 0 ? "All scores" : `Score ≥ ${t.min}`}</p>
                    </div>
                  </div>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.125rem", fontWeight: 900, color: t.color, letterSpacing: "-0.03em", margin: 0 }}>
                    {t.pct}%
                  </p>
                </div>
              ))}
            </div>
            <p style={{ marginTop: "0.875rem", fontSize: "0.75rem", color: "#363636", lineHeight: 1.5 }}>
              Platform: 5%. HWM per share. No fees on flat periods.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ FLOW: TRADERS vs INVESTORS ══════════════════════════════════ */}
      <section
        ref={flowRef}
        className="section-reveal"
        style={{ borderBottom: "1px solid #1c1c1c" }}
      >
        <div style={{ padding: "0.875rem clamp(2rem, 5vw, 5rem)", borderBottom: "1px solid #1c1c1c" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.25em", textTransform: "uppercase", color: "#363636" }}>Two Sides, One Protocol</span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
          {/* Traders */}
          <div style={{ borderRight: "1px solid #1c1c1c", padding: "clamp(3rem, 6vw, 5rem) clamp(2rem, 5vw, 5rem)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: "1.75rem" }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "rgba(79,158,255,0.1)", border: "1px solid rgba(79,158,255,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <TrendingUp size={13} style={{ color: "#4f9eff" }} />
              </div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#f0f0f0", margin: 0, letterSpacing: "-0.02em" }}>For Traders</h3>
            </div>

            <p style={{ fontSize: "0.9375rem", color: "#6a6a6a", lineHeight: 1.7, marginBottom: "2.5rem", maxWidth: "38ch" }}>
              Turn two years of profitable trading into a verifiable reputation and access real investor capital — without giving up your edge.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {[
                { n: "1", title: "Connect & fund",       body: "Connect your Solana wallet and fund your vault with USDC. No application, no approval required." },
                { n: "2", title: "Trade as normal",       body: "Open and close positions on Drift or Jupiter. Every trade is logged permanently on-chain in real time." },
                { n: "3", title: "Watch your score grow", body: "Your Arcadia Score updates automatically after each trade. Consistent wins push you up the tier ladder." },
                { n: "4", title: "Earn your split",       body: "When the vault beats its high-water mark, request a payout. 20–35% of profit, straight to your wallet in under 2s." },
              ].map((s, i) => (
                <div key={s.n} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    background: "rgba(79,158,255,0.1)", border: "1px solid rgba(79,158,255,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 800, color: "#4f9eff",
                    marginTop: 2,
                  }}>
                    {s.n}
                  </div>
                  <div>
                    <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#f0f0f0", margin: "0 0 3px", letterSpacing: "-0.01em" }}>{s.title}</p>
                    <p style={{ fontSize: "0.8125rem", color: "#6a6a6a", margin: 0, lineHeight: 1.6 }}>{s.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link href="/terminal" style={{
              display: "inline-flex", alignItems: "center", gap: 8, marginTop: "2.5rem",
              background: "#4f9eff", color: "#ffffff",
              fontWeight: 700, fontSize: "0.875rem",
              padding: "11px 22px", borderRadius: 8,
              textDecoration: "none", transition: "background 0.15s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#74b5ff")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#4f9eff")}
            >
              Start trading <ArrowRight size={14} />
            </Link>
          </div>

          {/* Investors */}
          <div style={{ padding: "clamp(3rem, 6vw, 5rem) clamp(2rem, 5vw, 5rem)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: "1.75rem" }}>
              <div style={{
                width: 28, height: 28, borderRadius: 8,
                background: "rgba(240,180,41,0.08)", border: "1px solid rgba(240,180,41,0.2)",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Users size={13} style={{ color: "#f0b429" }} />
              </div>
              <h3 style={{ fontSize: "1.125rem", fontWeight: 700, color: "#f0f0f0", margin: 0, letterSpacing: "-0.02em" }}>For Investors</h3>
            </div>

            <p style={{ fontSize: "0.9375rem", color: "#6a6a6a", lineHeight: 1.7, marginBottom: "2.5rem", maxWidth: "38ch" }}>
              Allocate to verified, on-chain-proven traders. Monitor every position in real time, with custody-safe on-chain infrastructure.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
              {[
                { n: "1", title: "Browse the marketplace",  body: "Filter traders by score, tier, strategy, AUM capacity, and 30-day return. Every stat is verified on-chain." },
                { n: "2", title: "Deposit into a vault",    body: "Choose a trader with open capacity. Deposit USDC — it goes straight into their smart-contract vault, not their wallet." },
                { n: "3", title: "Monitor in real time",    body: "Watch positions, NAV, and equity curve from your portfolio dashboard. Every trade is visible and public." },
                { n: "4", title: "Earn with the trader",   body: "When the vault hits a new high, your share value increases. No action needed — returns accrue automatically." },
              ].map((s, i) => (
                <div key={s.n} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: "50%", flexShrink: 0,
                    background: "rgba(240,180,41,0.08)", border: "1px solid rgba(240,180,41,0.2)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 800, color: "#f0b429",
                    marginTop: 2,
                  }}>
                    {s.n}
                  </div>
                  <div>
                    <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#f0f0f0", margin: "0 0 3px", letterSpacing: "-0.01em" }}>{s.title}</p>
                    <p style={{ fontSize: "0.8125rem", color: "#6a6a6a", margin: 0, lineHeight: 1.6 }}>{s.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <Link href="/traders" style={{
              display: "inline-flex", alignItems: "center", gap: 8, marginTop: "2.5rem",
              background: "#f0b429", color: "#0a0800",
              fontWeight: 700, fontSize: "0.875rem",
              padding: "11px 22px", borderRadius: 8,
              textDecoration: "none", transition: "background 0.15s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#f5c842")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#f0b429")}
            >
              Browse traders <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ═══ LIVE LEADERBOARD ════════════════════════════════════════════ */}
      <section style={{ borderBottom: "1px solid #1c1c1c" }}>
        <div style={{
          padding: "0.875rem clamp(2rem, 5vw, 5rem)", borderBottom: "1px solid #1c1c1c",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.25em", textTransform: "uppercase", color: "#363636" }}>Live Traders</span>
          <Link href="/leaderboard" style={{
            fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase",
            color: "#4f9eff", textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
          }}>
            Leaderboard <ArrowRight size={9} />
          </Link>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1c1c1c" }}>
                {["#", "Trader", "Score", "Tier", "30d Return", "AUM", "Action"].map((h) => (
                  <th key={h} style={{
                    padding: "0.625rem clamp(1.25rem, 3vw, 2.5rem)",
                    textAlign: "left",
                    fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase",
                    color: "#363636", fontWeight: 600,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #1c1c1c" }}>
                    {[20, 80, 30, 50, 40, 40, 30].map((w, j) => (
                      <td key={j} style={{ padding: "0.875rem clamp(1.25rem, 3vw, 2.5rem)" }}>
                        <div style={{ height: 6, borderRadius: 3, background: "#0c0c0c", width: `${w + i * 4}%` }} />
                      </td>
                    ))}
                  </tr>
                ))
                : topTraders.map((t, idx) => (
                  <tr key={t.handle} style={{ borderBottom: "1px solid #1c1c1c", transition: "background 0.1s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#050505")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "0.875rem clamp(1.25rem, 3vw, 2.5rem)" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "#363636" }}>{idx + 1}</span>
                    </td>
                    <td style={{ padding: "0.875rem clamp(1.25rem, 3vw, 2.5rem)" }}>
                      <Link href={`/t/${t.handle}`} style={{
                        fontFamily: "var(--font-sans)", fontSize: "0.875rem", fontWeight: 600, color: "#f0f0f0",
                        textDecoration: "none", transition: "color 0.1s",
                      }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#4f9eff")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#f0f0f0")}
                      >
                        @{t.handle}
                      </Link>
                    </td>
                    <td style={{ padding: "0.875rem clamp(1.25rem, 3vw, 2.5rem)" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 700, color: "#4f9eff" }}>{t.score}</span>
                    </td>
                    <td style={{ padding: "0.875rem clamp(1.25rem, 3vw, 2.5rem)" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: TIER_COLOR[t.tier] ?? "#6a6a6a" }} />
                        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: TIER_COLOR[t.tier] ?? "#6a6a6a" }}>{t.tier}</span>
                      </span>
                    </td>
                    <td style={{ padding: "0.875rem clamp(1.25rem, 3vw, 2.5rem)" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 700, color: t.return_30d >= 0 ? "#22c55e" : "#ef4444" }}>
                        {t.return_30d >= 0 ? "+" : ""}{t.return_30d.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding: "0.875rem clamp(1.25rem, 3vw, 2.5rem)" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "#6a6a6a" }}>{formatUSD(t.aum, 0)}</span>
                    </td>
                    <td style={{ padding: "0.875rem clamp(1.25rem, 3vw, 2.5rem)" }}>
                      <Link href={`/vault/${t.handle}`} style={{
                        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.1em", textTransform: "uppercase",
                        color: "#4f9eff", textDecoration: "none",
                        padding: "4px 10px", borderRadius: 4,
                        border: "1px solid rgba(79,158,255,0.2)",
                        transition: "background 0.1s",
                      }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(79,158,255,0.08)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        Invest →
                      </Link>
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </section>

      {/* ═══ FAQ ══════════════════════════════════════════════════════════ */}
      <section
        ref={faqRef}
        className="section-reveal"
        style={{ borderBottom: "1px solid #1c1c1c" }}
      >
        <div style={{ padding: "0.875rem clamp(2rem, 5vw, 5rem)", borderBottom: "1px solid #1c1c1c" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.25em", textTransform: "uppercase", color: "#363636" }}>FAQ</span>
        </div>

        <div style={{
          display: "grid", gridTemplateColumns: "1fr 2fr",
          padding: "clamp(3rem, 6vw, 5rem) clamp(2rem, 5vw, 5rem)",
          gap: "5rem", alignItems: "start",
        }}>
          <div>
            <h2 style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)", fontWeight: 800, letterSpacing: "-0.04em", color: "#f0f0f0", margin: "0 0 1rem", lineHeight: 1.2 }}>
              Common questions, honest answers.
            </h2>
            <p style={{ fontSize: "0.875rem", color: "#6a6a6a", lineHeight: 1.7 }}>
              No jargon. If the answer requires a whitepaper, we haven't simplified it enough.
            </p>
          </div>
          <FAQ />
        </div>
      </section>

      {/* ═══ DUAL CTA FOOTER ═════════════════════════════════════════════ */}
      <section style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        borderBottom: "1px solid #1c1c1c",
      }}>
        {/* Trader CTA */}
        <div style={{
          borderRight: "1px solid #1c1c1c",
          padding: "clamp(4rem, 8vw, 7rem) clamp(2rem, 5vw, 5rem)",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          background: "radial-gradient(ellipse at 20% 50%, rgba(79,158,255,0.04) 0%, transparent 60%)",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "1.5rem" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#4f9eff" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase", color: "#363636" }}>Traders</span>
            </div>
            <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", fontWeight: 800, letterSpacing: "-0.045em", color: "#f0f0f0", lineHeight: 1.15, margin: "0 0 1.25rem" }}>
              Your track record<br />belongs on-chain.
            </h2>
            <p style={{ fontSize: "1rem", color: "#6a6a6a", lineHeight: 1.7, maxWidth: "38ch" }}>
              Stop proving yourself with screenshots. Build a permanent reputation on Solana — one trade at a time.
            </p>
          </div>
          <Link href="/terminal" style={{
            display: "inline-flex", alignItems: "center", gap: 8, marginTop: "3rem", alignSelf: "flex-start",
            background: "#4f9eff", color: "#ffffff",
            fontWeight: 700, fontSize: "0.9375rem",
            padding: "13px 28px", borderRadius: 8,
            textDecoration: "none", transition: "background 0.15s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#74b5ff")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#4f9eff")}
          >
            Open terminal <ArrowRight size={15} />
          </Link>
        </div>

        {/* Investor CTA */}
        <div style={{
          padding: "clamp(4rem, 8vw, 7rem) clamp(2rem, 5vw, 5rem)",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          background: "radial-gradient(ellipse at 80% 50%, rgba(240,180,41,0.03) 0%, transparent 60%)",
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: "1.5rem" }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f0b429" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase", color: "#363636" }}>Investors</span>
            </div>
            <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", fontWeight: 800, letterSpacing: "-0.045em", color: "#f0f0f0", lineHeight: 1.15, margin: "0 0 1.25rem" }}>
              Back traders you<br />can verify.
            </h2>
            <p style={{ fontSize: "1rem", color: "#6a6a6a", lineHeight: 1.7, maxWidth: "38ch" }}>
              Browse scores, not stories. Every stat is on-chain. Every position is visible. Your capital stays in a smart contract vault.
            </p>
          </div>
          <Link href="/traders" style={{
            display: "inline-flex", alignItems: "center", gap: 8, marginTop: "3rem", alignSelf: "flex-start",
            background: "#f0b429", color: "#0a0800",
            fontWeight: 700, fontSize: "0.9375rem",
            padding: "13px 28px", borderRadius: 8,
            textDecoration: "none", transition: "background 0.15s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f5c842")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#f0b429")}
          >
            Browse vaults <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ═══ FOOTER ══════════════════════════════════════════════════════ */}
      <footer style={{
        padding: "1.5rem clamp(2rem, 5vw, 5rem)",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6, background: "#4f9eff",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 6, fontWeight: 900, color: "#fff", letterSpacing: "0.04em" }}>ARC</span>
          </div>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700, color: "#363636" }}>Arcadia Protocol</span>
        </div>
        <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
          {[
            { label: "Traders",     href: "/traders"   },
            { label: "Leaderboard", href: "/leaderboard"},
            { label: "Terminal",    href: "/terminal"  },
            { label: "Docs",        href: "#"          },
          ].map((l) => (
            <Link key={l.label} href={l.href} style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "#363636", textDecoration: "none", transition: "color 0.1s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#f0f0f0")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#363636")}
            >
              {l.label}
            </Link>
          ))}
        </div>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "#2a2a2a" }}>
          Solana Devnet · © 2026 Arcadia
        </span>
      </footer>

    </div>
  );
}
