"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion, useInView, AnimatePresence } from "framer-motion";
import { apiFetch } from "@/lib/utils";
import type { TraderListItem } from "@/lib/types";
import { formatUSD } from "@/lib/types";
import {
  ArrowUpRight,
  ArrowRight,
  CaretDown,
  TrendingUp,
  Users,
  ShieldCheck,
  Lightning,
} from "@phosphor-icons/react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRole } from "@/lib/role-context";

/* ─── DATA ─────────────────────────────────────────────────────────────── */

const FAQ_ITEMS = [
  {
    q: "What is Arcadia?",
    a: "Arcadia is the allocation rail for on-chain trading talent. It turns real trading history into verified reputation, then lets investor capital flow to traders through smart-contract vaults instead of screenshots, trust games, or direct custody.",
  },
  {
    q: "What problem does Arcadia solve?",
    a: "Today, skilled traders struggle to prove they are genuinely good, and investors struggle to know who to trust. Arcadia connects both sides with a verified score, public track record, and vault-based allocation system.",
  },
  {
    q: "What is the Arcadia Score?",
    a: "The Arcadia Score is a 0-1000 reputation number built from real trading history. It rewards consistent, risk-aware performance, not loud claims, lucky screenshots, or one-off wins.",
  },
  {
    q: "Why does the score matter?",
    a: "The score is the trust layer. It helps investors compare traders more clearly, and it helps traders unlock more capital capacity as they prove themselves over time.",
  },
  {
    q: "Can a trader fake their reputation?",
    a: "Arcadia is based on on-chain trading activity, not uploaded screenshots. A trader cannot simply edit a P&L image or claim a fake win. Their reputation comes from the public record.",
  },
  {
    q: "Can a trader run away with investor funds?",
    a: "Investor capital goes into a smart-contract vault, not directly into the trader's wallet. The trader can trade under the protocol's rules, but they cannot simply withdraw investor capital.",
  },
  {
    q: "Can I lose money as an investor?",
    a: "Yes. Arcadia protects you from theft -- the trader can never withdraw your principal. It does not protect you from trading losses. You hold vault shares alongside the trader, and if the vault loses money, your share loses value proportionally, the same as any fund. Verified skill lowers this risk over time; it does not remove it.",
  },
  {
    q: "How does capital allocation work?",
    a: "A trader builds reputation by trading. As their score improves, they can unlock more vault capacity. Investors can then deposit into that vault and share in the upside if the trader performs.",
  },
  {
    q: "What if a trader's capacity falls below what's already invested?",
    a: "If a trader's score or backing capital drops enough, new deposits pause automatically. If the gap is severe, the vault gives the trader a short window to add capital or recover performance. If that window passes unresolved, investor funds are returned in an orderly way -- never a forced fire sale, and always disclosed upfront.",
  },
  {
    q: "How does Arcadia make money?",
    a: "Arcadia earns two ways: a share of profit when a vault performs, and a small ongoing management fee. The performance share means Arcadia earns meaningfully only when traders and investors do too. The management fee keeps the protocol funded through flat or down markets, not just good ones.",
  },
];

const HOW_STEPS = [
  {
    n: "01",
    title: "A trader connects their wallet",
    body: "Arcadia reads the trader's public on-chain history and turns raw trading activity into a clear performance record.",
  },
  {
    n: "02",
    title: "Arcadia builds a reputation score",
    body: "The score measures consistency, risk control, drawdown, and real performance -- not screenshots or social hype.",
  },
  {
    n: "03",
    title: "The trader opens a vault",
    body: "The trader starts with their own capital first, creating skin in the game before outside investors allocate.",
  },
  {
    n: "04",
    title: "Capital follows proven skill",
    body: "As reputation improves, investors can deposit into the trader's vault. Higher trust can unlock more allocation capacity.",
  },
  {
    n: "05",
    title: "Profits are shared on-chain",
    body: "When the vault generates new profit, the trader earns a performance share, investors participate in the upside, and Arcadia earns its performance and management fees.",
  },
];

const SCORE_BARS = [
  { label: "Risk-adjusted return", weight: 30, color: "#4f9eff", val: 91 },
  { label: "Consistency",          weight: 25, color: "#22c55e", val: 88 },
  { label: "Drawdown control",     weight: 25, color: "#f0b429", val: 72 },
  { label: "Track record depth",   weight: 20, color: "#818cf8", val: 84 },
];

const TIERS = [
  { name: "Verified",    min: 0,   pct: 20, color: "#60a5fa" },
  { name: "Established", min: 700, pct: 25, color: "#818cf8" },
  { name: "Advanced",    min: 800, pct: 30, color: "#f59e0b" },
  { name: "Elite",       min: 900, pct: 35, color: "#a855f7" },
];

const TIER_COLOR: Record<string, string> = {
  Elite: "#a855f7", Advanced: "#f59e0b", Established: "#818cf8", Verified: "#60a5fa",
};

const TRADER_STEPS = [
  { n: "1", title: "Connect your wallet",    body: "Arcadia reads your public on-chain trading history and begins turning it into a reputation profile." },
  { n: "2", title: "Fund your own vault",    body: "Start with your own capital first, giving investors a clear signal that you have skin in the game." },
  { n: "3", title: "Build your score",       body: "Consistent, risk-aware performance improves your Arcadia Score and strengthens your public reputation." },
  { n: "4", title: "Earn allocated capital", body: "As investors back your vault, you manage more capital and earn a share of the profit you generate." },
];

const INVESTOR_STEPS = [
  { n: "1", title: "Browse verified traders", body: "Compare traders by score, record, tier, strategy, vault size, and recent performance." },
  { n: "2", title: "Choose who to back",      body: "Deposit into a trader's vault instead of sending funds directly to their wallet." },
  { n: "3", title: "Track the record",        body: "Follow vault activity, score changes, and performance from one clear dashboard." },
  { n: "4", title: "Share in the upside",     body: "When the trader generates new profit, investors participate through the vault, subject to normal trading risk." },
];

/* ─── MOTION HELPERS ────────────────────────────────────────────────────── */

function FadeUp({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.08 });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94], delay }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

function useCounter(target: number, duration = 1400) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, { once: true });

  useEffect(() => {
    if (!inView) return;
    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - start) / duration, 1);
      const ease = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(ease * target));
      if (p < 1) { raf = requestAnimationFrame(tick); }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [inView, target, duration]);

  return { ref, value };
}

/* ─── ANIMATED SCORE BAR ────────────────────────────────────────────────── */

function AnimatedScoreBar({
  label, weight, color, val, delay,
}: {
  label: string; weight: number; color: string; val: number; delay: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  return (
    <div ref={ref}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 2, background: color, flexShrink: 0 }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", color: "#6a6a6a" }}>{label}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#363636" }}>{weight}% weight</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 700, color: "#f0f0f0" }}>
            {val}<span style={{ color: "#363636", fontWeight: 300, fontSize: "0.75rem" }}>/100</span>
          </span>
        </div>
      </div>
      <div style={{ height: 5, background: "#1c1c1c", borderRadius: 3, overflow: "hidden" }}>
        <motion.div
          initial={{ width: 0 }}
          animate={inView ? { width: `${val}%` } : {}}
          transition={{ duration: 0.85, ease: "easeOut", delay: delay + 0.15 }}
          style={{ height: "100%", background: color, borderRadius: 3, opacity: 0.85 }}
        />
      </div>
    </div>
  );
}

/* ─── HERO CARDS ────────────────────────────────────────────────────────── */

function HeroCards() {
  return (
    <div style={{ position: "relative", width: "100%", height: "100%", minHeight: 460 }}>
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
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#a855f7", margin: 0 }}>Elite tier</p>
          </div>
          <div style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9, color: "#22c55e" }}>+41.2%</div>
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "2rem", fontWeight: 800, color: "#f0f0f0", letterSpacing: "-0.04em", lineHeight: 1 }}>912</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "#363636" }}>/1000</span>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase", color: "#363636", marginTop: 4, marginBottom: 0 }}>Verified Reputation</p>
        <div style={{ marginTop: 10, height: 4, borderRadius: 2, background: "#1c1c1c", overflow: "hidden" }}>
          <div style={{ width: "91.2%", height: "100%", background: "linear-gradient(90deg, #4f9eff, #a855f7)", borderRadius: 2 }} />
        </div>
      </div>

      {/* Card 2: Vault */}
      <div style={{
        position: "absolute", top: "30%", right: "8%",
        background: "#0c0c0c", border: "1px solid #1c1c1c",
        borderRadius: 12, padding: "1rem 1.25rem", width: 200,
        animation: "float-b 7s ease-in-out infinite",
        boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
      }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: "#363636", marginBottom: 8, marginTop: 0 }}>Allocation vault · @nova</p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 900, color: "#22c55e", letterSpacing: "-0.03em", margin: 0 }}>$387K</p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#6a6a6a", marginTop: 4, marginBottom: 12 }}>reputation-based capacity</p>
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

      {/* Card 3: Payout */}
      <div style={{
        position: "absolute", bottom: "12%", left: "12%",
        background: "#0c0c0c", border: "1px solid #1c1c1c",
        borderRadius: 12, padding: "0.875rem 1.25rem", width: 210,
        animation: "float-c 5.5s ease-in-out infinite",
        boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
          <Lightning size={12} style={{ color: "#4f9eff" }} />
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase", color: "#363636" }}>Profit split · Solana</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#22c55e", marginLeft: "auto" }}>1.8s</span>
        </div>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 900, color: "#f0f0f0", letterSpacing: "-0.03em", margin: 0 }}>+$6,810</p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#6a6a6a", marginTop: 4, marginBottom: 8 }}>performance share above high-water mark</p>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#363636", margin: 0 }}>4PqRtLv9Xw...M3kN</p>
      </div>

      {/* Card 4: Score breakdown */}
      <div style={{
        position: "absolute", top: "55%", left: "32%",
        background: "#0c0c0c", border: "1px solid #1c1c1c",
        borderRadius: 12, padding: "0.875rem 1rem", width: 160,
        animation: "float-a 8s ease-in-out infinite 1s",
        boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
      }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase", color: "#363636", margin: "0 0 8px" }}>Reputation inputs</p>
        {[{ l: "Risk-adj return", v: 91, c: "#4f9eff" }, { l: "Consistency", v: 88, c: "#22c55e" }, { l: "Drawdown ctrl", v: 72, c: "#f0b429" }].map(b => (
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

/* ─── FAQ ───────────────────────────────────────────────────────────────── */

function FAQ() {
  const [active, setActive] = useState<number | null>(null);
  return (
    <div>
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = active === i;
        return (
          <div key={i} style={{ borderBottom: "1px solid #1c1c1c" }}>
            <button
              onClick={() => setActive(isOpen ? null : i)}
              style={{
                width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "1.375rem 0", background: "none", border: "none", cursor: "pointer",
                color: isOpen ? "#f0f0f0" : "#6a6a6a",
                fontSize: "0.9375rem", fontWeight: 500, textAlign: "left",
                fontFamily: "var(--font-sans)", transition: "color 0.15s",
              }}
            >
              <span>{item.q}</span>
              <CaretDown
                size={14}
                style={{
                  transition: "transform 0.2s",
                  transform: isOpen ? "rotate(180deg)" : "none",
                  color: isOpen ? "#4f9eff" : "#363636",
                  flexShrink: 0, marginLeft: 16,
                }}
              />
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  key="answer"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22, ease: "easeInOut" }}
                  style={{ overflow: "hidden" }}
                >
                  <p style={{ paddingBottom: "1.375rem", fontSize: "0.875rem", color: "#6a6a6a", lineHeight: 1.75, margin: 0 }}>
                    {item.a}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ─── TWO SIDES TABBED ──────────────────────────────────────────────────── */

function TwoSidesTabs() {
  const [tab, setTab] = useState<"traders" | "investors">("traders");

  const content = {
    traders: {
      intro: "Turn your real trading history into a reputation investors can understand. Arcadia helps proven traders earn access to capital without relying on screenshots or social hype.",
      steps: TRADER_STEPS,
      cta: { label: "Build your reputation", href: "/terminal" },
    },
    investors: {
      intro: "Back traders based on proof, not promises. Arcadia gives investors a clearer way to compare talent, allocate through vaults, and follow performance on-chain.",
      steps: INVESTOR_STEPS,
      cta: { label: "Browse verified traders", href: "/traders" },
    },
  };

  const active = content[tab];

  return (
    <div>
      <div style={{ display: "flex", gap: 6, marginBottom: "clamp(2.5rem, 5vw, 4rem)" }}>
        {(["traders", "investors"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "9px 22px", borderRadius: 8,
              border: `1px solid ${tab === t ? "#4f9eff" : "#1c1c1c"}`,
              background: tab === t ? "rgba(79,158,255,0.1)" : "transparent",
              color: tab === t ? "#4f9eff" : "#6a6a6a",
              fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700,
              letterSpacing: "0.04em", cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
            }}
          >
            {t === "traders" ? "For Traders" : "For Investors"}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <div className="lp-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(3rem, 6vw, 6rem)", alignItems: "start" }}>
            <div>
              <p style={{ fontSize: "clamp(0.9375rem, 1.4vw, 1.125rem)", color: "#6a6a6a", lineHeight: 1.75, marginBottom: "2.5rem", maxWidth: "42ch" }}>
                {active.intro}
              </p>
              <Link href={active.cta.href} style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "#4f9eff", color: "#ffffff",
                fontWeight: 700, fontSize: "0.875rem",
                padding: "11px 22px", borderRadius: 8,
                textDecoration: "none", transition: "background 0.15s, transform 0.12s",
                whiteSpace: "nowrap",
              }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#74b5ff"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#4f9eff"; e.currentTarget.style.transform = "none"; }}
              >
                {active.cta.label} <ArrowRight size={14} />
              </Link>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              {active.steps.map((s) => (
                <div key={s.n} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                    border: "1px solid #1c1c1c",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 800, color: "#4f9eff",
                    marginTop: 2,
                  }}>{s.n}</div>
                  <div>
                    <p style={{ fontSize: "0.875rem", fontWeight: 700, color: "#f0f0f0", margin: "0 0 4px", letterSpacing: "-0.01em" }}>{s.title}</p>
                    <p style={{ fontSize: "0.8125rem", color: "#6a6a6a", margin: 0, lineHeight: 1.65 }}>{s.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/* ─── PAGE ──────────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const router = useRouter();
  const { connected } = useWallet();
  const { role } = useRole();
  const score912 = useCounter(912);

  useEffect(() => {
    if (connected && role) {
      router.replace(role === "trader" ? "/terminal" : "/dashboard");
    }
  }, [connected, role, router]);

  const { data: traders, isLoading } = useQuery<TraderListItem[]>({
    queryKey: ["traders"],
    queryFn: () => apiFetch("/traders"),
  });

  const topTraders = [...(traders ?? [])].sort((a, b) => b.score - a.score).slice(0, 6);

  return (
    <div style={{ background: "#000", minHeight: "100vh", fontFamily: "var(--font-sans)" }}>

      {/* ═══ HERO ════════════════════════════════════════════════════════ */}
      <section className="lp-hero" style={{
        display: "grid",
        gridTemplateColumns: "5fr 7fr",
        minHeight: "calc(100dvh - 3rem)",
        borderBottom: "1px solid #1c1c1c",
      }}>
        <div className="lp-hero-left" style={{
          padding: "clamp(4rem, 7vw, 6rem) clamp(2rem, 5vw, 5rem)",
          display: "flex", flexDirection: "column", justifyContent: "center",
          position: "relative", overflow: "hidden",
        }}>
          <div aria-hidden style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            backgroundImage: "radial-gradient(circle, #1c1c1c 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            WebkitMaskImage: "radial-gradient(ellipse at 10% 50%, black 0%, transparent 65%)",
            maskImage: "radial-gradient(ellipse at 10% 50%, black 0%, transparent 65%)",
          }} />

          {/* Status pill — eyebrow 1/3 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            style={{ marginBottom: "clamp(2rem, 4vw, 3rem)", position: "relative" }}
          >
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              border: "1px solid #1c1c1c", borderRadius: 999,
              padding: "5px 14px",
            }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px rgba(34,197,94,0.5)", animation: "glow-pulse 2s ease-in-out infinite", flexShrink: 0 }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "#6a6a6a" }}>
                Verified reputation · On-chain allocation
              </span>
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            style={{
              fontWeight: 800,
              fontSize: "clamp(2.75rem, 5.5vw, 6rem)",
              lineHeight: 0.97, letterSpacing: "-0.05em",
              color: "#f0f0f0", margin: 0, position: "relative",
            }}
          >
            The allocation rail<br />
            for{" "}<span style={{ color: "#4f9eff" }}>on-chain</span>{" "}
            trading talent.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.35 }}
            style={{
              marginTop: "clamp(1.5rem, 3vw, 2rem)",
              fontSize: "clamp(0.9375rem, 1.4vw, 1.0625rem)",
              color: "#6a6a6a", maxWidth: "42ch", lineHeight: 1.7,
              position: "relative",
            }}
          >
            Arcadia turns real on-chain trading history into verified reputation. Investor capital flows to the traders who have earned it.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            style={{ display: "flex", alignItems: "center", gap: 10, marginTop: "clamp(2rem, 3.5vw, 2.5rem)", flexWrap: "wrap", position: "relative" }}
          >
            <Link href="/traders" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "#4f9eff", color: "#ffffff",
              fontWeight: 700, fontSize: "0.875rem",
              padding: "11px 22px", borderRadius: 8,
              textDecoration: "none", transition: "background 0.15s, transform 0.12s",
              letterSpacing: "-0.01em", whiteSpace: "nowrap",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#74b5ff"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#4f9eff"; e.currentTarget.style.transform = "none"; }}
            >
              Browse verified traders <ArrowUpRight size={14} />
            </Link>
            <Link href="/terminal" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "transparent", border: "1px solid #1c1c1c",
              color: "#6a6a6a",
              fontWeight: 600, fontSize: "0.875rem",
              padding: "10px 20px", borderRadius: 8,
              textDecoration: "none", transition: "border-color 0.15s, color 0.15s",
              whiteSpace: "nowrap",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(79,158,255,0.35)"; e.currentTarget.style.color = "#f0f0f0"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1c1c1c"; e.currentTarget.style.color = "#6a6a6a"; }}
            >
              Build your reputation
            </Link>
          </motion.div>
        </div>

        {/* Right — floating cards */}
        <div className="lp-hero-cards" style={{
          borderLeft: "1px solid #1c1c1c",
          padding: "4rem 3rem",
          display: "flex", alignItems: "center",
          background: "radial-gradient(ellipse at 65% 40%, rgba(79,158,255,0.04) 0%, transparent 60%)",
        }}>
          <HeroCards />
        </div>
      </section>

      {/* ═══ TRUST STRIP MARQUEE ════════════════════════════════════════ */}
      <div style={{ borderBottom: "1px solid #1c1c1c", overflow: "hidden", position: "relative" }}>
        <div style={{ display: "flex", width: "max-content", animation: "lp-scroll 22s linear infinite" }}>
          {[...Array(4)].flatMap((_, rep) =>
            ["Solana", "Drift", "Jupiter", "Verified reputation", "Smart-contract allocation", "Non-custodial vaults"].map((item, i) => (
              <div key={`${rep}-${i}`} style={{
                display: "flex", alignItems: "center", gap: "3rem",
                padding: "1.125rem 1.5rem", flexShrink: 0,
              }}>
                <span style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: i < 3 ? "0.8125rem" : "0.75rem",
                  fontWeight: i < 3 ? 700 : 400,
                  color: i < 3 ? "#2a2a2a" : "#1e1e1e",
                  whiteSpace: "nowrap",
                  letterSpacing: i >= 3 ? "0.04em" : "0",
                }}>
                  {item}
                </span>
                <span style={{ width: 3, height: 3, borderRadius: "50%", background: "#1c1c1c", flexShrink: 0 }} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* ═══ THE PROBLEM ════════════════════════════════════════════════ */}
      <FadeUp>
        <section style={{
          borderBottom: "1px solid #1c1c1c",
          padding: "clamp(5rem, 8vw, 8rem) clamp(2rem, 5vw, 5rem)",
        }}>
          <div style={{ marginBottom: "clamp(3rem, 6vw, 5rem)" }}>
            <h2 style={{
              fontSize: "clamp(2.25rem, 4.5vw, 5rem)", fontWeight: 800,
              letterSpacing: "-0.05em", lineHeight: 1.05, margin: 0,
            }}>
              <span style={{ color: "#f0f0f0" }}>Skilled traders</span>{" "}
              <span style={{ color: "#ef4444" }}>can't prove it.</span>
              <br />
              <span style={{ color: "#f0f0f0" }}>Capital has</span>{" "}
              <span style={{ color: "#ef4444" }}>no trusted rail.</span>
            </h2>
          </div>

          <div className="lp-2col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(2.5rem, 5vw, 5rem)" }}>
            {/* Trader side */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1.25rem" }}>
                <TrendingUp size={11} style={{ color: "#4f9eff" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "#4f9eff", fontWeight: 700 }}>For Traders</span>
              </div>
              <p style={{ fontSize: "0.9375rem", color: "#6a6a6a", lineHeight: 1.75, maxWidth: "44ch", marginBottom: "1.5rem" }}>
                A trader can be genuinely talented and still have no trusted way to show it. Screenshots can be edited. Private dashboards do not travel. Without verified reputation, skill stays trapped inside one wallet.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  "Real performance is hard to separate from lucky wins",
                  "Screenshots and P&L claims are easy to fake",
                  "Small traders struggle to earn access to larger capital",
                ].map((txt) => (
                  <div key={txt} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#ef4444", flexShrink: 0, marginTop: 8 }} />
                    <span style={{ fontSize: "0.875rem", color: "#6a6a6a", lineHeight: 1.6 }}>{txt}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Investor side */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1.25rem" }}>
                <Users size={11} style={{ color: "#4f9eff" }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "#4f9eff", fontWeight: 700 }}>For Investors</span>
              </div>
              <p style={{ fontSize: "0.9375rem", color: "#6a6a6a", lineHeight: 1.75, maxWidth: "44ch", marginBottom: "1.5rem" }}>
                Investors want exposure to skilled traders, but the internet is full of claims. Without a verified record and a safe allocation structure, backing a trader becomes guesswork.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {[
                  "No simple way to verify claimed performance",
                  "No clear reputation layer for on-chain traders",
                  "No safe reason to send capital directly to a stranger",
                ].map((txt) => (
                  <div key={txt} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span style={{ width: 4, height: 4, borderRadius: "50%", background: "#ef4444", flexShrink: 0, marginTop: 8 }} />
                    <span style={{ fontSize: "0.875rem", color: "#6a6a6a", lineHeight: 1.6 }}>{txt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </FadeUp>

      {/* ═══ NON-CUSTODIAL — THE ALLOCATION RAIL ═══════════════════════ */}
      <FadeUp>
        <section className="lp-nocust" style={{
          borderBottom: "1px solid #1c1c1c",
          background: "#050505",
          padding: "clamp(5rem, 8vw, 8rem) clamp(2rem, 5vw, 5rem)",
          display: "grid", gridTemplateColumns: "1fr 1fr",
          gap: "clamp(3rem, 6vw, 6rem)", alignItems: "center",
        }}>
          <div>
            {/* Eyebrow 2/3 */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1.5rem" }}>
              <ShieldCheck size={12} style={{ color: "#22c55e" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "#363636" }}>The Allocation Rail</span>
            </div>
            <h2 style={{ fontSize: "clamp(2rem, 4vw, 3.5rem)", fontWeight: 800, letterSpacing: "-0.05em", color: "#f0f0f0", lineHeight: 1.05, margin: "0 0 1.25rem" }}>
              Investors don't<br />send money to traders.
            </h2>
            <p style={{ fontSize: "1rem", color: "#6a6a6a", lineHeight: 1.75, maxWidth: "44ch", margin: 0 }}>
              Investor capital goes into an on-chain vault, not into a trader's wallet. The trader can trade under protocol rules, but they cannot simply withdraw investor funds. This protects you from theft -- it does not protect you from trading losses, which are shared proportionally like any fund. Arcadia turns custody risk into software; market risk still belongs to the trade.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              { label: "Investor capital held by", value: "Smart-contract vault" },
              { label: "Trader access",            value: "Trading permissions" },
              { label: "Trader withdrawal",        value: "Performance share only" },
              { label: "Investor visibility",      value: "Score, vault, and activity" },
              { label: "Allocation logic",         value: "Reputation-based capacity" },
              { label: "Protected against",        value: "Theft -- not trading losses" },
            ].map((row) => (
              <div key={row.label} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "0.875rem 1.25rem",
                background: "#0c0c0c", border: "1px solid #1c1c1c", borderRadius: 8,
              }}>
                <span style={{ fontSize: "0.875rem", color: "#6a6a6a" }}>{row.label}</span>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "#f0f0f0" }}>{row.value}</span>
                  <span style={{
                    width: 18, height: 18, borderRadius: "50%",
                    background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, color: "#22c55e", flexShrink: 0,
                  }}>&#x2713;</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </FadeUp>

      {/* ═══ HOW IT WORKS — VERTICAL TIMELINE ══════════════════════════ */}
      <FadeUp>
        <section style={{ borderBottom: "1px solid #1c1c1c", padding: "clamp(5rem, 8vw, 8rem) clamp(2rem, 5vw, 5rem)" }}>
          <h2 style={{
            fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800,
            letterSpacing: "-0.045em", color: "#f0f0f0",
            marginBottom: "clamp(3rem, 6vw, 5rem)", maxWidth: "28ch",
          }}>
            From verified skill to allocated capital.
          </h2>

          <div className="lp-timeline" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "clamp(2rem, 5vw, 5rem)", alignItems: "start" }}>
            {/* Left: vertical timeline steps */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {HOW_STEPS.map((step, i) => (
                <FadeUp key={step.n} delay={i * 0.07}>
                  <div style={{
                    display: "grid", gridTemplateColumns: "60px 1fr", gap: "1.5rem",
                    paddingBottom: i < HOW_STEPS.length - 1 ? "2.5rem" : 0,
                    position: "relative",
                  }}>
                    <div style={{ position: "relative", display: "flex", flexDirection: "column", alignItems: "center" }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                        border: "1px solid #1c1c1c", background: "#080808",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontFamily: "var(--font-mono)", fontSize: "0.6875rem", fontWeight: 900,
                        color: "#4f9eff", letterSpacing: "0.05em",
                      }}>
                        {step.n}
                      </div>
                      {i < HOW_STEPS.length - 1 && (
                        <div style={{
                          position: "absolute", top: 40, left: "50%", transform: "translateX(-50%)",
                          width: 1, height: "calc(100% - 40px + 2.5rem)",
                          background: "linear-gradient(to bottom, #1c1c1c 60%, transparent)",
                        }} />
                      )}
                    </div>
                    <div>
                      <h3 style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#f0f0f0", letterSpacing: "-0.02em", marginBottom: "0.5rem", lineHeight: 1.3 }}>
                        {step.title}
                      </h3>
                      <p style={{ fontSize: "0.8125rem", color: "#6a6a6a", lineHeight: 1.65, margin: 0 }}>
                        {step.body}
                      </p>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>

            {/* Right: score growth card */}
            <div style={{
              background: "#0c0c0c", border: "1px solid #1c1c1c", borderRadius: 12,
              padding: "clamp(1.75rem, 3.5vw, 2.5rem)",
              position: "sticky", top: "5rem",
            }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase", color: "#363636", marginBottom: "1.5rem" }}>
                Score builds as you trade
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {[
                  { label: "Week 1",  score: 340, w: "34%",   color: "#60a5fa" },
                  { label: "Week 4",  score: 580, w: "58%",   color: "#818cf8" },
                  { label: "Week 8",  score: 740, w: "74%",   color: "#f59e0b" },
                  { label: "Week 12", score: 912, w: "91.2%", color: "#a855f7" },
                ].map((pt) => (
                  <div key={pt.label}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#363636" }}>{pt.label}</span>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, color: pt.color }}>{pt.score}</span>
                    </div>
                    <div style={{ height: 4, background: "#1c1c1c", borderRadius: 2 }}>
                      <div style={{ width: pt.w, height: "100%", background: pt.color, borderRadius: 2, opacity: 0.75 }} />
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "1.75rem", paddingTop: "1.25rem", borderTop: "1px solid #1c1c1c", display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#a855f7", flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#a855f7", fontWeight: 700 }}>Elite tier unlocked</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#363636", marginLeft: "auto" }}>35% profit share</span>
              </div>
            </div>
          </div>
        </section>
      </FadeUp>

      {/* ═══ THE SCORE ══════════════════════════════════════════════════ */}
      <FadeUp>
        <section style={{ borderBottom: "1px solid #1c1c1c" }}>
          {/* Eyebrow 3/3 */}
          <div style={{ padding: "0.875rem clamp(2rem, 5vw, 5rem)", borderBottom: "1px solid #1c1c1c" }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.25em", textTransform: "uppercase", color: "#363636" }}>The Reputation Layer</span>
          </div>

          <div className="lp-3col" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
            {/* Big number */}
            <div style={{
              padding: "clamp(2.5rem, 5vw, 4rem) clamp(2rem, 5vw, 5rem)",
              borderRight: "1px solid #1c1c1c",
              display: "flex", flexDirection: "column", justifyContent: "center",
            }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase", color: "#363636", marginBottom: "1.25rem" }}>
                Arcadia Score
              </p>
              <div ref={score912.ref} style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <span suppressHydrationWarning style={{ fontFamily: "var(--font-mono)", fontWeight: 900, fontSize: "clamp(4rem, 7vw, 6rem)", lineHeight: 1, letterSpacing: "-0.05em", color: "#f0f0f0" }}>
                  {score912.value}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", color: "#363636", fontWeight: 300 }}>/1000</span>
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)",
                borderRadius: 4, padding: "3px 10px", marginTop: "1rem", alignSelf: "flex-start",
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#a855f7", flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#a855f7", fontWeight: 700 }}>Elite Tier</span>
              </div>
              <p style={{ fontSize: "0.875rem", color: "#6a6a6a", lineHeight: 1.7, maxWidth: "34ch", marginTop: "1.25rem" }}>
                The score is the trust layer: a 0-1000 reputation number built from real trading history. It helps capital find traders with consistency, discipline, and proof.
              </p>
            </div>

            {/* Score bars */}
            <div className="lp-score-mid" style={{
              padding: "clamp(2.5rem, 5vw, 4rem) clamp(2rem, 5vw, 4rem)",
              borderRight: "1px solid #1c1c1c",
              display: "flex", flexDirection: "column", justifyContent: "center", gap: "2rem",
            }}>
              {SCORE_BARS.map((b, i) => (
                <AnimatedScoreBar key={b.label} {...b} delay={i * 0.1} />
              ))}
            </div>

            {/* Tier table */}
            <div style={{
              padding: "clamp(2.5rem, 5vw, 4rem) clamp(2rem, 5vw, 4rem)",
              display: "flex", flexDirection: "column", justifyContent: "center",
            }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.22em", textTransform: "uppercase", color: "#363636", marginBottom: "1.25rem" }}>
                Reputation tiers
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {TIERS.map((t) => (
                  <div key={t.name} style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.875rem 1rem",
                    background: "#0c0c0c", border: "1px solid #1c1c1c", borderRadius: 8,
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                      <div>
                        <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontWeight: 700, color: "#f0f0f0", margin: 0, lineHeight: 1.3 }}>{t.name}</p>
                        <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, color: "#363636", margin: 0 }}>{t.min === 0 ? "All scores" : `Score >= ${t.min}`}</p>
                      </div>
                    </div>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.125rem", fontWeight: 900, color: t.color, letterSpacing: "-0.03em", margin: 0 }}>
                      {t.pct}%
                    </p>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "#363636", lineHeight: 1.6 }}>
                Higher reputation unlocks more vault capacity. Arcadia also takes a small management fee, active in every market condition, so the protocol stays funded through flat or down periods.
              </p>
            </div>
          </div>
        </section>
      </FadeUp>

      {/* ═══ TWO SIDES — TABBED ══════════════════════════════════════════ */}
      <FadeUp>
        <section style={{ borderBottom: "1px solid #1c1c1c", padding: "clamp(5rem, 8vw, 8rem) clamp(2rem, 5vw, 5rem)" }}>
          <h2 style={{
            fontSize: "clamp(1.75rem, 3vw, 2.5rem)", fontWeight: 800,
            letterSpacing: "-0.045em", color: "#f0f0f0",
            marginBottom: "clamp(2.5rem, 5vw, 4rem)", maxWidth: "28ch",
          }}>
            Two sides, one allocation rail.
          </h2>
          <TwoSidesTabs />
        </section>
      </FadeUp>

      {/* ═══ LIVE LEADERBOARD ════════════════════════════════════════════ */}
      <section style={{ borderBottom: "1px solid #1c1c1c" }}>
        <div style={{
          padding: "0.875rem clamp(2rem, 5vw, 5rem)", borderBottom: "1px solid #1c1c1c",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontSize: "0.9375rem", fontWeight: 700, color: "#f0f0f0", letterSpacing: "-0.01em" }}>Verified Traders</span>
          <Link href="/leaderboard" style={{
            fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.15em", textTransform: "uppercase",
            color: "#4f9eff", textDecoration: "none", display: "flex", alignItems: "center", gap: 4,
          }}>
            View leaderboard <ArrowRight size={9} />
          </Link>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #1c1c1c" }}>
                {["#", "Trader", "Score", "Tier", "30d Return", "Vault Size", "Action"].map((h) => (
                  <th key={h} style={{
                    padding: "0.625rem clamp(1.25rem, 3vw, 2.5rem)", textAlign: "left",
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
                  <motion.tr
                    key={t.handle}
                    initial={{ opacity: 0, y: 6 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.3, delay: idx * 0.04 }}
                    style={{ borderBottom: "1px solid #1c1c1c", transition: "background 0.1s" } as React.CSSProperties}
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
                        <span style={{ width: 5, height: 5, borderRadius: "50%", background: TIER_COLOR[t.tier] ?? "#6a6a6a", flexShrink: 0 }} />
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
                        View vault
                      </Link>
                    </td>
                  </motion.tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </section>

      {/* ═══ FAQ ════════════════════════════════════════════════════════ */}
      <FadeUp>
        <section style={{ borderBottom: "1px solid #1c1c1c" }}>
          <div className="lp-faq-grid" style={{
            display: "grid", gridTemplateColumns: "1fr 2fr",
            padding: "clamp(4rem, 7vw, 7rem) clamp(2rem, 5vw, 5rem)",
            gap: "5rem", alignItems: "start",
          }}>
            <div className="lp-faq-sidebar">
              <h2 style={{ fontSize: "clamp(1.5rem, 2.5vw, 2rem)", fontWeight: 800, letterSpacing: "-0.04em", color: "#f0f0f0", margin: "0 0 1rem", lineHeight: 1.2 }}>
                Simple answers before you allocate.
              </h2>
              <p style={{ fontSize: "0.875rem", color: "#6a6a6a", lineHeight: 1.7 }}>
                Arcadia is built around one idea: proof should replace promises, and capital should follow verified skill.
              </p>
            </div>
            <div className="lp-faq-content"><FAQ /></div>
          </div>
        </section>
      </FadeUp>

      {/* ═══ DUAL CTA FOOTER ════════════════════════════════════════════ */}
      <section className="lp-dual-cta" style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        borderBottom: "1px solid #1c1c1c",
      }}>
        <div style={{
          borderRight: "1px solid #1c1c1c",
          padding: "clamp(4rem, 8vw, 7rem) clamp(2rem, 5vw, 5rem)",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", fontWeight: 800, letterSpacing: "-0.05em", color: "#f0f0f0", lineHeight: 1.1, margin: "0 0 1.25rem" }}>
              Turn your record<br />into allocated capital.
            </h2>
            <p style={{ fontSize: "1rem", color: "#6a6a6a", lineHeight: 1.75, maxWidth: "38ch" }}>
              Stop proving yourself with screenshots. Build a reputation from real on-chain trades and let capital find you when your record deserves it.
            </p>
          </div>
          <Link href="/terminal" style={{
            display: "inline-flex", alignItems: "center", gap: 8, marginTop: "3rem", alignSelf: "flex-start",
            background: "#4f9eff", color: "#ffffff",
            fontWeight: 700, fontSize: "0.9375rem",
            padding: "13px 28px", borderRadius: 8,
            textDecoration: "none", transition: "background 0.15s, transform 0.12s",
            whiteSpace: "nowrap",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#74b5ff"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#4f9eff"; e.currentTarget.style.transform = "none"; }}
          >
            Build your reputation <ArrowRight size={15} />
          </Link>
        </div>

        <div style={{
          padding: "clamp(4rem, 8vw, 7rem) clamp(2rem, 5vw, 5rem)",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
        }}>
          <div>
            <h2 style={{ fontSize: "clamp(1.75rem, 3.5vw, 2.75rem)", fontWeight: 800, letterSpacing: "-0.05em", color: "#f0f0f0", lineHeight: 1.1, margin: "0 0 1.25rem" }}>
              Back talent with<br />proof, not promises.
            </h2>
            <p style={{ fontSize: "1rem", color: "#6a6a6a", lineHeight: 1.75, maxWidth: "38ch" }}>
              See the score, read the record, and allocate through vaults designed to keep trust on-chain.
            </p>
          </div>
          <Link href="/traders" style={{
            display: "inline-flex", alignItems: "center", gap: 8, marginTop: "3rem", alignSelf: "flex-start",
            background: "#4f9eff", color: "#ffffff",
            fontWeight: 700, fontSize: "0.9375rem",
            padding: "13px 28px", borderRadius: 8,
            textDecoration: "none", transition: "background 0.15s, transform 0.12s",
            whiteSpace: "nowrap",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#74b5ff"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#4f9eff"; e.currentTarget.style.transform = "none"; }}
          >
            Browse verified traders <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ═══ FOOTER ═════════════════════════════════════════════════════ */}
      <footer style={{
        padding: "2rem clamp(2rem, 5vw, 5rem)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: "1.5rem",
      }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontWeight: 700, color: "#f0f0f0", letterSpacing: "-0.02em" }}>Arcadia</span>
        <nav style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          {[
            { label: "Traders",     href: "/traders" },
            { label: "Leaderboard", href: "/leaderboard" },
            { label: "Vaults",      href: "/traders" },
            { label: "Docs",        href: "#" },
          ].map((link) => (
            <Link key={link.label} href={link.href} style={{
              fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "#363636",
              textDecoration: "none", transition: "color 0.15s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#f0f0f0")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#363636")}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "#363636", letterSpacing: "0.08em" }}>
          Proof replaces promises · &#169; 2026 Arcadia
        </span>
      </footer>
    </div>
  );
}
