"use client";

import { useMemo, useState } from "react";
import { BarChart2, Layers } from "lucide-react";

import { usePhoenix } from "@/lib/phoenix-context";
import type { PhoenixTrade } from "@/lib/phoenix-types";
import { formatUSD } from "@/lib/types";

type BookTab = "book" | "trades";

/* Flow sparkline (SVG) — success/danger by sign. */
function FlowSparkline({ flow }: { flow: number[] }) {
  if (!flow.length) return <div className="flex-1" style={{ height: 20 }} />;
  const W = 200;
  const H = 20;
  const min = Math.min(0, ...flow);
  const max = Math.max(0, ...flow);
  const span = Math.max(max - min, 1e-9);
  const x = (i: number) => (flow.length === 1 ? W / 2 : (i / (flow.length - 1)) * W);
  const y = (v: number) => H - 1 - ((v - min) / span) * (H - 2);
  const path = flow
    .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(2)} ${y(v).toFixed(2)}`)
    .join(" ");
  const last = flow[flow.length - 1];
  const stroke = last >= 0 ? "var(--color-success)" : "var(--color-danger)";
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="flex-1"
      style={{ height: 20, minWidth: 60 }}
      preserveAspectRatio="none"
      aria-hidden
    >
      <path d={path} fill="none" stroke={stroke} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TradeFlowStrip({ trades: tradeList }: { trades: PhoenixTrade[] }) {
  const analytics = useMemo(() => {
    let buyNotional = 0;
    let sellNotional = 0;
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
    <div className="flex flex-col gap-2 border-b border-line px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-bold tracking-widest text-faint uppercase">
          Flow · window
        </span>
        <span
          className="text-[10px] font-semibold tabular-nums"
          style={{ color: dominant === "BUY" ? "var(--color-success)" : "var(--color-danger)" }}
        >
          {dominantPct.toFixed(0)}% {dominant}
        </span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded bg-panel-2">
        <div
          style={{
            width: `${analytics.buyPct}%`,
            background: "color-mix(in srgb, var(--color-success) 70%, transparent)",
          }}
        />
        <div
          style={{
            width: `${analytics.sellPct}%`,
            background: "color-mix(in srgb, var(--color-danger) 70%, transparent)",
          }}
        />
      </div>
      <div className="flex items-center gap-2">
        <span className="shrink-0 text-[9px] font-bold tracking-widest text-faint uppercase">
          Net
        </span>
        <FlowSparkline flow={analytics.flow} />
        <span
          className="shrink-0 text-[10px] font-semibold tabular-nums"
          style={{ color: analytics.net >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
        >
          {analytics.net >= 0 ? "+" : ""}
          {formatUSD(analytics.net, 0)}
        </span>
      </div>
    </div>
  );
}

export function TerminalOrderBook({ symbol, market }: { symbol: string; market: string }) {
  const { orderbook, trades: phoenixTrades, marketStats } = usePhoenix();
  const [tab, setTab] = useState<BookTab>("book");

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
  const askSizes = askLevels.slice(-14).map((l) => l.size);
  const bidSizes = bidLevels.slice(0, 14).map((l) => l.size);
  const askMed = askSizes.length
    ? [...askSizes].sort((a, b) => a - b)[Math.floor(askSizes.length / 2)]
    : 0;
  const bidMed = bidSizes.length
    ? [...bidSizes].sort((a, b) => a - b)[Math.floor(bidSizes.length / 2)]
    : 0;

  const asks = askLevels
    .slice(-14)
    .map((a, i, arr) => {
      const total = arr.slice(0, i + 1).reduce((s, x) => s + x.size, 0);
      return { ...a, total, isWall: askMed > 0 && a.size > askMed * WALL_THRESH };
    })
    .reverse();
  const bids = bidLevels.slice(0, 14).map((b, i, arr) => {
    const total = arr.slice(0, i + 1).reduce((s, x) => s + x.size, 0);
    return { ...b, total, isWall: bidMed > 0 && b.size > bidMed * WALL_THRESH };
  });
  const allLevels = [...asks, ...bids];
  const maxTotal = allLevels.length > 0 ? Math.max(...allLevels.map((x) => x.total)) : 1;

  const spread =
    asks.length > 0 && bids.length > 0 ? asks[asks.length - 1].price - bids[0].price : 0;

  const bookMid = book?.mid ?? midPrice;
  const depthWithin = (bps: number, side: "ask" | "bid") => {
    if (bookMid <= 0) return 0;
    const limit = side === "ask" ? bookMid * (1 + bps / 10000) : bookMid * (1 - bps / 10000);
    let total = 0;
    for (const lvl of side === "ask" ? askLevels : bidLevels) {
      if (side === "ask" && lvl.price > limit) break;
      if (side === "bid" && lvl.price < limit) break;
      total += lvl.size;
    }
    return total;
  };
  const depthRows = DEPTH_BPS.map((bps) => ({
    bps,
    ask: depthWithin(bps, "ask"),
    bid: depthWithin(bps, "bid"),
  }));
  const topAskSz = asks.reduce((s, r) => s + r.size, 0);
  const topBidSz = bids.reduce((s, r) => s + r.size, 0);
  const tSize = topAskSz + topBidSz;
  const bidPct = tSize > 0 ? (topBidSz / tSize) * 100 : 50;
  const askPct = 100 - bidPct;

  return (
    <div className="flex h-full flex-col overflow-hidden border-l border-line transition-colors duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] hover:border-white/15 motion-reduce:transition-none">
      {/* Tabs */}
      <div className="flex shrink-0 border-b border-line">
        {(["book", "trades"] as BookTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className="flex-1 py-2 text-[11px] font-semibold capitalize transition-colors active:scale-[0.98] motion-reduce:transition-none motion-reduce:transform-none"
            style={{
              color: tab === t ? "var(--color-ink)" : "var(--color-faint)",
              borderBottom: tab === t ? "2px solid var(--color-acid)" : "2px solid transparent",
            }}
          >
            {t === "book" ? "Order Book" : "Trades"}
          </button>
        ))}
        <div className="flex items-center gap-0.5 px-1.5">
          {[Layers, BarChart2].map((Icon, i) => (
            <button
              key={i}
              type="button"
              className="flex size-6 items-center justify-center rounded hover:bg-panel-2"
              aria-label="Book view option"
            >
              <Icon size={10} className="text-faint" />
            </button>
          ))}
        </div>
      </div>

      {tab === "book" ? (
        <>
          {/* Depth bands */}
          <div
            className="grid shrink-0 items-center gap-x-2 border-b border-line px-2 py-1.5 text-[9px] font-medium text-faint"
            style={{ gridTemplateColumns: "auto 1fr 1fr 1fr" }}
          >
            <span className="self-start pt-0.5 text-[9px] font-bold tracking-widest uppercase">
              Depth
            </span>
            {depthRows.map((r) => (
              <span key={`h-${r.bps}`} className="text-right text-[9px] tabular-nums text-faint">
                ±{r.bps} bps
              </span>
            ))}
            {depthRows.map((r) => (
              <span
                key={`a-${r.bps}`}
                className="text-right text-[10px] tabular-nums"
                style={{ color: "var(--color-danger)" }}
              >
                {r.ask.toFixed(2)}
              </span>
            ))}
            {depthRows.map((r) => (
              <span
                key={`b-${r.bps}`}
                className="text-right text-[10px] tabular-nums"
                style={{ color: "var(--color-success)" }}
              >
                {r.bid.toFixed(2)}
              </span>
            ))}
          </div>

          <div
            className="grid shrink-0 border-b border-line px-2 py-1 text-[9px] font-medium text-faint"
            style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
          >
            <span>Price (USD)</span>
            <span className="text-right">Size</span>
            <span className="text-right">Total</span>
          </div>

          <div className="overflow-hidden" style={{ flex: "1 1 0" }}>
            <div className="flex h-full flex-col-reverse">
              {asks.map((a, i) => (
                <div
                  key={i}
                  className="relative grid cursor-pointer px-2 hover:bg-panel-2"
                  style={{ gridTemplateColumns: "1fr 1fr 1fr", height: 19 }}
                >
                  <div
                    className="absolute top-0 right-0 bottom-0"
                    style={{
                      width: `${(a.total / maxTotal) * 100}%`,
                      background: "color-mix(in srgb, var(--color-danger) 9%, transparent)",
                    }}
                  />
                  {a.isWall && (
                    <div
                      className="absolute top-1 bottom-0 left-0 w-0.5"
                      style={{ background: "var(--color-danger)" }}
                    />
                  )}
                  <span
                    className="relative z-10 text-[10px] leading-[19px] tabular-nums"
                    style={{ color: "var(--color-danger)" }}
                  >
                    {a.price.toFixed(dp)}
                  </span>
                  <span className="relative z-10 text-right text-[10px] leading-[19px] tabular-nums text-muted">
                    {a.size.toFixed(3)}
                  </span>
                  <span className="relative z-10 text-right text-[10px] leading-[19px] tabular-nums text-faint">
                    {a.total.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between border-t border-b border-line bg-panel-2 px-2 py-1.5">
            <span className="text-[12px] font-bold tabular-nums text-ink">
              {midPrice.toFixed(dp)}
            </span>
            <span className="text-[9px] text-faint">Spread {spread.toFixed(dp)}</span>
          </div>

          <div className="overflow-hidden" style={{ flex: "1 1 0" }}>
            <div className="flex h-full flex-col">
              {bids.map((b, i) => (
                <div
                  key={i}
                  className="relative grid cursor-pointer px-2 hover:bg-panel-2"
                  style={{ gridTemplateColumns: "1fr 1fr 1fr", height: 19 }}
                >
                  <div
                    className="absolute top-0 right-0 bottom-0"
                    style={{
                      width: `${(b.total / maxTotal) * 100}%`,
                      background: "color-mix(in srgb, var(--color-success) 9%, transparent)",
                    }}
                  />
                  {b.isWall && (
                    <div
                      className="absolute top-1 bottom-0 left-0 w-0.5"
                      style={{ background: "var(--color-success)" }}
                    />
                  )}
                  <span
                    className="relative z-10 text-[10px] leading-[19px] tabular-nums"
                    style={{ color: "var(--color-success)" }}
                  >
                    {b.price.toFixed(dp)}
                  </span>
                  <span className="relative z-10 text-right text-[10px] leading-[19px] tabular-nums text-muted">
                    {b.size.toFixed(3)}
                  </span>
                  <span className="relative z-10 text-right text-[10px] leading-[19px] tabular-nums text-faint">
                    {b.total.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Imbalance bar */}
          <div className="flex shrink-0 items-center gap-2 border-t border-line px-2 py-1">
            <span className="shrink-0 text-[8px] font-bold tracking-widest text-faint uppercase">
              Imb.
            </span>
            <div className="flex h-1.5 flex-1 overflow-hidden rounded bg-panel-2">
              <div
                style={{
                  width: `${bidPct}%`,
                  background: "color-mix(in srgb, var(--color-success) 70%, transparent)",
                }}
              />
              <div
                style={{
                  width: `${askPct}%`,
                  background: "color-mix(in srgb, var(--color-danger) 70%, transparent)",
                }}
              />
            </div>
            <span
              className="shrink-0 text-[9px] font-semibold tabular-nums"
              style={{ color: bidPct >= askPct ? "var(--color-success)" : "var(--color-danger)" }}
            >
              {Math.max(bidPct, askPct).toFixed(0)}% {bidPct >= askPct ? "BID" : "ASK"}
            </span>
          </div>
        </>
      ) : (
        <>
          <div
            className="grid shrink-0 border-b border-line px-2 py-1 text-[9px] font-medium text-faint"
            style={{ gridTemplateColumns: "1fr 1fr 1fr" }}
          >
            <span>Price (USD)</span>
            <span className="text-right">Size</span>
            <span className="text-right">Time</span>
          </div>
          <TradeFlowStrip trades={tradeList} />
          <div className="flex flex-1 flex-col overflow-hidden">
            {tradeList.length === 0 ? (
              <div className="flex h-full items-center justify-center">
                <span className="text-[9px] text-faint">Waiting for trades…</span>
              </div>
            ) : (
              tradeList.slice(0, 30).map((t) => (
                <div
                  key={t.tradeSequenceNumber}
                  className="grid px-2 transition-colors hover:bg-panel-2 motion-reduce:transition-none"
                  style={{ gridTemplateColumns: "1fr 1fr 1fr", height: 19 }}
                >
                  <span
                    className="text-[10px] leading-[19px] font-medium tabular-nums"
                    style={{ color: t.side === "b" ? "var(--color-success)" : "var(--color-danger)" }}
                  >
                    {t.price.toFixed(dp)}
                  </span>
                  <span className="text-right text-[10px] leading-[19px] tabular-nums text-muted">
                    {t.size.toFixed(3)}
                  </span>
                  <span className="text-right text-[10px] leading-[19px] tabular-nums text-faint">
                    {new Date(t.time).toLocaleTimeString("en-US", {
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: false,
                    })}
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
