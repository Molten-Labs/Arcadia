"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useWalletCompat } from "@/lib/use-wallet-compat";
import dynamic from "next/dynamic";
import { Activity, ChevronDown, Maximize2, Search, Shield, X } from "lucide-react";

import { TerminalOrderForm } from "@/components/pages/trader/TerminalOrderForm";
import type { Direction, OrderType } from "@/components/pages/trader/terminal-types";
import { useFlashTradePrices } from "@/lib/use-flash-trade-prices";
import { usePhoenixMarketData } from "@/lib/use-phoenix-market-data";
import { useFlashExecution } from "@/lib/use-flash-execution";
import { useArcadiaVault } from "@/lib/use-arcadia-vault";
import { useMe } from "@/lib/hooks";
import { formatUSD } from "@/lib/types";
import type { PositionMarker } from "@/components/TvChart";
import type { FlashPosition } from "@/lib/use-flash-execution";

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
  sig?: string;
}

const MARKETS = ["SOL/USD", "BTC/USD", "ETH/USD"];
const INTERVALS = ["1m", "5m", "15m", "1H", "4H", "1D"];

function fmtCompact(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function fmtNum(v: string | undefined, dp = 2): number {
  const n = parseFloat(v ?? "");
  return Number.isFinite(n) ? n : 0;
}

interface LivePosition {
  mt_id: string;
  market: string;
  direction: "long" | "short";
  size_usd: number;
  leverage: number;
  entry_px: number;
  opened_at: number;
  upnl: number;
  liq: number;
}

function mapLivePosition(p: FlashPosition): LivePosition {
  return {
    mt_id: p.venuePositionKey,
    market: `${p.marketSymbol}/USD`,
    direction: p.sideUi.toLowerCase() === "short" ? "short" : "long",
    size_usd: fmtNum(p.sizeUsdUi),
    leverage: fmtNum(p.leverageUi),
    entry_px: fmtNum(p.entryPriceUi),
    opened_at: Math.floor(Date.now() / 1000),
    upnl: fmtNum(p.pnlWithFeeUsdUi),
    liq: fmtNum(p.liquidationPriceUi),
  };
}

function TerminalContent() {
  const { connected, publicKey } = useWalletCompat();
  const searchParams = useSearchParams();
  const { getPrice } = useFlashTradePrices();
  const { recordTrade } = useArcadiaVault();
  const { data: me } = useMe();

  const [market, setMarket] = useState("SOL/USD");
  const [direction, setDirection] = useState<Direction>("long");
  const [orderType, setOrderType] = useState<OrderType>("Market");
  const [sizeUSD, setSizeUSD] = useState("100");
  const [leverage, setLeverage] = useState(2);
  const [closedTrades, setClosedTrades] = useState<ClosedTrade[]>([]);
  const [bottomTab, setBottomTab] = useState<BottomTab>("positions");
  const [interval, setInterval_] = useState("15m");
  const [marketOpen, setMarketOpen] = useState(false);
  const [showDuel, setShowDuel] = useState(false);

  const [depositOpen, setDepositOpen] = useState(
    () => searchParams.get("deposit") === "1",
  );
  const [depositClose, setDepositClose] = useState(false);
  const [depositAmt, setDepositAmt] = useState("1000");
  const [depositPhase, setDepositPhase] = useState<"idle" | "pending" | "done">("idle");
  const depositRef = useRef<HTMLDivElement>(null);

  const symbol = market.replace("/USD", "");

  // Real market data (Phoenix: order book, candles, funding, mark, tape).
  const phoenix = usePhoenixMarketData(symbol, interval);
  // Real Flash execution (sidecar proxy).
  const { seed, setSeed, status: execStatus, position, open, close, refresh } = useFlashExecution();

  const ftPrice = getPrice(symbol);
  const markPrice = phoenix.snapshot?.markPrice ?? phoenix.snapshot?.lastPrice ?? ftPrice?.priceUi;
  const currentPrice = phoenix.snapshot?.lastPrice ?? markPrice ?? ftPrice?.priceUi;
  const snap = phoenix.snapshot;
  const changePct = snap?.changePct24h ?? 0;
  const volume24h = snap?.volumeQuote24h ?? 0;
  const high24h = snap?.high24h;
  const low24h = snap?.low24h;
  const fundingRate = snap?.fundingRatePercent ?? 0;

  // Live Flash position → display row (one position per account/market).
  const livePosition = useMemo<LivePosition | null>(
    () => (position ? mapLivePosition(position) : null),
    [position],
  );

  const liveMarker: PositionMarker | null = livePosition
    ? {
        id: livePosition.mt_id,
        direction: livePosition.direction,
        entry_px: livePosition.entry_px,
        size_usd: livePosition.size_usd,
        leverage: livePosition.leverage,
      }
    : null;

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
    void open(market, direction, parseFloat(depositAmt) || 100).then((r) => {
      setDepositPhase(r.ok ? "done" : "idle");
    });
    setTimeout(() => {
      setDepositOpen(false);
      setDepositClose(false);
    }, 250);
  }, [open, market, direction, depositAmt]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (depositRef.current && !depositRef.current.contains(e.target as Node)) {
        closeDeposit();
      }
    }
    if (depositOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [depositOpen, closeDeposit]);

  // Real open: send to the Flash sidecar, then pull the on-chain position.
  const openPosition = useCallback(async () => {
    const r = await open(market, direction, parseFloat(sizeUSD) || 100);
    if (r.ok) await refresh(market, direction);
  }, [open, refresh, market, direction, sizeUSD]);

  // Real close: close on-chain via the sidecar, then record the realized trade.
  const closePosition = useCallback(
    async (id: string) => {
      if (!livePosition || livePosition.mt_id !== id) return;
      const side = livePosition.direction;
      const exitPx = currentPrice ?? livePosition.entry_px;
      const fees = livePosition.size_usd * 0.0002;

      const r = await close(market, side);
      if (!r.ok) return;

      const pnl = livePosition.upnl ?? 0;
      const trade: ClosedTrade = {
        id: `trade-${Date.now()}`,
        market: `${symbol}/USD`,
        direction: side,
        size_usd: livePosition.size_usd,
        leverage: livePosition.leverage,
        entry_px: livePosition.entry_px,
        exit_px: exitPx,
        realized_pnl: pnl - fees,
        fees_usd: fees,
        opened_at: livePosition.opened_at,
        closed_at: Math.floor(Date.now() / 1000),
        was_liquidated: false,
        sig: r.signature,
      };
      setClosedTrades((prev) => [trade, ...prev.slice(0, 49)]);

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
          wasLiquidated: trade.was_liquidated,
          openedAt: trade.opened_at,
          closedAt: trade.closed_at,
        }).catch(() => {});
      }
    },
    [livePosition, currentPrice, symbol, market, close, publicKey, recordTrade, me],
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
            <span
              className="rounded border border-acid/20 bg-acid/10 px-1.5 py-0.5 text-[10px] font-black text-acid"
              title="Real venue feed"
            >
              {phoenix.status === "live" ? "LIVE" : phoenix.status === "stale" ? "STALE" : "…"}
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
        {currentPrice != null && (
          <div className="flex shrink-0 items-center gap-3 border-r border-line px-4">
            <span
              className="text-[19px] font-black tabular-nums leading-none"
              style={{ color: isLong ? "var(--color-success)" : "var(--color-danger)" }}
            >
              {currentPrice.toFixed(2)}
            </span>
            <div className="flex flex-col gap-0.5">
              <div className="flex text-[10px] tabular-nums text-muted gap-2">
                <span>24h H <span className="text-ink">{high24h != null ? high24h.toFixed(2) : "—"}</span></span>
                <span>24h L <span className="text-ink">{low24h != null ? low24h.toFixed(2) : "—"}</span></span>
              </div>
              <div className="flex text-[10px] tabular-nums gap-3">
                <span style={{ color: changePct >= 0 ? "var(--color-success)" : "var(--color-danger)" }}>
                  24h Chg {changePct >= 0 ? "+" : ""}{changePct.toFixed(2)}%
                </span>
                <span className="text-muted">Vol {fmtCompact(volume24h)}</span>
              </div>
            </div>
          </div>
        )}

        <div className="flex-1" />

        {/* Real funding rate */}
        <div className="flex shrink-0 items-center gap-3 border-l border-line px-3">
          <div className="text-[10px] tabular-nums">
            <span className="text-faint">Funding</span>
            <span className="ml-1 text-ink">
              {fundingRate >= 0 ? "+" : ""}{fundingRate.toFixed(4)}%
            </span>
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
            Long
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
            Short
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
          className="flex h-6 w-7 items-center justify-center rounded hover:bg-panel-2"
          aria-label="Fullscreen chart"
        >
          <Maximize2 size={11} className="text-faint" />
        </button>
        <div className="flex-1" />
      </div>

      {/* ── Main row ───────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* Chart */}
        <div className="relative min-w-0 flex-1 overflow-hidden">
          <TvChart
            market={market}
            currentPrice={currentPrice}
            fullHeight
            externalCandles={phoenix.candles}
            positions={liveMarker ? [liveMarker] : []}
          />
          <div className="pointer-events-none absolute top-3 left-3 select-none" style={{ opacity: 0.35 }}>
            <p className="text-xs font-black text-ink">{symbol} / US DOLLAR</p>
            <p className="text-[10px] text-ink">Phoenix mark · live</p>
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
            onSubmit={() => void openPosition()}
            submitting={execStatus === "connecting"}
            connected={connected}
            market={market}
            openDeposit={openDeposit}
            seed={seed}
            setSeed={setSeed}
            execStatus={execStatus}
          />
        </div>
      </div>

      {/* ── Bottom panel ───────────────────────────────────────────── */}
      <div
        className="flex shrink-0 flex-col border-t border-line bg-panel"
        style={{ height: 190 }}
      >
        <div className="flex h-8 shrink-0 items-center border-b border-line">
          {(["positions", "history", "orders"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setBottomTab(t)}
              className="h-full px-4 text-[11px] font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none"
              style={{
                color: bottomTab === t ? "var(--color-ink)" : "var(--color-faint)",
                borderBottom: bottomTab === t ? "2px solid var(--color-acid)" : "2px solid transparent",
              }}
            >
              {t === "positions"
                ? `Positions (${livePosition ? 1 : 0})`
                : t === "history"
                  ? `Trade History (${closedTrades.length})`
                  : "Open Orders (0)"}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 pr-3">
            {livePosition && bottomTab === "positions" && (
              <button
                type="button"
                onClick={() => void closePosition(livePosition.mt_id)}
                className="rounded border border-line px-2 py-0.5 text-[10px] font-semibold text-danger transition-colors hover:opacity-80 active:scale-95 motion-reduce:transition-none motion-reduce:transform-none"
              >
                Close Position
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {bottomTab === "positions" &&
            (!livePosition ? (
              <div className="flex h-full flex-col items-center justify-center gap-1.5">
                <Activity size={18} className="text-faint opacity-50" />
                <p className="text-xs text-faint">
                  {execStatus === "no-seed"
                    ? "Paste a Flash devnet seed to open a real position"
                    : "No open position"}
                </p>
              </div>
            ) : (
              <PositionTable position={livePosition} currentPrice={currentPrice} onClose={() => void closePosition(livePosition.mt_id)} />
            ))}

          {bottomTab === "history" &&
            (closedTrades.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-1.5">
                <Activity size={18} className="text-faint opacity-50" />
                <p className="text-xs text-faint">No closed trades this session. Close a real position to see it here.</p>
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

function PositionTable({
  position,
  currentPrice,
  onClose,
}: {
  position: LivePosition;
  currentPrice: number | undefined;
  onClose: () => void;
}) {
  return (
    <table className="w-full text-xs">
      <thead className="sticky top-0 bg-panel">
        <tr className="border-b border-line">
          {["Market", "Side", "Size", "Collateral", "PnL Excl. fees", "Entry Price", "Mark Price", "Liq Price", "Actions"].map(
            (h) => (
              <th key={h} className="px-3 py-1.5 text-left text-[10px] font-medium text-faint">{h}</th>
            ),
          )}
        </tr>
      </thead>
      <tbody>
        <tr className="border-b border-line transition-colors hover:bg-panel-2 motion-reduce:transition-none">
          <td className="px-3 py-2 font-semibold text-ink">{position.market}</td>
          <td className="px-3 py-2">
            <span
              className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase"
              style={{
                background: position.direction === "long"
                  ? "color-mix(in srgb, var(--color-success) 12%, transparent)"
                  : "color-mix(in srgb, var(--color-danger) 12%, transparent)",
                color: position.direction === "long" ? "var(--color-success)" : "var(--color-danger)",
              }}
            >
              {position.direction}
            </span>
          </td>
          <td className="px-3 py-2 tabular-nums text-muted">{formatUSD(position.size_usd, 0)}</td>
          <td className="px-3 py-2 tabular-nums text-muted">{formatUSD(position.size_usd / Math.max(position.leverage, 1), 0)}</td>
          <td
            className="px-3 py-2 font-semibold tabular-nums"
            style={{ color: (position.upnl ?? 0) >= 0 ? "var(--color-success)" : "var(--color-danger)" }}
          >
            {(position.upnl ?? 0) >= 0 ? "+" : ""}{formatUSD(position.upnl ?? 0, 0)}
          </td>
          <td className="px-3 py-2 tabular-nums text-muted">{position.entry_px.toFixed(2)}</td>
          <td className="px-3 py-2 tabular-nums text-ink">{currentPrice?.toFixed(2) ?? "—"}</td>
          <td className="px-3 py-2 text-[10px] tabular-nums text-danger">{position.liq > 0 ? position.liq.toFixed(2) : "—"}</td>
          <td className="px-3 py-2">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1 rounded border border-line px-2 py-1 text-[10px] font-semibold transition-colors hover:bg-panel active:scale-95 motion-reduce:transition-none motion-reduce:transform-none"
              style={{ color: "var(--color-danger)" }}
            >
              <X size={9} />
              Close
            </button>
          </td>
        </tr>
      </tbody>
    </table>
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