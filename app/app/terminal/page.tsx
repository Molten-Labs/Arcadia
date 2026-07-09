"use client";

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { formatUSD } from "@/lib/types";
import type { OpenPosition } from "@/lib/types";
import { PhoenixProvider, usePhoenix } from "@/lib/phoenix-context";
import type { PhoenixTrade } from "@/lib/phoenix-types";
import {
  ChevronDown, TrendingUp, TrendingDown, X, Minus, Plus,
  Crosshair, BarChart2, Maximize2, BookOpen,
  Layers, Circle, Square, Triangle, Activity, Zap,
} from "lucide-react";
import { TextSwap } from "@/components/TextSwap";

const TvChart = dynamic(() => import("@/components/TvChart").then((m) => m.TvChart), { ssr: false });

type Direction = "long" | "short";
type OrderType = "Market" | "Limit" | "TP/SL";
type BookTab = "book" | "trades";
type BottomTab = "positions" | "orders" | "history" | "funding";

/* ─────────────────────────────────────────────────────────────────
   Flow sparkline (SVG)
───────────────────────────────────────────────────────────────── */

function FlowSparkline({ flow }: { flow: number[] }) {
  if (!flow.length) return <div className="flex-1" style={{ height: 20 }} />;
  const W = 200, H = 20;
  const min = Math.min(0, ...flow);
  const max = Math.max(0, ...flow);
  const span = Math.max(max - min, 1e-9);
  const x = (i: number) => (flow.length === 1 ? W / 2 : (i / (flow.length - 1)) * W);
  const y = (v: number) => H - 1 - ((v - min) / span) * (H - 2);
  const path = flow.map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`).join(" ");
  const last = flow[flow.length - 1];
  const stroke = last >= 0 ? "var(--color-green)" : "var(--color-red)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="flex-1" style={{ height: 20, minWidth: 60 }} preserveAspectRatio="none">
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TradeFlowStrip({ trades: tradeList }: { trades: PhoenixTrade[] }) {
  const analytics = useMemo(() => {
    let buyNotional = 0, sellNotional = 0;
    for (const t of tradeList) {
      if (t.side === "b") buyNotional += t.notional;
      else sellNotional += t.notional;
    }
    const total = buyNotional + sellNotional;
    const buyPct = total > 0 ? (buyNotional / total) * 100 : 50;
    const chrono = [...tradeList].sort((a, b) => a.time - b.time);
    const flow: number[] = [];
    let running = 0;
    for (const t of chrono) {
      running += t.side === "b" ? t.notional : -t.notional;
      flow.push(running);
    }
    return { buyPct, sellPct: 100 - buyPct, flow, net: running };
  }, [tradeList]);

  if (!tradeList.length) return null;

  const dominant = analytics.buyPct >= analytics.sellPct ? "BUY" : "SELL";
  const dominantPct = Math.max(analytics.buyPct, analytics.sellPct);
  return (
    <div style={{ borderBottom: "1px solid var(--color-line)" }} className="px-3 py-2 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>Flow · window</span>
        <span className="text-[10px] tnum font-semibold" style={{ color: dominant === "BUY" ? "var(--color-green)" : "var(--color-red)" }}>
          {dominantPct.toFixed(0)}% {dominant}
        </span>
      </div>
      <div className="h-1.5 flex overflow-hidden rounded" style={{ background: "var(--color-panel-2)" }}>
        <div style={{ width: `${analytics.buyPct}%`, background: "rgba(34,197,94,0.7)" }} />
        <div style={{ width: `${analytics.sellPct}%`, background: "rgba(239,68,68,0.7)" }} />
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[9px] font-bold uppercase tracking-widest flex-shrink-0" style={{ color: "var(--color-faint)" }}>Net</span>
        <FlowSparkline flow={analytics.flow} />
        <span className="text-[10px] tnum font-semibold flex-shrink-0" style={{ color: analytics.net >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
          {analytics.net >= 0 ? "+" : ""}{formatUSD(analytics.net, 0)}
        </span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   OrderBook + Trades panel
───────────────────────────────────────────────────────────────── */

function OrderBookPanel({ symbol, market }: { symbol: string; market: string }) {
  const { orderbook, trades: phoenixTrades, marketStats } = usePhoenix();
  const [tab, setTab]   = useState<BookTab>("book");

  const book = orderbook[symbol];
  const tradeList = phoenixTrades[symbol] ?? [];
  const stats = marketStats[symbol];
  const midPrice = stats?.markPx ?? 0;
  const isBtc = market === "BTC-PERP";
  const dp = isBtc ? 1 : 3;

  const WALL_THRESH = 3;
  const DEPTH_BPS = [10, 25, 50] as const;

  const askLevels = book?.asks ?? [];
  const bidLevels = book?.bids ?? [];
  const askSizes = askLevels.slice(-14).map(l => l.size);
  const bidSizes = bidLevels.slice(0, 14).map(l => l.size);
  const askMed = askSizes.length ? [...askSizes].sort((a, b) => a - b)[Math.floor(askSizes.length / 2)] : 0;
  const bidMed = bidSizes.length ? [...bidSizes].sort((a, b) => a - b)[Math.floor(bidSizes.length / 2)] : 0;

  const asks = askLevels.slice(-14).map((a, _i, arr) => {
    const total = arr.slice(0, _i + 1).reduce((s, x) => s + x.size, 0);
    return { ...a, total, isWall: askMed > 0 && a.size > askMed * WALL_THRESH };
  }).reverse();
  const bids = bidLevels.slice(0, 14).map((b, _i, arr) => {
    const total = arr.slice(0, _i + 1).reduce((s, x) => s + x.size, 0);
    return { ...b, total, isWall: bidMed > 0 && b.size > bidMed * WALL_THRESH };
  });
  const allLevels = [...asks, ...bids];
  const maxTotal = allLevels.length > 0 ? Math.max(...allLevels.map((x) => x.total)) : 1;

  const spread = asks.length > 0 && bids.length > 0
    ? asks[asks.length - 1].price - bids[0].price
    : 0;

  const bookMid = book?.mid ?? midPrice;
  const depthWithin = (bps: number, side: "ask" | "bid") => {
    if (bookMid <= 0) return 0;
    const limit = side === "ask" ? bookMid * (1 + bps / 10000) : bookMid * (1 - bps / 10000);
    let total = 0;
    for (const lvl of (side === "ask" ? askLevels : bidLevels)) {
      if (side === "ask" && lvl.price > limit) break;
      if (side === "bid" && lvl.price < limit) break;
      total += lvl.size;
    }
    return total;
  };
  const depthRows = DEPTH_BPS.map((bps) => ({ bps, ask: depthWithin(bps, "ask"), bid: depthWithin(bps, "bid") }));
  const topAskSz = asks.reduce((s, r) => s + r.size, 0);
  const topBidSz = bids.reduce((s, r) => s + r.size, 0);
  const tSize = topAskSz + topBidSz;
  const bidPct = tSize > 0 ? (topBidSz / tSize) * 100 : 50;
  const askPct = 100 - bidPct;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ borderLeft: "1px solid var(--color-line)" }}>
      {/* Tabs */}
      <div className="flex flex-shrink-0" style={{ borderBottom: "1px solid var(--color-line)" }}>
        {(["book", "trades"] as BookTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="flex-1 py-2 text-[11px] font-semibold capitalize transition-colors"
            style={{
              color: tab === t ? "var(--color-ink)" : "var(--color-faint)",
              borderBottom: tab === t ? "2px solid var(--color-mint)" : "2px solid transparent",
              background: "transparent",
            }}
          >
            {t === "book" ? "Order Book" : "Trades"}
          </button>
        ))}
        <div className="flex items-center px-1.5 gap-0.5">
          {[Layers, BarChart2].map((Icon, i) => (
            <button key={i} className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--color-panel-2)]">
              <Icon size={10} style={{ color: "var(--color-faint)" }} />
            </button>
          ))}
        </div>
      </div>

      {tab === "book" ? (
        <>
          {/* Depth bands */}
          <div
            className="grid px-2 py-1.5 flex-shrink-0 text-[9px] font-medium gap-x-2 items-center"
            style={{ gridTemplateColumns: "auto 1fr 1fr 1fr", borderBottom: "1px solid var(--color-line)", color: "var(--color-faint)" }}
          >
            <span className="text-[9px] font-bold uppercase tracking-widest self-start pt-0.5">Depth</span>
            {depthRows.map((r) => (
              <span key={`h-${r.bps}`} className="text-right tnum text-[9px]" style={{ color: "var(--color-faint)" }}>±{r.bps} bps</span>
            ))}
            {depthRows.map((r) => (
              <span key={`a-${r.bps}`} className="text-right tnum text-[10px]" style={{ color: "var(--color-red)" }}>{r.ask.toFixed(2)}</span>
            ))}
            {depthRows.map((r) => (
              <span key={`b-${r.bps}`} className="text-right tnum text-[10px]" style={{ color: "var(--color-green)" }}>{r.bid.toFixed(2)}</span>
            ))}
          </div>

          <div
            className="grid px-2 py-1 flex-shrink-0 text-[9px] font-medium"
            style={{ gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid var(--color-line)", color: "var(--color-faint)" }}
          >
            <span>Price (USD)</span><span className="text-right">Size</span><span className="text-right">Total</span>
          </div>

          <div className="overflow-hidden" style={{ flex: "1 1 0" }}>
            <div className="flex flex-col-reverse h-full">
              {asks.map((a, i) => (
                <div
                  key={i}
                  className="relative grid px-2 hover:bg-[var(--color-panel-2)] cursor-pointer"
                  style={{ gridTemplateColumns: "1fr 1fr 1fr", height: 19 }}
                >
                  <div
                    className="absolute right-0 top-0 bottom-0"
                    style={{ width: `${(a.total / maxTotal) * 100}%`, background: "rgba(239,68,68,0.09)" }}
                  />
                  {a.isWall && (
                    <div className="absolute left-0 top-1 bottom-0 w-0.5" style={{ background: "var(--color-red)" }} />
                  )}
                  <span className="text-[10px] tnum relative z-10 leading-[19px]" style={{ color: "var(--color-red)" }}>{a.price.toFixed(dp)}</span>
                  <span className="text-[10px] tnum relative z-10 text-right leading-[19px]" style={{ color: "var(--color-muted)" }}>{a.size.toFixed(3)}</span>
                  <span className="text-[10px] tnum relative z-10 text-right leading-[19px]" style={{ color: "var(--color-faint)" }}>{a.total.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>

          <div
            className="flex items-center justify-between px-2 py-1.5 flex-shrink-0"
            style={{ background: "var(--color-panel-2)", borderTop: "1px solid var(--color-line)", borderBottom: "1px solid var(--color-line)" }}
          >
            <span className="text-[12px] font-bold tnum" style={{ color: "var(--color-ink)" }}>
              {midPrice.toFixed(dp)}
            </span>
            <span className="text-[9px]" style={{ color: "var(--color-faint)" }}>
              Spread {spread.toFixed(dp)}
            </span>
          </div>

          <div className="overflow-hidden" style={{ flex: "1 1 0" }}>
            <div className="flex flex-col h-full">
              {bids.map((b, i) => (
                <div
                  key={i}
                  className="relative grid px-2 hover:bg-[var(--color-panel-2)] cursor-pointer"
                  style={{ gridTemplateColumns: "1fr 1fr 1fr", height: 19 }}
                >
                  <div
                    className="absolute right-0 top-0 bottom-0"
                    style={{ width: `${(b.total / maxTotal) * 100}%`, background: "rgba(79,158,255,0.09)" }}
                  />
                  {b.isWall && (
                    <div className="absolute left-0 top-1 bottom-0 w-0.5" style={{ background: "var(--color-mint)" }} />
                  )}
                  <span className="text-[10px] tnum relative z-10 leading-[19px]" style={{ color: "var(--color-green)" }}>{b.price.toFixed(dp)}</span>
                  <span className="text-[10px] tnum relative z-10 text-right leading-[19px]" style={{ color: "var(--color-muted)" }}>{b.size.toFixed(3)}</span>
                  <span className="text-[10px] tnum relative z-10 text-right leading-[19px]" style={{ color: "var(--color-faint)" }}>{b.total.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Imbalance bar */}
          <div className="flex items-center gap-2 px-2 py-1 flex-shrink-0" style={{ borderTop: "1px solid var(--color-line)" }}>
            <span className="text-[8px] font-bold uppercase tracking-widest flex-shrink-0" style={{ color: "var(--color-faint)" }}>Imb.</span>
            <div className="flex-1 h-1.5 flex overflow-hidden rounded" style={{ background: "var(--color-panel-2)" }}>
              <div style={{ width: `${bidPct}%`, background: "rgba(79,158,255,0.7)" }} />
              <div style={{ width: `${askPct}%`, background: "rgba(239,68,68,0.7)" }} />
            </div>
            <span className="text-[9px] tnum font-semibold flex-shrink-0" style={{ color: bidPct >= askPct ? "var(--color-green)" : "var(--color-red)" }}>
              {Math.max(bidPct, askPct).toFixed(0)}% {bidPct >= askPct ? "BID" : "ASK"}
            </span>
          </div>
        </>
      ) : (
        <>
          <div
            className="grid px-2 py-1 flex-shrink-0 text-[9px] font-medium"
            style={{ gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid var(--color-line)", color: "var(--color-faint)" }}
          >
            <span>Price (USD)</span><span className="text-right">Size</span><span className="text-right">Time</span>
          </div>
          <TradeFlowStrip trades={tradeList} />
          <div className="flex-1 overflow-hidden flex flex-col">
            {tradeList.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <span className="text-[9px]" style={{ color: "var(--color-faint)" }}>Waiting for trades…</span>
              </div>
            ) : (
              tradeList.slice(0, 30).map((t) => (
                <div
                  key={t.tradeSequenceNumber}
                  className="grid px-2"
                  style={{ gridTemplateColumns: "1fr 1fr 1fr", height: 19 }}
                >
                  <span className="text-[10px] tnum leading-[19px] font-medium" style={{ color: t.side === "b" ? "var(--color-green)" : "var(--color-red)" }}>
                    {t.price.toFixed(dp)}
                  </span>
                  <span className="text-[10px] tnum text-right leading-[19px]" style={{ color: "var(--color-muted)" }}>{t.size.toFixed(3)}</span>
                  <span className="text-[10px] tnum text-right leading-[19px]" style={{ color: "var(--color-faint)" }}>
                    {new Date(t.time).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Order form (right panel)
───────────────────────────────────────────────────────────────── */

function RightPanel({
  direction, setDirection, orderType, setOrderType,
  sizeUSD, setSizeUSD, leverage, setLeverage,
  currentPrice, oraclePrice, onSubmit, submitting, connected, market, openDeposit,
}: {
  direction: Direction; setDirection: (d: Direction) => void;
  orderType: OrderType; setOrderType: (t: OrderType) => void;
  sizeUSD: string; setSizeUSD: (v: string) => void;
  leverage: number; setLeverage: (v: number) => void;
  currentPrice?: number; oraclePrice?: number;
  onSubmit: () => void; submitting: boolean; connected: boolean;
  market: string; openDeposit: () => void;
}) {
  const [tpslEnabled, setTpslEnabled]   = useState(false);
  const [reduceOnly, setReduceOnly]     = useState(false);
  const [tpPrice, setTpPrice]           = useState("");
  const [slPrice, setSlPrice]           = useState("");
  const [limitPrice, setLimitPrice]     = useState("");
  const [focusPct, setFocusPct]         = useState<number | null>(null);

  const notional  = (parseFloat(sizeUSD) || 0) * leverage;
  const fee       = notional * 0.0004;
  const liqDist   = currentPrice ? (currentPrice / leverage) * 0.88 : 0;
  const liqPrice  = currentPrice
    ? direction === "long" ? currentPrice - liqDist : currentPrice + liqDist
    : 0;

  const MARGIN_AVAIL = 20_000;

  const pctButtons = [10, 25, 50, 75, 100];

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ borderLeft: "1px solid var(--color-line)" }}>

      {/* Long / Short tabs */}
      <div className="grid grid-cols-2 flex-shrink-0" style={{ borderBottom: "1px solid var(--color-line)" }}>
        {(["long", "short"] as Direction[]).map((d) => (
          <button
            key={d}
            onClick={() => setDirection(d)}
            className="py-2.5 text-xs font-bold capitalize transition-all"
            style={{
              background: direction === d
                ? d === "long" ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)"
                : "transparent",
              color: direction === d
                ? d === "long" ? "var(--color-green)" : "var(--color-red)"
                : "var(--color-faint)",
              borderBottom: direction === d
                ? `2px solid ${d === "long" ? "var(--color-green)" : "var(--color-red)"}`
                : "2px solid transparent",
            }}
          >
            {d === "long" ? "▲ Long" : "▼ Short"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "none" }}>
        <div className="p-3 space-y-3">

          {/* Order type */}
          <div className="flex rounded overflow-hidden" style={{ border: "1px solid var(--color-line)" }}>
            {(["Market", "Limit", "TP/SL"] as OrderType[]).map((t) => (
              <button
                key={t}
                onClick={() => setOrderType(t)}
                className="flex-1 py-1.5 text-[10px] font-semibold transition-colors"
                style={{
                  background: orderType === t ? "var(--color-panel-2)" : "transparent",
                  color: orderType === t ? "var(--color-ink)" : "var(--color-faint)",
                }}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Limit price (only for Limit orders) */}
          {orderType === "Limit" && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-medium" style={{ color: "var(--color-faint)" }}>Limit Price</label>
                <span className="text-[10px]" style={{ color: "var(--color-faint)" }}>USD</span>
              </div>
              <div className="flex items-center rounded overflow-hidden" style={{ border: "1px solid var(--color-line)", background: "var(--color-panel-2)" }}>
                <input
                  type="number"
                  value={limitPrice}
                  onChange={(e) => setLimitPrice(e.target.value)}
                  placeholder={currentPrice?.toFixed(2) ?? "0.00"}
                  className="flex-1 px-2 py-1.5 text-xs outline-none tnum bg-transparent"
                  style={{ color: "var(--color-ink)" }}
                />
                <span className="px-2 text-[10px]" style={{ color: "var(--color-faint)", borderLeft: "1px solid var(--color-line)" }}>USD</span>
              </div>
            </div>
          )}

          {/* Amount */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-medium" style={{ color: "var(--color-faint)" }}>Amount</label>
              <span className="text-[10px]" style={{ color: "var(--color-faint)" }}>USDC</span>
            </div>
            <div className="flex items-center rounded overflow-hidden" style={{ border: "1px solid var(--color-line)", background: "var(--color-panel-2)" }}>
              <span className="pl-2 text-[10px]" style={{ color: "var(--color-muted)" }}>$</span>
              <input
                type="number"
                value={sizeUSD}
                onChange={(e) => { setSizeUSD(e.target.value); setFocusPct(null); }}
                placeholder="0.00"
                className="flex-1 px-2 py-2 text-xs outline-none tnum bg-transparent"
                style={{ color: "var(--color-ink)" }}
              />
            </div>
            <div className="flex gap-1 mt-1.5">
              {pctButtons.map((p) => (
                <button
                  key={p}
                  onClick={() => { setSizeUSD((MARGIN_AVAIL * p / 100).toFixed(0)); setFocusPct(p); }}
                  className="flex-1 py-1 text-[9px] font-bold rounded transition-colors"
                  style={{
                    background: focusPct === p ? "var(--color-mint-dim)" : "var(--color-panel-2)",
                    color: focusPct === p ? "var(--color-mint)" : "var(--color-faint)",
                    border: `1px solid ${focusPct === p ? "rgba(79,158,255,0.3)" : "var(--color-line)"}`,
                  }}
                >
                  {p === 100 ? "Max" : `${p}%`}
                </button>
              ))}
            </div>
          </div>

          {/* Leverage */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[10px] font-medium" style={{ color: "var(--color-faint)" }}>Leverage</label>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setLeverage(Math.max(1, leverage - 1))}
                  className="w-5 h-5 rounded flex items-center justify-center transition-colors hover:bg-[var(--color-panel-2)]"
                  style={{ border: "1px solid var(--color-line)", color: "var(--color-muted)" }}
                >
                  <Minus size={8} />
                </button>
                <span className="text-xs font-bold tnum w-10 text-center" style={{ color: "var(--color-mint)" }}>{leverage}x</span>
                <button
                  onClick={() => setLeverage(Math.min(50, leverage + 1))}
                  className="w-5 h-5 rounded flex items-center justify-center transition-colors hover:bg-[var(--color-panel-2)]"
                  style={{ border: "1px solid var(--color-line)", color: "var(--color-muted)" }}
                >
                  <Plus size={8} />
                </button>
              </div>
            </div>
            <input
              type="range" min={1} max={50} value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value))}
              className="w-full h-1 rounded-full"
              style={{ accentColor: "var(--color-mint)" }}
            />
            <div className="flex justify-between text-[9px] mt-1" style={{ color: "var(--color-faint)" }}>
              {[1, 5, 10, 20, 50].map((v) => (
                <button
                  key={v}
                  onClick={() => setLeverage(v)}
                  className="hover:text-[var(--color-muted)] transition-colors"
                  style={{ color: leverage === v ? "var(--color-mint)" : undefined }}
                >
                  {v}x
                </button>
              ))}
            </div>
          </div>

          {/* TP / SL toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <label className="text-[10px] font-semibold" style={{ color: "var(--color-faint)" }}>TP / SL</label>
              <span className="text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(79,158,255,0.08)", color: "var(--color-mint)", border: "1px solid rgba(79,158,255,0.18)" }}>Optional</span>
            </div>
            <button
              onClick={() => setTpslEnabled(!tpslEnabled)}
              className="w-9 h-5 rounded-full relative transition-colors"
              style={{ background: tpslEnabled ? "var(--color-mint)" : "var(--color-line)" }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                style={{ left: tpslEnabled ? "calc(100% - 18px)" : "2px" }}
              />
            </button>
          </div>
          {tpslEnabled && (
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-[9px] mb-1 block" style={{ color: "var(--color-green)" }}>Take Profit</label>
                <input
                  type="number" value={tpPrice} onChange={(e) => setTpPrice(e.target.value)}
                  placeholder="Price"
                  className="w-full rounded px-2 py-1.5 text-[10px] outline-none tnum"
                  style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.22)", color: "var(--color-ink)" }}
                />
              </div>
              <div className="flex-1">
                <label className="text-[9px] mb-1 block" style={{ color: "var(--color-red)" }}>Stop Loss</label>
                <input
                  type="number" value={slPrice} onChange={(e) => setSlPrice(e.target.value)}
                  placeholder="Price"
                  className="w-full rounded px-2 py-1.5 text-[10px] outline-none tnum"
                  style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.22)", color: "var(--color-ink)" }}
                />
              </div>
            </div>
          )}

          {/* Reduce only */}
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium" style={{ color: "var(--color-faint)" }}>Reduce Only</label>
            <button
              onClick={() => setReduceOnly(!reduceOnly)}
              className="w-9 h-5 rounded-full relative transition-colors"
              style={{ background: reduceOnly ? "var(--color-mint)" : "var(--color-line)" }}
            >
              <div
                className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all"
                style={{ left: reduceOnly ? "calc(100% - 18px)" : "2px" }}
              />
            </button>
          </div>

          {/* Order summary */}
          <div className="rounded-lg p-2.5 space-y-1.5" style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)" }}>
            {[
              ["Entry",       currentPrice ? currentPrice.toFixed(2) : "Market"],
              ["Liq. Price",  liqPrice > 0 ? liqPrice.toFixed(2) : "—"],
              ["Notional",    notional > 0 ? formatUSD(notional) : "—"],
              ["Fees (est.)", fee > 0 ? formatUSD(fee) : "—"],
            ].map(([k, v]) => (
              <div key={k as string} className="flex items-center justify-between">
                <span className="text-[10px]" style={{ color: "var(--color-faint)" }}>{k}</span>
                <span className="text-[10px] tnum font-semibold" style={{ color: "var(--color-ink)" }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Submit */}
          <button
            onClick={onSubmit}
            disabled={!connected || submitting || !sizeUSD || parseFloat(sizeUSD) <= 0}
            className="w-full py-3 rounded-lg text-sm font-black tracking-wide transition-all disabled:opacity-40"
            style={{
              background: direction === "long"
                ? "linear-gradient(135deg, #16a34a, #22c55e)"
                : "linear-gradient(135deg, #b91c1c, #ef4444)",
              color: "#fff",
              boxShadow: direction === "long"
                ? "0 4px 14px rgba(34,197,94,0.25)"
                : "0 4px 14px rgba(239,68,68,0.25)",
            }}
          >
            <TextSwap>
              {!connected
                ? "Connect Wallet"
                : submitting
                ? "Placing order…"
                : `${direction === "long" ? "▲ Long" : "▼ Short"} ${market.replace("-PERP", "")}`}
            </TextSwap>
          </button>
        </div>
      </div>

      {/* Account summary */}
      <div className="flex-shrink-0 px-3 pb-3 pt-2" style={{ borderTop: "1px solid var(--color-line)" }}>
        <p className="text-[9px] font-black uppercase tracking-widest mb-2" style={{ color: "var(--color-faint)" }}>Account</p>
        <div className="space-y-1">
          {[
            ["Available", "$20,000.00",  "var(--color-ink)"],
            ["Margin Used", "$0.00",     "var(--color-ink)"],
            ["Margin Ratio", "—",        "var(--color-ink)"],
            ["Unrealized PnL", "+$0.00", "var(--color-green)"],
          ].map(([k, v, c]) => (
            <div key={k as string} className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: "var(--color-faint)" }}>{k}</span>
              <span className="text-[10px] font-semibold tnum" style={{ color: c as string }}>{v}</span>
            </div>
          ))}
        </div>
        <button
          onClick={openDeposit}
          className="w-full mt-2 py-1.5 rounded text-[10px] font-bold text-center transition-all flex items-center justify-center gap-1"
          style={{
            border: "1px solid rgba(79,158,255,0.3)",
            color: "var(--color-mint)",
            background: "rgba(79,158,255,0.06)",
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(79,158,255,0.12)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(79,158,255,0.06)"; }}
        >
          <Zap size={10} />Deposit USDC
        </button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Bottom ticker bar
───────────────────────────────────────────────────────────────── */

const EXTRA_TICKERS = [
  { sym: "HYPE", price: 28.41,       chg: -0.84 },
  { sym: "MNT",  price: 0.56,        chg: +5.21 },
  { sym: "LINK", price: 13.19,       chg: +2.44 },
  { sym: "TRON", price: 0.28,        chg: -1.33 },
  { sym: "OP",   price: 1.72,        chg: +3.87 },
  { sym: "AVAX", price: 22.14,       chg: -2.10 },
  { sym: "INJ",  price: 14.88,       chg: +7.32 },
  { sym: "WIF",  price: 1.05,        chg: -4.56 },
  { sym: "PEPE", price: 0.0000121,   chg: +12.3 },
  { sym: "JUP",  price: 0.58,        chg: +1.98 },
  { sym: "BONK", price: 0.000021,    chg: -3.44 },
  { sym: "W",    price: 0.31,        chg: +8.11 },
];

type TickerTab = "top" | "gainers" | "losers";

function TickerBar({ marketStats }: { marketStats: Record<string, { markPx: number; prevDayPx: number }> }) {
  const [tab, setTab] = useState<TickerTab>("top");
  const apiItems = Object.entries(marketStats).map(([sym, s]) => {
    const chg = s.prevDayPx ? ((s.markPx - s.prevDayPx) / s.prevDayPx) * 100 : 0;
    return { sym, price: s.markPx, chg };
  });
  const all = [...apiItems, ...EXTRA_TICKERS];
  const displayed =
    tab === "gainers" ? [...all].sort((a, b) => b.chg - a.chg).slice(0, 10) :
    tab === "losers"  ? [...all].sort((a, b) => a.chg - b.chg).slice(0, 10) : all;
  const marquee = [...displayed, ...displayed];

  return (
    <div
      className="flex-shrink-0 flex items-center overflow-hidden"
      style={{ height: 26, borderTop: "1px solid var(--color-line)", background: "var(--color-panel)" }}
    >
      <div className="flex items-center flex-shrink-0 h-full" style={{ borderRight: "1px solid var(--color-line)" }}>
        {([["top","Top"],["gainers","▲ Gainers"],["losers","▼ Losers"]] as [TickerTab,string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-2.5 h-full text-[9px] font-bold transition-colors whitespace-nowrap"
            style={{
              color: tab === t ? "var(--color-ink)" : "var(--color-faint)",
              background: tab === t ? "var(--color-panel-2)" : "transparent",
              borderRight: "1px solid var(--color-line)",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden relative h-full flex items-center">
        <div
          className="flex items-center whitespace-nowrap"
          style={{ animation: "ticker-scroll 50s linear infinite", willChange: "transform" }}
        >
          {marquee.map((item, i) => {
            const pos = item.chg >= 0;
            const fmt = item.price < 0.0001 ? item.price.toFixed(7) : item.price < 1 ? item.price.toFixed(4) : item.price < 100 ? item.price.toFixed(3) : item.price.toFixed(2);
            return (
              <span key={i} className="inline-flex items-center gap-1.5 px-3.5 h-full text-[10px]" style={{ borderRight: "1px solid var(--color-line)" }}>
                <span className="font-bold" style={{ color: "var(--color-ink)" }}>{item.sym}</span>
                <span className="tnum" style={{ color: "var(--color-muted)" }}>{fmt}</span>
                <span className="tnum font-semibold" style={{ color: pos ? "var(--color-green)" : "var(--color-red)" }}>
                  {pos ? "+" : ""}{item.chg.toFixed(2)}%
                </span>
              </span>
            );
          })}
        </div>
        <div className="absolute left-0 top-0 bottom-0 w-8 pointer-events-none" style={{ background: "linear-gradient(to right, var(--color-panel), transparent)" }} />
        <div className="absolute right-0 top-0 bottom-0 w-8 pointer-events-none" style={{ background: "linear-gradient(to left, var(--color-panel), transparent)" }} />
      </div>

      <div className="flex items-center gap-2 px-3 h-full flex-shrink-0" style={{ borderLeft: "1px solid var(--color-line)" }}>
        <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: "var(--color-green)" }} />
        <span className="text-[9px] font-bold" style={{ color: "var(--color-green)" }}>Phoenix LIVE</span>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Main page
───────────────────────────────────────────────────────────────── */

const MARKETS  = ["BTC-PERP", "SOL-PERP", "ETH-PERP", "ARB-PERP"];
const INTERVALS = ["1m", "5m", "15m", "1H", "4H", "1D"];
const CHART_TOOLS = [Crosshair, BarChart2, TrendingUp, Circle, Square, Triangle, BookOpen];

function TerminalContent() {
  const { connected } = useWallet();
  const searchParams = useSearchParams();
  const phoenix = usePhoenix();

  const [market,     setMarket]     = useState("SOL-PERP");
  const [direction,  setDirection]  = useState<Direction>("long");
  const [orderType,  setOrderType]  = useState<OrderType>("Market");
  const [sizeUSD,    setSizeUSD]    = useState("1000");
  const [leverage,   setLeverage]   = useState(5);
  const [positions,  setPositions]  = useState<OpenPosition[]>([]);
  const [closingId,  setClosingId]  = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bottomTab,  setBottomTab]  = useState<BottomTab>("positions");
  const [interval,      setInterval_]     = useState("15m");
  const [marketOpen,    setMarketOpen]    = useState(false);
  const [indicator,     setIndicator]     = useState(false);
  const [depositOpen,   setDepositOpen]   = useState(false);
  const [depositClose,  setDepositClose]  = useState(false);
  const [depositAmt,    setDepositAmt]    = useState("1000");
  const [depositPhase,  setDepositPhase]  = useState<"idle"|"pending"|"done">("idle");
  const depositRef = useRef<HTMLDivElement>(null);

  const symbol = market.replace("-PERP", "");
  const marketStats = phoenix.marketStats[symbol];
  const fundingRate = phoenix.fundingRate[symbol];
  const currentPrice = marketStats?.markPx;
  const oraclePrice = marketStats?.oraclePx;
  const prevDayPx = marketStats?.prevDayPx;
  const changePct = currentPrice && prevDayPx ? ((currentPrice - prevDayPx) / prevDayPx) * 100 : 0;
  const dayNtlVlm = marketStats?.dayNtlVlm ?? 0;
  const openInterest = marketStats?.openInterest ?? 0;

  const phoenixInterval = interval.toLowerCase();
  useEffect(() => {
    phoenix.seedCandles(symbol, phoenixInterval);
    phoenix.fetchMarketConfig(symbol);
  }, [symbol, phoenixInterval, phoenix]);

  const phoenixCandles = phoenix.candles[symbol] ?? [];

  /* auto-open deposit drawer when ?deposit=1 is in the URL */
  useEffect(() => {
    if (searchParams.get("deposit") === "1") openDeposit();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* close deposit dropdown on outside click */
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (depositRef.current && !depositRef.current.contains(e.target as Node)) {
        closeDeposit();
      }
    }
    if (depositOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [depositOpen]);

  function openDeposit() {
    setDepositClose(false);
    setDepositPhase("idle");
    setDepositOpen(true);
  }
  function closeDeposit() {
    setDepositClose(true);
    setTimeout(() => { setDepositOpen(false); setDepositClose(false); }, 150);
  }
  function confirmDeposit() {
    setDepositPhase("pending");
    setTimeout(() => setDepositPhase("done"), 1400);
  }

  const coinName = market.replace("-PERP", "");
  const isBtc = market === "BTC-PERP";
  const dp = isBtc ? 1 : 3;

  useEffect(() => {
    const t = setInterval(() => {
      setPositions((prev) =>
        prev.map((pos) => {
          const stats = phoenix.marketStats[pos.market.replace("-PERP", "")];
          const px = stats?.markPx ?? pos.entry_px;
          const upnl = pos.direction === "long"
            ? pos.size_usd * pos.leverage * (px - pos.entry_px) / pos.entry_px
            : pos.size_usd * pos.leverage * (pos.entry_px - px) / pos.entry_px;
          return { ...pos, upnl };
        })
      );
    }, 2000);
    return () => clearInterval(t);
  }, [phoenix.marketStats]);

  const openPosition = useCallback(() => {
    if (!connected || !currentPrice) return;
    setSubmitting(true);
    setTimeout(() => {
      setPositions((prev) => [{
        id: Math.random().toString(36).slice(2, 10),
        market,
        direction,
        size_usd: parseFloat(sizeUSD) || 1000,
        leverage,
        entry_px: currentPrice,
        opened_at: Math.floor(Date.now() / 1000),
        upnl: 0,
      }, ...prev]);
      setSubmitting(false);
    }, 700);
  }, [connected, currentPrice, market, direction, sizeUSD, leverage]);

  const closePosition = (id: string) => {
    setClosingId(id);
    setTimeout(() => { setPositions((p) => p.filter((x) => x.id !== id)); setClosingId(null); }, 1000);
  };

  function fmtCompact(n: number): string {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(0)}`;
  }

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: "calc(100vh - 48px)", background: "var(--color-bg)" }}
    >

      {/* ── Market header bar ─────────────────────────────────────── */}
      <div
        className="flex items-center flex-shrink-0 overflow-x-auto h-11"
        style={{ borderBottom: "1px solid var(--color-line)", background: "var(--color-panel)" }}
      >

        {/* Market selector */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMarketOpen(!marketOpen)}
            className="flex items-center gap-2 h-11 px-3 font-bold text-sm"
            style={{ color: "var(--color-ink)", borderRight: "1px solid var(--color-line)" }}
          >
            <span
              className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
              style={{ background: "var(--color-mint)", color: "#ffffff" }}
            >
              {coinName.slice(0, 1)}
            </span>
            <span>{coinName}/USD</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded ml-1" style={{ background: "rgba(79,158,255,0.10)", color: "var(--color-mint)", border: "1px solid rgba(79,158,255,0.2)" }}>PERP</span>
            <ChevronDown size={12} style={{ color: "var(--color-faint)" }} />
          </button>
          {marketOpen && (
            <div
              className="absolute top-full left-0 z-50 rounded-lg py-1 shadow-2xl"
              style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)", minWidth: 160 }}
            >
              {MARKETS.map((m) => (
                <button
                  key={m}
                  onClick={() => { setMarket(m); setMarketOpen(false); }}
                  className="w-full flex items-center gap-2.5 text-left px-3 py-2 text-xs transition-colors hover:bg-[var(--color-panel)]"
                  style={{ color: m === market ? "var(--color-mint)" : "var(--color-muted)" }}
                >
                  <span
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black flex-shrink-0"
                    style={{ background: m === market ? "var(--color-mint)" : "var(--color-panel-2)", color: m === market ? "#ffffff" : "var(--color-muted)", border: "1px solid var(--color-line)" }}
                  >
                    {m.slice(0, 1)}
                  </span>
                  {m.replace("-PERP", "")}/USD
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Price */}
        {currentPrice && (
          <div className="flex items-center gap-2.5 px-4 flex-shrink-0" style={{ borderRight: "1px solid var(--color-line)" }}>
            <span
              className="text-[17px] font-black tnum"
              style={{ color: changePct >= 0 ? "var(--color-green)" : "var(--color-red)" }}
            >
              {isBtc ? currentPrice.toFixed(0) : currentPrice.toFixed(dp)}
            </span>
            <div className="flex items-center gap-0.5">
              {changePct >= 0
                ? <TrendingUp size={10} style={{ color: "var(--color-green)" }} />
                : <TrendingDown size={10} style={{ color: "var(--color-red)" }} />
              }
              <span
                className="text-[11px] font-bold tnum"
                style={{ color: changePct >= 0 ? "var(--color-green)" : "var(--color-red)" }}
              >
                {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
              </span>
            </div>
          </div>
        )}

        {/* Market stats */}
        {[
          { label: "Oracle Price",   value: oraclePrice ? oraclePrice.toFixed(dp) : "—" },
          { label: "24h Volume",     value: dayNtlVlm > 0 ? fmtCompact(dayNtlVlm) : "—" },
          { label: "Open Interest",  value: openInterest > 0 ? fmtCompact(openInterest) : "—" },
          { label: "Spread (M/O)",   value: currentPrice && oraclePrice ? `${((currentPrice - oraclePrice) / oraclePrice * 10000).toFixed(2)} bps` : "—", color: currentPrice && oraclePrice ? (Math.abs((currentPrice - oraclePrice) / oraclePrice * 10000) > 5 ? "var(--color-gold)" : "var(--color-green)") : undefined },
          { label: "Funding Rate",   value: fundingRate ? `${fundingRate.funding >= 0 ? "+" : ""}${(fundingRate.funding * 100).toFixed(4)}%` : "—", color: fundingRate && fundingRate.funding >= 0 ? "var(--color-green)" : fundingRate && fundingRate.funding < 0 ? "var(--color-red)" : undefined },
          { label: "Connected",      value: phoenix.connected ? "LIVE" : "Reconnecting…", color: phoenix.connected ? "var(--color-green)" : "var(--color-gold)" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex flex-col justify-center px-4 h-full flex-shrink-0" style={{ borderRight: "1px solid var(--color-line)" }}>
            <span className="text-[9px] font-medium" style={{ color: "var(--color-faint)" }}>{label}</span>
            <span className="text-[11px] font-bold tnum" style={{ color: color ?? "var(--color-ink)" }}>{value}</span>
          </div>
        ))}

        <div className="flex-1" />

        {/* Right quick actions */}
        <div className="flex items-center gap-1 px-2 h-full flex-shrink-0 relative" style={{ borderLeft: "1px solid var(--color-line)" }} ref={depositRef}>
          <button
            onClick={() => depositOpen ? closeDeposit() : openDeposit()}
            className="h-7 px-3 rounded text-[10px] font-black transition-all hover:opacity-90 flex items-center gap-1"
            style={{
              background: depositOpen ? "var(--color-mint-bright)" : "var(--color-mint)",
              color: "#ffffff",
              boxShadow: depositOpen ? "0 0 0 2px rgba(79,158,255,0.25)" : "none",
            }}
          >
            <Zap size={11} />Deposit
          </button>

          {/* ── Deposit dropdown panel ── */}
          <div
            className={`t-dropdown${depositOpen ? " is-open" : ""}${depositClose ? " is-closing" : ""}`}
            data-origin="top-right"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              width: 280,
              background: "var(--color-panel)",
              border: "1px solid var(--color-line)",
              borderRadius: 12,
              boxShadow: "0 16px 48px rgba(0,0,0,0.6), 0 0 0 1px rgba(79,158,255,0.08)",
              zIndex: 100,
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: "1px solid var(--color-line)" }}>
              <div className="flex items-center gap-2">
                <Zap size={12} style={{ color: "var(--color-mint)" }} />
                <span className="text-xs font-bold" style={{ color: "var(--color-ink)" }}>Deposit USDC</span>
              </div>
              <button onClick={closeDeposit} className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--color-panel-2)] transition-colors">
                <X size={11} style={{ color: "var(--color-faint)" }} />
              </button>
            </div>

            <div className="px-4 py-4 space-y-4">
              {depositPhase === "done" ? (
                /* Success state */
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.3)" }}>
                    <span className="text-lg">✓</span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold" style={{ color: "var(--color-green)" }}>Deposit confirmed</p>
                    <p className="text-[10px] mt-0.5" style={{ color: "var(--color-faint)" }}>
                      +${Number(depositAmt).toLocaleString()} USDC · Devnet simulation
                    </p>
                  </div>
                  <button
                    onClick={() => { setDepositPhase("idle"); closeDeposit(); }}
                    className="text-[10px] font-semibold px-3 py-1 rounded transition-colors"
                    style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)", color: "var(--color-muted)" }}
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  {/* Amount input */}
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-widest mb-1.5 block" style={{ color: "var(--color-faint)" }}>Amount</label>
                    <div className="relative">
                      <input
                        type="number"
                        value={depositAmt}
                        onChange={(e) => setDepositAmt(e.target.value)}
                        className="w-full rounded-lg px-3 pr-14 py-2.5 text-sm font-bold outline-none"
                        style={{
                          background: "var(--color-panel-2)",
                          border: "1px solid var(--color-line)",
                          color: "var(--color-ink)",
                        }}
                        onFocus={(e) => { e.target.style.borderColor = "rgba(79,158,255,0.4)"; e.target.style.boxShadow = "0 0 0 3px rgba(79,158,255,0.08)"; }}
                        onBlur={(e)  => { e.target.style.borderColor = "var(--color-line)"; e.target.style.boxShadow = "none"; }}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: "rgba(79,158,255,0.12)", color: "var(--color-mint)" }}>
                        USDC
                      </span>
                    </div>
                  </div>

                  {/* Quick presets */}
                  <div className="flex gap-1.5">
                    {["100","500","1000","5000"].map((p) => (
                      <button
                        key={p}
                        onClick={() => setDepositAmt(p)}
                        className="flex-1 py-1 rounded text-[10px] font-bold transition-all"
                        style={{
                          background: depositAmt === p ? "rgba(79,158,255,0.12)" : "var(--color-panel-2)",
                          border: `1px solid ${depositAmt === p ? "rgba(79,158,255,0.3)" : "var(--color-line)"}`,
                          color: depositAmt === p ? "var(--color-mint)" : "var(--color-faint)",
                        }}
                      >
                        {Number(p) >= 1000 ? `$${Number(p)/1000}K` : `$${p}`}
                      </button>
                    ))}
                  </div>

                  {/* Balance row */}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]" style={{ color: "var(--color-faint)" }}>Wallet balance</span>
                    <span className="text-[10px] font-bold tnum" style={{ color: "var(--color-ink)" }}>$20,000.00 USDC</span>
                  </div>

                  {/* Devnet note */}
                  <div className="flex items-start gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(79,158,255,0.06)", border: "1px solid rgba(79,158,255,0.15)" }}>
                    <Zap size={11} className="flex-shrink-0 mt-0.5" style={{ color: "var(--color-mint)" }} />
                    <p className="text-[10px] leading-relaxed" style={{ color: "var(--color-muted)" }}>
                      Devnet simulation — no real funds transferred.
                    </p>
                  </div>

                  {/* Confirm button */}
                  <button
                    onClick={confirmDeposit}
                    disabled={depositPhase === "pending" || !depositAmt || Number(depositAmt) <= 0}
                    className="w-full py-2.5 rounded-lg text-xs font-black tracking-wide transition-all"
                    style={{
                      background: depositPhase === "pending" ? "rgba(79,158,255,0.4)" : "var(--color-mint)",
                      color: "#ffffff",
                      opacity: !depositAmt || Number(depositAmt) <= 0 ? 0.5 : 1,
                    }}
                  >
                    <TextSwap>
                      {depositPhase === "pending" ? "Confirming…" : `Deposit $${Number(depositAmt).toLocaleString()} USDC`}
                    </TextSwap>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Chart toolbar ─────────────────────────────────────────── */}
      <div
        className="flex items-center h-8 flex-shrink-0 px-1 gap-1 overflow-x-auto"
        style={{ borderBottom: "1px solid var(--color-line)", background: "var(--color-panel)" }}
      >
        {INTERVALS.map((iv) => (
          <button
            key={iv}
            onClick={() => setInterval_(iv)}
            className="px-2 h-6 text-[10px] font-bold rounded transition-colors"
            style={{
              background: interval === iv ? "var(--color-panel-2)" : "transparent",
              color: interval === iv ? "var(--color-ink)" : "var(--color-faint)",
              border: interval === iv ? "1px solid var(--color-line)" : "1px solid transparent",
            }}
          >
            {iv}
          </button>
        ))}
        <div className="w-px h-4 mx-1 flex-shrink-0" style={{ background: "var(--color-line)" }} />
        <button
          onClick={() => setIndicator(!indicator)}
          className="h-6 px-2.5 rounded text-[10px] font-semibold flex items-center gap-1.5 transition-colors"
          style={{
            background: indicator ? "var(--color-mint-dim)" : "transparent",
            color: indicator ? "var(--color-mint)" : "var(--color-faint)",
            border: indicator ? "1px solid rgba(79,158,255,0.25)" : "1px solid transparent",
          }}
        >
          <Activity size={10} />Indicators
        </button>
        <div className="flex-1" />
        <button className="w-7 h-6 rounded flex items-center justify-center hover:bg-[var(--color-panel-2)]">
          <Maximize2 size={11} style={{ color: "var(--color-faint)" }} />
        </button>
      </div>

      {/* ── Main row ──────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* Drawing tools sidebar */}
        <div
          className="w-9 flex-shrink-0 flex flex-col items-center py-2 gap-0.5"
          style={{ borderRight: "1px solid var(--color-line)", background: "var(--color-panel)" }}
        >
          {CHART_TOOLS.map((Icon, i) => (
            <button
              key={i}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--color-panel-2)] transition-colors"
            >
              <Icon size={12} style={{ color: "var(--color-faint)" }} strokeWidth={1.5} />
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="flex-1 min-w-0 overflow-hidden relative">
          <TvChart
            market={market}
            currentPrice={currentPrice}
            fullHeight
            externalCandles={phoenixCandles}
            positions={positions
              .filter((p) => p.market === market)
              .map((p) => ({ id: p.id, direction: p.direction, entry_px: p.entry_px, size_usd: p.size_usd, leverage: p.leverage }))}
          />
          {/* Chart watermark */}
          <div
            className="absolute top-3 left-3 pointer-events-none select-none"
            style={{ opacity: 0.18 }}
          >
            <p className="text-sm font-black" style={{ color: "var(--color-ink)" }}>{coinName}/USD · Perpetual</p>
          </div>
        </div>

        {/* Order book / Trades */}
        <div className="w-52 flex-shrink-0 overflow-hidden">
          <OrderBookPanel symbol={symbol} market={market} />
        </div>

        {/* Order form */}
        <div className="w-64 flex-shrink-0 overflow-hidden">
          <RightPanel
            direction={direction} setDirection={setDirection}
            orderType={orderType} setOrderType={setOrderType}
            sizeUSD={sizeUSD} setSizeUSD={setSizeUSD}
            leverage={leverage} setLeverage={setLeverage}
            currentPrice={currentPrice}
            oraclePrice={oraclePrice}
            onSubmit={openPosition}
            submitting={submitting}
            connected={connected}
            market={market}
            openDeposit={openDeposit}
          />
        </div>
      </div>

      {/* ── Bottom panel (positions / orders / history) ─────────── */}
      <div
        className="flex-shrink-0 flex flex-col"
        style={{ height: 190, borderTop: "1px solid var(--color-line)", background: "var(--color-panel)" }}
      >
        {/* Tab bar */}
        <div className="flex items-center flex-shrink-0 h-8" style={{ borderBottom: "1px solid var(--color-line)" }}>
          {([
            ["positions", `Positions (${positions.length})`],
            ["orders",    "Open Orders (0)"],
            ["history",   "Trade History"],
            ["funding",   "Funding History"],
          ] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setBottomTab(t)}
              className="h-full px-4 text-[11px] font-semibold transition-colors whitespace-nowrap"
              style={{
                color: bottomTab === t ? "var(--color-ink)" : "var(--color-faint)",
                borderBottom: bottomTab === t ? "2px solid var(--color-mint)" : "2px solid transparent",
              }}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 pr-3">
            <span
              className="text-[9px] px-2 py-0.5 rounded font-bold"
              style={{ background: "rgba(79,158,255,0.10)", color: "var(--color-mint)", border: "1px solid rgba(79,158,255,0.2)" }}
            >
              Paper trading
            </span>
            {positions.length > 0 && bottomTab === "positions" && (
              <button
                onClick={() => setPositions([])}
                className="text-[10px] px-2 py-0.5 rounded font-semibold transition-colors hover:opacity-80"
                style={{ border: "1px solid var(--color-line)", color: "var(--color-red)" }}
              >
                Close All
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {bottomTab === "positions" && (
            positions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full gap-1.5">
                <Activity size={18} style={{ color: "var(--color-faint)", opacity: 0.5 }} />
                <p className="text-xs" style={{ color: "var(--color-faint)" }}>No open positions</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0" style={{ background: "var(--color-panel)" }}>
                  <tr style={{ borderBottom: "1px solid var(--color-line)" }}>
                    {["Market", "Side", "Size", "Lev.", "Entry", "Mark", "Liq.", "uPnL", ""].map((h) => (
                      <th key={h} className="py-1.5 px-3 text-left font-medium text-[10px]" style={{ color: "var(--color-faint)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => {
                    const posPhoenix = phoenix.marketStats[pos.market.replace("-PERP", "")];
                    const markPx = posPhoenix?.markPx;
                    const posLiq = pos.entry_px - (pos.entry_px / pos.leverage) * 0.88 * (pos.direction === "long" ? 1 : -1);
                    return (
                      <tr key={pos.id} className="hover:bg-[var(--color-panel-2)] transition-colors" style={{ borderBottom: "1px solid var(--color-line)" }}>
                        <td className="py-2 px-3 font-semibold" style={{ color: "var(--color-ink)" }}>{pos.market}</td>
                        <td className="py-2 px-3">
                          <span
                            className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase"
                            style={{
                              background: pos.direction === "long" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                              color: pos.direction === "long" ? "var(--color-green)" : "var(--color-red)",
                            }}
                          >{pos.direction}</span>
                        </td>
                        <td className="py-2 px-3 tnum" style={{ color: "var(--color-muted)" }}>{formatUSD(pos.size_usd, 0)}</td>
                        <td className="py-2 px-3 tnum font-semibold" style={{ color: "var(--color-mint)" }}>{pos.leverage}x</td>
                        <td className="py-2 px-3 tnum" style={{ color: "var(--color-muted)" }}>{pos.entry_px.toFixed(dp)}</td>
                        <td className="py-2 px-3 tnum" style={{ color: "var(--color-ink)" }}>{markPx?.toFixed(dp) ?? "—"}</td>
                        <td className="py-2 px-3 tnum text-[10px]" style={{ color: "var(--color-red)" }}>{posLiq.toFixed(dp)}</td>
                        <td className="py-2 px-3 tnum font-semibold" style={{ color: (pos.upnl ?? 0) >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
                          {(pos.upnl ?? 0) >= 0 ? "+" : ""}{formatUSD(pos.upnl ?? 0, 0)}
                        </td>
                        <td className="py-2 px-3">
                          <button
                            onClick={() => closePosition(pos.id)}
                            disabled={closingId === pos.id}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-semibold transition-colors hover:bg-[var(--color-panel)]"
                            style={{ border: "1px solid var(--color-line)", color: closingId === pos.id ? "var(--color-faint)" : "var(--color-red)" }}
                          >
                            <X size={9} />{closingId === pos.id ? "…" : "Close"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
          {bottomTab === "funding" && <FundingTabPanel symbol={symbol} />}
          {(bottomTab === "orders" || bottomTab === "history") && (
            <div className="flex flex-col items-center justify-center h-full gap-1.5">
              <Activity size={18} style={{ color: "var(--color-faint)", opacity: 0.5 }} />
              <p className="text-xs" style={{ color: "var(--color-faint)" }}>No {bottomTab} data</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Live ticker bar ───────────────────────────────────────── */}
      <TickerBar marketStats={phoenix.marketStats} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Funding tab panel
───────────────────────────────────────────────────────────────── */

function FundingTabPanel({ symbol }: { symbol: string }) {
  const { fundingRate } = usePhoenix();
  const fr = fundingRate[symbol];
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!fr) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-1.5">
        <Activity size={18} style={{ color: "var(--color-faint)", opacity: 0.5 }} />
        <p className="text-xs" style={{ color: "var(--color-faint)" }}>No funding data</p>
      </div>
    );
  }

  const nextFunding = fr.fundingTime ?? 0;
  const diff = Math.max(0, nextFunding - now);
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  const countdown = `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  const apr = fr.funding * 24 * 365 * 100;

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between pb-2" style={{ borderBottom: "1px solid var(--color-line)" }}>
        <span className="text-[10px] font-medium" style={{ color: "var(--color-faint)" }}>Current Funding Rate</span>
        <span className="text-xs font-bold tnum" style={{ color: fr.funding >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
          {(fr.funding * 100).toFixed(4)}%
        </span>
      </div>
      <div className="flex items-center justify-between pb-2" style={{ borderBottom: "1px solid var(--color-line)" }}>
        <span className="text-[10px] font-medium" style={{ color: "var(--color-faint)" }}>Est. Annual APR</span>
        <span className="text-xs font-bold tnum" style={{ color: apr >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
          {apr >= 0 ? "+" : ""}{apr.toFixed(2)}%
        </span>
      </div>
      <div className="flex items-center justify-between pb-2" style={{ borderBottom: "1px solid var(--color-line)" }}>
        <span className="text-[10px] font-medium" style={{ color: "var(--color-faint)" }}>Next Funding</span>
        <span className="text-sm font-black tnum" style={{ color: "var(--color-ink)", fontVariantNumeric: "tabular-nums" }}>
          {countdown}
        </span>
      </div>
      <div className="rounded-lg p-2.5" style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)" }}>
        <p className="text-[9px] leading-relaxed" style={{ color: "var(--color-faint)" }}>
          Funding payments are exchanged between long and short positions every hour.
          {fr.funding > 0 ? " Longs pay shorts." : fr.funding < 0 ? " Shorts pay longs." : " No payment due."}
        </p>
      </div>
    </div>
  );
}

export default function TerminalPage() {
  return (
    // PhoenixProvider is route-scoped: the market-data WebSocket only opens
    // while the terminal is mounted, and closes on navigation away.
    <PhoenixProvider>
      <Suspense fallback={<div className="h-screen w-full bg-[var(--color-bg)]" />}>
        <TerminalContent />
      </Suspense>
    </PhoenixProvider>
  );
}
