"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Copy, Sparkles } from "lucide-react";

import type { Direction, OrderType } from "./terminal-types";
import { useFlashTradePrices } from "@/lib/use-flash-trade-prices";
import { useFaucet } from "@/lib/use-faucet";

interface Props {
  direction: Direction;
  setDirection: (d: Direction) => void;
  orderType: OrderType;
  setOrderType: (t: OrderType) => void;
  sizeUSD: string;
  setSizeUSD: (v: string) => void;
  leverage: number;
  setLeverage: (v: number) => void;
  currentPrice?: number;
  onSubmit: () => void;
  submitting: boolean;
  connected: boolean;
  market: string;
  openDeposit: () => void;
  identityAddress: string | null;
  executionWallet: string | null;
  execStatus: "idle" | "connecting" | "error" | "live";
}

const LEVERAGE_QUICK = [25, 50, 75, 100] as const;

export function TerminalOrderForm({
  direction,
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
  identityAddress,
  executionWallet,
  execStatus,
}: Props) {
  const { getPrice } = useFlashTradePrices();
  const { state: faucetState, message: faucetMessage, fund } = useFaucet();
  const [tpslOpen, setTpslOpen] = useState(false);
  const [slipOpen, setSlipOpen] = useState(false);
  const [payMode, setPayMode] = useState<"usdc" | "token">("usdc");
  const [tokenAmt, setTokenAmt] = useState("");

  const symbol = market.replace("-PERP", "").replace("/USD", "");
  const ftPrice = getPrice(symbol);
  const livePrice = ftPrice?.priceUi ?? currentPrice;

  // When user types USDC amount, compute token receive
  const expectedToken = useMemo(() => {
    const amt = parseFloat(sizeUSD);
    if (!amt || !livePrice || livePrice <= 0) return 0;
    return amt / livePrice;
  }, [sizeUSD, livePrice]);

  // When user types token amount, compute USDC cost
  const expectedUsdc = useMemo(() => {
    const amt = parseFloat(tokenAmt);
    if (!amt || !livePrice || livePrice <= 0) return 0;
    return amt * livePrice;
  }, [tokenAmt, livePrice]);

  const notional = (parseFloat(sizeUSD) || 0) * leverage;
  const fee = notional * 0.0002;
  const liqDist = livePrice ? (livePrice / leverage) * 0.88 : 0;
  const liqPrice = livePrice
    ? direction === "long"
      ? livePrice - liqDist
      : livePrice + liqDist
    : 0;
  const isLong = direction === "long";

  const handleGetFunds = useCallback(async () => {
    if (identityAddress) await fund(identityAddress);
  }, [fund, identityAddress]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (connected && !submitting && sizeUSD && parseFloat(sizeUSD) > 0) {
          onSubmit();
        }
      }
    },
    [connected, submitting, sizeUSD, onSubmit],
  );

  return (
    <div
      className="flex h-full flex-col overflow-hidden border-l border-line bg-panel"
      onKeyDown={handleKeyDown}
    >
      {/* Execution wallet / status */}
      <div className="flex shrink-0 items-center gap-2 border-b border-line px-3 py-2">
        {executionWallet ? (
          <>
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: "var(--color-success)" }} />
            <span className="truncate text-[10px] tabular-nums text-ink">
              {executionWallet.slice(0, 8)}…{executionWallet.slice(-6)}
            </span>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(executionWallet); }}
              className="shrink-0 rounded p-0.5 text-faint transition-colors hover:text-ink"
              title="Copy execution wallet address"
              aria-label="Copy execution wallet address"
            >
              <Copy size={9} />
            </button>
            <span className="shrink-0 text-[10px] tabular-nums text-faint">
              · {execStatus}
            </span>
          </>
        ) : (
          <>
            <span className="shrink-0 text-[10px] font-semibold text-faint">Execution</span>
            <span className="truncate text-[10px] tabular-nums text-faint">
              {connected ? "derived from your wallet on first trade" : "not connected"}
            </span>
          </>
        )}
            <button
              type="button"
              onClick={() => void handleGetFunds()}
              disabled={faucetState === "funding" || !identityAddress}
              className="ml-auto flex shrink-0 items-center gap-1 rounded border border-line bg-panel-2 px-1.5 py-0.5 text-[10px] font-bold text-muted transition-colors hover:text-ink disabled:opacity-50"
              title="Mint devnet USDC + SOL into your wallet"
            >
              <Sparkles size={9} />
              {faucetState === "funding" ? "Funding…" : "Get test funds"}
            </button>
      </div>

      {faucetMessage && (
        <div className="shrink-0 border-b border-line px-3 py-1 text-[9px] tabular-nums" style={{ color: faucetState === "error" ? "var(--color-danger)" : "var(--color-muted)" }}>
          {faucetMessage}
        </div>
      )}

      {/* Alert banner */}
      <div className="flex shrink-0 items-center gap-2 border-b border-line bg-panel-2 px-3 py-2">
        <AlertTriangle size={12} className="shrink-0 text-muted" />
        <p className="text-[10px] leading-tight text-muted">
          {execStatus === "error"
            ? "Order failed. Your wallet pays fees — check you hold SOL + USDC on devnet."
            : connected
              ? "Real devnet positions. Your wallet pays fees; the execution wallet never needs funding."
              : "Demo mode — simulated position at live prices. Connect your wallet for real Flash execution."}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div className="space-y-4 p-3">

          {/* Price entry */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <span className="text-[10px] font-medium text-faint">Price</span>
              <span className="text-[10px] text-faint">USD</span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="text-2xl font-bold tabular-nums"
                style={{ color: isLong ? "var(--color-success)" : "var(--color-danger)" }}
              >
                {livePrice?.toFixed(2) ?? "—"}
              </span>
              <span className="self-end pb-1 text-[10px] text-faint">USD</span>
            </div>
            <div className="mt-1.5 flex overflow-hidden rounded border border-line">
              {(["Market", "Limit"] as OrderType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setOrderType(t)}
                  className="flex-1 py-1 text-[10px] font-semibold transition-colors motion-reduce:transition-none"
                  style={{
                    background: orderType === t ? "var(--color-panel-2)" : "transparent",
                    color: orderType === t ? "var(--color-ink)" : "var(--color-faint)",
                  }}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Amount — Pay */}
          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-[10px] font-medium text-faint">Pay</label>
              <span className="text-[10px] text-faint">
                Balance: <span className="text-ink">0</span>
              </span>
            </div>
            <div className="flex items-center overflow-hidden rounded border border-line bg-panel-2">
              <span className="pl-2 text-[10px] text-muted">$</span>
              <input
                type="number"
                value={sizeUSD}
                onChange={(e) => {
                  setSizeUSD(e.target.value);
                  setPayMode("usdc");
                }}
                placeholder="0.00"
                className="flex-1 bg-transparent px-2 py-2 text-xs tabular-nums text-ink outline-none"
              />
              <span className="border-l border-line px-2 text-[10px] font-semibold text-acid">
                USDC
              </span>
            </div>
          </div>

          {/* Expected receive */}
          <div className="rounded-lg border border-line bg-panel-2 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-medium text-faint">Expected Receive</span>
              <span
                className="text-[10px] font-bold"
                style={{ color: isLong ? "var(--color-success)" : "var(--color-danger)" }}
              >
                {isLong ? "Long" : "Short"}
              </span>
            </div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-sm font-bold tabular-nums text-ink">
                {expectedToken > 0 ? `$${(parseFloat(sizeUSD) || 0).toFixed(2)}` : "—"}
              </span>
              <span className="text-[11px] tabular-nums text-muted">
                {expectedToken > 0 ? expectedToken.toFixed(4) : "0.0000"} {symbol}
              </span>
            </div>
          </div>

          {/* Leverage */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-[10px] font-medium text-faint">Leverage</label>
              <span className="text-xs font-bold tabular-nums text-acid">{leverage}x</span>
            </div>
            <input
              type="range"
              min={1}
              max={100}
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value))}
              className="h-1 w-full rounded-full"
              style={{ accentColor: "var(--color-acid)" }}
              aria-label="Leverage"
            />
            <div className="mt-1.5 flex gap-1">
              {LEVERAGE_QUICK.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setLeverage(v)}
                  className="flex-1 rounded border py-1 text-[9px] font-bold transition-colors active:scale-95 motion-reduce:transition-none motion-reduce:transform-none"
                  style={{
                    background: leverage === v
                      ? "color-mix(in srgb, var(--color-acid) 12%, transparent)"
                      : "var(--color-panel-2)",
                    color: leverage === v ? "var(--color-acid)" : "var(--color-faint)",
                    borderColor: leverage === v
                      ? "color-mix(in srgb, var(--color-acid) 40%, transparent)"
                      : "var(--color-line)",
                  }}
                >
                  {v}x
                </button>
              ))}
            </div>
          </div>

          {/* TP/SL collapsible */}
          <div className="overflow-hidden rounded-lg border border-line">
            <button
              type="button"
              onClick={() => setTpslOpen(!tpslOpen)}
              className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-semibold transition-colors hover:bg-panel-2 motion-reduce:transition-none"
            >
              <span className="text-faint">Take Profit / Stop Loss</span>
              {tpslOpen ? <ChevronUp size={12} className="text-faint" /> : <ChevronDown size={12} className="text-faint" />}
            </button>
            {tpslOpen && (
              <div className="flex gap-2 border-t border-line px-3 py-2">
                <div className="flex-1">
                  <label className="mb-1 block text-[9px] text-success">Take Profit</label>
                  <input
                    type="number"
                    placeholder="Price"
                    className="w-full rounded border border-line bg-panel-2 px-2 py-1.5 text-[10px] tabular-nums text-ink outline-none"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-[9px] text-danger">Stop Loss</label>
                  <input
                    type="number"
                    placeholder="Price"
                    className="w-full rounded border border-line bg-panel-2 px-2 py-1.5 text-[10px] tabular-nums text-ink outline-none"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Slippage collapsible */}
          <div className="overflow-hidden rounded-lg border border-line">
            <button
              type="button"
              onClick={() => setSlipOpen(!slipOpen)}
              className="flex w-full items-center justify-between px-3 py-2 text-[10px] font-semibold transition-colors hover:bg-panel-2 motion-reduce:transition-none"
            >
              <span className="text-faint">Slippage Tolerance (0.8%)</span>
              {slipOpen ? <ChevronUp size={12} className="text-faint" /> : <ChevronDown size={12} className="text-faint" />}
            </button>
            {slipOpen && (
              <div className="border-t border-line px-3 py-2">
                <input
                  type="number"
                  defaultValue={0.8}
                  step={0.1}
                  className="w-full rounded border border-line bg-panel-2 px-2 py-1.5 text-[10px] tabular-nums text-ink outline-none"
                />
              </div>
            )}
          </div>

          {/* Action button */}
          <button
            type="button"
            onClick={onSubmit}
            disabled={!connected || submitting || !sizeUSD || parseFloat(sizeUSD) <= 0}
            className="w-full rounded-lg bg-acid py-3 text-sm font-bold tracking-wide text-ink transition-colors active:scale-[0.98] disabled:opacity-40 motion-reduce:transition-none motion-reduce:transform-none"
          >
            {!connected
              ? "Connect Wallet"
              : submitting
                ? "Processing…"
                : `${direction === "long" ? "Long" : "Short"} ${market}`}
          </button>

          {/* Position summary */}
          <div className="space-y-1.5 rounded-lg border border-line bg-panel-2 p-2.5">
            <p className="text-[9px] font-bold tracking-widest text-faint uppercase">Position Summary</p>
            {[
              ["Funding Token", "USDC"],
              ["Leverage", `${leverage.toFixed(2)}x`],
              ["Entry Price", livePrice ? `$${livePrice.toFixed(2)}` : "—"],
              ["Liq. Price", liqPrice > 0 ? `$${liqPrice.toFixed(2)}` : "—"],
              ["Fees (0.02%)", fee > 0 ? `$${fee.toFixed(2)}` : "$0.00"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between">
                <span className="text-[10px] text-faint">{k}</span>
                <span className="text-[10px] font-semibold tabular-nums text-ink">{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
