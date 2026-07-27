"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWalletCompat } from "@/lib/use-wallet-compat";
import dynamic from "next/dynamic";
import {
  Activity,
  ChevronDown,
  Maximize2,
  Search,
  Shield,
  X,
  Zap,
} from "lucide-react";

import { TerminalOrderForm } from "@/components/pages/trader/TerminalOrderForm";
import type { Direction, OrderType } from "@/components/pages/trader/terminal-types";
import { useFlashTradePrices } from "@/lib/use-flash-trade-prices";
import { useArcadiaVault } from "@/lib/use-arcadia-vault";
import { useMe } from "@/lib/hooks";
import { formatUSD } from "@/lib/types";
import type { OpenPosition } from "@/lib/types";

const TvChart = dynamic(() => import("@/components/TvChart").then((m) => m.TvChart), {
  ssr: false,
});

type BottomTab = "positions" | "orders" | "history";

interface ClosedTrade {
  id: string;
  market: string;
  direction: "long" | "short";
  size_usd: number;
  leverage: number;
  entry_px: number;
  exit_px: number;
  realized_pnl: number;
  fees_usd: number;
  opened_at: number;
  closed_at: number;
  was_liquidated: boolean;
}

const POSITIONS_KEY = "arcadia_positions";
const TRADES_KEY = "arcadia_closed_trades";

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch { return fallback; }
}

function saveToStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

const MARKETS = ["SOL/USD", "BTC/USD", "ETH/USD", "ARB/USD"];
const INTERVALS = ["1m", "5m", "15m", "1H", "4H", "1D"];

function fmtCompact(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function TerminalContent() {
  const { connected, publicKey } = useWalletCompat();
  const searchParams = useSearchParams();
  const { getPrice, prices } = useFlashTradePrices();
  const { recordTrade } = useArcadiaVault();
  const { data: me } = useMe();

  const [market, setMarket] = useState("SOL/USD");
  const [direction, setDirection] = useState<Direction>("long");
  const [orderType, setOrderType] = useState<OrderType>("Market");
  const [sizeUSD, setSizeUSD] = useState("100");
  const [leverage, setLeverage] = useState(2);
  const [positions, setPositions] = useState<OpenPosition[]>(() => loadFromStorage<OpenPosition[]>(POSITIONS_KEY, []));
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>(() => loadFromStorage<ClosedTrade[]>(TRADES_KEY, []));
  const [closingId, setClosingId] = useState<string | null>(null);
  const [bottomTab, setBottomTab] = useState<BottomTab>("positions");
  const [interval, setInterval_] = useState("15m");
  const [marketOpen, setMarketOpen] = useState(false);
  const [indicator, setIndicator] = useState(false);
  const [showDuel, setShowDuel] = useState(false);

  const [depositOpen, setDepositOpen] = useState(
    () => searchParams.get("deposit") === "1",
  );
  const [depositClose, setDepositClose] = useState(false);
  const [depositAmt, setDepositAmt] = useState("1000");
  const [depositPhase, setDepositPhase] = useState<"idle" | "pending" | "done">("idle");
  const depositRef = useRef<HTMLDivElement>(null);

  const symbol = market.replace("/USD", "");
  const ftPrice = getPrice(symbol);
  const currentPrice = ftPrice?.priceUi;
  const changePct = 2.07;
  const volume24h = 2_160_000;

  const isLong = direction === "long";

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
    setTimeout(() => {
      setDepositPhase("idle");
      setDepositOpen(false);
    }, 200);
  }, []);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (depositRef.current && !depositRef.current.contains(e.target as Node)) {
        closeDeposit();
      }
    }
    if (depositOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [depositOpen, closeDeposit]);

  useEffect(() => { saveToStorage(POSITIONS_KEY, positions); }, [positions]);
  useEffect(() => { saveToStorage(TRADES_KEY, closedTrades); }, [closedTrades]);

  const totalMarginUsed = positions.reduce((sum, p) => sum + p.size_usd, 0);
  const totalUnrealizedPnL = positions.reduce((sum, p) => sum + (p.upnl ?? 0), 0);

  const openPosition = useCallback(() => {
    if (!connected || !currentPrice) return;
    setPositions((prev) => [
      {
        id: Math.random().toString(36).slice(2, 10),
        market,
        direction,
        size_usd: parseFloat(sizeUSD) || 100,
        leverage,
        entry_px: currentPrice,
        opened_at: Math.floor(Date.now() / 1000),
        upnl: 0,
      },
      ...prev,
    ]);
  }, [connected, currentPrice, market, direction, sizeUSD, leverage]);

  const closePosition = useCallback(
    (id: string) => {
      const pos = positions.find((p) => p.id === id);
      if (!pos) return;
      setClosingId(id);

      const exitPx = currentPrice ?? pos.entry_px;
      const pnl =
        pos.direction === "long"
          ? (pos.size_usd * pos.leverage * (exitPx - pos.entry_px)) / pos.entry_px
          : (pos.size_usd * pos.leverage * (pos.entry_px - exitPx)) / pos.entry_px;
      const fees = pos.size_usd * 0.0006;

      const trade: ClosedTrade = {
        id: `trade-${Date.now()}`,
        market: pos.market,
        direction: pos.direction,
        size_usd: pos.size_usd,
        leverage: pos.leverage,
        entry_px: pos.entry_px,
        exit_px: exitPx,
        realized_pnl: pnl - fees,
        fees_usd: fees,
        opened_at: pos.opened_at,
        closed_at: Math.floor(Date.now() / 1000),
        was_liquidated: false,
      };

      setPositions((p) => p.filter((x) => x.id !== id));
      setClosedTrades((prev) => [trade, ...prev.slice(0, 49)]);
      setClosingId(null);

      if (publicKey && recordTrade) {
        const profileAddr = me?.profile ?? publicKey.toBase58();
        recordTrade({
          profileAddress: profileAddr,
          market: trade.market,
          direction: trade.direction,
          sizeUsd: trade.size_usd,
          leverageX100: Math.round(trade.leverage * 100),
          entryPx: trade.entry_px,
          exitPx: trade.exit_px,
          feesUsd: trade.fees_usd,
          wasLiquidated: false,
          openedAt: trade.opened_at,
          closedAt: trade.closed_at,
        }).catch(() => {});
      }
    },
    [positions, publicKey, recordTrade, currentPrice],
  );

  return (
    <div
      className="flex flex-col overflow-hidden bg-void"
      style={{ height: "calc(100vh - 48px)" }}
    >
      {/* ── Top header ─────────────────────────────────────────────── */}
      <div className="flex h-11 shrink-0 items-center overflow-visible border-b border-line bg-panel">
        {/* Market selector */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMarketOpen(!marketOpen)}
            className="flex h-11 items-center gap-2 border-r border-line px-3 text-sm font-bold text-ink"
          >
            <Search size={13} className="text-faint" />
            <span>{symbol}/USD</span>
            <span className="rounded border border-acid/20 bg-acid/10 px-1.5 py-0.5 text-[10px] font-black text-acid">
              100x
            </span>
            <ChevronDown size={12} className="text-faint" />
          </button>
          {marketOpen && (
            <div
              role="listbox"
              className="absolute top-full left-0 z-50 rounded-lg border border-line bg-panel-2 py-1 shadow-2xl"
              style={{ minWidth: 160 }}
            >
              {MARKETS.map((m) => {
                const active = m === market;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMarket(m); setMarketOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-panel motion-reduce:transition-none"
                    style={{ color: active ? "var(--color-acid)" : "var(--color-muted)" }}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Current price */}
        {currentPrice && (
          <div className="flex shrink-0 items-center gap-3 border-r border-line px-4">
            <span
              className="text-[19px] font-black tabular-nums leading-none"
              style={{ color: isLong ? "var(--color-success)" : "var(--color-danger)" }}
            >
              {currentPrice.toFixed(2)}
            </span>
            <div className="flex flex-col gap-0.5">
              <div className="flex text-[10px] tabular-nums text-muted gap-2">
                <span>24h H <span className="text-ink">77.01</span></span>
                <span>24h L <span className="text-ink">74.71</span></span>
              </div>
              <div className="flex text-[10px] tabular-nums gap-3">
                <span style={{ color: "var(--color-success)" }}>
                  24h Chg +{changePct.toFixed(2)}%
                </span>
                <span className="text-muted">
                  24h Vol {fmtCompact(volume24h)}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* Margin / funding rate */}
        <div className="flex shrink-0 items-center gap-3 border-l border-line px-3">
          <div className="text-[10px] tabular-nums">
            <span className="text-faint">Margin/hr</span>
            <span className="ml-1 text-success">↑0.0004%</span>
            <span className="ml-1 text-danger">↓0.0005%</span>
          </div>
        </div>

        {/* Start Duel */}
        <button
          type="button"
          onClick={() => setShowDuel(!showDuel)}
          className="flex h-7 items-center gap-1.5 rounded bg-acid px-3 text-[10px] font-black text-void mr-2"
        >
          <Shield size={11} />
          Start Duel
        </button>

        {/* Long / Short toggle */}
        <div className="flex shrink-0 items-center gap-0 border-l border-line">
          <button
            type="button"
            onClick={() => setDirection("long")}
            className="flex h-11 items-center gap-1 px-3 text-[11px] font-bold transition-colors motion-reduce:transition-none"
            style={{
              background: isLong ? "color-mix(in srgb, var(--color-success) 10%, transparent)" : "transparent",
              color: isLong ? "var(--color-success)" : "var(--color-faint)",
              borderBottom: isLong ? "2px solid var(--color-success)" : "2px solid transparent",
            }}
          >
            <span className="text-sm">✔️</span> Long
          </button>
          <button
            type="button"
            onClick={() => setDirection("short")}
            className="flex h-11 items-center gap-1 px-3 text-[11px] font-bold transition-colors motion-reduce:transition-none"
            style={{
              background: !isLong ? "color-mix(in srgb, var(--color-danger) 10%, transparent)" : "transparent",
              color: !isLong ? "var(--color-danger)" : "var(--color-faint)",
              borderBottom: !isLong ? "2px solid var(--color-danger)" : "2px solid transparent",
            }}
          >
            Short <span className="text-xs text-faint">(gray)</span>
          </button>
        </div>
      </div>

      {/* ── Chart toolbar ──────────────────────────────────────────── */}
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
          className="flex h-6 items-center gap-1.5 rounded px-2.5 text-[10px] font-semibold transition-colors motion-reduce:transition-none"
          style={{
            background: indicator ? "color-mix(in srgb, var(--color-acid) 12%, transparent)" : "transparent",
            color: indicator ? "var(--color-acid)" : "var(--color-faint)",
            border: indicator ? "1px solid color-mix(in srgb, var(--color-acid) 25%, transparent)" : "1px solid transparent",
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

      {/* ── Main row ───────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Chart */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <TvChart
            market={market}
            currentPrice={currentPrice}
            fullHeight
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
            <p className="text-xs font-black text-ink">{symbol} / US DOLLAR · 1 · Pyth</p>
            <p className="text-[10px] text-ink">52W H/L close close</p>
          </div>
        </div>

        {/* Order form */}
        <div className="w-72 shrink-0 overflow-hidden">
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
            onSubmit={openPosition}
            submitting={false}
            connected={connected}
            market={market}
            openDeposit={openDeposit}
          />
        </div>
      </div>

      {/* ── Bottom panel ───────────────────────────────────────────── */}
      <div
        className="flex shrink-0 flex-col border-t border-line bg-panel"
        style={{ height: 190 }}
      >
        <div className="flex h-8 shrink-0 items-center border-b border-line">
          {(
            [
              ["positions", `Positions (${positions.length})`],
              ["history", `Trade History (${closedTrades.length})`],
              ["orders", "Open Orders (0)"],
            ] as const
          ).map(([t, label]) => {
            const active = bottomTab === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setBottomTab(t)}
                className="h-full px-4 text-[11px] font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none"
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
            {positions.length > 0 && bottomTab === "positions" && (
              <button
                type="button"
                onClick={() => setPositions([])}
                className="rounded border border-line px-2 py-0.5 text-[10px] font-semibold text-danger transition-colors hover:opacity-80 active:scale-95 motion-reduce:transition-none motion-reduce:transform-none"
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
                <p className="text-xs text-faint">No Positions</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-panel">
                  <tr className="border-b border-line">
                    {["Market", "Side", "Size", "Collateral", "PnL Excl. fees", "Entry Price", "Mark Price", "Liq Price", "SL/TP", "Actions"].map(
                      (h) => (
                        <th key={h} className="px-3 py-1.5 text-left text-[10px] font-medium text-faint">
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {positions.map((pos) => {
                    const isLongPos = pos.direction === "long";
                    const markPx = currentPrice;
                    const posLiq = pos.entry_px - (pos.entry_px / pos.leverage) * 0.88 * (isLongPos ? 1 : -1);
                    const up = (pos.upnl ?? 0) >= 0;
                    const collateral = pos.size_usd;
                    const pnlExclFees = pos.upnl ?? 0;
                    return (
                      <tr key={pos.id} className="border-b border-line transition-colors hover:bg-panel-2 motion-reduce:transition-none">
                        <td className="px-3 py-2 font-semibold text-ink">{pos.market}</td>
                        <td className="px-3 py-2">
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                            style={{
                              background: isLongPos
                                ? "color-mix(in srgb, var(--color-success) 12%, transparent)"
                                : "color-mix(in srgb, var(--color-danger) 12%, transparent)",
                              color: isLongPos ? "var(--color-success)" : "var(--color-danger)",
                            }}
                          >
                            {pos.direction}
                          </span>
                        </td>
                        <td className="px-3 py-2 tabular-nums text-muted">{formatUSD(pos.size_usd, 0)}</td>
                        <td className="px-3 py-2 tabular-nums text-muted">{formatUSD(collateral, 0)}</td>
                        <td
                          className="px-3 py-2 font-semibold tabular-nums"
                          style={{ color: pnlExclFees >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
                        >
                          {pnlExclFees >= 0 ? "+" : ""}{formatUSD(pnlExclFees, 0)}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-muted">{pos.entry_px.toFixed(2)}</td>
                        <td className="px-3 py-2 tabular-nums text-ink">{markPx?.toFixed(2) ?? "—"}</td>
                        <td className="px-3 py-2 text-[10px] tabular-nums text-danger">{posLiq.toFixed(2)}</td>
                        <td className="px-3 py-2 text-[10px] tabular-nums text-faint">—</td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => closePosition(pos.id)}
                            disabled={closingId === pos.id}
                            className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[10px] font-semibold transition-colors hover:bg-panel active:scale-95 motion-reduce:transition-none motion-reduce:transform-none"
                            style={{ color: closingId === pos.id ? "var(--color-faint)" : "var(--color-danger)" }}
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

          {bottomTab === "history" &&
            (closedTrades.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-1.5">
                <Activity size={18} className="text-faint opacity-50" />
                <p className="text-xs text-faint">No trade history yet. Open and close a position to see it here.</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-panel">
                  <tr className="border-b border-line">
                    {["Time", "Market", "Side", "Size", "Lev.", "Entry", "Exit", "PnL", "Fees"].map((h) => (
                      <th key={h} className="px-3 py-1.5 text-left text-[10px] font-medium text-faint">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {closedTrades.map((trade) => {
                    const profit = trade.realized_pnl >= 0;
                    return (
                      <tr key={trade.id} className="border-b border-line transition-colors hover:bg-panel-2 motion-reduce:transition-none">
                        <td className="px-3 py-2 text-[10px] tabular-nums text-muted">
                          {new Date(trade.closed_at * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="px-3 py-2 font-semibold text-ink">{trade.market}</td>
                        <td className="px-3 py-2">
                          <span
                            className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
                            style={{
                              background: trade.direction === "long"
                                ? "color-mix(in srgb, var(--color-success) 12%, transparent)"
                                : "color-mix(in srgb, var(--color-danger) 12%, transparent)",
                              color: trade.direction === "long" ? "var(--color-success)" : "var(--color-danger)",
                            }}
                          >
                            {trade.direction}
                          </span>
                        </td>
                        <td className="px-3 py-2 tabular-nums text-muted">{formatUSD(trade.size_usd, 0)}</td>
                        <td className="px-3 py-2 font-semibold tabular-nums text-acid">{trade.leverage}x</td>
                        <td className="px-3 py-2 tabular-nums text-muted">{trade.entry_px.toFixed(2)}</td>
                        <td className="px-3 py-2 tabular-nums text-ink">{trade.exit_px.toFixed(2)}</td>
                        <td className="px-3 py-2 font-semibold tabular-nums" style={{ color: profit ? "var(--color-success)" : "var(--color-danger)" }}>
                          {profit ? "+" : ""}{formatUSD(trade.realized_pnl, 0)}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-faint">{formatUSD(trade.fees_usd, 0)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ))}

          {bottomTab === "orders" && (
            <div className="flex h-full flex-col items-center justify-center gap-1.5">
              <Activity size={18} className="text-faint opacity-50" />
              <p className="text-xs text-faint">No orders data</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TerminalPageInner() {
  return (
    <div className="h-dvh w-full bg-void">
      <TerminalContent />
    </div>
  );
}

export default function TerminalPage() {
  return (
    <Suspense fallback={<div className="h-dvh w-full bg-void" />}>
      <TerminalPageInner />
    </Suspense>
  );
}
