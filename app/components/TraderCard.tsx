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

export function TraderCard({ trader }: TraderCardProps) {
  const r30Class = pnlClass(trader.return_30d);
  const r30Arrow = pnlArrow(trader.return_30d);
  const initials = trader.handle.slice(0, 2).toUpperCase();

  return (
    <div className="rounded-lg p-5 flex flex-col gap-4 card card-hover">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center text-xs font-black flex-shrink-0"
            style={{
              background: "var(--color-panel-2)",
              border: "1px solid var(--color-line)",
              color: "var(--color-accent)",
              fontFamily: "var(--font-sans)",
            }}
          >
            {initials}
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <span
                className="text-sm font-bold"
                style={{ color: "var(--color-ink)", fontFamily: "var(--font-sans)" }}
              >
                @{trader.handle}
              </span>
              <TierBadge tier={trader.tier} size="sm" />
            </div>
            <span className="text-[11px] font-mono" style={{ color: "var(--color-faint)" }}>
              {shortAddr(trader.wallet)}
            </span>
          </div>
        </div>

        {/* Score */}
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--color-faint)" }}>
            Score
          </p>
          <p
            className="text-2xl font-black tnum leading-none"
            style={{ color: "var(--color-accent)", fontFamily: "var(--font-sans)" }}
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
            className="text-[10px] px-1.5 py-0.5 rounded font-mono"
            style={{
              color: "var(--color-faint)",
              background: "var(--color-panel-2)",
              border: "1px solid var(--color-line)",
            }}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Stats row */}
      <div
        className="grid grid-cols-3 gap-3 py-3"
        style={{ borderTop: "1px solid var(--color-line)", borderBottom: "1px solid var(--color-line)" }}
      >
        <div>
          <p className="text-[10px] uppercase tracking-wider mb-0.5 font-semibold" style={{ color: "var(--color-faint)" }}>
            30d
          </p>
          <p className={`text-sm font-bold tnum ${r30Class}`}>
            {r30Arrow}{Math.abs(trader.return_30d).toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider mb-0.5 font-semibold" style={{ color: "var(--color-faint)" }}>
            Max DD
          </p>
          <p className="text-sm font-bold tnum" style={{ color: "var(--color-red)" }}>
            {trader.max_dd.toFixed(1)}%
          </p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider mb-0.5 font-semibold" style={{ color: "var(--color-faint)" }}>
            Sortino
          </p>
          <p className="text-sm font-bold tnum" style={{ color: "var(--color-ink)" }}>
            {trader.sortino.toFixed(2)}
          </p>
        </div>
      </div>

      {/* AUM */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: "var(--color-faint)" }}>
            AUM
          </p>
          <p className="text-xs tnum font-semibold" style={{ color: "var(--color-muted)" }}>
            {formatUSD(trader.aum, 0)}
          </p>
        </div>
        <CapacityBar aum={trader.aum} capacity_usd={trader.capacity_usd} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto">
        <p className="text-[10px] font-mono" style={{ color: "var(--color-faint)" }}>
          Self {formatUSD(trader.trader_self_funded, 0)}
        </p>
        <Link
          href={`/t/${trader.handle}`}
          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded font-bold transition-all"
          style={{
            background: "var(--color-accent)",
            color: "#060608",
            fontFamily: "var(--font-body)",
          }}
        >
          Profile <ArrowUpRight size={11} />
        </Link>
      </div>
    </div>
  );
}
