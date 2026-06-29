"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import dynamic from "next/dynamic";
import { apiFetch } from "@/lib/utils";
import { formatUSD, pnlClass } from "@/lib/types";
import type { PriceData, OpenPosition } from "@/lib/types";

const TvChart = dynamic(() => import("@/components/TvChart").then((m) => m.TvChart), { ssr: false });

type Direction = "long" | "short";

export default function TradePage() {
  const { connected } = useWallet();
  const [market, setMarket] = useState("SOL-PERP");
  const [direction, setDirection] = useState<Direction>("long");
  const [sizeUSD, setSizeUSD] = useState("1000");
  const [leverage, setLeverage] = useState(3);
  const [positions, setPositions] = useState<OpenPosition[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);

  const { data: prices, refetch: refetchPrices } = useQuery<PriceData[]>({
    queryKey: ["prices"],
    queryFn: () => apiFetch("/prices"),
    refetchInterval: 3000,
  });

  const currentPrice = prices?.find((p) => p.market === market);

  useEffect(() => {
    const interval = setInterval(() => {
      setPositions((prev) =>
        prev.map((pos) => {
          const price = prices?.find((p) => p.market === pos.market)?.price ?? pos.entry_px;
          const upnl =
            pos.direction === "long"
              ? pos.size_usd * pos.leverage * (price - pos.entry_px) / pos.entry_px
              : pos.size_usd * pos.leverage * (pos.entry_px - price) / pos.entry_px;
          return { ...pos, upnl };
        }),
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [prices]);

  const openPosition = () => {
    if (!connected || !currentPrice) return;
    const newPos: OpenPosition = {
      id: Math.random().toString(36).slice(2, 10),
      market,
      direction,
      size_usd: parseFloat(sizeUSD) || 1000,
      leverage,
      entry_px: currentPrice.price,
      opened_at: Math.floor(Date.now() / 1000),
      upnl: 0,
    };
    setPositions((prev) => [newPos, ...prev]);
  };

  const closePosition = (id: string) => {
    setClosingId(id);
    setTimeout(() => {
      setPositions((prev) => prev.filter((p) => p.id !== id));
      setClosingId(null);
    }, 1500);
  };

  const markets = ["SOL-PERP", "BTC-PERP", "ETH-PERP", "ARB-PERP"];

  return (
    <div className="min-h-screen" style={{ background: "var(--color-bg)" }}>
      
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold" style={{ color: "var(--color-ink)" }}>
            Trade
          </h1>
          <div
            className="text-xs px-2.5 py-1 rounded"
            style={{ background: "var(--color-panel-2)", color: "var(--color-gold)", border: "1px solid var(--color-line)" }}
          >
            Devnet simulation — no real capital
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-1 space-y-4">
            <div
              className="rounded-xl p-4 space-y-3"
              style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
            >
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-faint)" }}>
                Order
              </p>

              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--color-faint)" }}>Market</label>
                <select
                  value={market}
                  onChange={(e) => setMarket(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none"
                  style={{
                    background: "var(--color-panel-2)",
                    border: "1px solid var(--color-line)",
                    color: "var(--color-ink)",
                  }}
                >
                  {markets.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>

              <div className="flex rounded-lg overflow-hidden" style={{ border: "1px solid var(--color-line)" }}>
                {(["long", "short"] as Direction[]).map((d) => (
                  <button
                    key={d}
                    onClick={() => setDirection(d)}
                    className="flex-1 py-2 text-sm font-semibold transition-colors"
                    style={{
                      background: direction === d
                        ? d === "long" ? "var(--color-green)" : "var(--color-red)"
                        : "var(--color-panel-2)",
                      color: direction === d ? "#000" : "var(--color-muted)",
                    }}
                  >
                    {d.toUpperCase()}
                  </button>
                ))}
              </div>

              <div>
                <label className="text-xs mb-1 block" style={{ color: "var(--color-faint)" }}>Size (USD)</label>
                <input
                  type="number"
                  min={0}
                  value={sizeUSD}
                  onChange={(e) => setSizeUSD(e.target.value)}
                  className="w-full rounded-lg px-3 py-2 text-sm outline-none tnum"
                  style={{
                    background: "var(--color-panel-2)",
                    border: "1px solid var(--color-line)",
                    color: "var(--color-ink)",
                  }}
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs" style={{ color: "var(--color-faint)" }}>Leverage</label>
                  <span className="text-xs tnum font-medium" style={{ color: "var(--color-ink)" }}>{leverage}x</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={10}
                  value={leverage}
                  onChange={(e) => setLeverage(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>

              {currentPrice && (
                <div className="text-xs space-y-1" style={{ color: "var(--color-muted)" }}>
                  <div className="flex justify-between">
                    <span>Entry price</span>
                    <span className="tnum">{currentPrice.price.toFixed(market === "BTC-PERP" ? 0 : 4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Notional</span>
                    <span className="tnum">{formatUSD(parseFloat(sizeUSD) * leverage)}</span>
                  </div>
                </div>
              )}

              <button
                onClick={openPosition}
                disabled={!connected}
                className="w-full py-2.5 rounded-lg text-sm font-semibold transition-colors"
                style={{
                  background: !connected ? "var(--color-panel-2)" : direction === "long" ? "var(--color-green)" : "var(--color-red)",
                  color: !connected ? "var(--color-faint)" : "#000",
                }}
              >
                {!connected ? "Connect wallet" : `Open ${direction.toUpperCase()}`}
              </button>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
            >
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--color-line)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-faint)" }}>
                  Live Prices
                </p>
              </div>
              <div className="flex gap-0 overflow-x-auto">
                {prices?.map((p) => (
                  <button
                    key={p.market}
                    onClick={() => setMarket(p.market)}
                    className="flex-1 min-w-[140px] px-4 py-3 text-left transition-colors"
                    style={{
                      background: market === p.market ? "var(--color-panel-2)" : "transparent",
                      borderRight: "1px solid var(--color-line)",
                    }}
                  >
                    <p className="text-xs font-medium mb-0.5" style={{ color: "var(--color-muted)" }}>
                      {p.market}
                    </p>
                    <p className="text-base font-bold tnum" style={{ color: "var(--color-ink)" }}>
                      {p.market === "BTC-PERP" ? p.price.toFixed(0) : p.price.toFixed(3)}
                    </p>
                    <p
                      className="text-xs tnum"
                      style={{ color: p.change_pct_24h >= 0 ? "var(--color-green)" : "var(--color-red)" }}
                    >
                      {p.change_pct_24h >= 0 ? "+" : ""}{p.change_pct_24h.toFixed(2)}%
                    </p>
                  </button>
                ))}
              </div>
            </div>

            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
            >
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: "1px solid var(--color-line)" }}>
                <div className="flex items-center gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-faint)" }}>
                    {market}
                  </p>
                  {currentPrice && (
                    <span className="text-sm font-bold tnum" style={{ color: "var(--color-ink)" }}>
                      {market === "BTC-PERP" ? currentPrice.price.toFixed(0) : currentPrice.price.toFixed(3)}
                    </span>
                  )}
                  {currentPrice && (
                    <span
                      className="text-xs tnum"
                      style={{ color: currentPrice.change_pct_24h >= 0 ? "var(--color-green)" : "var(--color-red)" }}
                    >
                      {currentPrice.change_pct_24h >= 0 ? "+" : ""}{currentPrice.change_pct_24h.toFixed(2)}%
                    </span>
                  )}
                </div>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: "var(--color-panel-2)", color: "var(--color-faint)", border: "1px solid var(--color-line)" }}>
                  15m
                </span>
              </div>
              <TvChart
                market={market}
                currentPrice={currentPrice?.price}
                height={360}
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
            </div>

            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
            >
              <div className="px-4 py-3" style={{ borderBottom: "1px solid var(--color-line)" }}>
                <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--color-faint)" }}>
                  Open Positions ({positions.length})
                </p>
              </div>
              {positions.length === 0 ? (
                <div className="py-10 text-center">
                  <p className="text-xs" style={{ color: "var(--color-faint)" }}>No open positions</p>
                </div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--color-line)" }}>
                      {["Market", "Side", "Size", "Lev", "Entry", "uPnL", ""].map((h) => (
                        <th key={h} className="py-2.5 px-4 text-left font-medium" style={{ color: "var(--color-faint)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {positions.map((pos) => (
                      <tr
                        key={pos.id}
                        style={{ borderBottom: "1px solid var(--color-line)" }}
                      >
                        <td className="py-3 px-4 font-mono">{pos.market}</td>
                        <td
                          className="py-3 px-4 font-semibold"
                          style={{ color: pos.direction === "long" ? "var(--color-green)" : "var(--color-red)" }}
                        >
                          {pos.direction.toUpperCase()}
                        </td>
                        <td className="py-3 px-4 tnum">{formatUSD(pos.size_usd, 0)}</td>
                        <td className="py-3 px-4 tnum">{pos.leverage}x</td>
                        <td className="py-3 px-4 tnum" style={{ color: "var(--color-muted)" }}>
                          {pos.entry_px.toFixed(pos.market === "BTC-PERP" ? 0 : 3)}
                        </td>
                        <td className={`py-3 px-4 tnum font-medium ${pnlClass(pos.upnl ?? 0)}`}>
                          {(pos.upnl ?? 0) >= 0 ? "+" : ""}{formatUSD(pos.upnl ?? 0, 0)}
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => closePosition(pos.id)}
                            disabled={closingId === pos.id}
                            className="text-xs px-2.5 py-1 rounded"
                            style={{
                              border: "1px solid var(--color-line)",
                              color: closingId === pos.id ? "var(--color-faint)" : "var(--color-muted)",
                            }}
                          >
                            {closingId === pos.id ? "Closing…" : "Close"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
