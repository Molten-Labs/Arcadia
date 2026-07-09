"use client";

import { MicroLabel } from "@/components/pages/trader/trader-ui";
import { Skeleton } from "@/components/ui/skeleton";
import type { PriceData } from "@/lib/types";

/** Price formatter shared across the paper-trade surface. Pure. */
export function fmtPx(market: string, price: number): string {
  if (market === "BTC-PERP") return price.toFixed(0);
  if (price >= 100) return price.toFixed(2);
  if (price >= 1) return price.toFixed(3);
  return price.toFixed(4);
}

/**
 * Live market selector strip. Each cell is a market button showing the polled
 * mark price and 24h change; the active market is highlighted. Presentational
 * (no hooks) so the page owns the price poll and selection state.
 */
export function PaperTradeMarketBar({
  prices,
  market,
  setMarket,
}: {
  prices?: PriceData[];
  market: string;
  setMarket: (m: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-panel">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <MicroLabel>Live markets</MicroLabel>
        <MicroLabel className="text-faint">Devnet feed</MicroLabel>
      </div>

      <div className="flex overflow-x-auto">
        {!prices
          ? Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="min-w-[150px] flex-1 border-r border-white/10 px-4 py-3 last:border-r-0"
              >
                <Skeleton className="mb-2 h-3 w-16" />
                <Skeleton className="mb-2 h-5 w-20" />
                <Skeleton className="h-3 w-12" />
              </div>
            ))
          : prices.map((p) => {
              const active = market === p.market;
              const up = p.change_pct_24h >= 0;
              return (
                <button
                  key={p.market}
                  type="button"
                  onClick={() => setMarket(p.market)}
                  aria-pressed={active}
                  className="min-w-[150px] flex-1 border-r border-white/10 px-4 py-3 text-left transition-colors last:border-r-0 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-acid/40 focus-visible:outline-none active:bg-white/[0.07] motion-reduce:transition-none"
                  style={active ? { background: "var(--color-panel-2)" } : undefined}
                >
                  <p className="mb-0.5 flex items-center gap-1.5 font-mono text-[0.62rem] tracking-[0.14em] text-muted uppercase">
                    {active && (
                      <span
                        aria-hidden
                        className="inline-block size-1.5 shrink-0 rounded-full bg-acid"
                      />
                    )}
                    {p.market}
                  </p>
                  <p className="font-mono text-base font-bold tabular-nums text-ink">
                    {fmtPx(p.market, p.price)}
                  </p>
                  <p
                    className={`font-mono text-xs font-semibold tabular-nums ${
                      up ? "text-success" : "text-danger"
                    }`}
                  >
                    {up ? "+" : ""}
                    {p.change_pct_24h.toFixed(2)}%
                  </p>
                </button>
              );
            })}
      </div>
    </div>
  );
}
