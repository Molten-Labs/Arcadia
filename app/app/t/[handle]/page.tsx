"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScoreDial } from "@/components/ScoreDial";
import { TierBadge } from "@/components/TierBadge";
import { DepositsStatusBadge } from "@/components/DepositsStatusBadge";
import { CapacityBar } from "@/components/CapacityBar";
import { RiskBars } from "@/components/RiskBars";
import { EquityChart } from "@/components/EquityChart";
import { ScoreHistoryChart } from "@/components/ScoreHistoryChart";
import { PnLHeatmap } from "@/components/PnLHeatmap";
import { ErrorState } from "@/components/ErrorState";
import { apiFetch } from "@/lib/utils";
import { formatUSD, pnlClass, pnlArrow, shortAddr } from "@/lib/types";
import type { TraderProfile } from "@/lib/types";
import { useRole } from "@/lib/role-context";
import { MOCK_SCORE_HISTORY, MOCK_DAILY_PNL, MOCK_TRADERS } from "@/lib/mock-data";
import {
  Bookmark, BookmarkCheck, ExternalLink, TrendingDown,
  BarChart3, Share2, CheckCircle, ChevronDown, ChevronUp,
} from "lucide-react";
import { ShareCardModal } from "@/components/ShareCardModal";

/* ── Watchlist hook ── */
function useWatchlist() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  useEffect(() => {
    try {
      const s = localStorage.getItem("arcadia_watchlist");
      if (s) setWatchlist(JSON.parse(s));
    } catch {}
  }, []);
  const toggle = (handle: string) => {
    setWatchlist((prev) => {
      const next = prev.includes(handle)
        ? prev.filter((h) => h !== handle)
        : [...prev, handle];
      localStorage.setItem("arcadia_watchlist", JSON.stringify(next));
      return next;
    });
  };
  return { watchlist, toggle };
}

/* ── Sliding tabs ── */
type ProfileTab = "overview" | "trades" | "dd" | "score" | "heatmap";
const TABS: { id: ProfileTab; label: string }[] = [
  { id: "overview",  label: "Overview"      },
  { id: "trades",    label: "Trades"        },
  { id: "dd",        label: "Due Diligence" },
  { id: "score",     label: "Score History" },
  { id: "heatmap",   label: "P&L Heatmap"  },
];

function SlidingTabs({ active, onChange }: { active: ProfileTab; onChange: (t: ProfileTab) => void }) {
  const pillRef = useRef<HTMLSpanElement>(null);
  const barRef  = useRef<HTMLDivElement>(null);

  const snap = useCallback((animate: boolean) => {
    const bar  = barRef.current;
    const pill = pillRef.current;
    if (!bar || !pill) return;
    const btn = bar.querySelector<HTMLButtonElement>(`[data-tab="${active}"]`);
    if (!btn) return;
    if (!animate) {
      const old = pill.style.transition;
      pill.style.transition = "none";
      pill.style.transform  = `translateX(${btn.offsetLeft}px)`;
      pill.style.width      = `${btn.offsetWidth}px`;
      pill.getBoundingClientRect();
      pill.style.transition = old;
    } else {
      pill.style.transform = `translateX(${btn.offsetLeft}px)`;
      pill.style.width     = `${btn.offsetWidth}px`;
    }
  }, [active]);

  useEffect(() => { snap(true); });
  useEffect(() => { snap(false); }, []);

  return (
    <div ref={barRef} className="t-tabs" style={{ "--tabs-bar-bg": "var(--color-panel)" } as React.CSSProperties}>
      <span ref={pillRef} className="t-tabs-pill" />
      {TABS.map((t) => (
        <button
          key={t.id}
          data-tab={t.id}
          role="tab"
          aria-selected={active === t.id}
          className="t-tab"
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* ── Collapsible panel using t-panel-slide ── */
function CollapsibleCard({ title, icon, children, defaultOpen = true }: {
  title: string; icon?: React.ReactNode; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="card" style={{ overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          width: "100%", padding: "1rem 1.25rem",
          background: "transparent", border: "none", cursor: "pointer",
          borderBottom: open ? "1px solid var(--color-line)" : "none",
          transition: "border-color 0.3s",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {icon}
          <span style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--color-ink)" }}>
            {title}
          </span>
        </div>
        {open ? <ChevronUp size={14} style={{ color: "var(--color-faint)" }} /> : <ChevronDown size={14} style={{ color: "var(--color-faint)" }} />}
      </button>
      <div
        className="t-panel-slide"
        data-open={open ? "true" : "false"}
        style={{ "--panel-translate-y": "24px" } as React.CSSProperties}
      >
        <div style={{ padding: "1.25rem" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Drawdown analysis ── */
function DrawdownTimeline({ trader }: { trader: TraderProfile }) {
  const curve = trader.equity_curve;
  let peak = curve[0]?.value ?? 1;
  const periods: { start: number; end: number; depth: number }[] = [];
  let inDD = false; let start = 0; let depth = 0;
  for (const pt of curve) {
    if (pt.value > peak) peak = pt.value;
    const dd = peak > 0 ? ((pt.value - peak) / peak) * 100 : 0;
    if (dd < -2 && !inDD) { inDD = true; start = pt.ts; depth = dd; }
    else if (inDD) {
      if (dd < depth) depth = dd;
      if (dd >= -0.5) { periods.push({ start, end: pt.ts, depth }); inDD = false; }
    }
  }
  const btcCurve = trader.equity_curve.map((pt, i) => ({
    ts: pt.ts,
    value: 1.0 + (i / trader.equity_curve.length) * 0.38 + Math.sin(i * 0.4) * 0.06,
  }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Max Drawdown",       value: `${trader.metrics.max_dd.toFixed(1)}%`,            color: "var(--color-red)"  },
          { label: "Calmar Ratio",       value: (trader.metrics.return_90d / Math.abs(trader.metrics.max_dd)).toFixed(2), color: "var(--color-ink)"  },
          { label: "Volatility 30d",     value: `${trader.metrics.vol_30d.toFixed(1)}%`,            color: "var(--color-ink)"  },
          { label: "Avg Win Duration",   value: `${trader.metrics.avg_trade_duration_hours.toFixed(1)}h`, color: "var(--color-ink)" },
        ].map((s) => (
          <div key={s.label} className="card" style={{ padding: "1rem" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)", marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 800, color: s.color, letterSpacing: "-0.03em" }}>{s.value}</p>
          </div>
        ))}
      </div>

      {periods.length > 0 && (
        <div className="card" style={{ padding: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem" }}>
            <TrendingDown size={13} style={{ color: "var(--color-red)" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)" }}>Drawdown Periods</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {periods.slice(0, 5).map((p, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-faint)", width: 60, flexShrink: 0 }}>
                  {new Date(p.start * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <span style={{ color: "var(--color-faint)", fontSize: 9 }}>→</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-faint)", width: 60, flexShrink: 0 }}>
                  {new Date(p.end * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <div style={{ flex: 1, height: 4, borderRadius: 2, background: "var(--color-panel-2)", overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, Math.abs(p.depth) * 5)}%`, height: "100%", background: "var(--color-red)", borderRadius: 2 }} />
                </div>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700, color: "var(--color-red)", width: 44, textAlign: "right" }}>
                  {p.depth.toFixed(1)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ padding: "1.25rem" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <BarChart3 size={13} style={{ color: "var(--color-mint)" }} />
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)" }}>vs BTC Benchmark</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 10 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--color-faint)" }}>
              <span style={{ width: 12, height: 2, background: "var(--color-ink)", display: "inline-block", borderRadius: 1 }} />
              @{trader.handle}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--color-faint)" }}>
              <span style={{ width: 12, height: 2, background: "var(--color-gold)", display: "inline-block", borderRadius: 1, opacity: 0.6 }} />
              BTC HODL
            </span>
          </div>
        </div>
        <EquityChart data={trader.equity_curve} benchmarkData={btcCurve} height={180} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: "0.75rem" }}>
          <div className="card" style={{ padding: "0.75rem" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--color-faint)", marginBottom: 4 }}>Trader 90d</p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 800, color: "var(--color-green)" }}>+{trader.metrics.return_90d.toFixed(1)}%</p>
          </div>
          <div className="card" style={{ padding: "0.75rem" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--color-faint)", marginBottom: 4 }}>BTC HODL 90d</p>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 800, color: "var(--color-gold)" }}>+38.4%</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Page ── */
export default function TraderProfilePage() {
  const params = useParams();
  const handle = params?.handle as string;
  const { role } = useRole();
  const isInvestor = role === "investor";
  const { watchlist, toggle } = useWatchlist();
  const [tab, setTab] = useState<ProfileTab>("overview");
  const [showShare, setShowShare] = useState(false);

  const { data: trader, isLoading, error, refetch } = useQuery<TraderProfile>({
    queryKey: ["trader", handle],
    queryFn: () => apiFetch(`/traders/${handle}`),
    enabled: !!handle,
  });

  /* Estimate leaderboard rank from mock data */
  const rank = (() => {
    if (!trader) return null;
    const sorted = [...MOCK_TRADERS].sort((a, b) => b.score - a.score);
    const idx = sorted.findIndex((t) => t.handle === trader.handle);
    return idx >= 0 ? idx + 1 : null;
  })();

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
        <div style={{ height: 180, background: "linear-gradient(135deg, #0c0820 0%, #080c18 50%, #000 100%)", animation: "pulse 2s ease-in-out infinite" }} />
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "1.5rem 2rem" }}>
          <div style={{ display: "flex", gap: "1.5rem" }}>
            <div style={{ flex: 1 }}>
              <div style={{ height: 48, width: 240, borderRadius: 8, background: "var(--color-panel)", marginBottom: 16 }} />
              <div style={{ height: 320, borderRadius: 12, background: "var(--color-panel)" }} />
            </div>
            <div style={{ width: 320, display: "flex", flexDirection: "column", gap: 12 }}>
              {[100, 160, 80, 120].map((h, i) => (
                <div key={i} style={{ height: h, borderRadius: 12, background: "var(--color-panel)" }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !trader) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--color-bg)" }}>
        <ErrorState message="Trader not found" onRetry={() => refetch()} />
      </div>
    );
  }

  const riskItems = [
    { label: "Sortino",  value: trader.metrics.sortino,             max: 5,   fmt: (v: number) => v.toFixed(2)       },
    { label: "Sharpe",   value: trader.metrics.sharpe,              max: 4,   fmt: (v: number) => v.toFixed(2)       },
    { label: "Win Rate", value: trader.metrics.win_rate,            max: 100, fmt: (v: number) => `${v.toFixed(1)}%` },
    { label: "Max DD",   value: Math.abs(trader.metrics.max_dd),    max: 30,  fmt: (v: number) => `-${v.toFixed(1)}%`, invert: true },
  ];

  const isWatched      = watchlist.includes(trader.handle);
  const scoreHistory   = MOCK_SCORE_HISTORY[trader.handle];
  const dailyPnl       = MOCK_DAILY_PNL[trader.handle];
  const capacityPct    = Math.round((trader.aum / trader.capacity.total) * 100);

  const TIER_COLOR: Record<string, string> = {
    Elite: "var(--color-tier-elite)", Advanced: "var(--color-tier-advanced)",
    Established: "var(--color-tier-established)", Verified: "var(--color-tier-verified)",
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>

      {/* ─── BANNER HEADER ──────────────────────────────────────── */}
      <div style={{
        position: "relative",
        background: "linear-gradient(135deg, #0b0620 0%, #070c1c 45%, #000000 100%)",
        borderBottom: "1px solid var(--color-line)",
        overflow: "hidden",
      }}>
        {/* Glow accents */}
        <div aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at 15% 60%, rgba(79,158,255,0.11) 0%, transparent 55%)",
        }} />
        <div aria-hidden style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse at 85% 20%, rgba(79,158,255,0.05) 0%, transparent 50%)",
        }} />

        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "2rem clamp(1.5rem, 4vw, 3rem)", position: "relative" }}>
          {/* Rank badge — top right */}
          {rank !== null && (
            <div style={{
              position: "absolute", top: "1.5rem", right: "clamp(1.5rem, 4vw, 3rem)",
              background: "rgba(0,0,0,0.6)", border: "1px solid var(--color-line)",
              borderRadius: 8, padding: "5px 12px", textAlign: "center",
              backdropFilter: "blur(8px)",
            }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--color-faint)", lineHeight: 1.5 }}>Rank</p>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.125rem", fontWeight: 900, color: "var(--color-ink)", letterSpacing: "-0.03em", lineHeight: 1.2 }}>#{rank}</p>
            </div>
          )}

          {/* Avatar + identity */}
          <div style={{ display: "flex", alignItems: "flex-end", gap: "1.5rem", marginBottom: "1.25rem", flexWrap: "wrap" }}>
            {/* Avatar */}
            <div style={{
              width: 76, height: 76, borderRadius: "50%",
              background: "var(--color-panel-2)",
              border: "3px solid rgba(255,255,255,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "1.5rem", fontWeight: 900, color: "var(--color-mint)",
              letterSpacing: "-0.03em", flexShrink: 0,
              boxShadow: "0 0 0 1px rgba(79,158,255,0.15), 0 8px 32px rgba(0,0,0,0.5)",
            }}>
              {trader.handle.slice(0, 2).toUpperCase()}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                <h1 style={{ fontWeight: 800, fontSize: "clamp(1.25rem, 2.5vw, 1.75rem)", color: "var(--color-ink)", letterSpacing: "-0.04em", margin: 0 }}>
                  @{trader.handle}
                </h1>
                <CheckCircle size={15} style={{ color: "var(--color-mint)", flexShrink: 0 }} />
                <a
                  href={`https://solscan.io/account/${trader.wallet}?cluster=devnet`}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--color-faint)", display: "flex", alignItems: "center", gap: 4, transition: "opacity 0.15s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.6")}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                >
                  {shortAddr(trader.wallet)} <ExternalLink size={9} />
                </a>
              </div>
              {trader.bio && (
                <p style={{ fontSize: "0.875rem", color: "var(--color-muted)", margin: 0, lineHeight: 1.5, maxWidth: "60ch" }}>
                  {trader.bio}
                </p>
              )}
            </div>

            {/* Action buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
              <button
                onClick={() => setShowShare(true)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 8,
                  background: "transparent", border: "1px solid var(--color-line)",
                  color: "var(--color-muted)", fontSize: "0.75rem", fontWeight: 600,
                  cursor: "pointer", transition: "border-color 0.15s, color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "rgba(79,158,255,0.35)"; e.currentTarget.style.color = "var(--color-ink)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--color-line)"; e.currentTarget.style.color = "var(--color-muted)"; }}
              >
                <Share2 size={12} /> Share
              </button>
              <button
                onClick={() => toggle(trader.handle)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "7px 14px", borderRadius: 8,
                  background: isWatched ? "rgba(79,158,255,0.1)" : "transparent",
                  border: `1px solid ${isWatched ? "rgba(79,158,255,0.3)" : "var(--color-line)"}`,
                  color: isWatched ? "var(--color-mint)" : "var(--color-muted)",
                  fontSize: "0.75rem", fontWeight: 600,
                  cursor: "pointer", transition: "all 0.15s",
                }}
              >
                {isWatched ? <BookmarkCheck size={12} /> : <Bookmark size={12} />}
                {isWatched ? "Watching" : "Watch"}
              </button>
            </div>
          </div>

          {/* Badges row */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <TierBadge tier={trader.tier} />
            <DepositsStatusBadge
              deposits_open={trader.deposits_open}
              capacityLeft={trader.deposits_open ? trader.capacity.total - trader.capacity.used : undefined}
            />
            {trader.style_tags.map((tag) => (
              <span key={tag} style={{
                fontFamily: "var(--font-mono)", fontSize: 10, fontWeight: 700,
                padding: "3px 10px", borderRadius: 999,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "var(--color-faint)",
              }}>
                #{tag}
              </span>
            ))}
            {/* Leaderboard breadcrumb */}
            <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4 }}>
              <Link href="/traders" style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--color-faint)", textDecoration: "none", transition: "color 0.15s" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--color-mint)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--color-faint)")}
              >
                Marketplace
              </Link>
              <span style={{ color: "var(--color-faint)", fontSize: 9 }}>/</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--color-muted)" }}>@{trader.handle}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── RETURN STATS STRIP ─────────────────────────────────── */}
      <div style={{ borderBottom: "1px solid var(--color-line)" }}>
        <div style={{
          maxWidth: 1280, margin: "0 auto",
          padding: "0 clamp(1.5rem, 4vw, 3rem)",
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          overflow: "auto",
        }}>
          {[
            { label: "7d Return",  value: trader.metrics.return_7d  },
            { label: "30d Return", value: trader.metrics.return_30d },
            { label: "90d Return", value: trader.metrics.return_90d },
            { label: "All-time",   value: trader.metrics.return_all },
          ].map((s, i) => (
            <div key={s.label} style={{
              padding: "1rem 0",
              borderRight: i < 3 ? "1px solid var(--color-line)" : "none",
              paddingRight: i < 3 ? "1.5rem" : 0,
              paddingLeft: i > 0 ? "1.5rem" : 0,
              position: "relative", overflow: "hidden",
            }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)", marginBottom: 4 }}>
                {s.label}
              </p>
              <p className={`tnum ${pnlClass(s.value)}`} style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 800, letterSpacing: "-0.03em" }}>
                {pnlArrow(s.value)}{Math.abs(s.value).toFixed(1)}%
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ─── MAIN CONTENT ───────────────────────────────────────── */}
      <div style={{ maxWidth: 1280, margin: "0 auto", padding: "1.5rem clamp(1.5rem, 4vw, 3rem)" }}>
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 300px",
          gap: "1.5rem",
          alignItems: "start",
        }}>

          {/* ── LEFT: Charts + Tabs ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem", minWidth: 0 }}>
            {/* Sliding tab nav */}
            <div>
              <SlidingTabs active={tab} onChange={setTab} />
            </div>

            {/* ── Overview: equity curve + recent trades ── */}
            {tab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem", animation: "fade-in 0.2s ease" }}>
                <div className="card" style={{ overflow: "hidden" }}>
                  <div style={{
                    padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between",
                    borderBottom: "1px solid var(--color-line)", background: "var(--color-panel-2)",
                  }}>
                    <div>
                      <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)", marginBottom: 2 }}>
                        Equity Curve
                      </p>
                      <p style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>90-day performance history</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-green)", animation: "glow-pulse 2s ease-in-out infinite" }} />
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-faint)" }}>Live</span>
                    </div>
                  </div>
                  <div style={{ padding: "1.25rem 1.25rem 0.5rem" }}>
                    <EquityChart data={trader.equity_curve} height={280} />
                  </div>
                </div>

                {!isInvestor && (
                  <div className="card" style={{ overflow: "hidden" }}>
                    <div style={{
                      padding: "1rem 1.25rem", display: "flex", alignItems: "center", justifyContent: "space-between",
                      borderBottom: "1px solid var(--color-line)", background: "var(--color-panel-2)",
                    }}>
                      <div>
                        <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)", marginBottom: 2 }}>
                          Recent Trades
                        </p>
                        <p style={{ fontSize: "0.75rem", color: "var(--color-muted)" }}>On-chain verifiable execution history</p>
                      </div>
                      <Link href={`/t/${trader.handle}/trades`} style={{
                        fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.15em", textTransform: "uppercase",
                        color: "var(--color-mint)", textDecoration: "none", transition: "opacity 0.15s",
                      }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.6")}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                      >
                        All {trader.trade_count} →
                      </Link>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                        <thead>
                          <tr style={{ background: "var(--color-bg)", borderBottom: "1px solid var(--color-line)" }}>
                            {["Market", "Side", "Size", "Leverage", "PnL", "Closed", "On-chain"].map((h) => (
                              <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)", fontWeight: 600 }}>
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {trader.trades.slice(0, 8).map((t) => (
                            <tr key={t.id} style={{ borderBottom: "1px solid var(--color-line)", transition: "background 0.12s" }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-panel-2)")}
                              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                            >
                              <td style={{ padding: "10px 16px", fontWeight: 700, color: "var(--color-ink)" }}>{t.market.replace("-PERP", "")}</td>
                              <td style={{ padding: "10px 16px" }}>
                                <span style={{
                                  fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase",
                                  padding: "3px 8px", borderRadius: 4,
                                  background: t.direction === "long" ? "var(--color-green-dim)" : "var(--color-red-dim)",
                                  color: t.direction === "long" ? "var(--color-green)" : "var(--color-red)",
                                }}>
                                  {t.direction}
                                </span>
                              </td>
                              <td className="tnum" style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", color: "var(--color-muted)" }}>{formatUSD(t.size_usd, 0)}</td>
                              <td className="tnum" style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", color: "var(--color-ink)", fontWeight: 700 }}>{t.leverage}x</td>
                              <td className={`tnum ${pnlClass(t.realized_pnl)}`} style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontWeight: 800, fontSize: "0.875rem" }}>
                                {t.realized_pnl >= 0 ? "+" : ""}{formatUSD(t.realized_pnl, 0)}
                              </td>
                              <td className="tnum" style={{ padding: "10px 16px", fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-faint)" }}>
                                {new Date(t.closed_at * 1000).toLocaleDateString()}
                              </td>
                              <td style={{ padding: "10px 16px" }}>
                                {t.sig ? (
                                  <a href={`https://solscan.io/tx/${t.sig}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                                    style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-mint)", display: "flex", alignItems: "center", gap: 4, transition: "opacity 0.15s" }}
                                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.6")}
                                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
                                  >
                                    {t.sig.slice(0, 6)}… <ExternalLink size={9} />
                                  </a>
                                ) : <span style={{ color: "var(--color-faint)" }}>—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Trades tab ── */}
            {tab === "trades" && (
              <div className="card" style={{ overflow: "hidden", animation: "fade-in 0.2s ease" }}>
                <div style={{ padding: "1rem 1.25rem", borderBottom: "1px solid var(--color-line)", background: "var(--color-panel-2)" }}>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)" }}>
                    All Trades · {trader.trade_count} records
                  </p>
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
                    <thead>
                      <tr style={{ background: "var(--color-bg)", borderBottom: "1px solid var(--color-line)" }}>
                        {["Market", "Side", "Size", "Leverage", "PnL", "Duration", "Closed", "Sig"].map((h) => (
                          <th key={h} style={{ padding: "10px 16px", textAlign: "left", fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)", fontWeight: 600 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {trader.trades.map((t) => (
                        <tr key={t.id} style={{ borderBottom: "1px solid var(--color-line)", transition: "background 0.12s" }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-panel-2)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <td style={{ padding: "9px 16px", fontWeight: 700, color: "var(--color-ink)" }}>{t.market.replace("-PERP", "")}</td>
                          <td style={{ padding: "9px 16px" }}>
                            <span style={{
                              fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 800, letterSpacing: "0.12em",
                              padding: "2px 7px", borderRadius: 4,
                              background: t.direction === "long" ? "var(--color-green-dim)" : "var(--color-red-dim)",
                              color: t.direction === "long" ? "var(--color-green)" : "var(--color-red)",
                            }}>
                              {t.direction}
                            </span>
                          </td>
                          <td className="tnum" style={{ padding: "9px 16px", fontFamily: "var(--font-mono)", color: "var(--color-muted)" }}>{formatUSD(t.size_usd, 0)}</td>
                          <td className="tnum" style={{ padding: "9px 16px", fontFamily: "var(--font-mono)", fontWeight: 700 }}>{t.leverage}x</td>
                          <td className={`tnum ${pnlClass(t.realized_pnl)}`} style={{ padding: "9px 16px", fontFamily: "var(--font-mono)", fontWeight: 800 }}>
                            {t.realized_pnl >= 0 ? "+" : ""}{formatUSD(t.realized_pnl, 0)}
                          </td>
                          <td style={{ padding: "9px 16px", fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-faint)" }}>
                            {`${(((t.closed_at - t.opened_at) / 3600)).toFixed(1)}h`}
                          </td>
                          <td className="tnum" style={{ padding: "9px 16px", fontFamily: "var(--font-mono)", fontSize: "0.6875rem", color: "var(--color-faint)" }}>
                            {new Date(t.closed_at * 1000).toLocaleDateString()}
                          </td>
                          <td style={{ padding: "9px 16px" }}>
                            {t.sig ? (
                              <a href={`https://solscan.io/tx/${t.sig}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                                style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-mint)", display: "flex", alignItems: "center", gap: 3 }}>
                                {t.sig.slice(0, 5)}… <ExternalLink size={9} />
                              </a>
                            ) : <span style={{ color: "var(--color-faint)", fontFamily: "var(--font-mono)", fontSize: 9 }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Due Diligence ── */}
            {tab === "dd" && <div style={{ animation: "fade-in 0.2s ease" }}><DrawdownTimeline trader={trader} /></div>}

            {/* ── Score History ── */}
            {tab === "score" && (
              <div className="card" style={{ padding: "1.25rem", animation: "fade-in 0.2s ease" }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)", marginBottom: "1.25rem" }}>
                  Score History — {scoreHistory?.length ?? 0} days
                </p>
                {scoreHistory
                  ? <ScoreHistoryChart data={scoreHistory} height={280} />
                  : <p style={{ fontSize: "0.875rem", textAlign: "center", padding: "4rem 0", color: "var(--color-faint)" }}>No score history available</p>
                }
              </div>
            )}

            {/* ── P&L Heatmap ── */}
            {tab === "heatmap" && (
              <div className="card" style={{ padding: "1.25rem", animation: "fade-in 0.2s ease" }}>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)", marginBottom: "1.25rem" }}>
                  Daily P&L Heatmap
                </p>
                {dailyPnl
                  ? <PnLHeatmap data={dailyPnl} />
                  : <p style={{ fontSize: "0.875rem", textAlign: "center", padding: "4rem 0", color: "var(--color-faint)" }}>No trade data available</p>
                }
              </div>
            )}
          </div>

          {/* ── RIGHT SIDEBAR ── */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.875rem", position: "sticky", top: 60 }}>
            {/* Score card */}
            <div className="card" style={{ padding: "1.25rem" }}>
              <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)", marginBottom: "0.875rem" }}>
                Arcadia Score
              </p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontFamily: "var(--font-mono)", fontWeight: 900, fontSize: "3rem", letterSpacing: "-0.05em", color: "var(--color-ink)", lineHeight: 1 }}>
                    {trader.score}
                  </p>
                  <div style={{ marginTop: 6 }}>
                    <TierBadge tier={trader.tier} />
                  </div>
                </div>
                <div style={{ opacity: 0.85 }}>
                  <ScoreDial score={trader.score} tier={trader.tier} size={72} />
                </div>
              </div>
            </div>

            {/* Vault */}
            <CollapsibleCard title="Vault Status" defaultOpen>
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.875rem" }}>
                  <DepositsStatusBadge
                    deposits_open={trader.deposits_open}
                    capacityLeft={trader.deposits_open ? trader.capacity.total - trader.capacity.used : undefined}
                  />
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700, color: "var(--color-ink)" }}>
                    {formatUSD(trader.aum, 0)}
                  </span>
                </div>
                <div style={{ marginBottom: 4 }}>
                  <CapacityBar aum={trader.aum} capacity_usd={trader.capacity.total} />
                </div>
                <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--color-faint)", marginBottom: "1rem" }}>
                  {formatUSD(trader.aum, 0)} of {formatUSD(trader.capacity.total, 0)} · {capacityPct}%
                </p>
                <Link href={`/vault/${trader.profile}`} style={{
                  display: "block", textAlign: "center",
                  padding: "10px", borderRadius: 8,
                  background: "var(--color-mint)", color: "#ffffff",
                  fontWeight: 700, fontSize: "0.8125rem", letterSpacing: "-0.01em",
                  textDecoration: "none", transition: "background 0.15s",
                  boxShadow: "0 0 20px rgba(79,158,255,0.2)",
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-mint-bright)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-mint)")}
                >
                  Fund Vault
                </Link>
              </div>
            </CollapsibleCard>

            {/* Quick stats */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {[
                { label: "Investors",      value: trader.investors_count.toString()  },
                { label: "Active Days",    value: trader.days_active.toString()      },
                { label: "Total Trades",   value: trader.trade_count.toString()      },
                { label: "Max Leverage",   value: `${trader.max_leverage}x`         },
              ].map((s) => (
                <div key={s.label} className="card" style={{ padding: "0.875rem", textAlign: "center" }}>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: 8, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--color-faint)", marginBottom: 4 }}>
                    {s.label}
                  </p>
                  <p style={{ fontFamily: "var(--font-mono)", fontSize: "1.125rem", fontWeight: 800, color: "var(--color-ink)", letterSpacing: "-0.03em" }}>
                    {s.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Risk profile — collapsible */}
            <CollapsibleCard title="Risk Profile" defaultOpen>
              <RiskBars items={riskItems} />
            </CollapsibleCard>
          </div>
        </div>
      </div>

      {showShare && (
        <ShareCardModal
          data={{
            handle:     trader.handle,
            score:      trader.score,
            tier:       trader.tier,
            return_30d: trader.metrics.return_30d,
            sortino:    trader.metrics.sortino,
            max_dd:     trader.metrics.max_dd,
            win_rate:   trader.metrics.win_rate,
            wallet:     trader.wallet,
          }}
          profileUrl={
            typeof window !== "undefined"
              ? `${window.location.origin}/arcadia/t/${trader.handle}`
              : `/arcadia/t/${trader.handle}`
          }
          onClose={() => setShowShare(false)}
        />
      )}
    </div>
  );
}
