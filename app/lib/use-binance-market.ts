"use client";

import { useQuery } from "@tanstack/react-query";

const BINANCE = "https://api.binance.com/api/v3";

const INTERVAL_MAP: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "1H": "1h",
  "4H": "4h",
  "1D": "1d",
};

// Binance has no perpetual index history for synthetic/equity/forex symbols, so
// we only pull real candles+ticker for the core crypto pairs. Everything else
// falls back to Flash's live price / generated candles.
const SUPPORTED_PAIRS = new Set(["SOL", "BTC", "ETH"]);

export interface BinanceCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
}

export interface BinanceTicker {
  priceChangePercent: number;
  highPrice: number;
  lowPrice: number;
  quoteVolume: number;
  lastPrice: number;
}

export function binancePair(symbol: string): string | null {
  if (!SUPPORTED_PAIRS.has(symbol)) return null;
  return `${symbol}USDT`;
}

async function fetchKlines(symbol: string, interval: string): Promise<BinanceCandle[]> {
  const pair = binancePair(symbol);
  if (!pair) return [];
  const apiInterval = INTERVAL_MAP[interval] ?? "15m";
  const url = `${BINANCE}/klines?symbol=${pair}&interval=${apiInterval}&limit=150`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance klines ${res.status}`);
  const rows = (await res.json()) as Array<
    [number, string, string, string, string]
  >;
  return rows.map((k) => ({
    time: Math.floor(k[0] / 1000),
    open: parseFloat(k[1]),
    high: parseFloat(k[2]),
    low: parseFloat(k[3]),
    close: parseFloat(k[4]),
  }));
}

export function useBinanceCandles(symbol: string, interval: string): BinanceCandle[] {
  const { data } = useQuery({
    queryKey: ["binance-klines", symbol, interval],
    queryFn: () => fetchKlines(symbol, interval),
    enabled: binancePair(symbol) != null,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
  return data ?? [];
}

async function fetchTicker(symbol: string): Promise<BinanceTicker | null> {
  const pair = binancePair(symbol);
  if (!pair) return null;
  const url = `${BINANCE}/ticker/24hr?symbol=${pair}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance ticker ${res.status}`);
  const t = (await res.json()) as {
    priceChangePercent: string;
    highPrice: string;
    lowPrice: string;
    quoteVolume: string;
    lastPrice: string;
  };
  return {
    priceChangePercent: parseFloat(t.priceChangePercent),
    highPrice: parseFloat(t.highPrice),
    lowPrice: parseFloat(t.lowPrice),
    quoteVolume: parseFloat(t.quoteVolume),
    lastPrice: parseFloat(t.lastPrice),
  };
}

export function useBinanceTicker(symbol: string): BinanceTicker | null {
  const { data } = useQuery({
    queryKey: ["binance-ticker", symbol],
    queryFn: () => fetchTicker(symbol),
    enabled: binancePair(symbol) != null,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
  return data ?? null;
}