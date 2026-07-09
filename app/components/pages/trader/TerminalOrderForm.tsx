"use client";

import { useState } from "react";
import { Minus, Plus, Zap } from "lucide-react";

import { TextSwap } from "@/components/TextSwap";
import { formatUSD } from "@/lib/types";
import type { Direction, OrderType } from "./terminal-types";

export function TerminalOrderForm({
  direction,
  setDirection,
  orderType,
  setOrderType,
  sizeUSD,
  setSizeUSD,
  leverage,
  setLeverage,
  currentPrice,
  onSubmit,
  submitting,
  connected,
  market,
  openDeposit,
}: {
  direction: Direction;
  setDirection: (d: Direction) => void;
  orderType: OrderType;
  setOrderType: (t: OrderType) => void;
  sizeUSD: string;
  setSizeUSD: (v: string) => void;
  leverage: number;
  setLeverage: (v: number) => void;
  currentPrice?: number;
  oraclePrice?: number;
  onSubmit: () => void;
  submitting: boolean;
  connected: boolean;
  market: string;
  openDeposit: () => void;
}) {
  const [tpslEnabled, setTpslEnabled] = useState(false);
  const [reduceOnly, setReduceOnly] = useState(false);
  const [tpPrice, setTpPrice] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const [limitPrice, setLimitPrice] = useState("");
  const [focusPct, setFocusPct] = useState<number | null>(null);

  const notional = (parseFloat(sizeUSD) || 0) * leverage;
  const fee = notional * 0.0004;
  const liqDist = currentPrice ? (currentPrice / leverage) * 0.88 : 0;
  const liqPrice = currentPrice
    ? direction === "long"
      ? currentPrice - liqDist
      : currentPrice + liqDist
    : 0;

  const MARGIN_AVAIL = 20_000;
  const pctButtons = [10, 25, 50, 75, 100];
  const isLong = direction === "long";

  return (
    <div className="flex h-full flex-col overflow-hidden border-l border-line transition-colors duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] hover:border-white/15 motion-reduce:transition-none">
      {/* Long / Short tabs */}
      <div className="grid shrink-0 grid-cols-2 border-b border-line">
        {(["long", "short"] as Direction[]).map((d) => {
          const active = direction === d;
          const tone = d === "long" ? "var(--color-success)" : "var(--color-danger)";
          return (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className="py-2.5 text-xs font-bold capitalize transition-all"
              style={{
                background: active
                  ? `color-mix(in srgb, ${tone} 10%, transparent)`
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

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-3 p-3">
          {/* Order type */}
          <div className="flex overflow-hidden rounded border border-line">
            {(["Market", "Limit", "TP/SL"] as OrderType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setOrderType(t)}
                className="flex-1 py-1.5 text-[10px] font-semibold transition-colors active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none"
                style={{
                  background: orderType === t ? "var(--color-panel-2)" : "transparent",
                  color: orderType === t ? "var(--color-ink)" : "var(--color-faint)",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Limit price */}
          {orderType === "Limit" && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-[10px] font-medium text-faint">Limit Price</label>
                <span className="text-[10px] text-faint">USD</span>
              </div>
              <div className="flex items-center overflow-hidden rounded border border-line bg-panel-2">
                <input
                  type="number"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder={currentPrice?.toFixed(2) ?? "0.00"}
                  className="flex-1 bg-transparent px-2 py-1.5 text-xs tabular-nums text-ink outline-none"
                />
                <span className="border-l border-line px-2 text-[10px] text-faint">USD</span>
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[10px] font-medium text-faint">Amount</label>
              <span className="text-[10px] text-faint">USDC</span>
            </div>
            <div className="flex items-center overflow-hidden rounded border border-line bg-panel-2">
              <span className="pl-2 text-[10px] text-muted">$</span>
              <input
                type="number"
                value={sizeUSD}
                onChange={(e) => {
                  setSizeUSD(e.target.value);
                  setFocusPct(null);
                }}
                placeholder="0.00"
                className="flex-1 bg-transparent px-2 py-2 text-xs tabular-nums text-ink outline-none"
              />
            </div>
            <div className="mt-1.5 flex gap-1">
              {pctButtons.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => {
                    setSizeUSD(((MARGIN_AVAIL * p) / 100).toFixed(0));
                    setFocusPct(p);
                  }}
                  className="flex-1 rounded border py-1 text-[9px] font-bold transition-colors active:scale-95 motion-reduce:transition-none motion-reduce:transform-none"
                  style={{
                    background:
                      focusPct === p
                        ? "color-mix(in srgb, var(--color-acid) 12%, transparent)"
                        : "var(--color-panel-2)",
                    color: focusPct === p ? "var(--color-acid)" : "var(--color-faint)",
                    borderColor:
                      focusPct === p
                        ? "color-mix(in srgb, var(--color-acid) 40%, transparent)"
                        : "var(--color-line)",
                  }}
                >
                  {p === 100 ? "Max" : `${p}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Leverage */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] font-medium text-faint">Leverage</label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setLeverage(Math.max(1, leverage - 1))}
                  className="flex size-5 items-center justify-center rounded border border-line text-muted transition-colors hover:bg-panel-2 active:scale-90 motion-reduce:transform-none"
                  aria-label="Decrease leverage"
                >
                  <Minus size={8} />
                </button>
                <span className="w-10 text-center text-xs font-bold tabular-nums text-acid">
                  {leverage}x
                </span>
                <button
                  type="button"
                  onClick={() => setLeverage(Math.min(50, leverage + 1))}
                  className="flex size-5 items-center justify-center rounded border border-line text-muted transition-colors hover:bg-panel-2 active:scale-90 motion-reduce:transform-none"
                  aria-label="Increase leverage"
                >
                  <Plus size={8} />
                </button>
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value))}
              className="h-1 w-full rounded-full"
              style={{ accentColor: "var(--color-acid)" }}
              aria-label="Leverage"
            />
            <div className="mt-1 flex justify-between text-[9px] text-faint">
              {[1, 5, 10, 20, 50].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setLeverage(v)}
                  className="transition-colors hover:text-muted"
                  style={{ color: leverage === v ? "var(--color-acid)" : undefined }}
                >
                  {v}x
                </button>
              ))}
            </div>
          </div>

          {/* TP / SL toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-semibold text-faint">TP / SL</label>
              <span className="rounded border border-acid/20 bg-acid/[0.08] px-1.5 py-0.5 text-[9px] text-acid">
                Optional
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={tpslEnabled}
              aria-label="Enable take-profit / stop-loss"
              onClick={() => setTpslEnabled(!tpslEnabled)}
              className="relative h-5 w-9 rounded-full transition-colors"
              style={{ background: tpslEnabled ? "var(--color-acid)" : "var(--color-line)" }}
            >
              <div
                className="absolute top-0.5 size-4 rounded-full bg-white shadow transition-all"
                style={{ left: tpslEnabled ? "calc(100% - 18px)" : "2px" }}
              />
            </button>
          </div>
          {tpslEnabled && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-[9px]" style={{ color: "var(--color-success)" }}>
                  Take Profit
                </label>
                <input
                  type="number"
                  value={tpPrice}
                  onChange={(e) => setTpPrice(e.target.value)}
                  placeholder="Price"
                  className="w-full rounded px-2 py-1.5 text-[10px] tabular-nums text-ink outline-none"
                  style={{
                    background: "color-mix(in srgb, var(--color-success) 6%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-success) 22%, transparent)",
                  }}
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-[9px]" style={{ color: "var(--color-danger)" }}>
                  Stop Loss
                </label>
                <input
                  type="number"
                  value={slPrice}
                  onChange={(e) => setSlPrice(e.target.value)}
                  placeholder="Price"
                  className="w-full rounded px-2 py-1.5 text-[10px] tabular-nums text-ink outline-none"
                  style={{
                    background: "color-mix(in srgb, var(--color-danger) 6%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-danger) 22%, transparent)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Reduce only */}
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-faint">Reduce Only</label>
            <button
              type="button"
              role="switch"
              aria-checked={reduceOnly}
              aria-label="Reduce only"
              onClick={() => setReduceOnly(!reduceOnly)}
              className="relative h-5 w-9 rounded-full transition-colors"
              style={{ background: reduceOnly ? "var(--color-acid)" : "var(--color-line)" }}
            >
              <div
                className="absolute top-0.5 size-4 rounded-full bg-white shadow transition-all"
                style={{ left: reduceOnly ? "calc(100% - 18px)" : "2px" }}
              />
            </button>
          </div>

          {/* Order summary */}
          <div className="space-y-1.5 rounded-lg border border-line bg-panel-2 p-2.5">
            {[
              ["Entry", currentPrice ? currentPrice.toFixed(2) : "Market"],
              ["Liq. Price", liqPrice > 0 ? liqPrice.toFixed(2) : "—"],
              ["Notional", notional > 0 ? formatUSD(notional) : "—"],
              ["Fees (est.)", fee > 0 ? formatUSD(fee) : "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-[10px] text-faint">{k}</span>
                <span className="text-[10px] font-semibold tabular-nums text-ink">{v}</span>
              </div>
            ))}
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!connected || submitting || !sizeUSD || parseFloat(sizeUSD) <= 0}
            className="w-full rounded-lg py-3 text-sm font-black tracking-wide transition-all active:scale-[0.98] disabled:opacity-40 motion-reduce:transform-none"
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
                  ? "Placing order…"
                  : `${isLong ? "▲ Long" : "▼ Short"} ${market.replace("-PERP", "")}`}
            </TextSwap>
          </button>

          <p className="text-center font-mono text-[0.58rem] tracking-[0.12em] text-faint uppercase">
            Simulated fills · no real capital
          </p>
        </div>
      </div>

      {/* Account summary */}
      <div className="shrink-0 border-t border-line px-3 pt-2 pb-3">
        <p className="mb-2 text-[9px] font-black tracking-widest text-faint uppercase">Account</p>
        <div className="space-y-1">
          {[
            ["Available", "$20,000.00", "var(--color-ink)"],
            ["Margin Used", "$0.00", "var(--color-ink)"],
            ["Margin Ratio", "—", "var(--color-ink)"],
            ["Unrealized PnL", "+$0.00", "var(--color-success)"],
          ].map(([k, v, c]) => (
            <div key={k} className="flex items-center justify-between">
              <span className="text-[10px] text-faint">{k}</span>
              <span className="text-[10px] font-semibold tabular-nums" style={{ color: c }}>
                {v}
              </span>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={openDeposit}
          className="mt-2 flex w-full items-center justify-center gap-1 rounded border border-acid/30 bg-acid/[0.06] py-1.5 text-center text-[10px] font-bold text-acid transition-colors hover:bg-acid/[0.12] active:scale-[0.98] motion-reduce:transform-none"
        >
          <Zap size={10} />
          Deposit USDC
        </button>
      </div>
    </div>
  );
}
