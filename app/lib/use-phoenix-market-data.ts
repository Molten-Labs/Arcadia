"use client";

import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Live market data for the Arcadia terminal, sourced from Phoenix perps.
 *
 * Market data is real and never mocked. REST is polled for snapshots
 * (order book, mark price, funding, candles) and a WebSocket streams a live
 * trade tape. If a feed is unavailable the hook reports `status: "stale"`
 * and keeps the last good snapshot; it never fabricates values.
 */

const API_BASE = "https://perp-api.phoenix.trade";
const WS_BASE = "wss://perp-api.phoenix.trade/v1/ws";

const SNAPSHOT_POLL_MS = 2000;
const CANDLE_POLL_MS = 15000;

export interface OrderBookLevel {
  price: number;
  size: number;
}

export interface OrderBook {
  slot: number;
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
}

export interface PhoenixCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volumeQuote: number;
  tradeCount: number;
}

export interface TapeFill {
  id: string;
  symbol: string;
  price: number;
  size: number;
  side: "buy" | "sell";
  time: number;
}

export interface PhoenixSnapshot {
  symbol: string;
  markPrice: number;
  lastPrice: number;
  fundingRatePercent: number;
  high24h: number | null;
  low24h: number | null;
  changePct24h: number;
  volumeQuote24h: number;
}

export type FeedStatus = "connecting" | "live" | "stale";

export interface PhoenixMarketData {
  status: FeedStatus;
  symbol: string;
  snapshot: PhoenixSnapshot | null;
  candles: PhoenixCandle[];
  orderBook: OrderBook | null;
  tape: TapeFill[];
}

async function getJSON<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_BASE}${path}`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface RawOrderBook {
  slot: number;
  symbol?: string;
  bids: number[][];
  asks: number[][];
}

interface RawMark {
  markPrice?: { price: number };
  indexPrice?: { price: number };
}

interface RawFundingRate {
  timestamp: number;
  fundingRatePercentage: string;
}

interface RawCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volumeQuote: number;
  tradeCount: number;
}

interface RawFill {
  id?: string | number;
  price?: number | string;
  size?: number | string;
  taker?: string;
  takerSide?: "Buy" | "Sell" | "buy" | "sell";
  time?: number;
}

const lastSnapshots: Record<string, PhoenixSnapshot> = {};

export function usePhoenixMarketData(
  symbol: string,
  timeframe = "15m",
  candleLimit = 200,
): PhoenixMarketData {
  const [status, setStatus] = useState<FeedStatus>("connecting");
  const [snapshot, setSnapshot] = useState<PhoenixSnapshot | null>(
    () => lastSnapshots[symbol] ?? null,
  );
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [candles, setCandles] = useState<PhoenixCandle[]>([]);
  const [tape, setTape] = useState<TapeFill[]>([]);
  const snapshotRef = useRef<PhoenixSnapshot | null>(snapshot);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);

  // ── REST snapshot poll (order book, mark, funding) ─────────────────
  useEffect(() => {
    let alive = true;

    const pull = async () => {
      const [obReq, markReq, fundingReq] = await Promise.all([
        getJSON<RawOrderBook>(`/v1/view/orderbook/${symbol}`),
        getJSON<RawMark>(`/v1/market/${symbol}/mark-price`),
        getJSON<{ rates: RawFundingRate[] }>(`/v1/funding/${symbol}/rates`),
      ]);
      if (!alive) return;

      const prev = snapshotRef.current;
      if (!obReq) {
        setStatus((s) => (s === "live" ? "stale" : s));
        return;
      }

      const markPrice = markReq?.markPrice?.price ?? prev?.markPrice ?? 0;
      const lastPrice =
        markReq?.indexPrice?.price ?? markReq?.markPrice?.price ?? prev?.lastPrice ?? obReq.bids[0]?.[0] ?? 0;

      const rates = fundingReq?.rates;
      const fundingRatePercent =
        rates && rates.length > 0
          ? parseFloat(rates[rates.length - 1].fundingRatePercentage)
          : (prev?.fundingRatePercent ?? 0);

      const built: PhoenixSnapshot = {
        symbol,
        markPrice,
        lastPrice,
        fundingRatePercent,
        changePct24h: prev?.changePct24h ?? 0,
        volumeQuote24h: prev?.volumeQuote24h ?? 0,
        high24h: prev?.high24h ?? null,
        low24h: prev?.low24h ?? null,
      };

      lastSnapshots[symbol] = built;
      snapshotRef.current = built;
      setSnapshot(built);
      setStatus("live");
      setOrderBook({
        slot: obReq.slot,
        symbol: obReq.symbol ?? symbol,
        bids: obReq.bids.map(([price, size]) => ({ price, size })),
        asks: obReq.asks.map(([price, size]) => ({ price, size })),
      });
    };

    void pull();
    const t = setInterval(() => void pull(), SNAPSHOT_POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [symbol]);

  // ── Candle poll (active timeframe) ─────────────────────────────────
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      const data = await getJSON<RawCandle[]>(
        `/candles?symbol=${symbol}&timeframe=${timeframe}&limit=${candleLimit}`,
      );
      if (!alive || !data) return;
      setCandles(
        data.map((c) => ({
          time: c.time,
          open: c.open,
          high: c.high,
          low: c.low,
          close: c.close,
          volume: c.volume,
          volumeQuote: c.volumeQuote,
          tradeCount: c.tradeCount,
        })),
      );
    };
    void pull();
    const t = setInterval(() => void pull(), CANDLE_POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [symbol, timeframe, candleLimit]);

  // ── 24h derived stats (from a minute candle series) ────────────────
  useEffect(() => {
    let alive = true;
    const pull = async () => {
      const data = await getJSON<RawCandle[]>(
        `/candles?symbol=${symbol}&timeframe=1m&limit=1440`,
      );
      if (!alive || !data || data.length === 0) return;
      const firstOpen = data[0].open;
      const lastClose = data[data.length - 1].close;
      const high = Math.max(...data.map((c) => c.high));
      const low = Math.min(...data.map((c) => c.low));
      const quote = data.reduce((sum, c) => sum + c.volumeQuote, 0);
      const next = {
        ...(snapshotRef.current ?? {
          symbol,
          markPrice: 0,
          lastPrice: 0,
          fundingRatePercent: 0,
          high24h: null,
          low24h: null,
          changePct24h: 0,
          volumeQuote24h: 0,
        }),
        changePct24h: firstOpen > 0 ? ((lastClose - firstOpen) / firstOpen) * 100 : 0,
        high24h: high,
        low24h: low,
        volumeQuote24h: quote,
      };
      snapshotRef.current = next;
      lastSnapshots[symbol] = next;
      setSnapshot(next);
    };
    void pull();
    const t = setInterval(() => void pull(), 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [symbol]);

  // ── WebSocket trade tape ───────────────────────────────────────────
  useEffect(() => {
    let ws: WebSocket | null = null;
    let alive = true;
    let retry = 0;

    const open = () => {
      if (!alive) return;
      try {
        ws = new WebSocket(WS_BASE);
      } catch {
        return;
      }
      ws.onopen = () => {
        retry = 0;
        ws?.send(
          JSON.stringify({ type: "subscribe", subscription: { channel: "trades", symbol } }),
        );
      };
      ws.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data as string);
          const frames: RawFill[] = msg?.trades ?? msg?.data?.trades;
          if (!Array.isArray(frames) || frames.length === 0) return;
          const prints: TapeFill[] = frames.map((f, i) => {
            const sideNorm = String(f.taker ?? msg?.side ?? msg?.data?.side).toLowerCase();
            return {
              id: `${f.id ?? `${msg?.time ?? Date.now()}-${i}`}`,
              symbol,
              price: typeof f.price === "number" ? f.price : Number(f.price),
              size: typeof f.size === "number" ? f.size : Number(f.size),
              side: sideNorm === "sell" ? "sell" : "buy",
              time: (f.time ?? Date.now()) as number,
            };
          });
          setTape((prev) => [...prints.reverse(), ...prev].slice(0, 60));
        } catch {
          /* ignore malformed frame */
        }
      };
      ws.onclose = () => {
        ws = null;
        if (!alive) return;
        const delay = Math.min(1000 * 2 ** retry, 15000);
        retry += 1;
        setTimeout(open, delay);
      };
      ws.onerror = () => {
        ws?.close();
      };
    };

    open();
    return () => {
      alive = false;
      ws?.close();
    };
  }, [symbol]);

  const value = useMemo<PhoenixMarketData>(
    () => ({ status, symbol, snapshot, candles, orderBook, tape }),
    [status, symbol, snapshot, candles, orderBook, tape],
  );
  return value;
}