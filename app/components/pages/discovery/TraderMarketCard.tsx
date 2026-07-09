import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";

import { formatUSD, shortAddr, type TraderListItem } from "@/lib/types";
import { Avatar } from "./Avatar";
import { TierChip } from "./TierChip";
import { StatusPill } from "./StatusPill";
import { AllocationBar } from "./AllocationBar";
import { Sparkline } from "./Sparkline";
import { MonoLabel, signTone } from "./bits";

/**
 * Trader marketplace card. Presentational; the watchlist toggle is injected by
 * the page via the `action` slot (composition over a boolean prop).
 */
export function TraderMarketCard({
  trader,
  action,
}: {
  trader: TraderListItem;
  action?: ReactNode;
}) {
  const positive = trader.return_30d >= 0;
  const seed = trader.handle.charCodeAt(0) + (trader.handle.charCodeAt(1) || 0);

  return (
    <article className="group acid-int relative flex flex-col rounded-xl border border-line bg-panel">
      {action ? <div className="absolute top-3 right-3 z-10">{action}</div> : null}

      <div className="flex flex-col gap-4 p-5">
        {/* header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              handle={trader.handle}
              size={40}
              className="transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:-rotate-6 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:transform-none"
            />
            <div className="min-w-0">
              <div className="mb-0.5 flex items-center gap-1.5">
                <span className="truncate text-sm font-bold text-ink">@{trader.handle}</span>
                <TierChip tier={trader.tier} />
              </div>
              <span className="font-mono text-[11px] text-faint">{shortAddr(trader.wallet)}</span>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <MonoLabel>Score</MonoLabel>
            <p className="font-mono text-2xl font-bold tracking-[-0.03em] text-ink tabular-nums transition-colors duration-300 group-hover:text-acid motion-reduce:transition-none">
              {trader.score}
            </p>
          </div>
        </div>

        {/* tags */}
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusPill
            deposits_open={trader.deposits_open}
            capacityLeft={trader.deposits_open ? trader.capacity_usd - trader.aum : undefined}
          />
          {trader.style_tags.map((tag) => (
            <span
              key={tag}
              className="rounded-md border border-line bg-panel-2 px-1.5 py-0.5 font-mono text-[10px] text-faint transition-colors duration-300 group-hover:text-muted motion-reduce:transition-none"
            >
              {tag}
            </span>
          ))}
        </div>

        {/* stats + sparkline */}
        <div className="flex items-end justify-between gap-3 border-y border-line py-3">
          <div className="grid flex-1 grid-cols-3 gap-4">
            <div>
              <MonoLabel>30d</MonoLabel>
              <p className={`mt-0.5 font-mono text-sm font-bold tabular-nums ${signTone(trader.return_30d)}`}>
                {positive ? "+" : ""}
                {trader.return_30d.toFixed(1)}%
              </p>
            </div>
            <div>
              <MonoLabel>Max DD</MonoLabel>
              <p className="mt-0.5 font-mono text-sm font-bold text-danger tabular-nums">
                {trader.max_dd.toFixed(1)}%
              </p>
            </div>
            <div>
              <MonoLabel>Sortino</MonoLabel>
              <p className="mt-0.5 font-mono text-sm font-bold text-ink tabular-nums">
                {trader.sortino.toFixed(2)}
              </p>
            </div>
          </div>
          <div className="ml-2 shrink-0 opacity-90 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none">
            <Sparkline seed={seed} positive={positive} uid={trader.handle} />
          </div>
        </div>

        {/* AUM */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <MonoLabel>AUM</MonoLabel>
            <span className="font-mono text-xs font-semibold text-muted tabular-nums">
              {formatUSD(trader.aum, 0)}
            </span>
          </div>
          <AllocationBar aum={trader.aum} total={trader.capacity_usd} />
        </div>

        {/* footer */}
        <div className="mt-auto flex items-center justify-between pt-1">
          <span className="font-mono text-[10px] text-faint">
            Self {formatUSD(trader.trader_self_funded, 0)}
          </span>
          <Link
            href={`/t/${trader.handle}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-acid/20 px-3 py-1.5 font-mono text-[0.72rem] tracking-[0.08em] text-acid uppercase transition-colors hover:bg-acid hover:text-void focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void motion-reduce:transition-none"
          >
            Profile <ArrowUpRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      </div>
    </article>
  );
}
