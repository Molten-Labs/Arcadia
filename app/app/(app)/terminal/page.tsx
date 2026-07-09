"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import {
  Activity,
  BarChart2,
  BookOpen,
  ChevronDown,
  Circle,
  Crosshair,
  Maximize2,
  Square,
  TrendingDown,
  TrendingUp,
  Triangle,
  X,
  Zap,
} from "lucide-react";

import { TextSwap } from "@/components/TextSwap";
import { TerminalFundingPanel } from "@/components/pages/trader/TerminalFundingPanel";
import { TerminalOrderBook } from "@/components/pages/trader/TerminalOrderBook";
import { TerminalOrderForm } from "@/components/pages/trader/TerminalOrderForm";
import { TerminalTickerBar } from "@/components/pages/trader/TerminalTickerBar";
import type { Direction, OrderType } from "@/components/pages/trader/terminal-types";
import { PhoenixProvider, usePhoenix } from "@/lib/phoenix-context";
import { formatUSD } from "@/lib/types";
import type { OpenPosition } from "@/lib/types";

const TvChart = dynamic(() => import("@/components/TvChart").then((m) => m.TvChart), {
  ssr: false,
});

type BottomTab = "positions" | "orders" | "history" | "funding";

const MARKETS = ["BTC-PERP", "SOL-PERP", "ETH-PERP", "ARB-PERP"];
const INTERVALS = ["1m", "5m", "15m", "1H", "4H", "1D"];
const CHART_TOOLS = [Crosshair, BarChart2, TrendingUp, Circle, Square, Triangle, BookOpen];

function fmtCompact(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function TerminalContent() {
  const { connected } = useWallet();
  const searchParams = useSearchParams();
  const phoenix = usePhoenix();

  const [market, setMarket] = useState("SOL-PERP");
  const [direction, setDirection] = useState<Direction>("long");
  const [orderType, setOrderType] = useState<OrderType>("Market");
  const [sizeUSD, setSizeUSD] = useState("1000");
  const [leverage, setLeverage] = useState(5);
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [bottomTab, setBottomTab] = useState<BottomTab>("positions");
  const [interval, setInterval_] = useState("15m");
  const [marketOpen, setMarketOpen] = useState(false);
  const [indicator, setIndicator] = useState(false);
  // Auto-open the deposit drawer on mount when ?deposit=1 is in the URL.
  const [depositOpen, setDepositOpen] = useState(
    () => searchParams.get("deposit") === "1",
  );
  const [depositClose, setDepositClose] = useState(false);
  const [depositAmt, setDepositAmt] = useState("1000");
  const [depositPhase, setDepositPhase] = useState<"idle" | "pending" | "done">("idle");
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
  // Depend on the stable callbacks, never the context object itself: the
  // provider re-creates its value on every WS message, so listing `phoenix`
  // here refires this effect per tick and stampedes the REST API into 429s.
  const { seedCandles, fetchMarketConfig } = phoenix;
  useEffect(() => {
    seedCandles(symbol, phoenixInterval);
    fetchMarketConfig(symbol);
  }, [symbol, phoenixInterval, seedCandles, fetchMarketConfig]);

  const phoenixCandles = phoenix.candles[symbol] ?? [];

  const openDeposit = useCallback(() => {
    setDepositClose(false);
    setDepositPhase("idle");
    setDepositOpen(true);
  }, []);

  const closeDeposit = useCallback(() => {
    setDepositClose(true);
    setTimeout(() => {
      setDepositOpen(false);
      setDepositClose(false);
    }, 150);
  }, []);

  const confirmDeposit = useCallback(() => {
    setDepositPhase("pending");
    setTimeout(() => setDepositPhase("done"), 1400);
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
  }, [depositOpen, closeDeposit]);

  const coinName = market.replace("-PERP", "");
  const isBtc = market === "BTC-PERP";
  const dp = isBtc ? 1 : 3;

  useEffect(() => {
    const t = setInterval(() => {
      setPositions((prev) =>
        prev.map((pos) => {
          const stats = phoenix.marketStats[pos.market.replace("-PERP", "")];
          const px = stats?.markPx ?? pos.entry_px;
          const upnl =
            pos.direction === "long"
              ? (pos.size_usd * pos.leverage * (px - pos.entry_px)) / pos.entry_px
              : (pos.size_usd * pos.leverage * (pos.entry_px - px)) / pos.entry_px;
          return { ...pos, upnl };
        }),
      );
    }, 2000);
    return () => clearInterval(t);
  }, [phoenix.marketStats]);

  const openPosition = useCallback(() => {
    if (!connected || !currentPrice) return;
    setSubmitting(true);
    setTimeout(() => {
      setPositions((prev) => [
        {
          id: Math.random().toString(36).slice(2, 10),
          market,
          direction,
          size_usd: parseFloat(sizeUSD) || 1000,
          leverage,
          entry_px: currentPrice,
          opened_at: Math.floor(Date.now() / 1000),
          upnl: 0,
        },
        ...prev,
      ]);
      setSubmitting(false);
    }, 700);
  }, [connected, currentPrice, market, direction, sizeUSD, leverage]);

  const closePosition = (id: string) => {
    setClosingId(id);
    setTimeout(() => {
      setPositions((p) => p.filter((x) => x.id !== id));
      setClosingId(null);
    }, 1000);
  };

  const spreadBps =
    currentPrice && oraclePrice ? ((currentPrice - oraclePrice) / oraclePrice) * 10000 : null;

  return (
    <div
      className="flex flex-col overflow-hidden bg-void"
      style={{ height: "calc(100vh - 48px)" }}
    >
      {/* ── Market header bar ─────────────────────────────────────── */}
      <div className="flex h-11 shrink-0 items-center overflow-x-auto border-b border-line bg-panel">
        {/* Market selector */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMarketOpen(!marketOpen)}
            className="flex h-11 items-center gap-2 border-r border-line px-3 text-sm font-bold text-ink"
          >
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-acid text-[10px] font-black text-void">
              {coinName.slice(0, 1)}
            </span>
            <span>{coinName}/USD</span>
            <span className="ml-1 rounded border border-acid/20 bg-acid/10 px-1.5 py-0.5 text-[10px] text-acid">
              PERP
            </span>
            <ChevronDown size={12} className="text-faint" />
          </button>
          {marketOpen && (
            <div
              className="absolute top-full left-0 z-50 rounded-lg border border-line bg-panel-2 py-1 shadow-2xl"
              style={{ minWidth: 160 }}
            >
              {MARKETS.map((m) => {
                const active = m === market;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMarket(m);
                      setMarketOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-panel"
                    style={{ color: active ? "var(--color-acid)" : "var(--color-muted)" }}
                  >
                    <span
                      className="flex size-5 shrink-0 items-center justify-center rounded-full border border-line text-[9px] font-black"
                      style={{
                        background: active ? "var(--color-acid)" : "var(--color-panel-2)",
                        color: active ? "var(--color-void)" : "var(--color-muted)",
                      }}
                    >
                      {m.slice(0, 1)}
                    </span>
                    {m.replace("-PERP", "")}/USD
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Price */}
        {currentPrice && (
          <div className="flex shrink-0 items-center gap-2.5 border-r border-line px-4">
            <span
              className="text-[17px] font-black tabular-nums"
              style={{ color: changePct >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
            >
              {isBtc ? currentPrice.toFixed(0) : currentPrice.toFixed(dp)}
            </span>
            <div className="flex items-center gap-0.5">
              {changePct >= 0 ? (
                <TrendingUp size={10} style={{ color: "var(--color-success)" }} />
              ) : (
                <TrendingDown size={10} style={{ color: "var(--color-danger)" }} />
              )}
              <span
                className="text-[11px] font-bold tabular-nums"
                style={{ color: changePct >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
              >
                {changePct >= 0 ? "+" : ""}
                {changePct.toFixed(2)}%
              </span>
            </div>
          </div>
        )}

        {/* Market stats */}
        {[
          { label: "Oracle Price", value: oraclePrice ? oraclePrice.toFixed(dp) : "—" },
          { label: "24h Volume", value: dayNtlVlm > 0 ? fmtCompact(dayNtlVlm) : "—" },
          { label: "Open Interest", value: openInterest > 0 ? fmtCompact(openInterest) : "—" },
          {
            label: "Spread (M/O)",
            value: spreadBps !== null ? `${spreadBps.toFixed(2)} bps` : "—",
            color:
              spreadBps !== null
                ? Math.abs(spreadBps) > 5
                  ? "var(--color-tier-advanced)"
                  : "var(--color-success)"
                : undefined,
          },
          {
            label: "Funding Rate",
            value: fundingRate
              ? `${fundingRate.funding >= 0 ? "+" : ""}${(fundingRate.funding * 100).toFixed(4)}%`
              : "—",
            color: fundingRate
              ? fundingRate.funding >= 0
                ? "var(--color-success)"
                : "var(--color-danger)"
              : undefined,
          },
          {
            label: "Connected",
            value: phoenix.connected ? "LIVE" : "Reconnecting…",
            color: phoenix.connected ? "var(--color-success)" : "var(--color-tier-advanced)",
          },
        ].map(({ label, value, color }) => (
          <div
            key={label}
            className="flex h-full shrink-0 flex-col justify-center border-r border-line px-4"
          >
            <span className="text-[9px] font-medium text-faint">{label}</span>
            <span
              className="text-[11px] font-bold tabular-nums"
              style={{ color: color ?? "var(--color-ink)" }}
            >
              {value}
            </span>
          </div>
        ))}

        <div className="flex-1" />

        {/* Right quick actions */}
        <div
          ref={depositRef}
          className="relative flex h-full shrink-0 items-center gap-1 border-l border-line px-2"
        >
          <button
            type="button"
            onClick={() => (depositOpen ? closeDeposit() : openDeposit())}
            className="flex h-7 items-center gap-1 rounded bg-acid px-3 text-[10px] font-black text-void transition-all hover:opacity-90 active:scale-95 motion-reduce:transform-none"
            style={
              depositOpen
                ? { boxShadow: "0 0 0 2px color-mix(in srgb, var(--color-acid) 35%, transparent)" }
                : undefined
            }
          >
            <Zap size={11} />
            Deposit
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
              boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
              zIndex: 100,
              overflow: "hidden",
            }}
          >
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <div className="flex items-center gap-2">
                <Zap size={12} className="text-acid" />
                <span className="text-xs font-bold text-ink">Deposit USDC</span>
              </div>
              <button
                type="button"
                onClick={closeDeposit}
                className="flex size-5 items-center justify-center rounded transition-colors hover:bg-panel-2"
                aria-label="Close deposit panel"
              >
                <X size={11} className="text-faint" />
              </button>
            </div>

            <div className="space-y-4 px-4 py-4">
              {depositPhase === "done" ? (
                <div className="flex flex-col items-center gap-3 py-4">
                  <div className="flex size-10 items-center justify-center rounded-full border border-success/30 bg-success/10">
                    <span className="text-lg text-success">✓</span>
                  </div>
                  <div className="text-center">
                    <p className="text-xs font-bold text-success">Deposit confirmed</p>
                    <p className="mt-0.5 text-[10px] text-faint">
                      +${Number(depositAmt).toLocaleString()} USDC · Devnet simulation
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDepositPhase("idle");
                      closeDeposit();
                    }}
                    className="rounded border border-line bg-panel-2 px-3 py-1 text-[10px] font-semibold text-muted transition-colors"
                  >
                    Close
                  </button>
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-[10px] font-bold tracking-widest text-faint uppercase">
                      Amount
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        value={depositAmt}
                        onChange={(e) => setDepositAmt(e.target.value)}
                        className="w-full rounded-lg border border-line bg-panel-2 px-3 py-2.5 pr-14 text-sm font-bold text-ink outline-none focus-visible:border-acid focus-visible:ring-2 focus-visible:ring-acid/30"
                        aria-label="Deposit amount"
                      />
                      <span className="absolute top-1/2 right-3 -translate-y-1/2 rounded bg-acid/15 px-1.5 py-0.5 text-[10px] font-black text-acid">
                        USDC
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-1.5">
                    {["100", "500", "1000", "5000"].map((p) => {
                      const active = depositAmt === p;
                      return (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setDepositAmt(p)}
                          className="flex-1 rounded border py-1 text-[10px] font-bold transition-all active:scale-95 motion-reduce:transform-none"
                          style={{
                            background: active
                              ? "color-mix(in srgb, var(--color-acid) 12%, transparent)"
                              : "var(--color-panel-2)",
                            borderColor: active
                              ? "color-mix(in srgb, var(--color-acid) 30%, transparent)"
                              : "var(--color-line)",
                            color: active ? "var(--color-acid)" : "var(--color-faint)",
                          }}
                        >
                          {Number(p) >= 1000 ? `$${Number(p) / 1000}K` : `$${p}`}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-faint">Wallet balance</span>
                    <span className="text-[10px] font-bold tabular-nums text-ink">
                      $20,000.00 USDC
                    </span>
                  </div>

                  <div className="flex items-start gap-2 rounded-lg border border-acid/15 bg-acid/[0.06] px-3 py-2">
                    <Zap size={11} className="mt-0.5 shrink-0 text-acid" />
                    <p className="text-[10px] leading-relaxed text-muted">
                      Devnet simulation — no real funds transferred.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={confirmDeposit}
                    disabled={depositPhase === "pending" || !depositAmt || Number(depositAmt) <= 0}
                    className="w-full rounded-lg bg-acid py-2.5 text-xs font-black tracking-wide text-void transition-all active:scale-[0.98] disabled:opacity-50 motion-reduce:transform-none"
                    style={
                      depositPhase === "pending"
                        ? { background: "color-mix(in srgb, var(--color-acid) 45%, transparent)" }
                        : undefined
                    }
                  >
                    <TextSwap>
                      {depositPhase === "pending"
                        ? "Confirming…"
                        : `Deposit $${Number(depositAmt).toLocaleString()} USDC`}
                    </TextSwap>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Chart toolbar ─────────────────────────────────────────── */}
      <div className="flex h-8 shrink-0 items-center gap-1 overflow-x-auto border-b border-line bg-panel px-1">
        {INTERVALS.map((iv) => {
          const active = interval === iv;
          return (
            <button
              key={iv}
              type="button"
              onClick={() => setInterval_(iv)}
              className="h-6 rounded px-2 text-[10px] font-bold transition-colors active:scale-95 motion-reduce:transition-none motion-reduce:transform-none"
              style={{
                background: active ? "var(--color-panel-2)" : "transparent",
                color: active ? "var(--color-ink)" : "var(--color-faint)",
                border: active ? "1px solid var(--color-line)" : "1px solid transparent",
              }}
            >
              {iv}
            </button>
          );
        })}
        <div className="mx-1 h-4 w-px shrink-0 bg-line" />
        <button
          type="button"
          onClick={() => setIndicator(!indicator)}
          className="flex h-6 items-center gap-1.5 rounded px-2.5 text-[10px] font-semibold transition-colors"
          style={{
            background: indicator
              ? "color-mix(in srgb, var(--color-acid) 12%, transparent)"
              : "transparent",
            color: indicator ? "var(--color-acid)" : "var(--color-faint)",
            border: indicator
              ? "1px solid color-mix(in srgb, var(--color-acid) 25%, transparent)"
              : "1px solid transparent",
          }}
        >
          <Activity size={10} />
          Indicators
        </button>
        <div className="flex-1" />
        <button
          type="button"
          className="flex h-6 w-7 items-center justify-center rounded hover:bg-panel-2"
          aria-label="Fullscreen chart"
        >
          <Maximize2 size={11} className="text-faint" />
        </button>
      </div>

      {/* ── Main row ──────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Drawing tools sidebar */}
        <div className="flex w-9 shrink-0 flex-col items-center gap-0.5 border-r border-line bg-panel py-2">
          {CHART_TOOLS.map((Icon, i) => (
            <button
              key={i}
              type="button"
              className="flex size-7 items-center justify-center rounded transition-colors hover:bg-panel-2"
              aria-label="Chart tool"
            >
              <Icon size={12} className="text-faint" strokeWidth={1.5} />
            </button>
          ))}
        </div>

        {/* Chart */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <TvChart
            market={market}
            currentPrice={currentPrice}
            fullHeight
            externalCandles={phoenixCandles}
            positions={positions
              .filter((p) => p.market === market)
              .map((p) => ({
                id: p.id,
                direction: p.direction,
                entry_px: p.entry_px,
                size_usd: p.size_usd,
                leverage: p.leverage,
              }))}
          />
          <div className="pointer-events-none absolute top-3 left-3 select-none" style={{ opacity: 0.18 }}>
            <p className="text-sm font-black text-ink">{coinName}/USD · Perpetual</p>
          </div>
        </div>

        {/* Order book / Trades */}
        <div className="w-52 shrink-0 overflow-hidden">
          <TerminalOrderBook symbol={symbol} market={market} />
        </div>

        {/* Order form */}
        <div className="w-64 shrink-0 overflow-hidden">
          <TerminalOrderForm
            direction={direction}
            setDirection={setDirection}
            orderType={orderType}
            setOrderType={setOrderType}
            sizeUSD={sizeUSD}
            setSizeUSD={setSizeUSD}
            leverage={leverage}
            setLeverage={setLeverage}
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
        className="flex shrink-0 flex-col border-t border-line bg-panel"
        style={{ height: 190 }}
      >
        <div className="flex h-8 shrink-0 items-center border-b border-line">
          {(
            [
              ["positions", `Positions (${positions.length})`],
              ["orders", "Open Orders (0)"],
              ["history", "Trade History"],
              ["funding", "Funding History"],
            ] as const
          ).map(([t, label]) => {
            const active = bottomTab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setBottomTab(t)}
                className="h-full px-4 text-[11px] font-semibold whitespace-nowrap transition-colors"
                style={{
                  color: active ? "var(--color-ink)" : "var(--color-faint)",
                  borderBottom: active ? "2px solid var(--color-acid)" : "2px solid transparent",
                }}
              >
                {label}
              </button>
            );
          })}
          <div className="ml-auto flex items-center gap-2 pr-3">
            <span className="rounded border border-acid/20 bg-acid/10 px-2 py-0.5 text-[9px] font-bold text-acid">
              Paper trading
            </span>
            {positions.length > 0 && bottomTab === "positions" && (
              <button
                type="button"
                onClick={() => setPositions([])}
                className="rounded border border-line px-2 py-0.5 text-[10px] font-semibold text-danger transition-colors hover:opacity-80 active:scale-95 motion-reduce:transform-none"
              >
                Close All
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {bottomTab === "positions" &&
            (positions.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-1.5">
                <Activity size={18} className="text-faint opacity-50" />
                <p className="text-xs text-faint">No open positions</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-panel">
                  <tr className="border-b border-line">
                    {["Market", "Side", "Size", "Lev.", "Entry", "Mark", "Liq.", "uPnL", ""].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-3 py-1.5 text-left text-[10px] font-medium text-faint"
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => {
                    const posPhoenix = phoenix.marketStats[pos.market.replace("-PERP", "")];
                    const markPx = posPhoenix?.markPx;
                    const posLiq =
                      pos.entry_px -
                      (pos.entry_px / pos.leverage) * 0.88 * (pos.direction === "long" ? 1 : -1);
                    const isLong = pos.direction === "long";
                    const up = (pos.upnl ?? 0) >= 0;
                    return (
                      <tr key={pos.id} className="border-b border-line transition-colors hover:bg-panel-2">
                        <td className="px-3 py-2 font-semibold text-ink">{pos.market}</td>
                        <td className="px-3 py-2">
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                            style={{
                              background: isLong
                                ? "color-mix(in srgb, var(--color-success) 12%, transparent)"
                                : "color-mix(in srgb, var(--color-danger) 12%, transparent)",
                              color: isLong ? "var(--color-success)" : "var(--color-danger)",
                            }}
                          >
                            {pos.direction}
                          </span>
                        </td>
                        <td className="px-3 py-2 tabular-nums text-muted">
                          {formatUSD(pos.size_usd, 0)}
                        </td>
                        <td className="px-3 py-2 font-semibold tabular-nums text-acid">
                          {pos.leverage}x
                        </td>
                        <td className="px-3 py-2 tabular-nums text-muted">
                          {pos.entry_px.toFixed(dp)}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-ink">
                          {markPx?.toFixed(dp) ?? "—"}
                        </td>
                        <td
                          className="px-3 py-2 text-[10px] tabular-nums"
                          style={{ color: "var(--color-danger)" }}
                        >
                          {posLiq.toFixed(dp)}
                        </td>
                        <td
                          className="px-3 py-2 font-semibold tabular-nums"
                          style={{ color: up ? "var(--color-success)" : "var(--color-danger)" }}
                        >
                          {up ? "+" : ""}
                          {formatUSD(pos.upnl ?? 0, 0)}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => closePosition(pos.id)}
                            disabled={closingId === pos.id}
                            className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[10px] font-semibold transition-colors hover:bg-panel active:scale-95 motion-reduce:transform-none"
                            style={{
                              color:
                                closingId === pos.id ? "var(--color-faint)" : "var(--color-danger)",
                            }}
                          >
                            <X size={9} />
                            {closingId === pos.id ? "…" : "Close"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ))}
          {bottomTab === "funding" && <TerminalFundingPanel symbol={symbol} />}
          {(bottomTab === "orders" || bottomTab === "history") && (
            <div className="flex h-full flex-col items-center justify-center gap-1.5">
              <Activity size={18} className="text-faint opacity-50" />
              <p className="text-xs text-faint">No {bottomTab} data</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Live ticker bar ───────────────────────────────────────── */}
      <TerminalTickerBar marketStats={phoenix.marketStats} />
    </div>
  );
}

export default function TerminalPage() {
  return (
    // PhoenixProvider is route-scoped: the market-data WebSocket only opens
    // while the terminal is mounted, and closes on navigation away.
    <PhoenixProvider>
      <Suspense fallback={<div className="h-screen w-full bg-void" />}>
        <TerminalContent />
      </Suspense>
    </PhoenixProvider>
  );
}
