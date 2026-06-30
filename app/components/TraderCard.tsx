"use client";

import Link from "next/link";
import { TierBadge } from "./TierBadge";
import { DepositsStatusBadge } from "./DepositsStatusBadge";
import { CapacityBar } from "./CapacityBar";
import { formatUSD, pnlClass, pnlArrow, shortAddr } from "@/lib/types";
import type { TraderListItem } from "@/lib/types";
import { ArrowUpRight } from "lucide-react";

interface TraderCardProps {
  trader: TraderListItem;
}

/* Tiny inline sparkline — unique gradient ID per trader handle */
function MiniSparkline({ seed, positive, uid }: { seed: number; positive: boolean; uid: string }) {
  const pts = Array.from({ length: 12 }, (_, i) => {
    const noise = Math.sin((seed + i) * 2.5) * 0.4 + Math.sin((seed + i) * 1.1) * 0.3;
    return 30 + noise * 20 + (positive ? i * 1.2 : -i * 0.5);
  });
  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const w = 72, h = 24;
  const coords = pts.map((v, i) => ({
    x: (i / (pts.length - 1)) * w,
    y: h - ((v - min) / range) * h,
  }));
  const path = coords.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${path} L ${w} ${h} L 0 ${h} Z`;
  const color = positive ? "var(--color-mint)" : "var(--color-red)";
  /* Use sanitised handle as gradient ID to avoid collisions */
  const gradId = `spark-${uid.replace(/[^a-z0-9]/gi, "_")}`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={positive ? "#4f9eff" : "#ef4444"} stopOpacity="0.3" />
          <stop offset="100%" stopColor={positive ? "#4f9eff" : "#ef4444"} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${gradId})`} />
      <path d={path} stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function tierCardClass(tier: string): string {
  switch (tier) {
    case "Elite":       return "tier-elite-card";
    case "Advanced":    return "tier-advanced-card";
    case "Established": return "tier-established-card";
    case "Verified":    return "tier-verified-card";
    default:            return "";
  }
}

export function TraderCard({ trader }: TraderCardProps) {
  const r30Class = pnlClass(trader.return_30d);
  const r30Arrow = pnlArrow(trader.return_30d);
  const isPos = trader.return_30d >= 0;
  const initials = trader.handle.slice(0, 2).toUpperCase();
  const seed = trader.handle.charCodeAt(0) + (trader.handle.charCodeAt(1) || 0);

  return (
    <div
      className={`rounded-xl flex flex-col gap-0 overflow-hidden card card-hover ${tierCardClass(trader.tier)}`}
      style={{ background: "var(--color-panel)" }}
    >
      <div className="p-5 flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black flex-shrink-0"
              style={{
                background: "var(--color-panel-2)",
                border: "1px solid rgba(79,158,255,0.15)",
                color: "var(--color-mint)",
              }}
            >
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-sm font-bold" style={{ color: "var(--color-ink)" }}>
                  @{trader.handle}
                </span>
                <TierBadge tier={trader.tier} size="sm" />
              </div>
              <span className="text-[11px]" style={{ fontFamily: "var(--font-mono)", color: "var(--color-faint)" }}>
                {shortAddr(trader.wallet)}
              </span>
            </div>
          </div>

          {/* Score */}
          <div className="text-right flex-shrink-0">
            <p className="text-[9px] uppercase tracking-widest font-semibold mb-0.5" style={{ color: "var(--color-faint)" }}>
              Score
            </p>
            <p
              className="text-2xl font-black tnum leading-none"
              style={{ color: "var(--color-ink)", letterSpacing: "-0.03em" }}
            >
              {trader.score}
            </p>
          </div>
        </div>

        {/* Tags */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <DepositsStatusBadge
            deposits_open={trader.deposits_open}
            capacityLeft={trader.deposits_open ? trader.capacity_usd - trader.aum : undefined}
          />
          {trader.style_tags.map((tag) => (
            <span
              key={tag}
              className="text-[10px] px-1.5 py-0.5 rounded-md"
              style={{
                fontFamily: "var(--font-mono)",
                color: "var(--color-faint)",
                background: "var(--color-panel-2)",
                border: "1px solid var(--color-line)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        {/* Stats row + sparkline */}
        <div
          className="py-3"
          style={{ borderTop: "1px solid var(--color-line)", borderBottom: "1px solid var(--color-line)" }}
        >
          <div className="flex items-end justify-between">
            <div className="grid grid-cols-3 gap-4 flex-1">
              <div>
                <p className="text-[9px] uppercase tracking-widest mb-0.5 font-semibold" style={{ color: "var(--color-faint)" }}>
                  30d
                </p>
                <p className={`text-sm font-bold tnum ${r30Class}`}>
                  {r30Arrow}{Math.abs(trader.return_30d).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest mb-0.5 font-semibold" style={{ color: "var(--color-faint)" }}>
                  Max DD
                </p>
                <p className="text-sm font-bold tnum" style={{ color: "var(--color-red)" }}>
                  {trader.max_dd.toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-[9px] uppercase tracking-widest mb-0.5 font-semibold" style={{ color: "var(--color-faint)" }}>
                  Sortino
                </p>
                <p className="text-sm font-bold tnum" style={{ color: "var(--color-ink)" }}>
                  {trader.sortino.toFixed(2)}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 ml-4 opacity-80">
              <MiniSparkline seed={seed} positive={isPos} uid={trader.handle} />
            </div>
          </div>
        </div>

        {/* AUM */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[9px] uppercase tracking-widest font-semibold" style={{ color: "var(--color-faint)" }}>
              AUM
            </p>
            <p className="text-xs tnum font-semibold" style={{ fontFamily: "var(--font-mono)", color: "var(--color-muted)" }}>
              {formatUSD(trader.aum, 0)}
            </p>
          </div>
          <CapacityBar aum={trader.aum} capacity_usd={trader.capacity_usd} />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-1">
          <p className="text-[10px]" style={{ fontFamily: "var(--font-mono)", color: "var(--color-faint)" }}>
            Self {formatUSD(trader.trader_self_funded, 0)}
          </p>
          <Link
            href={`/t/${trader.handle}`}
            className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg font-bold transition-all"
            style={{
              background: "var(--color-mint)",
              color: "#ffffff",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--color-mint-bright)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "var(--color-mint)")}
          >
            Profile <ArrowUpRight size={11} />
          </Link>
        </div>
      </div>
    </div>
  );
}
