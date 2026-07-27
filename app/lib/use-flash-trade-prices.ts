"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const FLASH_API = typeof window !== "undefined"
  ? (process.env.NEXT_PUBLIC_FLASHTRADE_API_URL ?? "https://flashapi.trade")
  : "https://flashapi.trade";

export interface FTokenPrice {
  symbol: string;
  price: number;
  exponent: number;
  confidence: number;
  priceUi: number;
  timestampUs: number;
  marketSession: string;
}

interface PriceCache {
  data: Record<string, FTokenPrice>;
  ts: number;
}

let globalCache: PriceCache | null = null;
let globalPromise: Promise<Record<string, FTokenPrice>> | null = null;

async function fetchAllPrices(): Promise<Record<string, FTokenPrice>> {
  const res = await fetch(`${FLASH_API}/prices`);
  if (!res.ok) throw new Error(`FlashTrade prices ${res.status}`);
  return res.json() as Promise<Record<string, FTokenPrice>>;
}

export function useFlashTradePrices(): {
  prices: Record<string, FTokenPrice>;
  getPrice: (symbol: string) => FTokenPrice | undefined;
  loading: boolean;
  refetch: () => void;
} {
  const [prices, setPrices] = useState<Record<string, FTokenPrice>>(() => globalCache?.data ?? {});
  const [loading, setLoading] = useState(!globalCache);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    if (globalCache && Date.now() - globalCache.ts < 10_000) {
      setPrices(globalCache.data);
      setLoading(false);
      return;
    }
    if (!globalPromise) globalPromise = fetchAllPrices();
    try {
      const data = await globalPromise;
      globalCache = { data, ts: Date.now() };
      globalPromise = null;
      if (mounted.current) {
        setPrices(data);
        setLoading(false);
      }
    } catch {
      globalPromise = null;
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();
    const interval = setInterval(load, 15_000);
    return () => {
      mounted.current = false;
      clearInterval(interval);
    };
  }, [load]);

  return {
    prices,
    getPrice: useCallback((symbol: string) => prices[symbol], [prices]),
    loading,
    refetch: load,
  };
}
