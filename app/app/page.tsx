"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import type { TraderListItem } from "@/lib/types";
import { formatUSD } from "@/lib/types";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRole } from "@/lib/role-context";

/* ─────────────────────────────────────────────────────────────────────────
   BEAM ANIMATION — adapted from Xero hero spec for Arcadia
   Three-node pipeline: Trader → Score Engine → Vault
   State machine: p1(800ms) → splash(800ms) → p2(800ms) → idle(1000ms) → loop
───────────────────────────────────────────────────────────────────────── */

type BeamState = "p1" | "splash" | "p2" | "idle";

/* ─────────────────────────────────────────────────────────────────────────
   FAQ DATA
───────────────────────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: "What is the Arcadia Score?",
    a: "A 0–1000 number derived entirely from your on-chain trade history. It weights sharpe ratio (25%), sortino ratio (30%), consistency (25%), and drawdown control (20%). No curator can adjust it — the math runs against immutable Solana data.",
  },
  {
    q: "How do I start as a trader?",
    a: "Connect your Solana wallet, fund your vault with USDC, and open the trading terminal. Every trade you close emits a TradeClosed event that the indexer scores immediately. Your public profile updates in real time.",
  },
  {
    q: "How does profit-sharing work?",
    a: "Profit above the high-water mark is split by tier: Verified traders keep 20%, Established 25%, Advanced 30%, Elite 35%. The platform takes 5%. The rest accrues to investor NAV. Nothing is charged on losing periods.",
  },
  {
    q: "Can anyone invest in a vault?",
    a: "Yes. Any Solana wallet can browse the marketplace, filter by score or open deposits, and deposit USDC into any vault with open capacity. Your share balance is tracked on-chain via InvestorPosition PDAs — no token mint required.",
  },
  {
    q: "What makes the scores tamper-proof?",
    a: "Every trade is recorded as a TradeClosed event on Solana — a public, immutable ledger. Screenshots can be faked; on-chain receipts cannot. Arcadia reads the raw events, runs the scoring algorithm, and anchors the result. There is no override mechanism.",
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   HERO PIPELINE COMPONENT
───────────────────────────────────────────────────────────────────────── */
function HeroPipeline() {
  const pipelineRef = useRef<HTMLDivElement>(null);
  const nodeTraderRef = useRef<HTMLDivElement>(null);
  const nodeCenterRef = useRef<HTMLDivElement>(null);
  const nodeVaultRef  = useRef<HTMLDivElement>(null);
  const beamPathRef1  = useRef<SVGPathElement>(null);
  const beamPathRef2  = useRef<SVGPathElement>(null);
  const gradientRef   = useRef<SVGLinearGradientElement>(null);
  const splashRef     = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf: number;
    let state: BeamState = "p1";
    let lastChange = performance.now();

    function computePath() {
      const p = pipelineRef.current;
      const s = nodeTraderRef.current;
      const x = nodeCenterRef.current;
      const sh = nodeVaultRef.current;
      if (!p || !s || !x || !sh) return "";
      const pRect = p.getBoundingClientRect();
      const sRect = s.getBoundingClientRect();
      const xRect = x.getBoundingClientRect();
      const shRect = sh.getBoundingClientRect();
      const startX = sRect.left + sRect.width / 2 - pRect.left;
      const startY = sRect.top  + sRect.height / 2 - pRect.top;
      const midX   = xRect.left + xRect.width / 2 - pRect.left;
      const midY   = xRect.top  + xRect.height / 2 - pRect.top;
      const endX   = shRect.left + shRect.width / 2 - pRect.left;
      const endY   = shRect.top  + shRect.height / 2 - pRect.top;
      return `M ${startX},${startY} L ${midX},${midY} L ${endX},${endY}`;
    }

    function updateBeam(pct: number) {
      const d = computePath();
      if (beamPathRef1.current) beamPathRef1.current.setAttribute("d", d);
      if (beamPathRef2.current) beamPathRef2.current.setAttribute("d", d);
      const center = pct * 100;
      const half = 12;
      if (gradientRef.current) {
        gradientRef.current.setAttribute("x1", `${center - half}%`);
        gradientRef.current.setAttribute("x2", `${center + half}%`);
        gradientRef.current.setAttribute("y1", "0%");
        gradientRef.current.setAttribute("y2", "0%");
      }
    }

    function lerp(a: number, b: number, t: number) {
      return a + (b - a) * Math.min(t, 1);
    }

    function loop(now: number) {
      const elapsed = now - lastChange;

      if (state === "p1") {
        const t = elapsed / 800;
        const pct = lerp(0, 0.5, t);
        if (beamPathRef1.current) beamPathRef1.current.style.opacity = "1";
        if (beamPathRef2.current) beamPathRef2.current.style.opacity = "1";
        updateBeam(pct);
        if (pct < 0.35) {
          nodeTraderRef.current?.classList.add("node-active");
        } else {
          nodeTraderRef.current?.classList.remove("node-active");
        }
        if (elapsed >= 800) {
          if (beamPathRef1.current) beamPathRef1.current.style.opacity = "0";
          if (beamPathRef2.current) beamPathRef2.current.style.opacity = "0";
          splashRef.current?.classList.add("splash-animate");
          state = "splash";
          lastChange = now;
        }
      } else if (state === "splash") {
        if (elapsed >= 800) {
          splashRef.current?.classList.remove("splash-animate");
          if (beamPathRef1.current) beamPathRef1.current.style.opacity = "1";
          if (beamPathRef2.current) beamPathRef2.current.style.opacity = "1";
          state = "p2";
          lastChange = now;
        }
      } else if (state === "p2") {
        const t = elapsed / 800;
        const pct = lerp(0.5, 1.0, t);
        updateBeam(pct);
        if (pct > 0.65) {
          nodeVaultRef.current?.classList.add("node-active");
        } else {
          nodeVaultRef.current?.classList.remove("node-active");
        }
        if (elapsed >= 800) {
          nodeVaultRef.current?.classList.remove("node-active");
          if (beamPathRef1.current) beamPathRef1.current.style.opacity = "0";
          if (beamPathRef2.current) beamPathRef2.current.style.opacity = "0";
          state = "idle";
          lastChange = now;
        }
      } else {
        if (elapsed >= 1000) {
          state = "p1";
          lastChange = now;
        }
      }

      raf = requestAnimationFrame(loop);
    }

    function onResize() {
      const d = computePath();
      beamPathRef1.current?.setAttribute("d", d);
      beamPathRef2.current?.setAttribute("d", d);
    }

    window.addEventListener("resize", onResize);
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div
      ref={pipelineRef}
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 0,
        marginBottom: 52,
        zIndex: 1,
        maxWidth: 700,
        width: "100%",
      }}
    >
      {/* Beam SVG */}
      <svg
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          overflow: "visible",
          zIndex: 2,
          pointerEvents: "none",
        }}
      >
        <defs>
          <filter id="beam-glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          <linearGradient id="beam-gradient" gradientUnits="userSpaceOnUse" x1="0%" x2="10%" y1="0%" y2="0%">
            <stop offset="0%" stopColor="#b04090" stopOpacity="0" />
            <stop offset="20%" stopColor="#b04090" stopOpacity="0.8" />
            <stop offset="50%" stopColor="#fff" stopOpacity="1" />
            <stop offset="80%" stopColor="#c8a0e0" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#c8a0e0" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Glow path */}
        <path
          ref={beamPathRef1}
          stroke="url(#beam-gradient)"
          strokeWidth="2"
          fill="none"
          filter="url(#beam-glow)"
          opacity="0.6"
          style={{ opacity: 0, transition: "opacity 0.1s" }}
        />
        {/* Core path */}
        <path
          ref={beamPathRef2}
          stroke="url(#beam-gradient)"
          strokeWidth="0.8"
          fill="none"
          style={{ opacity: 0, transition: "opacity 0.1s" }}
        />
        {/* Keep gradient ref */}
        <defs>
          <linearGradient ref={gradientRef} id="beam-gradient-live" gradientUnits="userSpaceOnUse" x1="0%" x2="10%" y1="0%" y2="0%" />
        </defs>
      </svg>

      {/* Left node: Trader / Layers icon */}
      <div
        ref={nodeTraderRef}
        className="icon-node"
        style={{
          width: 46, height: 46,
          borderRadius: "50%",
          background: "#1a1a24",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", zIndex: 3, flexShrink: 0,
          boxShadow: "6px 6px 12px rgba(0,0,0,0.4), -4px -4px 10px rgba(255,255,255,0.03), inset 1px 1px 1px rgba(255,255,255,0.05), inset 4px 4px 8px rgba(0,0,0,0.4)",
          position: "relative",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="12 2 2 7 12 12 22 7 12 2"/>
          <polyline points="2 17 12 22 22 17"/>
          <polyline points="2 12 12 17 22 12"/>
        </svg>
        {/* side glow */}
        <div className="node-light-right" style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "radial-gradient(circle at right, rgba(200,200,200,0.45) 0%, transparent 70%)",
          opacity: 0, transition: "opacity 0.3s",
          pointerEvents: "none",
        }} />
      </div>

      {/* Pipeline line left */}
      <div style={{
        width: 140, height: 1, flexShrink: 0,
        background: "linear-gradient(90deg, rgba(255,255,255,0.15), rgba(255,255,255,0.07))",
      }} />

      {/* Center node: Arcadia "A" */}
      <div style={{ position: "relative" }}>
        {/* Splash */}
        <div
          ref={splashRef}
          style={{
            position: "absolute",
            top: "50%", left: "50%",
            transform: "translate(-50%, -50%) scale(0.4)",
            width: 100, height: 100,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255,77,200,0.6) 0%, transparent 70%)",
            opacity: 0,
            zIndex: 2,
            pointerEvents: "none",
          }}
        />
        <div
          ref={nodeCenterRef}
          style={{
            width: 64, height: 64,
            borderRadius: "50%",
            background: "#1e1e2c",
            display: "flex", alignItems: "center", justifyContent: "center",
            zIndex: 3, position: "relative", flexShrink: 0,
            boxShadow: "8px 8px 16px rgba(0,0,0,0.5), -6px -6px 14px rgba(255,255,255,0.04), inset 1px 1px 2px rgba(255,255,255,0.06), inset 6px 6px 12px rgba(0,0,0,0.5)",
          }}
        >
          {/* Arcadia "A" mark */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 4 L24 22 H18 L14 14 L10 22 H4 Z M10.5 18 H17.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
          </svg>
        </div>
      </div>

      {/* Pipeline line right */}
      <div style={{
        width: 140, height: 1, flexShrink: 0,
        background: "linear-gradient(90deg, rgba(255,255,255,0.07), rgba(255,255,255,0.15))",
      }} />

      {/* Right node: Vault / Shield */}
      <div
        ref={nodeVaultRef}
        className="icon-node"
        style={{
          width: 46, height: 46,
          borderRadius: "50%",
          background: "#1a1a24",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", zIndex: 3, flexShrink: 0,
          boxShadow: "6px 6px 12px rgba(0,0,0,0.4), -4px -4px 10px rgba(255,255,255,0.03), inset 1px 1px 1px rgba(255,255,255,0.05), inset 4px 4px 8px rgba(0,0,0,0.4)",
          position: "relative",
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <polyline points="9 12 11 14 15 10"/>
        </svg>
        <div className="node-light-left" style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "radial-gradient(circle at left, rgba(200,100,255,0.5) 0%, transparent 70%)",
          opacity: 0, transition: "opacity 0.3s",
          pointerEvents: "none",
        }} />
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────────────
   FAQ ACCORDION
───────────────────────────────────────────────────────────────────────── */
function FAQ() {
  const [active, setActive] = useState<number | null>(0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = active === i;
        return (
          <div
            key={i}
            onClick={() => setActive(isOpen ? null : i)}
            style={{
              background: isOpen ? "var(--color-panel)" : "var(--color-panel)",
              border: `1px solid ${isOpen ? "rgba(255,255,255,0.12)" : "var(--color-line)"}`,
              borderRadius: 10,
              padding: "18px 20px",
              cursor: "pointer",
              transition: "border-color 0.2s",
              boxShadow: isOpen ? "0 4px 24px rgba(0,0,0,0.3)" : "0 2px 8px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontWeight: 500,
              fontSize: "0.9rem",
              color: "var(--color-ink)",
            }}>
              <span>{item.q}</span>
              {isOpen
                ? <ChevronUp size={18} style={{ color: "var(--color-muted)", flexShrink: 0, marginLeft: 12 }} />
                : <ChevronDown size={18} style={{ color: "var(--color-muted)", flexShrink: 0, marginLeft: 12 }} />
              }
            </div>
            {isOpen && (
              <p style={{
                marginTop: 12,
                fontSize: "0.875rem",
                color: "var(--color-muted)",
                lineHeight: 1.65,
                animation: "faq-open 0.2s ease",
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

/* ─────────────────────────────────────────────────────────────────────────
   LANDING PAGE
───────────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const router = useRouter();
  const { connected } = useWallet();
  const { role } = useRole();

  useEffect(() => {
    if (connected && role) {
      router.replace(role === "trader" ? "/terminal" : "/dashboard");
    }
  }, [connected, role, router]);

  const { data: traders, isLoading } = useQuery<TraderListItem[]>({
    queryKey: ["traders"],
    queryFn: () => apiFetch("/traders"),
  });

  const totalAUM  = traders?.reduce((a, t) => a + t.aum, 0) ?? 0;
  const topReturn = traders?.length ? Math.max(...traders.map((t) => t.return_30d)) : null;
  const topTraders = [...(traders ?? [])].sort((a, b) => b.score - a.score).slice(0, 5);

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh", overflowX: "hidden", fontFamily: "'Inter', sans-serif" }}>

      {/* ═══════════════════════════════════════════════════════════════
          HERO — Xero-style hero card with animated beam pipeline
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{
        width: "100%",
        padding: "clamp(1rem, 3vw, 2rem) clamp(1rem, 3vw, 2rem) 0",
      }}>
        <div
          className="hero-arc"
          style={{
            width: "100%",
            borderRadius: 20,
            border: "1px solid rgba(255,255,255,0.07)",
            overflow: "hidden",
            position: "relative",
            background: "#0d0b12",
            padding: "80px 40px 70px",
            minHeight: 580,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
          }}
        >
          {/* Crosshatch grid masked by arc */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
              backgroundSize: "40px 40px",
              WebkitMaskImage: "radial-gradient(circle at 50% -70%, transparent 60%, black 78%)",
              maskImage: "radial-gradient(circle at 50% -70%, transparent 60%, black 78%)",
              zIndex: 0,
              pointerEvents: "none",
            }}
          />

          {/* Animated beam pipeline */}
          <HeroPipeline />

          {/* Hero text */}
          <div style={{ maxWidth: 600, zIndex: 1 }}>
            <h1 style={{
              fontFamily: "'Inter', sans-serif",
              fontSize: "clamp(2.4rem, 5.5vw, 4rem)",
              fontWeight: 300,
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              color: "#f0f0f5",
              margin: 0,
              marginBottom: "1rem",
            }}>
              The verifiable way to
              <strong style={{
                display: "block",
                fontWeight: 400,
                marginTop: 4,
                background: "linear-gradient(to right, #ffffff, #c8a0e0)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                prove your trading edge.
              </strong>
            </h1>
            <p style={{
              fontSize: "0.9rem",
              color: "rgba(255,255,255,0.4)",
              maxWidth: 440,
              margin: "0 auto 2.25rem",
              lineHeight: 1.7,
            }}>
              Arcadia scores every closed trade on Solana and anchors the result immutably on-chain.
              Traders build verifiable records. Investors fund the best vaults.
            </p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", flexWrap: "wrap" }}>
              <Link
                href="/traders"
                style={{
                  background: "#ffffff",
                  color: "#0a0a0f",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  padding: "12px 32px",
                  borderRadius: 999,
                  textDecoration: "none",
                  transition: "opacity 0.15s, transform 0.15s",
                  display: "inline-block",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                Explore Traders
              </Link>
              <Link
                href="/leaderboard"
                style={{
                  fontSize: "0.875rem",
                  fontWeight: 500,
                  color: "rgba(255,255,255,0.5)",
                  textDecoration: "none",
                  transition: "color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#ffffff"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.5)"; }}
              >
                Leaderboard →
              </Link>
            </div>
          </div>

          {/* Bottom live stats strip inside card */}
          <div style={{
            position: "absolute",
            bottom: 0, left: 0, right: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "clamp(1.5rem, 5vw, 4rem)",
            flexWrap: "wrap",
            padding: "1rem 2rem",
            borderTop: "1px solid rgba(255,255,255,0.05)",
            zIndex: 1,
          }}>
            {[
              { label: "Total AUM", value: isLoading ? "—" : formatUSD(totalAUM, 0) },
              { label: "Active traders", value: isLoading ? "—" : String(traders?.length ?? "—") },
              { label: "Top 30d return", value: isLoading || topReturn === null ? "—" : `+${topReturn.toFixed(1)}%` },
              { label: "Chain", value: "Solana" },
              { label: "Score range", value: "0 — 1000" },
            ].map((s) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.3)" }}>{s.label}</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", fontWeight: 700, color: "rgba(255,255,255,0.7)" }}>{s.value}</span>
              </div>
            ))}
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", display: "inline-block", animation: "glow-pulse 2s ease-in-out infinite" }} />
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "rgba(255,255,255,0.3)", letterSpacing: "0.12em" }}>Active · Devnet</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          PROBLEM — Screenshots lie. The blockchain doesn't.
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{
        padding: "clamp(4rem, 8vw, 7rem) clamp(1.5rem, 5vw, 4.5rem)",
        borderBottom: "1px solid var(--color-line)",
      }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 10,
            letterSpacing: "0.28em",
            textTransform: "uppercase",
            color: "var(--color-muted)",
            marginBottom: "1.5rem",
          }}>
            The Problem
          </p>
          <h2 style={{
            fontFamily: "'Inter', sans-serif",
            fontWeight: 800,
            fontSize: "clamp(2rem, 4.5vw, 3.5rem)",
            lineHeight: 1.08,
            letterSpacing: "-0.03em",
            color: "var(--color-ink)",
            marginBottom: "1.25rem",
            maxWidth: "18ch",
          }}>
            Screenshots lie.<br />
            <span style={{ color: "var(--color-muted)", fontWeight: 400 }}>The blockchain doesn't.</span>
          </h2>
          <p style={{
            fontSize: "1rem",
            color: "var(--color-muted)",
            maxWidth: "52ch",
            lineHeight: 1.7,
            marginBottom: "3rem",
          }}>
            Anyone can fake a P&amp;L screenshot. On Solana, every trade is a permanent public receipt that cannot be edited or erased. The proof of who is actually skilled already exists — buried in raw data nobody has turned into something trustworthy. Until now.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
            {[
              {
                tag: "The talented trader",
                title: "Stuck without proof",
                body: "Genuinely skilled traders can't access institutional capital because there is no trustworthy, verifiable track record. Anyone can post a screenshot of a big win.",
              },
              {
                tag: "The investor",
                title: "Can't find who to trust",
                body: "Capital sits idle or is misallocated because there is no honest way to rank skill over luck. The internet is full of people claiming to be the best.",
              },
              {
                tag: "The missing piece",
                title: "No verified scoreboard",
                body: "There was no system that reads the immutable on-chain data, scores it fairly, and creates a permanent reputation that investors can rely on.",
              },
            ].map((c) => (
              <div
                key={c.tag}
                style={{
                  background: "var(--color-panel)",
                  border: "1px solid var(--color-line)",
                  borderRadius: 14,
                  padding: "clamp(1.25rem, 2.5vw, 1.75rem)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                <div style={{
                  position: "absolute", top: 0, left: 0, right: 0, height: 2,
                  background: "linear-gradient(90deg, rgba(239,68,68,0.6), transparent)",
                }} />
                <p style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: "rgba(239,68,68,0.7)",
                  marginBottom: "0.75rem",
                }}>
                  {c.tag}
                </p>
                <h3 style={{ fontWeight: 700, fontSize: "1rem", color: "var(--color-ink)", marginBottom: "0.6rem" }}>{c.title}</h3>
                <p style={{ fontSize: "0.875rem", color: "var(--color-muted)", lineHeight: 1.65 }}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          HOW IT WORKS — Three protocol pillars
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ borderBottom: "1px solid var(--color-line)" }}>
        <div style={{
          padding: "0.875rem clamp(1.5rem, 5vw, 4.5rem)",
          borderBottom: "1px solid var(--color-line)",
        }}>
          <p style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9, letterSpacing: "0.2em",
            textTransform: "uppercase", color: "var(--color-faint)",
          }}>
            Protocol
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {[
            {
              n: "01", code: "SCORE",
              title: "Immutable trading record",
              body: "Every TradeClosed event is scored across sharpe, sortino, drawdown, and consistency. The result is anchored on Solana — no curator, no override, no appeals. Your score is your career.",
              cta: "View reputation →", href: "/reputation",
            },
            {
              n: "02", code: "VAULT",
              title: "Capital follows skill",
              body: "Each trader profile is their vault. Deposit USDC, receive shares tracked by InvestorPosition PDAs. Profit above the HWM is split by score tier — enforced on-chain by Anchor.",
              cta: "Browse vaults →", href: "/traders",
            },
            {
              n: "03", code: "MARKETPLACE",
              title: "On-chain proof of skill",
              body: "Public directory of ranked traders. Sort by score, return, AUM, or sortino. Filter by open deposits. Every number is derived from on-chain TradeClosed events — no curation.",
              cta: "Leaderboard →", href: "/leaderboard",
            },
          ].map((col, i) => (
            <div
              key={col.n}
              style={{
                display: "flex", flexDirection: "column",
                padding: "clamp(2rem, 4vw, 3rem) clamp(1.5rem, 3.5vw, 2.75rem)",
                borderRight: i < 2 ? "1px solid var(--color-line)" : undefined,
                borderTop: "1px solid var(--color-line)",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.875rem", marginBottom: "1.75rem" }}>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontWeight: 900, fontSize: "1.875rem", lineHeight: 1,
                  color: "var(--color-line)", letterSpacing: "-0.05em",
                }}>
                  {col.n}
                </span>
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 9, fontWeight: 700, letterSpacing: "0.3em",
                  textTransform: "uppercase", color: "var(--color-mint)",
                }}>
                  {col.code}
                </span>
              </div>
              <h3 style={{
                fontSize: "0.9375rem", fontWeight: 900,
                letterSpacing: "-0.02em", color: "var(--color-ink)",
                marginBottom: "0.75rem",
              }}>
                {col.title}
              </h3>
              <p style={{ fontSize: "0.875rem", lineHeight: 1.7, color: "var(--color-muted)", flex: 1 }}>
                {col.body}
              </p>
              <Link
                href={col.href}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 4,
                  marginTop: "1.75rem", fontSize: "0.75rem", fontWeight: 700,
                  color: "var(--color-mint)", textDecoration: "none", transition: "opacity 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.55")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                {col.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          TOP TRADERS TABLE
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{ borderBottom: "1px solid var(--color-line)" }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.875rem clamp(1.5rem, 5vw, 4.5rem)",
          borderBottom: "1px solid var(--color-line)",
        }}>
          <p style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 9, letterSpacing: "0.2em",
            textTransform: "uppercase", color: "var(--color-faint)",
          }}>
            Top Traders · by Arcadia Score
          </p>
          <Link
            href="/traders"
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9, fontWeight: 700, letterSpacing: "0.15em",
              textTransform: "uppercase", color: "var(--color-mint)",
              textDecoration: "none", transition: "opacity 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.55")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            View all
          </Link>
        </div>

        {/* Column headers */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "2rem 1fr 5rem 7.5rem 5.5rem 5.5rem",
          gap: "1rem",
          padding: "0.6rem clamp(1.5rem, 5vw, 4.5rem)",
          borderBottom: "1px solid var(--color-line)",
        }}>
          {["", "Handle", "Score", "Tier", "30d", "AUM"].map((h) => (
            <span key={h || "rank"} style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9, letterSpacing: "0.2em",
              textTransform: "uppercase", color: "var(--color-faint)",
            }}>
              {h}
            </span>
          ))}
        </div>

        {isLoading
          ? [1, 2, 3].map((n) => (
            <div key={n} style={{
              display: "grid", gridTemplateColumns: "2rem 1fr 5rem 7.5rem 5.5rem 5.5rem",
              gap: "1rem", padding: "0.875rem clamp(1.5rem, 5vw, 4.5rem)",
              borderBottom: "1px solid var(--color-line)",
            }}>
              {[40, 80, 30, 60, 30, 40].map((w, i) => (
                <div key={i} style={{ height: 8, borderRadius: 4, background: "var(--color-panel)", width: `${w}%` }} />
              ))}
            </div>
          ))
          : topTraders.map((t, idx) => {
            const TIER_COLOR: Record<string, string> = {
              Elite: "var(--color-tier-elite)",
              Advanced: "var(--color-tier-advanced)",
              Established: "var(--color-tier-established)",
              Verified: "var(--color-tier-verified)",
            };
            return (
              <Link
                key={t.handle}
                href={`/t/${t.handle}`}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2rem 1fr 5rem 7.5rem 5.5rem 5.5rem",
                  gap: "1rem",
                  padding: "0.875rem clamp(1.5rem, 5vw, 4.5rem)",
                  borderBottom: "1px solid var(--color-line)",
                  alignItems: "center",
                  textDecoration: "none",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-panel)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.75rem", color: "var(--color-faint)" }}>{idx + 1}</span>
                <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.handle}</span>
                <span className="tnum" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.875rem", fontWeight: 700, color: "var(--color-ink)" }}>{t.score}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: TIER_COLOR[t.tier] ?? "var(--color-muted)", flexShrink: 0 }} />
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.6875rem", color: TIER_COLOR[t.tier] ?? "var(--color-muted)" }}>{t.tier}</span>
                </span>
                <span className="tnum" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.875rem", fontWeight: 700, color: t.return_30d >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
                  {t.return_30d >= 0 ? "+" : ""}{t.return_30d.toFixed(1)}%
                </span>
                <span className="tnum" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.8125rem", color: "var(--color-muted)" }}>{formatUSD(t.aum, 0)}</span>
              </Link>
            );
          })
        }
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          FAQ + CTA — two-column layout
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{
        padding: "clamp(4rem, 8vw, 6rem) clamp(1.5rem, 5vw, 4.5rem)",
        borderBottom: "1px solid var(--color-line)",
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto",
          display: "grid",
          gridTemplateColumns: "1.4fr 1fr",
          gap: "clamp(2rem, 5vw, 4rem)",
          alignItems: "stretch",
        }}>
          {/* Left: CTA card */}
          <div style={{
            background: "#0d0b12",
            border: "1px solid rgba(255,255,255,0.07)",
            borderRadius: 20,
            padding: "clamp(2rem, 5vw, 3.5rem)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Subtle top glow */}
            <div aria-hidden style={{
              position: "absolute", top: 0, left: 0, right: 0, height: "50%",
              background: "radial-gradient(ellipse at 50% -20%, rgba(176,48,136,0.18) 0%, transparent 65%)",
              pointerEvents: "none",
            }} />
            <div style={{ position: "relative", zIndex: 1 }}>
              <p style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9, letterSpacing: "0.22em",
                textTransform: "uppercase", color: "rgba(200,160,224,0.7)",
                marginBottom: "1.25rem",
              }}>
                Arcadia · Solana Devnet
              </p>
              <h2 style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: 300, fontSize: "clamp(1.8rem, 4vw, 2.8rem)",
                lineHeight: 1.1, letterSpacing: "-0.02em",
                color: "#f0f0f5",
                marginBottom: "1rem",
              }}>
                Start building your
                <strong style={{
                  display: "block", fontWeight: 400, marginTop: 4,
                  background: "linear-gradient(to right, #ffffff, #c8a0e0)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text",
                }}>
                  on-chain record.
                </strong>
              </h2>
              <p style={{
                fontSize: "0.9rem", color: "rgba(255,255,255,0.35)",
                lineHeight: 1.65, marginBottom: "2rem", maxWidth: "36ch",
              }}>
                Connect a Solana wallet. Every trade scores immediately. Your reputation follows you permanently — earned, not bought.
              </p>
              <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
                <Link
                  href="/terminal"
                  style={{
                    background: "#ffffff", color: "#0a0a0f",
                    fontWeight: 600, fontSize: "0.875rem",
                    padding: "12px 28px", borderRadius: 999,
                    textDecoration: "none", transition: "opacity 0.15s",
                    display: "inline-block",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
                >
                  Open Terminal
                </Link>
                <Link
                  href="/traders"
                  style={{
                    background: "rgba(255,255,255,0.06)",
                    border: "1px solid rgba(255,255,255,0.12)",
                    color: "rgba(255,255,255,0.7)",
                    fontWeight: 500, fontSize: "0.875rem",
                    padding: "12px 24px", borderRadius: 999,
                    textDecoration: "none", transition: "background 0.15s",
                    display: "inline-block",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.12)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}
                >
                  Browse Traders
                </Link>
              </div>
            </div>
          </div>

          {/* Right: FAQ accordion */}
          <div style={{ display: "flex", flexDirection: "column", justifyContent: "center" }}>
            <p style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 9, letterSpacing: "0.22em",
              textTransform: "uppercase", color: "var(--color-muted)",
              marginBottom: "1.25rem",
            }}>
              Frequently asked
            </p>
            <FAQ />
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          FOOTER
      ═══════════════════════════════════════════════════════════════ */}
      <footer style={{
        display: "flex", flexWrap: "wrap",
        alignItems: "center", justifyContent: "space-between",
        gap: "0.75rem",
        padding: "1.25rem clamp(1.5rem, 5vw, 4.5rem)",
        borderTop: "1px solid var(--color-line)",
      }}>
        <p style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 9, letterSpacing: "0.2em",
          textTransform: "uppercase", color: "var(--color-faint)",
        }}>
          Arcadia · Anchor 1.0 · Solana Devnet · Score 0–1000
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "1.25rem" }}>
          {["Docs", "API", "Privacy"].map((l) => (
            <span
              key={l}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 9, letterSpacing: "0.2em",
                textTransform: "uppercase", color: "var(--color-faint)",
                cursor: "pointer", transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.opacity = "0.5")}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.opacity = "1")}
            >
              {l}
            </span>
          ))}
        </div>
      </footer>
    </div>
  );
}
