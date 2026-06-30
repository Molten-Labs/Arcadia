"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/utils";
import type { TraderListItem } from "@/lib/types";
import { formatUSD } from "@/lib/types";
import { ChevronDown, ChevronUp, ArrowRight, ArrowUpRight } from "lucide-react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useRole } from "@/lib/role-context";

/* ─────────────────────────────────────────────────────────────────────────
   FAQ DATA
───────────────────────────────────────────────────────────────────────── */
const FAQ_ITEMS = [
  {
    q: "What is the Arcadia Score?",
    a: "A 0–1000 number derived entirely from on-chain trade history. It weights sharpe (25%), sortino (30%), consistency (25%), and drawdown control (20%). No curator can adjust it — the math runs against immutable Solana data.",
  },
  {
    q: "How do I start as a trader?",
    a: "Connect your Solana wallet, fund your vault with USDC, and open the trading terminal. Every trade you close emits a TradeClosed event that the indexer scores immediately.",
  },
  {
    q: "How does profit-sharing work?",
    a: "Profit above the high-water mark is split by tier: Verified 20%, Established 25%, Advanced 30%, Elite 35%. Platform takes 5%. Nothing is charged on losing periods.",
  },
  {
    q: "Can anyone invest in a vault?",
    a: "Yes. Any Solana wallet can deposit USDC into any vault with open capacity. Your share balance is tracked on-chain via InvestorPosition PDAs — no token mint required.",
  },
  {
    q: "What makes the scores tamper-proof?",
    a: "Every trade is a TradeClosed event on Solana — a public, immutable ledger. Screenshots can be faked; on-chain receipts cannot. There is no override mechanism.",
  },
];

/* ─────────────────────────────────────────────────────────────────────────
   SCORE COMPONENT BARS
───────────────────────────────────────────────────────────────────────── */
const SCORE_COMPONENTS = [
  { label: "Sortino Ratio",     weight: 30, color: "var(--color-mint)", example: 91 },
  { label: "Sharpe Ratio",      weight: 25, color: "#818cf8",           example: 84 },
  { label: "Consistency",       weight: 25, color: "#22c55e",           example: 88 },
  { label: "Drawdown Control",  weight: 20, color: "#f59e0b",           example: 72 },
];

const TIER_TABLE = [
  { tier: "Verified",    min: 0,   fee: "20%", color: "var(--color-tier-verified)"    },
  { tier: "Established", min: 700, fee: "25%", color: "var(--color-tier-established)" },
  { tier: "Advanced",    min: 800, fee: "30%", color: "var(--color-tier-advanced)"    },
  { tier: "Elite",       min: 900, fee: "35%", color: "var(--color-tier-elite)"       },
];

const TIER_COLOR: Record<string, string> = {
  Elite: "var(--color-tier-elite)",
  Advanced: "var(--color-tier-advanced)",
  Established: "var(--color-tier-established)",
  Verified: "var(--color-tier-verified)",
};

/* ─────────────────────────────────────────────────────────────────────────
   FAQ ACCORDION
───────────────────────────────────────────────────────────────────────── */
function FAQ() {
  const [active, setActive] = useState<number | null>(null);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = active === i;
        return (
          <div
            key={i}
            onClick={() => setActive(isOpen ? null : i)}
            style={{
              borderBottom: "1px solid var(--color-line)",
              cursor: "pointer",
            }}
          >
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "1rem 0",
              fontWeight: 500,
              fontSize: "0.875rem",
              color: isOpen ? "var(--color-ink)" : "var(--color-muted)",
              transition: "color 0.15s",
            }}>
              <span>{item.q}</span>
              {isOpen
                ? <ChevronUp size={15} style={{ flexShrink: 0, marginLeft: 12 }} />
                : <ChevronDown size={15} style={{ flexShrink: 0, marginLeft: 12 }} />
              }
            </div>
            {isOpen && (
              <p style={{
                paddingBottom: "1rem",
                fontSize: "0.8125rem",
                color: "var(--color-muted)",
                lineHeight: 1.7,
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
   SCROLL REVEAL HOOK
───────────────────────────────────────────────────────────────────────── */
function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("is-visible");
          obs.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ─────────────────────────────────────────────────────────────────────────
   LANDING PAGE
───────────────────────────────────────────────────────────────────────── */
export default function LandingPage() {
  const router = useRouter();
  const { connected } = useWallet();
  const { role } = useRole();

  const scoreRef = useReveal();
  const protocolRef = useReveal();
  const tableRef = useReveal();

  useEffect(() => {
    if (connected && role) {
      router.replace(role === "trader" ? "/terminal" : "/dashboard");
    }
  }, [connected, role, router]);

  const { data: traders, isLoading } = useQuery<TraderListItem[]>({
    queryKey: ["traders"],
    queryFn: () => apiFetch("/traders"),
  });

  const totalAUM   = traders?.reduce((a, t) => a + t.aum, 0) ?? 0;
  const topReturn  = traders?.length ? Math.max(...traders.map((t) => t.return_30d)) : null;
  const topTraders = [...(traders ?? [])].sort((a, b) => b.score - a.score).slice(0, 5);
  const tableTraders = [...(traders ?? [])].sort((a, b) => b.score - a.score).slice(0, 8);

  return (
    <div style={{ background: "var(--color-bg)", minHeight: "100vh", fontFamily: "var(--font-sans)" }}>

      {/* ═══════════════════════════════════════════════════════════════
          HERO — Split layout: editorial left / live data right
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "55fr 45fr",
        minHeight: "calc(100vh - 3rem)",
        borderBottom: "1px solid var(--color-line)",
      }}>
        {/* Left — headline + CTAs */}
        <div style={{
          padding: "clamp(4rem, 8vw, 7rem) clamp(2rem, 5vw, 5rem)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Subtle grid */}
          <div aria-hidden className="landing-grid" style={{
            position: "absolute", inset: 0, pointerEvents: "none",
            WebkitMaskImage: "radial-gradient(ellipse at 20% 60%, black 0%, transparent 70%)",
            maskImage: "radial-gradient(ellipse at 20% 60%, black 0%, transparent 70%)",
          }} />

          {/* Status pill */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "clamp(2.5rem, 5vw, 4rem)", position: "relative" }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: "var(--color-green)",
              display: "inline-block",
              animation: "glow-pulse 2s ease-in-out infinite",
              boxShadow: "0 0 6px rgba(34,197,94,0.5)",
            }} />
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: 10,
              letterSpacing: "0.22em", textTransform: "uppercase",
              color: "var(--color-muted)",
            }}>
              Solana · Devnet · Live
            </span>
          </div>

          {/* Headline */}
          <h1 style={{
            fontFamily: "var(--font-sans)",
            fontWeight: 800,
            fontSize: "clamp(2.8rem, 6vw, 5.5rem)",
            lineHeight: 1.04,
            letterSpacing: "-0.04em",
            color: "var(--color-ink)",
            margin: 0,
            position: "relative",
            overflow: "wrap",
          }}>
            On-chain<br />
            reputation.<br />
            <span style={{ color: "var(--color-faint)", fontWeight: 300 }}>No screenshots.</span>
          </h1>

          <p style={{
            marginTop: "clamp(1.5rem, 3vw, 2rem)",
            fontSize: "clamp(0.875rem, 1.5vw, 1rem)",
            color: "var(--color-muted)",
            maxWidth: "46ch",
            lineHeight: 1.7,
            position: "relative",
          }}>
            Every trade you close on Solana becomes a permanent, tamper-proof score.
            Skilled traders unlock capital. Investors fund the best vaults.
          </p>

          {/* CTAs */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginTop: "clamp(2rem, 4vw, 2.5rem)",
            flexWrap: "wrap",
            position: "relative",
          }}>
            <Link
              href="/traders"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "var(--color-ink)", color: "#000000",
                fontWeight: 700, fontSize: "0.875rem",
                padding: "11px 24px", borderRadius: 8,
                textDecoration: "none",
                transition: "opacity 0.15s, transform 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.88"; e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = "translateY(0)"; }}
            >
              Browse vaults <ArrowUpRight size={14} />
            </Link>
            <Link
              href="/terminal"
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "transparent",
                border: "1px solid var(--color-line)",
                color: "var(--color-muted)",
                fontWeight: 600, fontSize: "0.875rem",
                padding: "10px 20px", borderRadius: 8,
                textDecoration: "none",
                transition: "border-color 0.15s, color 0.15s",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(79,158,255,0.4)"; e.currentTarget.style.color = "var(--color-ink)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-line)"; e.currentTarget.style.color = "var(--color-muted)"; }}
            >
              Open terminal
            </Link>
          </div>

          {/* Bottom stats */}
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "clamp(1.5rem, 3vw, 2.5rem)",
            marginTop: "clamp(3rem, 6vw, 5rem)",
            flexWrap: "wrap",
            position: "relative",
          }}>
            {[
              { label: "Total AUM", value: isLoading ? "—" : formatUSD(totalAUM, 0) },
              { label: "Active traders", value: isLoading ? "—" : String(traders?.length ?? "—") },
              { label: "Top 30d return", value: isLoading || topReturn === null ? "—" : `+${topReturn.toFixed(1)}%` },
            ].map((s) => (
              <div key={s.label}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)", marginBottom: 4 }}>
                  {s.label}
                </p>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, color: "var(--color-ink)", letterSpacing: "-0.02em" }}>
                  {s.value}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — live leaderboard panel */}
        <div style={{
          borderLeft: "1px solid var(--color-line)",
          display: "flex",
          flexDirection: "column",
          position: "relative",
          overflow: "hidden",
        }}>
          {/* Panel header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "1rem 1.5rem",
            borderBottom: "1px solid var(--color-line)",
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-faint)" }}>
              Top Traders · Arcadia Score
            </span>
            <Link href="/traders" style={{
              fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
              letterSpacing: "0.15em", textTransform: "uppercase",
              color: "var(--color-mint)", textDecoration: "none",
              display: "flex", alignItems: "center", gap: 4,
              transition: "opacity 0.15s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.6")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              All <ArrowRight size={10} />
            </Link>
          </div>

          {/* Column headers */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "1.5rem 1fr 3.5rem 4.5rem 3.5rem",
            gap: "0.75rem",
            padding: "0.5rem 1.5rem",
            borderBottom: "1px solid var(--color-line)",
          }}>
            {["#", "Handle", "Score", "Tier", "30d"].map((h) => (
              <span key={h} style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)" }}>
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          <div style={{ flex: 1, overflow: "auto" }}>
            {isLoading
              ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{
                  display: "grid", gridTemplateColumns: "1.5rem 1fr 3.5rem 4.5rem 3.5rem",
                  gap: "0.75rem", padding: "0.875rem 1.5rem",
                  borderBottom: "1px solid var(--color-line)",
                  alignItems: "center",
                }}>
                  {[20, 70, 25, 50, 25].map((w, j) => (
                    <div key={j} style={{ height: 7, borderRadius: 3, background: "var(--color-panel-2)", width: `${w + i * 3}%` }} />
                  ))}
                </div>
              ))
              : topTraders.map((t, idx) => (
                <Link key={t.handle} href={`/t/${t.handle}`} style={{
                  display: "grid",
                  gridTemplateColumns: "1.5rem 1fr 3.5rem 4.5rem 3.5rem",
                  gap: "0.75rem",
                  padding: "0.875rem 1.5rem",
                  borderBottom: "1px solid var(--color-line)",
                  alignItems: "center",
                  textDecoration: "none",
                  transition: "background 0.12s",
                  animation: `fade-in 0.3s ease ${idx * 60}ms both`,
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-panel)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-faint)" }}>
                    {idx + 1}
                  </span>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 600, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    @{t.handle}
                  </span>
                  <span className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-accent)" }}>
                    {t.score}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: TIER_COLOR[t.tier] ?? "var(--color-muted)", flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.625rem", color: TIER_COLOR[t.tier] ?? "var(--color-muted)" }}>
                      {t.tier}
                    </span>
                  </span>
                  <span className="tnum" style={{
                    fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontWeight: 700,
                    color: t.return_30d >= 0 ? "var(--color-green)" : "var(--color-red)",
                  }}>
                    {t.return_30d >= 0 ? "+" : ""}{t.return_30d.toFixed(1)}%
                  </span>
                </Link>
              ))
            }
          </div>

          {/* Panel footer */}
          <div style={{
            padding: "1rem 1.5rem",
            borderTop: "1px solid var(--color-line)",
            display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0,
          }}>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-faint)" }}>
              Updated every block · ~400ms
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-green)", animation: "glow-pulse 2s ease-in-out infinite" }} />
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-faint)" }}>Live</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SCORE — How it's built
      ═══════════════════════════════════════════════════════════════ */}
      <section
        ref={scoreRef}
        className="section-reveal"
        style={{ borderBottom: "1px solid var(--color-line)" }}
      >
        {/* Section label */}
        <div style={{
          padding: "0.875rem clamp(1.5rem, 5vw, 4.5rem)",
          borderBottom: "1px solid var(--color-line)",
        }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--color-faint)" }}>
            The Score
          </p>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          borderBottom: "1px solid var(--color-line)",
        }}>
          {/* Left — the number */}
          <div style={{
            padding: "clamp(2rem, 5vw, 4rem) clamp(1.5rem, 5vw, 4.5rem)",
            borderRight: "1px solid var(--color-line)",
            display: "flex", flexDirection: "column", justifyContent: "center",
          }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--color-faint)", marginBottom: "1.25rem" }}>
              Example score
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: "0.5rem" }}>
              <span style={{
                fontFamily: "var(--font-mono)", fontWeight: 700,
                fontSize: "clamp(4rem, 8vw, 7rem)",
                lineHeight: 1, letterSpacing: "-0.04em",
                color: "var(--color-ink)",
              }}>
                847
              </span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", color: "var(--color-faint)", fontWeight: 300 }}>
                / 1000
              </span>
            </div>
            <p style={{ fontSize: "0.8125rem", color: "var(--color-muted)", lineHeight: 1.6, maxWidth: "36ch", marginTop: "1rem" }}>
              Each TradeClosed event on Solana feeds into four weighted components. The result is anchored on-chain — no curator, no appeals, no override.
            </p>
            <div style={{ marginTop: "1.5rem", display: "flex", alignItems: "center", gap: 8 }}>
              <Link href="/leaderboard" style={{
                fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.15em", textTransform: "uppercase",
                color: "var(--color-mint)", textDecoration: "none",
                display: "flex", alignItems: "center", gap: 6,
                transition: "opacity 0.15s",
              }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.6")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                See the leaderboard <ArrowRight size={11} />
              </Link>
            </div>
          </div>

          {/* Middle — component bars */}
          <div style={{
            padding: "clamp(2rem, 5vw, 4rem) clamp(1.5rem, 5vw, 4.5rem)",
            borderRight: "1px solid var(--color-line)",
            display: "flex", flexDirection: "column", justifyContent: "center",
            gap: "1.75rem",
          }}>
            {SCORE_COMPONENTS.map((c, i) => (
              <div key={c.label}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: c.color, flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--color-muted)" }}>
                      {c.label}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--color-faint)", marginRight: 8 }}>
                      {c.weight}% weight
                    </span>
                    <span className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 700, color: "var(--color-ink)" }}>
                      {c.example}
                      <span style={{ color: "var(--color-faint)", fontWeight: 300, fontSize: "0.75rem" }}>/100</span>
                    </span>
                  </div>
                </div>
                <div className="progress-track">
                  <div
                    className="score-bar"
                    style={{
                      height: "100%",
                      width: `${c.example}%`,
                      background: c.color,
                      borderRadius: 3,
                      opacity: 0.85,
                      "--delay": `${i * 120}ms`,
                    } as React.CSSProperties}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Right — tier table */}
          <div style={{
            padding: "clamp(2rem, 5vw, 4rem) clamp(1.5rem, 5vw, 4.5rem)",
            display: "flex", flexDirection: "column", justifyContent: "center",
          }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--color-faint)", marginBottom: "1.5rem" }}>
              Profit split · by tier
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {TIER_TABLE.map((t) => (
                <div key={t.tier} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "0.875rem 1rem",
                  borderRadius: 8,
                  background: "var(--color-panel)",
                  border: "1px solid var(--color-line)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: t.color, flexShrink: 0 }} />
                    <div>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", fontWeight: 700, color: "var(--color-ink)", lineHeight: 1.3 }}>
                        {t.tier}
                      </p>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-faint)" }}>
                        {t.min === 0 ? "All scores" : `Score ≥ ${t.min}`}
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 800, color: t.color, letterSpacing: "-0.02em" }}>
                      {t.fee}
                    </p>
                    <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-faint)" }}>
                      of profit
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <p style={{ marginTop: "1rem", fontSize: "0.75rem", color: "var(--color-faint)", lineHeight: 1.5 }}>
              Platform fee: 5%. HWM per share — no fees on flat or losing periods.
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          PROTOCOL — Three pillars
      ═══════════════════════════════════════════════════════════════ */}
      <section
        ref={protocolRef}
        className="section-reveal"
        style={{ borderBottom: "1px solid var(--color-line)" }}
      >
        <div style={{ padding: "0.875rem clamp(1.5rem, 5vw, 4.5rem)", borderBottom: "1px solid var(--color-line)" }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em", textTransform: "uppercase", color: "var(--color-faint)" }}>
            Protocol
          </p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {[
            {
              n: "01", code: "SCORE",
              title: "Immutable trading record",
              body: "Every TradeClosed event is scored across sharpe, sortino, drawdown, and consistency. Anchored on Solana — no curator, no override. Your score is your career.",
              cta: "View reputation", href: "/reputation",
            },
            {
              n: "02", code: "VAULT",
              title: "Capital follows skill",
              body: "Each trader profile is their vault. Deposit USDC, receive shares tracked by InvestorPosition PDAs. Profit above the HWM is split by score tier — enforced on-chain by Anchor.",
              cta: "Browse vaults", href: "/traders",
            },
            {
              n: "03", code: "MARKET",
              title: "On-chain proof of skill",
              body: "Public directory of ranked traders. Sort by score, return, AUM, or sortino. Filter by open deposits. Every number is derived from on-chain TradeClosed events — no curation.",
              cta: "Leaderboard", href: "/leaderboard",
            },
          ].map((col, i) => (
            <div key={col.n} style={{
              display: "flex", flexDirection: "column",
              padding: "clamp(2rem, 4vw, 3rem) clamp(1.5rem, 3.5vw, 2.75rem)",
              borderRight: i < 2 ? "1px solid var(--color-line)" : undefined,
              borderTop: "1px solid var(--color-line)",
              transition: "background 0.2s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-panel)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.875rem", marginBottom: "1.75rem" }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontWeight: 900,
                  fontSize: "clamp(1.5rem, 3vw, 1.875rem)", lineHeight: 1,
                  color: "var(--color-line)", letterSpacing: "-0.05em",
                }}>
                  {col.n}
                </span>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
                  letterSpacing: "0.3em", textTransform: "uppercase", color: "var(--color-mint)",
                }}>
                  {col.code}
                </span>
              </div>
              <h3 style={{
                fontSize: "0.9375rem", fontWeight: 700,
                letterSpacing: "-0.02em", color: "var(--color-ink)",
                marginBottom: "0.75rem",
              }}>
                {col.title}
              </h3>
              <p style={{ fontSize: "0.875rem", lineHeight: 1.7, color: "var(--color-muted)", flex: 1 }}>
                {col.body}
              </p>
              <Link href={col.href} style={{
                display: "inline-flex", alignItems: "center", gap: 6,
                marginTop: "1.75rem", fontSize: "0.75rem", fontWeight: 700,
                color: "var(--color-mint)", textDecoration: "none",
                fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
                transition: "opacity 0.15s",
              }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.55")}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
              >
                {col.cta} <ArrowRight size={11} />
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          TOP TRADERS TABLE
      ═══════════════════════════════════════════════════════════════ */}
      <section
        ref={tableRef}
        className="section-reveal"
        style={{ borderBottom: "1px solid var(--color-line)" }}
      >
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0.875rem clamp(1.5rem, 5vw, 4.5rem)",
          borderBottom: "1px solid var(--color-line)",
        }}>
          <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-faint)" }}>
            Top Traders · by Arcadia Score
          </p>
          <Link href="/traders" style={{
            fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700,
            letterSpacing: "0.15em", textTransform: "uppercase",
            color: "var(--color-mint)", textDecoration: "none",
            display: "flex", alignItems: "center", gap: 5,
            transition: "opacity 0.15s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.55")}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
          >
            View all <ArrowRight size={10} />
          </Link>
        </div>

        <div style={{
          display: "grid",
          gridTemplateColumns: "2rem 1fr 5rem 7.5rem 5.5rem 5.5rem 5rem",
          gap: "1rem",
          padding: "0.5rem clamp(1.5rem, 5vw, 4.5rem)",
          borderBottom: "1px solid var(--color-line)",
        }}>
          {["", "Handle", "Score", "Tier", "30d", "AUM", ""].map((h, i) => (
            <span key={i} style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-faint)" }}>
              {h}
            </span>
          ))}
        </div>

        {isLoading
          ? [1, 2, 3, 4, 5].map((n) => (
            <div key={n} style={{
              display: "grid", gridTemplateColumns: "2rem 1fr 5rem 7.5rem 5.5rem 5.5rem 5rem",
              gap: "1rem", padding: "0.875rem clamp(1.5rem, 5vw, 4.5rem)",
              borderBottom: "1px solid var(--color-line)",
            }}>
              {[30, 80, 25, 55, 25, 35, 20].map((w, i) => (
                <div key={i} style={{ height: 7, borderRadius: 3, background: "var(--color-panel)", width: `${w}%` }} />
              ))}
            </div>
          ))
          : tableTraders.map((t, idx) => (
            <Link key={t.handle} href={`/t/${t.handle}`} style={{
              display: "grid",
              gridTemplateColumns: "2rem 1fr 5rem 7.5rem 5.5rem 5.5rem 5rem",
              gap: "1rem",
              padding: "0.875rem clamp(1.5rem, 5vw, 4.5rem)",
              borderBottom: "1px solid var(--color-line)",
              alignItems: "center",
              textDecoration: "none",
              transition: "background 0.12s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-panel)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-faint)" }}>{idx + 1}</span>
              <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--color-ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>@{t.handle}</span>
              <span className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 700, color: "var(--color-ink)" }}>{t.score}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: TIER_COLOR[t.tier] ?? "var(--color-muted)", flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: TIER_COLOR[t.tier] ?? "var(--color-muted)" }}>{t.tier}</span>
              </span>
              <span className="tnum" style={{
                fontFamily: "var(--font-mono)", fontSize: "0.875rem", fontWeight: 700,
                color: t.return_30d >= 0 ? "var(--color-green)" : "var(--color-red)",
              }}>
                {t.return_30d >= 0 ? "+" : ""}{t.return_30d.toFixed(1)}%
              </span>
              <span className="tnum" style={{ fontFamily: "var(--font-mono)", fontSize: "0.8125rem", color: "var(--color-muted)" }}>{formatUSD(t.aum, 0)}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{
                  fontFamily: "var(--font-mono)", fontSize: 9,
                  color: t.deposits_open ? "var(--color-green)" : "var(--color-faint)",
                  letterSpacing: "0.1em",
                }}>
                  {t.deposits_open ? "OPEN" : "CLOSED"}
                </span>
              </span>
            </Link>
          ))
        }
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          FAQ + CTA
      ═══════════════════════════════════════════════════════════════ */}
      <section style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
        borderBottom: "1px solid var(--color-line)",
      }}>
        {/* Left: CTA */}
        <div style={{
          padding: "clamp(3rem, 6vw, 5rem) clamp(1.5rem, 5vw, 4.5rem)",
          borderRight: "1px solid var(--color-line)",
          display: "flex", flexDirection: "column", justifyContent: "center",
        }}>
          <p style={{
            fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em",
            textTransform: "uppercase", color: "var(--color-faint)", marginBottom: "1.5rem",
          }}>
            Get started
          </p>
          <h2 style={{
            fontWeight: 800, fontSize: "clamp(1.75rem, 3.5vw, 2.5rem)",
            lineHeight: 1.1, letterSpacing: "-0.03em",
            color: "var(--color-ink)", marginBottom: "1rem",
          }}>
            Build your record.<br />
            <span style={{ color: "var(--color-muted)", fontWeight: 300 }}>Earn what you deserve.</span>
          </h2>
          <p style={{ fontSize: "0.875rem", color: "var(--color-muted)", lineHeight: 1.7, marginBottom: "2rem", maxWidth: "40ch" }}>
            Connect a Solana wallet. Every trade scores immediately. Your reputation follows you permanently — earned, not bought.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <Link href="/terminal" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "var(--color-ink)", color: "#000000",
              fontWeight: 700, fontSize: "0.875rem",
              padding: "11px 22px", borderRadius: 8,
              textDecoration: "none", transition: "opacity 0.15s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.85")}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
            >
              Open Terminal <ArrowUpRight size={14} />
            </Link>
            <Link href="/traders" style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: "transparent", border: "1px solid var(--color-line)",
              color: "var(--color-muted)", fontWeight: 600, fontSize: "0.875rem",
              padding: "10px 20px", borderRadius: 8,
              textDecoration: "none", transition: "border-color 0.15s, color 0.15s",
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(79,158,255,0.4)"; e.currentTarget.style.color = "var(--color-ink)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-line)"; e.currentTarget.style.color = "var(--color-muted)"; }}
            >
              Browse Traders
            </Link>
          </div>
        </div>

        {/* Right: FAQ */}
        <div style={{
          padding: "clamp(3rem, 6vw, 5rem) clamp(1.5rem, 5vw, 4.5rem)",
          display: "flex", flexDirection: "column", justifyContent: "center",
        }}>
          <p style={{
            fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.22em",
            textTransform: "uppercase", color: "var(--color-faint)", marginBottom: "1.25rem",
          }}>
            Common questions
          </p>
          <FAQ />
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
      }}>
        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)" }}>
          Arcadia · Anchor · Solana Devnet · Score 0–1000
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
          {[
            { label: "GitHub", href: "https://github.com" },
            { label: "Docs", href: "#docs" },
            { label: "Discord", href: "#discord" },
          ].map((l) => (
            <a key={l.label} href={l.href} target={l.href.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer"
              style={{
                fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em",
                textTransform: "uppercase", color: "var(--color-faint)",
                textDecoration: "none", transition: "color 0.15s",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-muted)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-faint)")}
            >
              {l.label}
            </a>
          ))}
        </div>
      </footer>
    </div>
  );
}
