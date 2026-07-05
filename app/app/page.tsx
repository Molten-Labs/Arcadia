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
  className,
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.08 });
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.55, ease: [0.25, 0.46, 0.45, 0.94], delay }}
      className={className}
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
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="shrink-0" style={{ width: 7, height: 7, borderRadius: 2, background: color }} />
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-fg">{label}</span>
        </div>
        <div className="flex items-center gap-[10px]">
          <span className="font-mono text-[8px] text-faint">{weight}% weight</span>
          <span className="font-mono text-sm font-bold text-ink">
            {val}<span className="text-faint font-light text-xs">/100</span>
          </span>
        </div>
      </div>
      <div className="h-[5px] bg-line rounded-[3px] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={inView ? { width: `${val}%` } : {}}
          transition={{ duration: 0.85, ease: "easeOut", delay: delay + 0.15 }}
          className="h-full rounded-[3px] opacity-85"
          style={{ background: color }}
        />
      </div>
    </div>
  );
}

/* ─── HERO CARDS ────────────────────────────────────────────────────────── */

function HeroCards() {
  return (
    <div className="relative w-full min-h-[460px]">
      {/* Card 1: Trader profile */}
      <div className="absolute top-[8%] left-[5%] bg-panel border border-line rounded-xl p-4 w-[220px]" style={{
        animation: "float-a 6s ease-in-out infinite",
        boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
      }}>
        <div className="flex items-center gap-2.5 mb-2.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-mono text-xs font-extrabold shrink-0" style={{
            background: "rgba(79,158,255,0.15)", border: "1px solid rgba(79,158,255,0.3)", color: "#4f9eff",
          }}>NO</div>
          <div>
            <p className="font-mono text-xs font-bold text-ink m-0">@nova</p>
            <p className="font-mono text-[9px] m-0" style={{ color: "#a855f7" }}>Elite tier</p>
          </div>
          <div className="ml-auto font-mono text-[9px] text-[var(--color-green)]">+41.2%</div>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-2xl font-extrabold text-ink tracking-[-0.04em] leading-none">912</span>
          <span className="font-mono text-xs text-faint">/1000</span>
        </div>
        <p className="font-mono text-[8px] tracking-[0.15em] uppercase text-faint mt-1 mb-0">Verified Reputation</p>
        <div className="mt-2.5 h-1 rounded-[2px] bg-line overflow-hidden">
          <div className="h-full rounded-[2px]" style={{ width: "91.2%", background: "linear-gradient(90deg, #4f9eff, #a855f7)" }} />
        </div>
      </div>

      {/* Card 2: Vault */}
      <div className="absolute top-[30%] right-[8%] bg-panel border border-line rounded-xl p-4 w-[200px]" style={{
        animation: "float-b 7s ease-in-out infinite",
        boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
      }}>
        <p className="font-mono text-[8px] tracking-[0.2em] uppercase text-faint mb-2 mt-0">Allocation vault · @nova</p>
        <p className="font-mono text-xl font-black text-[var(--color-green)] tracking-[-0.03em] m-0">$387K</p>
        <p className="font-mono text-[9px] text-muted-fg mt-1 mb-3">reputation-based capacity</p>
        <div className="h-[3px] bg-line rounded-[2px] mb-2.5 overflow-hidden">
          <div className="h-full rounded-[2px] bg-[var(--color-green)]" style={{ width: "42%" }} />
        </div>
        <div className="inline-flex items-center gap-1 rounded px-2 py-[3px]" style={{
          background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.25)",
        }}>
          <span className="w-[5px] h-[5px] rounded-full bg-[var(--color-green)]" />
          <span className="font-mono text-[8px] text-[var(--color-green)] font-bold">OPEN · $525K left</span>
        </div>
      </div>

      {/* Card 3: Payout */}
      <div className="absolute bottom-[12%] left-[12%] bg-panel border border-line rounded-xl p-[0.875rem_1.25rem] w-[210px]" style={{
        animation: "float-c 5.5s ease-in-out infinite",
        boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
      }}>
        <div className="flex items-center gap-1.5 mb-2">
          <Lightning size={12} className="text-[var(--color-mint)]" />
          <span className="font-mono text-[8px] tracking-[0.15em] uppercase text-faint">Profit split · Solana</span>
          <span className="font-mono text-[9px] text-[var(--color-green)] ml-auto">1.8s</span>
        </div>
        <p className="font-mono text-xl font-black text-ink tracking-[-0.03em] m-0">+$6,810</p>
        <p className="font-mono text-[8px] text-muted-fg mt-1 mb-2">performance share above high-water mark</p>
        <p className="font-mono text-[8px] text-faint m-0">4PqRtLv9Xw...M3kN</p>
      </div>

      {/* Card 4: Score breakdown */}
      <div className="absolute top-[55%] left-[32%] bg-panel border border-line rounded-xl p-[0.875rem_1rem] w-[160px]" style={{
        animation: "float-a 8s ease-in-out infinite 1s",
        boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
      }}>
        <p className="font-mono text-[8px] tracking-[0.15em] uppercase text-faint m-0 mb-2">Reputation inputs</p>
        {[{ l: "Risk-adj return", v: 91, c: "#4f9eff" }, { l: "Consistency", v: 88, c: "#22c55e" }, { l: "Drawdown ctrl", v: 72, c: "#f0b429" }].map(b => (
          <div key={b.l} className="mb-[5px]">
            <div className="flex justify-between mb-[2px]">
              <span className="font-mono text-[7px] text-muted-fg">{b.l}</span>
              <span className="font-mono text-[7px] font-bold" style={{ color: b.c }}>{b.v}</span>
            </div>
            <div className="h-[2px] bg-line rounded-[1px]">
              <div className="h-full rounded-[1px]" style={{ width: `${b.v}%`, background: b.c }} />
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
          <div key={i} className="border-b border-line">
            <button
              onClick={() => setActive(isOpen ? null : i)}
              className="w-full flex items-center justify-between py-[1.375rem] bg-transparent border-none cursor-pointer text-left font-sans"
              style={{
                color: isOpen ? "#f0f0f0" : "#6a6a6a",
                fontSize: "0.9375rem", fontWeight: 500,
                transition: "color 0.15s",
              }}
            >
              <span>{item.q}</span>
              <CaretDown
                size={14}
                className="shrink-0 ml-4"
                style={{
                  transition: "transform 0.2s",
                  transform: isOpen ? "rotate(180deg)" : "none",
                  color: isOpen ? "#4f9eff" : "#363636",
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
                  className="overflow-hidden"
                >
                  <p className="pb-[1.375rem] text-sm text-muted-fg leading-relaxed m-0">
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
      <div className="flex gap-1.5 mb-[clamp(2.5rem,5vw,4rem)]">
        {(["traders", "investors"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="font-mono text-xs font-bold tracking-[0.04em] cursor-pointer whitespace-nowrap rounded-lg"
            style={{
              padding: "9px 22px",
              border: `1px solid ${tab === t ? "#4f9eff" : "#1c1c1c"}`,
              background: tab === t ? "rgba(79,158,255,0.1)" : "transparent",
              color: tab === t ? "#4f9eff" : "#6a6a6a",
              transition: "all 0.15s",
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
          <div className="lp-2col grid grid-cols-2 gap-[clamp(3rem,6vw,6rem)] items-start">
            <div>
              <p className="text-[clamp(0.9375rem,1.4vw,1.125rem)] text-muted-fg leading-relaxed mb-10 max-w-[42ch]">
                {active.intro}
              </p>
              <Link href={active.cta.href} className="btn-primary inline-flex items-center gap-2 text-sm no-underline whitespace-nowrap"
                style={{ padding: "11px 22px" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "#74b5ff"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "#4f9eff"; e.currentTarget.style.transform = "none"; }}
              >
                {active.cta.label} <ArrowRight size={14} />
              </Link>
            </div>

            <div className="flex flex-col gap-6">
              {active.steps.map((s) => (
                <div key={s.n} className="flex gap-4 items-start">
                  <div className="w-[26px] h-[26px] rounded-full shrink-0 border border-line flex items-center justify-center font-mono text-[9px] font-extrabold mt-[2px]" style={{ color: "#4f9eff" }}>
                    {s.n}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-ink m-0 mb-1 tracking-[-0.01em]">{s.title}</p>
                    <p className="text-[0.8125rem] text-muted-fg m-0 leading-relaxed">{s.body}</p>
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
    <div className="bg-black min-h-screen">

      {/* ═══ HERO ════════════════════════════════════════════════════════ */}
      <section className="lp-hero grid grid-cols-[5fr_7fr] min-h-[calc(100dvh-3rem)] border-b border-line">
        <div className="lp-hero-left px-[clamp(2rem,5vw,5rem)] py-[clamp(4rem,7vw,6rem)] flex flex-col justify-center relative overflow-hidden">
          <div aria-hidden className="absolute inset-0 pointer-events-none landing-grid" style={{
            WebkitMaskImage: "radial-gradient(ellipse at 10% 50%, black 0%, transparent 65%)",
            maskImage: "radial-gradient(ellipse at 10% 50%, black 0%, transparent 65%)",
          }} />

          {/* Status pill — eyebrow 1/3 */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, delay: 0.1 }}
            className="mb-[clamp(2rem,4vw,3rem)] relative"
          >
            <span className="inline-flex items-center gap-2 border border-line rounded-full px-[14px] py-[5px]">
              <span className="w-[5px] h-[5px] rounded-full bg-[var(--color-green)] shrink-0" style={{ boxShadow: "0 0 6px rgba(34,197,94,0.5)", animation: "glow-pulse 2s ease-in-out infinite" }} />
              <span className="font-mono text-[9px] tracking-[0.18em] uppercase text-muted-fg">
                Verified reputation · On-chain allocation
              </span>
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="font-extrabold text-[clamp(2.75rem,5.5vw,6rem)] leading-[0.97] tracking-[-0.05em] text-ink m-0 relative"
          >
            The allocation rail<br />
            for{" "}<span className="text-[var(--color-mint)]">on-chain</span>{" "}
            trading talent.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.35 }}
            className="mt-[clamp(1.5rem,3vw,2rem)] text-[clamp(0.9375rem,1.4vw,1.0625rem)] text-muted-fg max-w-[42ch] leading-relaxed relative"
          >
            Arcadia turns real on-chain trading history into verified reputation. Investor capital flows to the traders who have earned it.
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.45 }}
            className="flex items-center gap-2.5 mt-[clamp(2rem,3.5vw,2.5rem)] flex-wrap relative"
          >
            <Link href="/traders" className="btn-primary inline-flex items-center gap-2 text-sm no-underline whitespace-nowrap tracking-[-0.01em]"
              style={{ padding: "11px 22px" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#74b5ff"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "#4f9eff"; e.currentTarget.style.transform = "none"; }}
            >
              Browse verified traders <ArrowUpRight size={14} />
            </Link>
            <Link href="/terminal"
              className="inline-flex items-center gap-2 text-sm font-semibold no-underline whitespace-nowrap rounded-lg"
              style={{
                background: "transparent", border: "1px solid #1c1c1c",
                color: "#6a6a6a", padding: "10px 20px",
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(79,158,255,0.35)"; e.currentTarget.style.color = "#f0f0f0"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#1c1c1c"; e.currentTarget.style.color = "#6a6a6a"; }}
            >
              Build your reputation
            </Link>
          </motion.div>
        </div>

        {/* Right — floating cards */}
        <div className="lp-hero-cards border-l border-line p-16 flex items-center" style={{
          background: "radial-gradient(ellipse at 65% 40%, rgba(79,158,255,0.04) 0%, transparent 60%)",
        }}>
          <HeroCards />
        </div>
      </section>

      {/* ═══ TRUST STRIP MARQUEE ════════════════════════════════════════ */}
      <div className="border-b border-line overflow-hidden relative">
        <div className="ticker-track">
          {[...Array(4)].flatMap((_, rep) =>
            ["Solana", "Drift", "Jupiter", "Verified reputation", "Smart-contract allocation", "Non-custodial vaults"].map((item, i) => (
              <div key={`${rep}-${i}`} className="flex items-center gap-12 px-6 py-[1.125rem] shrink-0">
                <span className="font-mono whitespace-nowrap"
                  style={{
                    fontSize: i < 3 ? "0.8125rem" : "0.75rem",
                    fontWeight: i < 3 ? 700 : 400,
                    color: i < 3 ? "#2a2a2a" : "#1e1e1e",
                    letterSpacing: i >= 3 ? "0.04em" : "0",
                  }}
                >
                  {item}
                </span>
                <span className="w-[3px] h-[3px] rounded-full bg-line shrink-0" />
              </div>
            ))
          )}
        </div>
      </div>

      {/* ═══ THE PROBLEM ════════════════════════════════════════════════ */}
      <FadeUp>
        <section className="border-b border-line px-[clamp(2rem,5vw,5rem)] py-[clamp(5rem,8vw,8rem)]">
          <div className="mb-[clamp(3rem,6vw,5rem)] max-w-[90%]">
            <h2 className="font-extrabold text-[clamp(2.25rem,4.5vw,5rem)] tracking-[-0.05em] leading-[1.05] m-0">
              <span className="text-ink">Skilled traders</span>{" "}
              <span className="text-[var(--color-red)]">can't prove it.</span>
              <br />
              <span className="text-ink">Capital has</span>{" "}
              <span className="text-[var(--color-red)]">no trusted rail.</span>
            </h2>
          </div>

          {/* 40/60 asymmetric split */}
          <div className="grid grid-cols-[2fr_3fr] gap-[clamp(2.5rem,5vw,5rem)] items-start">
            {/* Left — trader side */}
            <div>
              <p className="text-[0.9375rem] text-muted-fg leading-relaxed max-w-[44ch] mb-6">
                A trader can be genuinely talented and still have no trusted way to show it. Screenshots can be edited. Private dashboards do not travel. Without verified reputation, skill stays trapped inside one wallet.
              </p>
              <div className="flex flex-col gap-2.5">
                {[
                  "Real performance is hard to separate from lucky wins",
                  "Screenshots and P&L claims are easy to fake",
                  "Small traders struggle to earn access to larger capital",
                ].map((txt) => (
                  <div key={txt} className="flex gap-3 items-start">
                    <span className="w-1 h-1 rounded-full bg-[var(--color-red)] shrink-0 mt-2" />
                    <span className="text-sm text-muted-fg leading-relaxed">{txt}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right — investor side */}
            <div>
              <p className="text-[0.9375rem] text-muted-fg leading-relaxed max-w-[44ch] mb-6">
                Investors want exposure to skilled traders, but the internet is full of claims. Without a verified record and a safe allocation structure, backing a trader becomes guesswork.
              </p>
              <div className="flex flex-col gap-2.5">
                {[
                  "No simple way to verify claimed performance",
                  "No clear reputation layer for on-chain traders",
                  "No safe reason to send capital directly to a stranger",
                ].map((txt) => (
                  <div key={txt} className="flex gap-3 items-start">
                    <span className="w-1 h-1 rounded-full bg-[var(--color-red)] shrink-0 mt-2" />
                    <span className="text-sm text-muted-fg leading-relaxed">{txt}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </FadeUp>

      {/* ═══ NON-CUSTODIAL — THE ALLOCATION RAIL ═══════════════════════ */}
      <FadeUp>
        <section className="lp-nocust border-b border-line bg-[#050505] px-[clamp(2rem,5vw,5rem)] py-[clamp(5rem,8vw,8rem)] grid grid-cols-2 gap-[clamp(3rem,6vw,6rem)] items-center">
          <div>
            {/* Eyebrow 2/3 */}
            <div className="flex items-center gap-2 mb-6">
              <ShieldCheck size={12} className="text-[var(--color-green)]" />
              <span className="font-mono text-[9px] tracking-[0.22em] uppercase text-faint">The Allocation Rail</span>
            </div>
            <h2 className="font-extrabold text-[clamp(2rem,4vw,3.5rem)] tracking-[-0.05em] text-ink leading-[1.05] m-0 mb-5">
              Investors don't<br />send money to traders.
            </h2>
            <p className="text-base text-muted-fg leading-relaxed max-w-[44ch] m-0">
              Investor capital goes into an on-chain vault, not into a trader's wallet. The trader can trade under protocol rules, but they cannot simply withdraw investor funds. This protects you from theft -- it does not protect you from trading losses, which are shared proportionally like any fund. Arcadia turns custody risk into software; market risk still belongs to the trade.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {[
              { label: "Investor capital held by", value: "Smart-contract vault" },
              { label: "Trader access",            value: "Trading permissions" },
              { label: "Trader withdrawal",        value: "Performance share only" },
              { label: "Investor visibility",      value: "Score, vault, and activity" },
              { label: "Allocation logic",         value: "Reputation-based capacity" },
              { label: "Protected against",        value: "Theft -- not trading losses" },
            ].map((row) => (
              <div key={row.label} className="flex items-center justify-between px-5 py-[0.875rem] bg-panel border border-line rounded-lg">
                <span className="text-sm text-muted-fg">{row.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-ink">{row.value}</span>
                  <span className="w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] shrink-0"
                    style={{
                      background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.25)", color: "#22c55e",
                    }}
                  >&#x2713;</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </FadeUp>

      {/* ═══ HOW IT WORKS — VERTICAL TIMELINE ══════════════════════════ */}
      <FadeUp>
        <section className="border-b border-line px-[clamp(2rem,5vw,5rem)] py-[clamp(5rem,8vw,8rem)]">
          <h2 className="font-extrabold text-[clamp(2rem,3.5vw,3rem)] tracking-[-0.045em] text-ink mb-[clamp(3rem,6vw,5rem)] max-w-[28ch]">
            From verified skill to allocated capital.
          </h2>

          <div className="lp-timeline grid grid-cols-2 gap-[clamp(2rem,5vw,5rem)] items-start">
            {/* Left: vertical timeline steps */}
            <div className="flex flex-col">
              {HOW_STEPS.map((step, i) => (
                <FadeUp key={step.n} delay={i * 0.07}>
                  <div className="grid grid-cols-[60px_1fr] gap-6 relative"
                    style={{ paddingBottom: i < HOW_STEPS.length - 1 ? "2.5rem" : 0 }}
                  >
                    <div className="relative flex flex-col items-center">
                      <div className="w-10 h-10 rounded-lg shrink-0 border border-line bg-[#080808] flex items-center justify-center font-mono text-[0.6875rem] font-black tracking-[0.05em] text-[var(--color-mint)]">
                        {step.n}
                      </div>
                      {i < HOW_STEPS.length - 1 && (
                        <div className="absolute top-10 left-1/2 -translate-x-1/2 w-px"
                          style={{ height: "calc(100% - 40px + 2.5rem)", background: "linear-gradient(to bottom, #1c1c1c 60%, transparent)" }}
                        />
                      )}
                    </div>
                    <div>
                      <h3 className="text-[0.9375rem] font-bold text-ink tracking-[-0.02em] mb-2 leading-[1.3]">
                        {step.title}
                      </h3>
                      <p className="text-[0.8125rem] text-muted-fg leading-relaxed m-0">
                        {step.body}
                      </p>
                    </div>
                  </div>
                </FadeUp>
              ))}
            </div>

            {/* Right: score growth card */}
            <div className="bg-panel border border-line rounded-xl px-[clamp(1.75rem,3.5vw,2.5rem)] py-[clamp(1.75rem,3.5vw,2.5rem)] sticky top-20">
              <p className="font-mono text-[8px] tracking-[0.22em] uppercase text-faint mb-6">
                Score builds as you trade
              </p>
              <div className="flex flex-col gap-5">
                {[
                  { label: "Week 1",  score: 340, w: "34%",   color: "#60a5fa" },
                  { label: "Week 4",  score: 580, w: "58%",   color: "#818cf8" },
                  { label: "Week 8",  score: 740, w: "74%",   color: "#f59e0b" },
                  { label: "Week 12", score: 912, w: "91.2%", color: "#a855f7" },
                ].map((pt) => (
                  <div key={pt.label}>
                    <div className="flex justify-between mb-[0.4rem]">
                      <span className="font-mono text-[9px] text-faint">{pt.label}</span>
                      <span className="font-mono text-[9px] font-bold" style={{ color: pt.color }}>{pt.score}</span>
                    </div>
                    <div className="h-1 bg-line rounded-[2px]">
                      <div className="h-full rounded-[2px] opacity-75" style={{ width: pt.w, background: pt.color }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-7 pt-5 border-t border-line flex items-center gap-2">
                <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: "#a855f7" }} />
                <span className="font-mono text-[9px] font-bold" style={{ color: "#a855f7" }}>Elite tier unlocked</span>
                <span className="font-mono text-[9px] text-faint ml-auto">35% profit share</span>
              </div>
            </div>
          </div>
        </section>
      </FadeUp>

      {/* ═══ THE SCORE ══════════════════════════════════════════════════ */}
      <FadeUp>
        <section className="border-b border-line">
          {/* Eyebrow 3/3 */}
          <div className="px-[clamp(2rem,5vw,5rem)] py-[0.875rem] border-b border-line">
            <span className="font-mono text-[8px] tracking-[0.25em] uppercase text-faint">The Reputation Layer</span>
          </div>

          <div className="lp-3col grid grid-cols-3">
            {/* Big number */}
            <div className="px-[clamp(2rem,5vw,5rem)] py-[clamp(2.5rem,5vw,4rem)] border-r border-line flex flex-col justify-center">
              <p className="font-mono text-[8px] tracking-[0.22em] uppercase text-faint mb-5">
                Arcadia Score
              </p>
              <div ref={score912.ref} className="flex items-baseline gap-2.5">
                <span suppressHydrationWarning className="font-mono font-black text-[clamp(4rem,7vw,6rem)] leading-none tracking-[-0.05em] text-ink">
                  {score912.value}
                </span>
                <span className="font-mono text-xl text-faint font-light">/1000</span>
              </div>
              <div className="inline-flex items-center gap-1.5 rounded px-2.5 py-[3px] mt-4 self-start"
                style={{ background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)" }}
              >
                <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: "#a855f7" }} />
                <span className="font-mono text-[9px] font-bold" style={{ color: "#a855f7" }}>Elite Tier</span>
              </div>
              <p className="text-sm text-muted-fg leading-relaxed max-w-[34ch] mt-5">
                The score is the trust layer: a 0-1000 reputation number built from real trading history. It helps capital find traders with consistency, discipline, and proof.
              </p>
            </div>

            {/* Score bars */}
            <div className="lp-score-mid px-[clamp(2rem,5vw,4rem)] py-[clamp(2.5rem,5vw,4rem)] border-r border-line flex flex-col justify-center gap-8">
              {SCORE_BARS.map((b, i) => (
                <AnimatedScoreBar key={b.label} {...b} delay={i * 0.1} />
              ))}
            </div>

            {/* Tier table */}
            <div className="px-[clamp(2rem,5vw,4rem)] py-[clamp(2.5rem,5vw,4rem)] flex flex-col justify-center">
              <p className="font-mono text-[8px] tracking-[0.22em] uppercase text-faint mb-5">
                Reputation tiers
              </p>
              <div className="flex flex-col gap-1.5">
                {TIERS.map((t) => (
                  <div key={t.name} className="flex items-center justify-between px-4 py-[0.875rem] bg-panel border border-line rounded-lg">
                    <div className="flex items-center gap-[9px]">
                      <span className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: t.color }} />
                      <div>
                        <p className="font-mono text-[0.8125rem] font-bold text-ink m-0 leading-[1.3]">{t.name}</p>
                        <p className="font-mono text-[8px] text-faint m-0">{t.min === 0 ? "All scores" : `Score >= ${t.min}`}</p>
                      </div>
                    </div>
                    <p className="font-mono text-lg font-black tracking-[-0.03em] m-0" style={{ color: t.color }}>
                      {t.pct}%
                    </p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-faint leading-relaxed">
                Higher reputation unlocks more vault capacity. Arcadia also takes a small management fee, active in every market condition, so the protocol stays funded through flat or down periods.
              </p>
            </div>
          </div>
        </section>
      </FadeUp>

      {/* ═══ TWO SIDES — TABBED ══════════════════════════════════════════ */}
      <FadeUp>
        <section className="border-b border-line px-[clamp(2rem,5vw,5rem)] py-[clamp(5rem,8vw,8rem)]">
          <h2 className="font-extrabold text-[clamp(2rem,3.5vw,3rem)] tracking-[-0.045em] text-ink mb-[clamp(2.5rem,5vw,4rem)] max-w-[28ch]">
            Two sides, one allocation rail.
          </h2>
          <TwoSidesTabs />
        </section>
      </FadeUp>

      {/* ═══ LIVE LEADERBOARD ════════════════════════════════════════════ */}
      <section className="border-b border-line">
        <div className="px-[clamp(2rem,5vw,5rem)] py-[0.875rem] border-b border-line flex items-center justify-between">
          <span className="text-[0.9375rem] font-bold text-ink tracking-[-0.01em]">Verified Traders</span>
          <Link href="/leaderboard" className="font-mono text-[8px] tracking-[0.15em] uppercase text-[var(--color-mint)] no-underline flex items-center gap-1">
            View leaderboard <ArrowRight size={9} />
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-line">
                {["#", "Trader", "Score", "Tier", "30d Return", "Vault Size", "Action"].map((h) => (
                  <th key={h} className="font-mono text-[8px] tracking-[0.18em] uppercase text-faint font-semibold text-left"
                    style={{ padding: "0.625rem clamp(1.25rem, 3vw, 2.5rem)" }}
                  >{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-line">
                    {[20, 80, 30, 50, 40, 40, 30].map((w, j) => (
                      <td key={j} style={{ padding: "0.875rem clamp(1.25rem, 3vw, 2.5rem)" }}>
                        <div className="h-[6px] rounded-[3px] bg-panel" style={{ width: `${w + i * 4}%` }} />
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
                    className="border-b border-line"
                    style={{ transition: "background 0.1s" } as React.CSSProperties}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#050505")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <td style={{ padding: "0.875rem clamp(1.25rem, 3vw, 2.5rem)" }}>
                      <span className="font-mono text-xs text-faint">{idx + 1}</span>
                    </td>
                    <td style={{ padding: "0.875rem clamp(1.25rem, 3vw, 2.5rem)" }}>
                      <Link href={`/t/${t.handle}`}
                        className="text-sm font-semibold text-ink no-underline"
                        style={{ transition: "color 0.1s" }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#4f9eff")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#f0f0f0")}
                      >
                        @{t.handle}
                      </Link>
                    </td>
                    <td style={{ padding: "0.875rem clamp(1.25rem, 3vw, 2.5rem)" }}>
                      <span className="font-mono text-sm font-bold text-[var(--color-mint)]">{t.score}</span>
                    </td>
                    <td style={{ padding: "0.875rem clamp(1.25rem, 3vw, 2.5rem)" }}>
                      <span className="flex items-center gap-1">
                        <span className="w-[5px] h-[5px] rounded-full shrink-0" style={{ background: TIER_COLOR[t.tier] ?? "#6a6a6a" }} />
                        <span className="font-mono text-[0.6875rem]" style={{ color: TIER_COLOR[t.tier] ?? "#6a6a6a" }}>{t.tier}</span>
                      </span>
                    </td>
                    <td style={{ padding: "0.875rem clamp(1.25rem, 3vw, 2.5rem)" }}>
                      <span className="font-mono text-sm font-bold" style={{ color: t.return_30d >= 0 ? "#22c55e" : "#ef4444" }}>
                        {t.return_30d >= 0 ? "+" : ""}{t.return_30d.toFixed(1)}%
                      </span>
                    </td>
                    <td style={{ padding: "0.875rem clamp(1.25rem, 3vw, 2.5rem)" }}>
                      <span className="font-mono text-xs text-muted-fg">{formatUSD(t.aum, 0)}</span>
                    </td>
                    <td style={{ padding: "0.875rem clamp(1.25rem, 3vw, 2.5rem)" }}>
                      <Link href={`/vault/${t.handle}`}
                        className="font-mono text-[9px] tracking-[0.1em] uppercase text-[var(--color-mint)] no-underline rounded px-2.5 py-1"
                        style={{ border: "1px solid rgba(79,158,255,0.2)", transition: "background 0.1s" }}
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
        <section className="border-b border-line">
          <div className="lp-faq-grid px-[clamp(2rem,5vw,5rem)] py-[clamp(4rem,7vw,7rem)] grid grid-cols-[1fr_2fr] gap-20 items-start">
            <div className="lp-faq-sidebar">
              <h2 className="font-extrabold text-[clamp(1.5rem,2.5vw,2rem)] tracking-[-0.04em] text-ink m-0 mb-4 leading-[1.2]">
                Simple answers before you allocate.
              </h2>
              <p className="text-sm text-muted-fg leading-relaxed">
                Arcadia is built around one idea: proof should replace promises, and capital should follow verified skill.
              </p>
            </div>
            <div className="lp-faq-content"><FAQ /></div>
          </div>
        </section>
      </FadeUp>

      {/* ═══ DUAL CTA FOOTER ════════════════════════════════════════════ */}
      <section className="lp-dual-cta grid grid-cols-2 border-b border-line">
        <div className="border-r border-line px-[clamp(2rem,5vw,5rem)] py-[clamp(4rem,8vw,7rem)] flex flex-col justify-between">
          <div>
            <h2 className="font-extrabold text-[clamp(1.75rem,3.5vw,2.75rem)] tracking-[-0.05em] text-ink leading-[1.1] m-0 mb-5">
              Turn your record<br />into allocated capital.
            </h2>
            <p className="text-base text-muted-fg leading-relaxed max-w-[38ch]">
              Stop proving yourself with screenshots. Build a reputation from real on-chain trades and let capital find you when your record deserves it.
            </p>
          </div>
          <Link href="/terminal"
            className="inline-flex items-center gap-2 mt-12 self-start btn-primary no-underline whitespace-nowrap text-[0.9375rem]"
            style={{ padding: "13px 28px" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#74b5ff"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#4f9eff"; e.currentTarget.style.transform = "none"; }}
          >
            Build your reputation <ArrowRight size={15} />
          </Link>
        </div>

        <div className="px-[clamp(2rem,5vw,5rem)] py-[clamp(4rem,8vw,7rem)] flex flex-col justify-between">
          <div>
            <h2 className="font-extrabold text-[clamp(1.75rem,3.5vw,2.75rem)] tracking-[-0.05em] text-ink leading-[1.1] m-0 mb-5">
              Back talent with<br />proof, not promises.
            </h2>
            <p className="text-base text-muted-fg leading-relaxed max-w-[38ch]">
              See the score, read the record, and allocate through vaults designed to keep trust on-chain.
            </p>
          </div>
          <Link href="/traders"
            className="inline-flex items-center gap-2 mt-12 self-start btn-primary no-underline whitespace-nowrap text-[0.9375rem]"
            style={{ padding: "13px 28px" }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#74b5ff"; e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#4f9eff"; e.currentTarget.style.transform = "none"; }}
          >
            Browse verified traders <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ═══ FOOTER ═════════════════════════════════════════════════════ */}
      <footer className="px-[clamp(2rem,5vw,5rem)] py-8 flex items-center justify-between flex-wrap gap-6">
        <span className="font-mono text-[0.8125rem] font-bold text-ink tracking-[-0.02em]">Arcadia</span>
        <nav className="flex gap-8 flex-wrap">
          {[
            { label: "Traders",     href: "/traders" },
            { label: "Leaderboard", href: "/leaderboard" },
            { label: "Vaults",      href: "/traders" },
            { label: "Docs",        href: "#" },
          ].map((link) => (
            <Link key={link.label} href={link.href}
              className="font-mono text-xs text-faint no-underline"
              style={{ transition: "color 0.15s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#f0f0f0")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#363636")}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <span className="font-mono text-[9px] text-faint tracking-[0.08em]">
          Proof replaces promises · &#169; 2026 Arcadia
        </span>
      </footer>
    </div>
  );
}
