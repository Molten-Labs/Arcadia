"use client";

import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";

const FLASH_API = process.env.NEXT_PUBLIC_FLASHTRADE_API_URL ?? "https://flashapi.trade";

export interface FTokenPrice {
  symbol: string;
  price: number;
  exponent: number;
  confidence: number;
  priceUi: number;
  timestampUs: number;
  marketSession: string;
}

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
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["flash-prices"],
    queryFn: fetchAllPrices,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  const prices = data ?? {};
  const getPrice = useCallback((symbol: string) => data?.[symbol], [data]);

  return { prices, getPrice, loading: isLoading, refetch };
}
