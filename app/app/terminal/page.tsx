"use client";

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/utils";
import { formatUSD } from "@/lib/types";
import type { PriceData, OpenPosition } from "@/lib/types";
import {
  ChevronDown, TrendingUp, TrendingDown, X, Minus, Plus,
  Crosshair, BarChart2, Maximize2, Settings, BookOpen,
  Layers, Circle, Square, Triangle, Wifi,
} from "lucide-react";

const TvChart = dynamic(() => import("@/components/TvChart").then((m) => m.TvChart), { ssr: false });

type Direction = "long" | "short";
type OrderType = "Market" | "Limit" | "Pro";

/* ── Mock order book data ────────────────────────────────────────── */
function genOrderBook(mid: number) {
  const asks = Array.from({ length: 10 }, (_, i) => {
    const price = mid + (i + 1) * 3.5 + Math.random() * 2;
    const size = 0.02 + Math.random() * 2.8;
    return { price, size, total: 0 };
  }).reverse();
  let sumA = 0;
  for (const a of [...asks].reverse()) { sumA += a.size; a.total = sumA; }

  const bids = Array.from({ length: 10 }, (_, i) => {
    const price = mid - (i + 1) * 3.5 - Math.random() * 2;
    const size = 0.02 + Math.random() * 2.8;
    return { price, size, total: 0 };
  });
  let sumB = 0;
  for (const b of bids) { sumB += b.size; b.total = sumB; }

  const maxTotal = Math.max(sumA, sumB);
  return { asks, bids, maxTotal };
}

/* ── Order Book ─────────────────────────────────────────────────── */
function OrderBook({ midPrice }: { midPrice: number }) {
  const [book, setBook] = useState(() => genOrderBook(midPrice));
  useEffect(() => {
    const t = setInterval(() => setBook(genOrderBook(midPrice)), 1500);
    return () => clearInterval(t);
  }, [midPrice]);

  const spread = (book.asks[book.asks.length - 1].price - book.bids[0].price);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ borderLeft: "1px solid var(--color-line)" }}>
      <div className="flex items-center justify-between px-3 py-2 flex-shrink-0" style={{ borderBottom: "1px solid var(--color-line)" }}>
        <span className="text-[11px] font-semibold" style={{ color: "var(--color-ink)" }}>Order Book</span>
        <div className="flex gap-1">
          {[Layers, BarChart2].map((Icon, i) => (
            <button key={i} className="w-5 h-5 flex items-center justify-center rounded hover:bg-[var(--color-panel-2)]">
              <Icon size={11} style={{ color: "var(--color-faint)" }} />
            </button>
          ))}
        </div>
      </div>

      {/* Column headers */}
      <div className="grid px-2 py-1 flex-shrink-0" style={{ gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid var(--color-line)" }}>
        {["Price (USD)", "Size", "Sum"].map((h) => (
          <span key={h} className="text-[9px] font-medium" style={{ color: "var(--color-faint)" }}>{h}</span>
        ))}
      </div>

      {/* Asks (sell orders — red) */}
      <div className="flex-1 overflow-hidden flex flex-col-reverse">
        {book.asks.map((a, i) => (
          <div
            key={i}
            className="relative grid px-2 hover:bg-[var(--color-panel-2)] cursor-pointer"
            style={{ gridTemplateColumns: "1fr 1fr 1fr", height: 20 }}
          >
            <div
              className="absolute right-0 top-0 bottom-0"
              style={{ width: `${(a.total / book.maxTotal) * 100}%`, background: "rgba(239,68,68,0.08)" }}
            />
            <span className="text-[10px] tnum relative z-10" style={{ color: "var(--color-red)" }}>{a.price.toFixed(1)}</span>
            <span className="text-[10px] tnum relative z-10" style={{ color: "var(--color-muted)" }}>{a.size.toFixed(3)}</span>
            <span className="text-[10px] tnum relative z-10" style={{ color: "var(--color-faint)" }}>{a.total.toFixed(3)}</span>
          </div>
        ))}
      </div>

      {/* Spread */}
      <div className="flex items-center justify-between px-2 py-1 flex-shrink-0" style={{ background: "var(--color-panel-2)", borderTop: "1px solid var(--color-line)", borderBottom: "1px solid var(--color-line)" }}>
        <span className="text-[11px] font-bold tnum" style={{ color: "var(--color-ink)" }}>
          {midPrice.toFixed(1)}
        </span>
        <span className="text-[9px]" style={{ color: "var(--color-faint)" }}>
          Spread {spread.toFixed(1)}
        </span>
      </div>

      {/* Bids (buy orders — green) */}
      <div className="flex-1 overflow-hidden flex flex-col">
        {book.bids.map((b, i) => (
          <div
            key={i}
            className="relative grid px-2 hover:bg-[var(--color-panel-2)] cursor-pointer"
            style={{ gridTemplateColumns: "1fr 1fr 1fr", height: 20 }}
          >
            <div
              className="absolute right-0 top-0 bottom-0"
              style={{ width: `${(b.total / book.maxTotal) * 100}%`, background: "rgba(34,197,94,0.08)" }}
            />
            <span className="text-[10px] tnum relative z-10" style={{ color: "var(--color-green)" }}>{b.price.toFixed(1)}</span>
            <span className="text-[10px] tnum relative z-10" style={{ color: "var(--color-muted)" }}>{b.size.toFixed(3)}</span>
            <span className="text-[10px] tnum relative z-10" style={{ color: "var(--color-faint)" }}>{b.total.toFixed(3)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Order form + Account ───────────────────────────────────────── */
function RightPanel({
  direction, setDirection, orderType, setOrderType,
  sizeUSD, setSizeUSD, leverage, setLeverage,
  currentPrice, onSubmit, submitting, connected,
  market,
}: {
  direction: Direction; setDirection: (d: Direction) => void;
  orderType: OrderType; setOrderType: (t: OrderType) => void;
  sizeUSD: string; setSizeUSD: (v: string) => void;
  leverage: number; setLeverage: (v: number) => void;
  currentPrice?: number; onSubmit: () => void; submitting: boolean; connected: boolean;
  market: string;
}) {
  const [tpslEnabled, setTpslEnabled] = useState(false);
  const [tpPrice, setTpPrice] = useState("");
  const [slPrice, setSlPrice] = useState("");
  const notional = (parseFloat(sizeUSD) || 0) * leverage;
  const fee = notional * 0.0005;
  const liqDist = currentPrice ? currentPrice / leverage * 0.9 : 0;
  const liqPrice = currentPrice ? (direction === "long" ? currentPrice - liqDist : currentPrice + liqDist) : 0;

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ borderLeft: "1px solid var(--color-line)" }}>
      {/* Long / Short tabs */}
      <div className="flex flex-shrink-0" style={{ borderBottom: "1px solid var(--color-line)" }}>
        {(["long", "short"] as Direction[]).map((d) => (
          <button
            key={d}
            onClick={() => setDirection(d)}
            className="flex-1 py-2.5 text-xs font-bold capitalize transition-colors"
            style={{
              background: direction === d ? (d === "long" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)") : "transparent",
              color: direction === d ? (d === "long" ? "var(--color-green)" : "var(--color-red)") : "var(--color-faint)",
              borderBottom: direction === d ? `2px solid ${d === "long" ? "var(--color-green)" : "var(--color-red)"}` : "2px solid transparent",
            }}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Order type */}
        <div className="flex rounded overflow-hidden" style={{ border: "1px solid var(--color-line)" }}>
          {(["Market", "Limit", "Pro"] as OrderType[]).map((t) => (
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

        {/* Amount */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-[10px] font-medium" style={{ color: "var(--color-faint)" }}>Amount</label>
            <span className="text-[10px]" style={{ color: "var(--color-faint)" }}>USD</span>
          </div>
          <div className="flex items-center rounded overflow-hidden" style={{ border: "1px solid var(--color-line)", background: "var(--color-panel-2)" }}>
            <span className="px-2 text-[10px]" style={{ color: "var(--color-muted)" }}>$</span>
            <input
              type="number"
              value={sizeUSD}
              onChange={(e) => setSizeUSD(e.target.value)}
              placeholder="0.00"
              className="flex-1 py-2 text-sm outline-none tnum bg-transparent"
              style={{ color: "var(--color-ink)" }}
            />
            <button className="px-2 text-[10px] py-2" style={{ color: "var(--color-faint)", borderLeft: "1px solid var(--color-line)" }}>
              USD
            </button>
          </div>
          <div className="flex gap-1 mt-1.5">
            {[25, 50, 75, 100].map((p) => (
              <button
                key={p}
                onClick={() => setSizeUSD((20000 * p / 100).toString())}
                className="flex-1 py-1 text-[9px] font-semibold rounded transition-colors"
                style={{ background: "var(--color-panel-2)", color: "var(--color-faint)", border: "1px solid var(--color-line)" }}
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
              <button onClick={() => setLeverage(Math.max(1, leverage - 1))} className="w-5 h-5 rounded flex items-center justify-center" style={{ border: "1px solid var(--color-line)", color: "var(--color-faint)" }}>
                <Minus size={9} />
              </button>
              <span className="text-xs font-bold tnum w-10 text-center" style={{ color: "var(--color-ink)" }}>{leverage}x</span>
              <button onClick={() => setLeverage(Math.min(50, leverage + 1))} className="w-5 h-5 rounded flex items-center justify-center" style={{ border: "1px solid var(--color-line)", color: "var(--color-faint)" }}>
                <Plus size={9} />
              </button>
            </div>
          </div>
          <input
            type="range"
            min={1}
            max={50}
            value={leverage}
            onChange={(e) => setLeverage(parseInt(e.target.value))}
            className="w-full h-1 accent-purple-500"
            style={{ accentColor: "var(--color-purple)" }}
          />
          <div className="flex justify-between text-[9px] mt-0.5" style={{ color: "var(--color-faint)" }}>
            {[1, 10, 20, 30, 50].map((v) => <span key={v}>{v}x</span>)}
          </div>
        </div>

        {/* TP / SL */}
        <div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium" style={{ color: "var(--color-faint)" }}>TP / SL</label>
            <button
              onClick={() => setTpslEnabled(!tpslEnabled)}
              className="w-8 h-4 rounded-full relative transition-colors"
              style={{ background: tpslEnabled ? "var(--color-purple)" : "var(--color-line)" }}
            >
              <div
                className="absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all"
                style={{ left: tpslEnabled ? "calc(100% - 14px)" : "2px" }}
              />
            </button>
          </div>
          {tpslEnabled && (
            <div className="flex gap-2 mt-2">
              <input
                type="number"
                value={tpPrice}
                onChange={(e) => setTpPrice(e.target.value)}
                placeholder="Take Profit"
                className="flex-1 rounded px-2 py-1.5 text-[10px] outline-none tnum"
                style={{ background: "rgba(34,197,94,0.06)", border: "1px solid rgba(34,197,94,0.2)", color: "var(--color-ink)" }}
              />
              <input
                type="number"
                value={slPrice}
                onChange={(e) => setSlPrice(e.target.value)}
                placeholder="Stop Loss"
                className="flex-1 rounded px-2 py-1.5 text-[10px] outline-none tnum"
                style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", color: "var(--color-ink)" }}
              />
            </div>
          )}
        </div>

        {/* Order details */}
        <div className="rounded p-2.5 space-y-1.5" style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)" }}>
          {[
            ["Entry Price",  currentPrice ? currentPrice.toFixed(1) : "—"],
            ["Liq. Price",   currentPrice ? liqPrice.toFixed(1) : "—"],
            ["Notional",     notional > 0 ? formatUSD(notional) : "—"],
            ["Est. Fees",    fee > 0 ? formatUSD(fee) : "—"],
          ].map(([k, v]) => (
            <div key={k as string} className="flex items-center justify-between">
              <span className="text-[10px]" style={{ color: "var(--color-faint)" }}>{k}</span>
              <span className="text-[10px] tnum font-medium" style={{ color: "var(--color-ink)" }}>{v}</span>
            </div>
          ))}
        </div>

        {/* Submit */}
        <button
          onClick={onSubmit}
          disabled={!connected || submitting || !sizeUSD || parseFloat(sizeUSD) <= 0}
          className="w-full py-2.5 rounded text-sm font-bold transition-all disabled:opacity-40"
          style={{
            background: direction === "long" ? "var(--color-green)" : "var(--color-red)",
            color: "#000",
          }}
        >
          {!connected ? "Connect Wallet" : submitting ? "Placing…" : `${direction === "long" ? "Long" : "Short"} ${market.replace("-PERP","")}`}
        </button>
      </div>

      {/* Account overview */}
      <div className="flex-shrink-0 p-3" style={{ borderTop: "1px solid var(--color-line)" }}>
        <p className="text-[10px] font-semibold mb-2" style={{ color: "var(--color-faint)" }}>Account Overview</p>
        {[
          ["Account Value",   "$27,311", "var(--color-ink)"],
          ["Available",       "$20,000", "var(--color-ink)"],
          ["Margin Ratio",    "2.5%",    "var(--color-ink)"],
          ["Unrealized PnL",  "+$322",   "var(--color-green)"],
          ["Realized PnL",    "+$1,200", "var(--color-green)"],
        ].map(([k, v, c]) => (
          <div key={k as string} className="flex items-center justify-between py-1" style={{ borderBottom: "1px solid var(--color-line)" }}>
            <span className="text-[10px]" style={{ color: "var(--color-faint)" }}>{k}</span>
            <span className="text-[10px] font-semibold tnum" style={{ color: c as string }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Ticker Bar ─────────────────────────────────────────────────── */
const EXTRA_TICKERS = [
  { sym: "HYPE", price: 28.41,  chg: -0.84 },
  { sym: "MNT",  price: 0.56,   chg: +5.21 },
  { sym: "LINK", price: 13.19,  chg: +2.44 },
  { sym: "TRON", price: 0.28,   chg: -1.33 },
  { sym: "OP",   price: 1.72,   chg: +3.87 },
  { sym: "AVAX", price: 22.14,  chg: -2.10 },
  { sym: "INJ",  price: 14.88,  chg: +7.32 },
  { sym: "WIF",  price: 1.05,   chg: -4.56 },
  { sym: "PEPE", price: 0.0000121, chg: +12.3 },
  { sym: "JUP",  price: 0.58,   chg: +1.98 },
];

type TickerTab = "top" | "gainers" | "losers";

function TickerBar({ prices }: { prices?: PriceData[] }) {
  const [tab, setTab] = useState<TickerTab>("top");
  const [tick, setTick] = useState(0);
  const tickerRef = useRef<HTMLDivElement>(null);

  // Slowly nudge the tick so prices flicker live
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 2000);
    return () => clearInterval(t);
  }, []);

  // Build unified list from API prices + extras
  const apiItems = (prices ?? []).map((p) => ({
    sym: p.market.replace("-PERP", ""),
    price: p.price,
    chg: p.change_pct_24h,
  }));
  const all = [...apiItems, ...EXTRA_TICKERS];

  const displayed =
    tab === "gainers"
      ? [...all].sort((a, b) => b.chg - a.chg).slice(0, 8)
      : tab === "losers"
      ? [...all].sort((a, b) => a.chg - b.chg).slice(0, 8)
      : all;

  // duplicate for seamless marquee
  const marquee = [...displayed, ...displayed];

  return (
    <div
      className="flex-shrink-0 flex items-center h-[26px] overflow-hidden"
      style={{ borderTop: "1px solid var(--color-line)", background: "var(--color-panel)" }}
    >
      {/* Tabs */}
      <div className="flex items-center flex-shrink-0 h-full" style={{ borderRight: "1px solid var(--color-line)" }}>
        {([["top","Top Traded"],["gainers","Gainers"],["losers","Losers"]] as [TickerTab,string][]).map(([t, label]) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="px-3 h-full text-[10px] font-semibold transition-colors"
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

      {/* Scrolling ticker */}
      <div className="flex-1 overflow-hidden relative h-full flex items-center">
        <div
          ref={tickerRef}
          className="flex items-center gap-0 whitespace-nowrap"
          style={{
            animation: "ticker-scroll 40s linear infinite",
            willChange: "transform",
          }}
        >
          {marquee.map((item, i) => {
            const pos = item.chg >= 0;
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-4 h-full text-[10px]"
                style={{ borderRight: "1px solid var(--color-line)" }}
              >
                <span className="font-bold" style={{ color: "var(--color-ink)" }}>{item.sym}</span>
                <span className="tnum" style={{ color: "var(--color-muted)" }}>
                  {item.price < 0.01
                    ? item.price.toFixed(7)
                    : item.price < 1
                    ? item.price.toFixed(4)
                    : item.price < 100
                    ? item.price.toFixed(3)
                    : item.price.toFixed(2)}
                </span>
                <span
                  className="tnum font-semibold"
                  style={{ color: pos ? "var(--color-green)" : "var(--color-red)" }}
                >
                  {pos ? "+" : ""}{item.chg.toFixed(2)}%
                </span>
              </span>
            );
          })}
        </div>
        {/* Fade edges */}
        <div className="absolute left-0 top-0 bottom-0 w-6 pointer-events-none" style={{ background: "linear-gradient(to right, var(--color-panel), transparent)" }} />
        <div className="absolute right-0 top-0 bottom-0 w-6 pointer-events-none" style={{ background: "linear-gradient(to left, var(--color-panel), transparent)" }} />
      </div>

      {/* Status + feedback */}
      <div className="flex items-center gap-3 px-3 flex-shrink-0 h-full" style={{ borderLeft: "1px solid var(--color-line)" }}>
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-green)] animate-pulse flex-shrink-0" />
          <span className="text-[10px] font-semibold" style={{ color: "var(--color-green)" }}>Connected</span>
        </div>
        <div className="w-px h-3" style={{ background: "var(--color-line)" }} />
        <button
          className="text-[10px] font-medium px-2 py-0.5 rounded transition-colors hover:bg-[var(--color-panel-2)]"
          style={{ color: "var(--color-faint)", border: "1px solid var(--color-line)" }}
        >
          Send Feedback
        </button>
      </div>
    </div>
  );
}

/* ── Page ───────────────────────────────────────────────────────── */
const MARKETS = ["BTC-PERP", "SOL-PERP", "ETH-PERP", "ARB-PERP"];
const INTERVALS = ["1m","5m","15m","1H","4H","1D"];

export default function TerminalPage() {
  const { connected } = useWallet();
  const [market, setMarket] = useState("BTC-PERP");
  const [direction, setDirection] = useState<Direction>("long");
  const [orderType, setOrderType] = useState<OrderType>("Market");
  const [sizeUSD, setSizeUSD] = useState("1000");
  const [leverage, setLeverage] = useState(5);
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [posTab, setPosTab] = useState<"positions"|"orders"|"history"|"funding">("positions");
  const [interval, setInterval] = useState("1H");
  const [marketOpen, setMarketOpen] = useState(false);

  const { data: prices } = useQuery<PriceData[]>({
    queryKey: ["prices"],
    queryFn: () => apiFetch("/prices"),
    refetchInterval: 2000,
  });

  const current = prices?.find((p) => p.market === market);

  // Update unrealized PnL
  useEffect(() => {
    const t = setInterval(() => {
      setPositions((prev) =>
        prev.map((pos) => {
          const price = prices?.find((p) => p.market === pos.market)?.price ?? pos.entry_px;
          const upnl = pos.direction === "long"
            ? pos.size_usd * pos.leverage * (price - pos.entry_px) / pos.entry_px
            : pos.size_usd * pos.leverage * (pos.entry_px - price) / pos.entry_px;
          return { ...pos, upnl };
        })
      );
    }, 2000);
    return () => clearInterval(t);
  }, [prices]);

  const openPosition = () => {
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
    }, 800);
  };

  const closePosition = (id: string) => {
    setClosingId(id);
    setTimeout(() => { setPositions((prev) => prev.filter((p) => p.id !== id)); setClosingId(null); }, 1200);
  };

  const coinName = market.replace("-PERP", "");
  const isBtc = market === "BTC-PERP";

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: "calc(100vh - 36px)", background: "var(--color-bg)" }}
    >
      {/* ── Market bar ── */}
      <div
        className="flex items-center gap-0 flex-shrink-0 h-10 px-2 overflow-x-auto"
        style={{ borderBottom: "1px solid var(--color-line)", background: "var(--color-panel)" }}
      >
        {/* Market selector */}
        <div className="relative flex-shrink-0">
          <button
            onClick={() => setMarketOpen(!marketOpen)}
            className="flex items-center gap-1.5 h-10 px-3 mr-2 font-bold text-sm"
            style={{ color: "var(--color-ink)", borderRight: "1px solid var(--color-line)" }}
          >
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0"
              style={{ background: "var(--color-purple)", color: "#fff" }}
            >
              {coinName.slice(0, 1)}
            </span>
            {coinName}/USD
            <ChevronDown size={12} style={{ color: "var(--color-faint)" }} />
          </button>
          {marketOpen && (
            <div
              className="absolute top-full left-0 z-50 rounded py-1 shadow-xl"
              style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)", minWidth: 140 }}
            >
              {MARKETS.map((m) => (
                <button
                  key={m}
                  onClick={() => { setMarket(m); setMarketOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-panel)] transition-colors"
                  style={{ color: m === market ? "var(--color-ink)" : "var(--color-muted)" }}
                >
                  {m.replace("-PERP", "")}/USD
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Price */}
        {current && (
          <div className="flex items-center gap-3 flex-shrink-0 pr-4" style={{ borderRight: "1px solid var(--color-line)" }}>
            <span className="text-base font-black tnum" style={{ color: current.change_pct_24h >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
              {isBtc ? current.price.toFixed(0) : current.price.toFixed(3)}
            </span>
            <div className="flex items-center gap-0.5">
              {current.change_pct_24h >= 0
                ? <TrendingUp size={11} style={{ color: "var(--color-green)" }} />
                : <TrendingDown size={11} style={{ color: "var(--color-red)" }} />
              }
              <span className="text-xs tnum font-semibold" style={{ color: current.change_pct_24h >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
                {current.change_pct_24h >= 0 ? "+" : ""}{current.change_pct_24h.toFixed(2)}%
              </span>
            </div>
          </div>
        )}

        {/* Market stats */}
        {[
          { label: "24h Change",      value: current ? `${current.change_pct_24h >= 0 ? "+" : ""}${current.change_pct_24h.toFixed(2)}%` : "—" },
          { label: "24h Volume",      value: "$12,449,328,220" },
          { label: "Open Interest",   value: "$8,234,119,032" },
          { label: "Funding Rate",    value: "+0.0100%" },
          { label: "Next Funding",    value: "1h 30m" },
        ].map(({ label, value }) => (
          <div key={label} className="flex flex-col px-4 flex-shrink-0" style={{ borderRight: "1px solid var(--color-line)" }}>
            <span className="text-[9px]" style={{ color: "var(--color-faint)" }}>{label}</span>
            <span className="text-[11px] font-semibold tnum" style={{ color: "var(--color-ink)" }}>{value}</span>
          </div>
        ))}

        {/* Interval buttons */}
        <div className="ml-auto flex items-center gap-1 px-3 flex-shrink-0">
          {INTERVALS.map((iv) => (
            <button
              key={iv}
              onClick={() => setInterval(iv)}
              className="px-2 py-1 text-[10px] font-semibold rounded transition-colors"
              style={{
                background: interval === iv ? "var(--color-panel-2)" : "transparent",
                color: interval === iv ? "var(--color-ink)" : "var(--color-faint)",
                border: interval === iv ? "1px solid var(--color-line)" : "1px solid transparent",
              }}
            >
              {iv}
            </button>
          ))}
          <div className="w-px h-4 mx-1" style={{ background: "var(--color-line)" }} />
          <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--color-panel-2)]">
            <Maximize2 size={11} style={{ color: "var(--color-faint)" }} />
          </button>
          <button className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--color-panel-2)]">
            <Settings size={11} style={{ color: "var(--color-faint)" }} />
          </button>
        </div>
      </div>

      {/* ── Main row ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Chart tools */}
        <div
          className="w-9 flex-shrink-0 flex flex-col items-center py-2 gap-0.5"
          style={{ borderRight: "1px solid var(--color-line)", background: "var(--color-panel)" }}
        >
          {[Crosshair, BarChart2, TrendingUp, Circle, Square, Triangle, BookOpen].map((Icon, i) => (
            <button
              key={i}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--color-panel-2)] transition-colors"
              title="Chart tool"
            >
              <Icon size={13} style={{ color: "var(--color-faint)" }} strokeWidth={1.5} />
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="flex-1 min-w-0 overflow-hidden relative">
          <TvChart
            market={market}
            currentPrice={current?.price}
            height={undefined}
            positions={positions
              .filter((p) => p.market === market)
              .map((p) => ({
                id: p.id,
                direction: p.direction,
                entry_px: p.entry_px,
                size_usd: p.size_usd,
                leverage: p.leverage,
              }))}
            fullHeight
          />
        </div>

        {/* Order book */}
        <div className="w-48 flex-shrink-0 overflow-hidden">
          {current && <OrderBook midPrice={current.price} />}
        </div>

        {/* Order form */}
        <div className="w-60 flex-shrink-0 overflow-hidden">
          <RightPanel
            direction={direction}
            setDirection={setDirection}
            orderType={orderType}
            setOrderType={setOrderType}
            sizeUSD={sizeUSD}
            setSizeUSD={setSizeUSD}
            leverage={leverage}
            setLeverage={setLeverage}
            currentPrice={current?.price}
            onSubmit={openPosition}
            submitting={submitting}
            connected={connected}
            market={market}
          />
        </div>
      </div>

      {/* ── Bottom panel ── */}
      <div
        className="flex-shrink-0 flex flex-col overflow-hidden"
        style={{ height: 180, borderTop: "1px solid var(--color-line)", background: "var(--color-panel)" }}
      >
        {/* Tabs */}
        <div className="flex items-center px-3 flex-shrink-0" style={{ borderBottom: "1px solid var(--color-line)" }}>
          {([
            ["positions", `Positions (${positions.length})`],
            ["orders",    "Open Orders (0)"],
            ["history",   "Trade History"],
            ["funding",   "Funding History"],
          ] as const).map(([t, label]) => (
            <button
              key={t}
              onClick={() => setPosTab(t)}
              className="px-4 py-2 text-xs font-semibold"
              style={{
                color: posTab === t ? "var(--color-ink)" : "var(--color-faint)",
                borderBottom: posTab === t ? "2px solid var(--color-purple-bright)" : "2px solid transparent",
              }}
            >
              {label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 pr-2">
            <span
              className="text-[10px] px-2 py-0.5 rounded"
              style={{ background: "rgba(240,180,41,0.12)", color: "var(--color-gold)", border: "1px solid rgba(240,180,41,0.2)" }}
            >
              Devnet simulation
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {posTab === "positions" && (
            positions.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <p className="text-xs" style={{ color: "var(--color-faint)" }}>No open positions</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0" style={{ background: "var(--color-panel)" }}>
                  <tr>
                    {["Market","Side","Size","Leverage","Entry","Mark","uPnL",""].map((h) => (
                      <th key={h} className="py-2 px-3 text-left font-medium" style={{ color: "var(--color-faint)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => (
                    <tr key={pos.id} className="hover:bg-[var(--color-panel-2)] transition-colors" style={{ borderBottom: "1px solid var(--color-line)" }}>
                      <td className="py-2 px-3 font-semibold" style={{ color: "var(--color-ink)" }}>{pos.market}</td>
                      <td className="py-2 px-3">
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded font-bold uppercase"
                          style={{
                            background: pos.direction === "long" ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                            color: pos.direction === "long" ? "var(--color-green)" : "var(--color-red)",
                          }}
                        >
                          {pos.direction}
                        </span>
                      </td>
                      <td className="py-2 px-3 tnum" style={{ color: "var(--color-muted)" }}>{formatUSD(pos.size_usd, 0)}</td>
                      <td className="py-2 px-3 tnum" style={{ color: "var(--color-muted)" }}>{pos.leverage}x</td>
                      <td className="py-2 px-3 tnum" style={{ color: "var(--color-muted)" }}>
                        {pos.entry_px.toFixed(isBtc ? 0 : 3)}
                      </td>
                      <td className="py-2 px-3 tnum" style={{ color: "var(--color-ink)" }}>
                        {prices?.find((p) => p.market === pos.market)?.price.toFixed(isBtc ? 0 : 3) ?? "—"}
                      </td>
                      <td className="py-2 px-3 tnum font-semibold" style={{ color: (pos.upnl ?? 0) >= 0 ? "var(--color-green)" : "var(--color-red)" }}>
                        {(pos.upnl ?? 0) >= 0 ? "+" : ""}{formatUSD(pos.upnl ?? 0, 0)}
                      </td>
                      <td className="py-2 px-3">
                        <button
                          onClick={() => closePosition(pos.id)}
                          disabled={closingId === pos.id}
                          className="flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-colors"
                          style={{ border: "1px solid var(--color-line)", color: "var(--color-muted)" }}
                        >
                          <X size={10} />
                          {closingId === pos.id ? "Closing…" : "Close"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          )}
          {posTab !== "positions" && (
            <div className="flex items-center justify-center h-full">
              <p className="text-xs" style={{ color: "var(--color-faint)" }}>No {posTab} data</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Live Ticker Bar ── */}
      <TickerBar prices={prices} />
    </div>
  );
}
