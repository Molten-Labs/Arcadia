"use client";

import { Minus, Plus } from "lucide-react";

import { TextSwap } from "@/components/TextSwap";
import { MicroLabel } from "@/components/pages/trader/trader-ui";
import type { Direction } from "@/components/pages/trader/terminal-types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatUSD } from "@/lib/types";
import { fmtPx } from "./PaperTradeMarketBar";

const AMOUNT_PRESETS = ["250", "1000", "5000", "10000"];
const LEV_PRESETS = [1, 3, 5, 10];
const MAX_LEV = 10;

/**
 * Paper-trade order ticket: market select, long/short toggle, size, leverage,
 * a derived order summary, and submit. Presentational (no data hooks) so the
 * page owns state and the simulated-fill mechanics.
 */
export function PaperTradeOrderForm({
  markets,
  market,
  setMarket,
  direction,
  setDirection,
  sizeUSD,
  setSizeUSD,
  leverage,
  setLeverage,
  currentPrice,
  onSubmit,
  submitting,
  connected,
}: {
  markets: string[];
  market: string;
  setMarket: (m: string) => void;
  direction: Direction;
  setDirection: (d: Direction) => void;
  sizeUSD: string;
  setSizeUSD: (v: string) => void;
  leverage: number;
  setLeverage: (v: number) => void;
  currentPrice?: number;
  onSubmit: () => void;
  submitting: boolean;
  connected: boolean;
}) {
  const isLong = direction === "long";
  const size = parseFloat(sizeUSD) || 0;
  const notional = size * leverage;
  const fee = notional * 0.0004;
  const liqDist = currentPrice ? (currentPrice / leverage) * 0.88 : 0;
  const liqPrice = currentPrice
    ? isLong
      ? currentPrice - liqDist
      : currentPrice + liqDist
    : 0;
  const symbol = market.replace("-PERP", "");
  const invalidSize = size <= 0;

  return (
    <div className="group acid-int rounded-2xl border border-white/10 bg-panel p-4">
      <MicroLabel className="mb-3">Order ticket</MicroLabel>

      <div className="space-y-3">
        {/* Market */}
        <div>
          <label
            htmlFor="pt-market"
            className="mb-1.5 block font-mono text-[0.62rem] tracking-[0.14em] text-faint uppercase"
          >
            Market
          </label>
          <Select value={market} onValueChange={setMarket}>
            <SelectTrigger id="pt-market" className="w-full" aria-label="Market">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {markets.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Long / Short */}
        <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-white/10">
          {(["long", "short"] as Direction[]).map((d) => {
            const active = direction === d;
            const tone = d === "long" ? "var(--color-success)" : "var(--color-danger)";
            return (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                aria-pressed={active}
                className="py-2.5 text-xs font-bold capitalize transition-all focus-visible:outline-none"
                style={{
                  background: active
                    ? `color-mix(in srgb, ${tone} 12%, transparent)`
                    : "transparent",
                  color: active ? tone : "var(--color-faint)",
                  borderBottom: active ? `2px solid ${tone}` : "2px solid transparent",
                }}
              >
                {d === "long" ? "▲ Long" : "▼ Short"}
              </button>
            );
          })}
        </div>

        {/* Size */}
        <div>
          <label
            htmlFor="pt-size"
            className="mb-1.5 block font-mono text-[0.62rem] tracking-[0.14em] text-faint uppercase"
          >
            Size (USD)
          </label>
          <div className="flex items-center overflow-hidden rounded-lg border border-white/10 bg-panel-2 focus-within:border-acid focus-within:ring-2 focus-within:ring-acid/30">
            <span className="pl-3 text-xs text-muted">$</span>
            <input
              id="pt-size"
              type="number"
              min={0}
              inputMode="decimal"
              value={sizeUSD}
              onChange={(e) => setSizeUSD(e.target.value)}
              placeholder="0.00"
              className="w-full flex-1 bg-transparent px-2 py-2 text-sm tabular-nums text-ink outline-none placeholder:text-faint"
            />
          </div>
          <div className="mt-1.5 flex gap-1.5">
            {AMOUNT_PRESETS.map((p) => {
              const active = sizeUSD === p;
              return (
                <button
                  key={p}
                  type="button"
                  onClick={() => setSizeUSD(p)}
                  className="flex-1 rounded border py-1 font-mono text-[0.62rem] font-bold tabular-nums transition-colors focus-visible:outline-none active:scale-95 motion-reduce:transition-none motion-reduce:transform-none"
                  style={{
                    background: active
                      ? "color-mix(in srgb, var(--color-acid) 12%, transparent)"
                      : "var(--color-panel-2)",
                    borderColor: active
                      ? "color-mix(in srgb, var(--color-acid) 40%, transparent)"
                      : "var(--color-line)",
                    color: active ? "var(--color-acid)" : "var(--color-faint)",
                  }}
                >
                  {Number(p) >= 1000 ? `$${Number(p) / 1000}K` : `$${p}`}
                </button>
              );
            })}
          </div>
        </div>

        {/* Leverage */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="pt-leverage"
              className="font-mono text-[0.62rem] tracking-[0.14em] text-faint uppercase"
            >
              Leverage
            </label>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setLeverage(Math.max(1, leverage - 1))}
                className="flex size-5 items-center justify-center rounded border border-white/10 text-muted transition-colors hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid/40 active:scale-90 motion-reduce:transition-none motion-reduce:transform-none"
                aria-label="Decrease leverage"
              >
                <Minus size={9} />
              </button>
              <span className="w-9 text-center font-mono text-xs font-bold tabular-nums text-acid">
                {leverage}x
              </span>
              <button
                type="button"
                onClick={() => setLeverage(Math.min(MAX_LEV, leverage + 1))}
                className="flex size-5 items-center justify-center rounded border border-white/10 text-muted transition-colors hover:bg-panel-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid/40 active:scale-90 motion-reduce:transition-none motion-reduce:transform-none"
                aria-label="Increase leverage"
              >
                <Plus size={9} />
              </button>
            </div>
          </div>
          <input
            id="pt-leverage"
            type="range"
            min={1}
            max={MAX_LEV}
            value={leverage}
            onChange={(e) => setLeverage(parseInt(e.target.value))}
            className="h-1 w-full rounded-full"
            style={{ accentColor: "var(--color-acid)" }}
            aria-label="Leverage"
          />
          <div className="mt-1 flex justify-between">
            {LEV_PRESETS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setLeverage(v)}
                className="font-mono text-[0.62rem] tabular-nums transition-colors hover:text-muted focus-visible:outline-none"
                style={{ color: leverage === v ? "var(--color-acid)" : "var(--color-faint)" }}
              >
                {v}x
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className="space-y-1.5 rounded-lg border border-white/10 bg-panel-2 p-2.5">
          {(
            [
              ["Entry", currentPrice ? fmtPx(market, currentPrice) : "Market"],
              ["Notional", notional > 0 ? formatUSD(notional) : "-"],
              ["Est. fee", fee > 0 ? formatUSD(fee) : "-"],
              ["Liq. price (est.)", liqPrice > 0 ? fmtPx(market, liqPrice) : "-"],
            ] as const
          ).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-[0.7rem] text-faint">{k}</span>
              <span className="font-mono text-[0.7rem] font-semibold tabular-nums text-ink">
                {v}
              </span>
            </div>
          ))}
        </div>

        {/* Submit */}
        <button
          type="button"
          onClick={onSubmit}
          disabled={!connected || submitting || invalidSize}
          className="w-full rounded-lg py-3 text-sm font-black tracking-wide transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-void active:scale-[0.98] disabled:opacity-40 motion-reduce:transform-none"
          style={{
            background: isLong ? "var(--color-success)" : "var(--color-danger)",
            color: isLong ? "var(--color-void)" : "var(--color-chrome-1)",
            boxShadow: isLong
              ? "0 4px 14px color-mix(in srgb, var(--color-success) 25%, transparent)"
              : "0 4px 14px color-mix(in srgb, var(--color-danger) 25%, transparent)",
          }}
        >
          <TextSwap>
            {!connected
              ? "Connect Wallet"
              : submitting
                ? "Placing order..."
                : `${isLong ? "▲ Long" : "▼ Short"} ${symbol}`}
          </TextSwap>
        </button>

        <p className="text-center font-mono text-[0.58rem] tracking-[0.12em] text-faint uppercase">
          Simulated fills - no real capital
        </p>
      </div>
    </div>
  );
}
