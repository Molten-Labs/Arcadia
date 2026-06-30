"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/utils";
import { formatUSD } from "@/lib/types";
import type { PriceData, OpenPosition } from "@/lib/types";
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
   Order book helpers
───────────────────────────────────────────────────────────────── */

function genOrderBook(mid: number) {
  const step = mid < 10 ? 0.001 : mid < 100 ? 0.01 : mid < 1000 ? 0.1 : 1;
  const asks = Array.from({ length: 14 }, (_, i) => {
    const price = mid + (i + 0.5) * step * 5 + Math.random() * step;
    const size  = 0.05 + Math.random() * 8;
    return { price, size, total: 0 };
  }).reverse();

  let sumA = 0;
  for (const a of [...asks].reverse()) { sumA += a.size; a.total = sumA; }

  const bids = Array.from({ length: 14 }, (_, i) => {
    const price = mid - (i + 0.5) * step * 5 - Math.random() * step;
    const size  = 0.05 + Math.random() * 8;
    return { price, size, total: 0 };
  });

  let sumB = 0;
  for (const b of bids) { sumB += b.size; b.total = sumB; }

  const maxTotal = Math.max(sumA, sumB);
  return { asks, bids, maxTotal };
}

function genTrade(mid: number, isBtc: boolean) {
  const side = Math.random() > 0.5 ? "buy" : "sell";
  const step = isBtc ? 1 : 0.01;
  const noise = (Math.random() - 0.5) * step * 6;
  return {
    side,
    price: mid + noise,
    size: parseFloat((0.01 + Math.random() * 3.5).toFixed(3)),
    time: new Date(),
  };
}

/* ─────────────────────────────────────────────────────────────────
   OrderBook + Trades panel
───────────────────────────────────────────────────────────────── */

function OrderBookPanel({ midPrice, isBtc }: { midPrice: number; isBtc: boolean }) {
  const [tab, setTab]   = useState<BookTab>("book");
  const [book, setBook] = useState(() => genOrderBook(midPrice));
  const [trades, setTrades] = useState<ReturnType<typeof genTrade>[]>(() =>
    Array.from({ length: 28 }, () => genTrade(midPrice, isBtc))
  );

  useEffect(() => {
    const t = setInterval(() => setBook(genOrderBook(midPrice)), 1200);
    return () => clearInterval(t);
  }, [midPrice]);

  useEffect(() => {
    const t = setInterval(() => {
      setTrades((prev) => [genTrade(midPrice, isBtc), ...prev.slice(0, 39)]);
    }, 600);
    return () => clearInterval(t);
  }, [midPrice, isBtc]);

  const spread = book.asks[book.asks.length - 1].price - book.bids[0].price;
  const dp = isBtc ? 1 : 3;

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
          {/* Column headers */}
          <div
            className="grid px-2 py-1 flex-shrink-0 text-[9px] font-medium"
            style={{ gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid var(--color-line)", color: "var(--color-faint)" }}
          >
            <span>Price (USD)</span><span className="text-right">Size</span><span className="text-right">Total</span>
          </div>

          {/* Asks */}
          <div className="overflow-hidden" style={{ flex: "1 1 0" }}>
            <div className="flex flex-col-reverse h-full">
              {book.asks.map((a, i) => (
                <div
                  key={i}
                  className="relative grid px-2 hover:bg-[var(--color-panel-2)] cursor-pointer"
                  style={{ gridTemplateColumns: "1fr 1fr 1fr", height: 19 }}
                >
                  <div
                    className="absolute right-0 top-0 bottom-0"
                    style={{ width: `${(a.total / book.maxTotal) * 100}%`, background: "rgba(239,68,68,0.09)" }}
                  />
                  <span className="text-[10px] tnum relative z-10 leading-[19px]" style={{ color: "var(--color-red)" }}>{a.price.toFixed(dp)}</span>
                  <span className="text-[10px] tnum relative z-10 text-right leading-[19px]" style={{ color: "var(--color-muted)" }}>{a.size.toFixed(2)}</span>
                  <span className="text-[10px] tnum relative z-10 text-right leading-[19px]" style={{ color: "var(--color-faint)" }}>{a.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Spread */}
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

          {/* Bids */}
          <div className="overflow-hidden" style={{ flex: "1 1 0" }}>
            <div className="flex flex-col h-full">
              {book.bids.map((b, i) => (
                <div
                  key={i}
                  className="relative grid px-2 hover:bg-[var(--color-panel-2)] cursor-pointer"
                  style={{ gridTemplateColumns: "1fr 1fr 1fr", height: 19 }}
                >
                  <div
                    className="absolute right-0 top-0 bottom-0"
                    style={{ width: `${(b.total / book.maxTotal) * 100}%`, background: "rgba(79,158,255,0.09)" }}
                  />
                  <span className="text-[10px] tnum relative z-10 leading-[19px]" style={{ color: "var(--color-green)" }}>{b.price.toFixed(dp)}</span>
                  <span className="text-[10px] tnum relative z-10 text-right leading-[19px]" style={{ color: "var(--color-muted)" }}>{b.size.toFixed(2)}</span>
                  <span className="text-[10px] tnum relative z-10 text-right leading-[19px]" style={{ color: "var(--color-faint)" }}>{b.total.toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Recent trades column headers */}
          <div
            className="grid px-2 py-1 flex-shrink-0 text-[9px] font-medium"
            style={{ gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid var(--color-line)", color: "var(--color-faint)" }}
          >
            <span>Price (USD)</span><span className="text-right">Size</span><span className="text-right">Time</span>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            {trades.slice(0, 30).map((t, i) => (
              <div
                key={i}
                className="grid px-2"
                style={{ gridTemplateColumns: "1fr 1fr 1fr", height: 19 }}
              >
                <span className="text-[10px] tnum leading-[19px] font-medium" style={{ color: t.side === "buy" ? "var(--color-green)" : "var(--color-red)" }}>
                  {t.price.toFixed(dp)}
                </span>
                <span className="text-[10px] tnum text-right leading-[19px]" style={{ color: "var(--color-muted)" }}>{t.size.toFixed(3)}</span>
                <span className="text-[10px] tnum text-right leading-[19px]" style={{ color: "var(--color-faint)" }}>
                  {t.time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })}
                </span>
              </div>
            ))}
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

function TickerBar({ prices }: { prices?: PriceData[] }) {
  const [tab, setTab] = useState<TickerTab>("top");
  const apiItems = (prices ?? []).map((p) => ({
    sym: p.market.replace("-PERP", ""), price: p.price, chg: p.change_pct_24h,
  }));
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
        <span className="text-[9px] font-bold" style={{ color: "var(--color-green)" }}>LIVE · Devnet</span>
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

  const { data: prices } = useQuery<PriceData[]>({
    queryKey: ["prices"],
    queryFn: () => apiFetch("/prices"),
    refetchInterval: 2000,
  });

  const current = prices?.find((p) => p.market === market);
  const coinName = market.replace("-PERP", "");
  const isBtc = market === "BTC-PERP";
  const dp = isBtc ? 1 : 3;

  const oraclePrice = current ? current.price * (1 + (Math.random() - 0.5) * 0.0003) : undefined;

  useEffect(() => {
    const t = setInterval(() => {
      setPositions((prev) =>
        prev.map((pos) => {
          const px = prices?.find((p) => p.market === pos.market)?.price ?? pos.entry_px;
          const upnl = pos.direction === "long"
            ? pos.size_usd * pos.leverage * (px - pos.entry_px) / pos.entry_px
            : pos.size_usd * pos.leverage * (pos.entry_px - px) / pos.entry_px;
          return { ...pos, upnl };
        })
      );
    }, 2000);
    return () => clearInterval(t);
  }, [prices]);

  const openPosition = useCallback(() => {
    if (!connected || !current) return;
    setSubmitting(true);
    setTimeout(() => {
      setPositions((prev) => [{
        id: Math.random().toString(36).slice(2, 10),
        market,
        direction,
        size_usd: parseFloat(sizeUSD) || 1000,
        leverage,
        entry_px: current.price,
        opened_at: Math.floor(Date.now() / 1000),
        upnl: 0,
      }, ...prev]);
      setSubmitting(false);
    }, 700);
  }, [connected, current, market, direction, sizeUSD, leverage]);

  const closePosition = (id: string) => {
    setClosingId(id);
    setTimeout(() => { setPositions((p) => p.filter((x) => x.id !== id)); setClosingId(null); }, 1000);
  };

  /* 24h stats (mocked, realistic) */
  const vol24  = market === "BTC-PERP" ? "$42.1B" : market === "SOL-PERP" ? "$3.2B" : market === "ETH-PERP" ? "$18.4B" : "$0.4B";
  const oi24   = market === "BTC-PERP" ? "$12.8B" : market === "SOL-PERP" ? "$1.1B" : market === "ETH-PERP" ? "$8.7B"  : "$0.2B";

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
        {current && (
          <div className="flex items-center gap-2.5 px-4 flex-shrink-0" style={{ borderRight: "1px solid var(--color-line)" }}>
            <span
              className="text-[17px] font-black tnum"
              style={{ color: current.change_pct_24h >= 0 ? "var(--color-green)" : "var(--color-red)" }}
            >
              {isBtc ? current.price.toFixed(0) : current.price.toFixed(dp)}
            </span>
            <div className="flex items-center gap-0.5">
              {current.change_pct_24h >= 0
                ? <TrendingUp size={10} style={{ color: "var(--color-green)" }} />
                : <TrendingDown size={10} style={{ color: "var(--color-red)" }} />
              }
              <span
                className="text-[11px] font-bold tnum"
                style={{ color: current.change_pct_24h >= 0 ? "var(--color-green)" : "var(--color-red)" }}
              >
                {current.change_pct_24h >= 0 ? "+" : ""}{current.change_pct_24h.toFixed(2)}%
              </span>
            </div>
          </div>
        )}

        {/* Market stats */}
        {[
          { label: "Oracle Price",   value: oraclePrice ? oraclePrice.toFixed(dp) : "—" },
          { label: "24h Volume",     value: vol24 },
          { label: "Open Interest",  value: oi24 },
          { label: "Funding Rate",   value: "+0.0100%", color: "var(--color-green)" },
          { label: "Next Funding",   value: "01:22:47" },
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
            currentPrice={current?.price}
            fullHeight
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
          {current && <OrderBookPanel midPrice={current.price} isBtc={isBtc} />}
        </div>

        {/* Order form */}
        <div className="w-64 flex-shrink-0 overflow-hidden">
          <RightPanel
            direction={direction} setDirection={setDirection}
            orderType={orderType} setOrderType={setOrderType}
            sizeUSD={sizeUSD} setSizeUSD={setSizeUSD}
            leverage={leverage} setLeverage={setLeverage}
            currentPrice={current?.price}
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
              style={{ background: "rgba(240,180,41,0.12)", color: "var(--color-gold)", border: "1px solid rgba(240,180,41,0.2)" }}
            >
              Devnet simulation
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
                    const markPx = prices?.find((p) => p.market === pos.market)?.price;
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
          {bottomTab !== "positions" && (
            <div className="flex flex-col items-center justify-center h-full gap-1.5">
              <Activity size={18} style={{ color: "var(--color-faint)", opacity: 0.5 }} />
              <p className="text-xs" style={{ color: "var(--color-faint)" }}>No {bottomTab} data</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Live ticker bar ───────────────────────────────────────── */}
      <TickerBar prices={prices} />
    </div>
  );
}

export default function TerminalPage() {
  return (
    <Suspense fallback={<div className="h-screen w-full bg-[var(--color-bg)]" />}>
      <TerminalContent />
    </Suspense>
  );
}
