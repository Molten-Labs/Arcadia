"use client";

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import type {
  PhoenixState,
  PhoenixMarketStats,
  PhoenixOrderbook,
  PhoenixTrade,
  PhoenixCandle,
  PhoenixFundingRate,
  PhoenixExchangeState,
  PhoenixMarketConfig,
} from "./phoenix-types";

const WS_URL = "wss://perp-api.phoenix.trade/v1/ws";
const REST_URL = "https://perp-api.phoenix.trade";
const SYMBOLS = ["SOL", "BTC", "ETH"];
const RECONNECT_DELAY = 3000;
const MAX_RECONNECT_DELAY = 30000;

type PhoenixContextValue = PhoenixState & {
  seedCandles: (symbol: string, timeframe: string) => Promise<PhoenixCandle[]>;
  fetchMarketConfig: (symbol: string) => Promise<PhoenixMarketConfig | null>;
};

const defaultState: PhoenixState = {
  marketStats: {},
  orderbook: {},
  trades: {},
  candles: {},
  fundingRate: {},
  exchange: null,
  marketConfigs: {},
  connected: false,
  error: null,
};

const PhoenixContext = createContext<PhoenixContextValue>({
  ...defaultState,
  seedCandles: async () => [],
  fetchMarketConfig: async () => null,
});

export function usePhoenix() {
  return useContext(PhoenixContext);
}

// The REST seed returns candle times in milliseconds while the WebSocket
// stream sends seconds. Everything stored in context is normalized to
// seconds (lightweight-charts' UTCTimestamp unit).
function toUnixSeconds(t: number): number {
  return t > 1e12 ? Math.floor(t / 1000) : t;
}

function normalizeCandle(c: PhoenixCandle): PhoenixCandle {
  return { ...c, time: toUnixSeconds(c.time) };
}

export function PhoenixProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PhoenixState>(defaultState);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const reconnectDelayRef = useRef(RECONNECT_DELAY);
  const mountedRef = useRef(true);

  const update = useCallback((patch: Partial<PhoenixState>) => {
    setState((prev) => ({ ...prev, ...patch }));
  }, []);

  // The socket lifecycle lives entirely inside this mount effect; `connect`
  // is local so its reconnect timer can reference it directly.
  useEffect(() => {
    mountedRef.current = true;

    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN || wsRef.current?.readyState === WebSocket.CONNECTING) return;

      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          update({ connected: true, error: null });
          reconnectDelayRef.current = RECONNECT_DELAY;

          const subscriptions: object[] = SYMBOLS.flatMap((symbol) => [
            { type: "subscribe", subscription: { channel: "market", symbol } },
            { type: "subscribe", subscription: { channel: "orderbook", symbol, bypassExecutionBand: false } },
            { type: "subscribe", subscription: { channel: "trades", symbol } },
            { type: "subscribe", subscription: { channel: "candles", symbol, timeframe: "1m" } },
            { type: "subscribe", subscription: { channel: "fundingRate", symbol } },
          ]);

          subscriptions.push({ type: "subscribe", subscription: { channel: "exchange", encoding: "json" } });

          for (const msg of subscriptions) {
            ws.send(JSON.stringify(msg));
          }
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            const msgType = msg.channel ?? msg.type;

            switch (msgType) {
              case "market": {
                const m = msg as PhoenixMarketStats;
                setState((prev) => ({
                  ...prev,
                  marketStats: { ...prev.marketStats, [m.symbol]: m },
                }));
                break;
              }
              case "orderbook": {
                const o = msg as { symbol: string; orderbook: { bids: number[][]; asks: number[][]; mid: number } };
                const book: PhoenixOrderbook = {
                  symbol: o.symbol,
                  bids: o.orderbook.bids.map(([price, size]) => ({ price, size })),
                  asks: o.orderbook.asks.map(([price, size]) => ({ price, size })),
                  mid: o.orderbook.mid,
                };
                setState((prev) => ({
                  ...prev,
                  orderbook: { ...prev.orderbook, [o.symbol]: book },
                }));
                break;
              }
              case "trades": {
                const t = msg as { symbol: string; trades: PhoenixTrade[] };
                setState((prev) => {
                  const existing = prev.trades[t.symbol] ?? [];
                  return {
                    ...prev,
                    trades: { ...prev.trades, [t.symbol]: [...t.trades.slice().reverse(), ...existing].slice(0, 100) },
                  };
                });
                break;
              }
              case "candles":
              case "candle": {
                const c = msg as { symbol: string; timeframe: string; candle: PhoenixCandle };
                const candle = normalizeCandle(c.candle);
                setState((prev) => {
                  const existing = prev.candles[c.symbol] ?? [];
                  const idx = existing.findIndex((x) => x.time === candle.time);
                  const next = idx >= 0
                    ? [...existing.slice(0, idx), candle, ...existing.slice(idx + 1)]
                    : [...existing, candle];
                  return {
                    ...prev,
                    candles: { ...prev.candles, [c.symbol]: next },
                  };
                });
                break;
              }
              case "fundingRate": {
                const f = msg as PhoenixFundingRate;
                setState((prev) => ({
                  ...prev,
                  fundingRate: { ...prev.fundingRate, [f.symbol]: f },
                }));
                break;
              }
              case "exchange": {
                const e = msg as PhoenixExchangeState & { messageType: string };
                if (e.messageType === "snapshot" || e.messageType === "delta") {
                  setState((prev) => ({
                    ...prev,
                    exchange: { active: e.active, gated: e.gated },
                  }));
                }
                break;
              }
              case "subscriptionConfirmed":
                break;
              case "subscriptionError":
              case "error":
                console.warn("[Phoenix] subscription/error:", msg);
                break;
            }
          } catch {}
        };

        ws.onclose = () => {
          if (!mountedRef.current) return;
          update({ connected: false });
          const delay = reconnectDelayRef.current;
          reconnectDelayRef.current = Math.min(delay * 1.5, MAX_RECONNECT_DELAY);
          reconnectTimerRef.current = setTimeout(connect, delay);
        };

        ws.onerror = () => {
          update({ error: "WebSocket connection error" });
        };
      } catch (err) {
        update({ error: err instanceof Error ? err.message : "Failed to connect" });
      }
    };

    connect();
    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      wsRef.current?.close();
    };
  }, [update]);

  const seedCandles = useCallback(async (symbol: string, timeframe: string): Promise<PhoenixCandle[]> => {
    try {
      const res = await fetch(`${REST_URL}/candles?symbol=${symbol}&timeframe=${timeframe}&limit=500`);
      if (!res.ok) return [];
      const raw: PhoenixCandle[] = await res.json();
      const data = raw.map(normalizeCandle);
      setState((prev) => ({
        ...prev,
        candles: { ...prev.candles, [symbol]: data },
      }));
      return data;
    } catch {
      return [];
    }
  }, []);

  const fetchMarketConfig = useCallback(async (symbol: string): Promise<PhoenixMarketConfig | null> => {
    try {
      const res = await fetch(`${REST_URL}/exchange/market/${symbol}`);
      if (!res.ok) return null;
      const data: PhoenixMarketConfig = await res.json();
      setState((prev) => ({
        ...prev,
        marketConfigs: { ...prev.marketConfigs, [symbol]: data },
      }));
      return data;
    } catch {
      return null;
    }
  }, []);

  return (
    <PhoenixContext.Provider value={{ ...state, seedCandles, fetchMarketConfig }}>
      {children}
    </PhoenixContext.Provider>
  );
}
