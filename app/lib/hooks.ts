"use client";

import { useQuery } from "@tanstack/react-query";
import { useWalletCompat } from "@/lib/use-wallet-compat";
import { apiFetch } from "./utils";

export interface MeResponse {
  role: "trader" | "investor" | "both";
  wallet: string | null;
  handle?: string;
  profile?: string;
}

export function useMe() {
  const { connected, publicKey } = useWalletCompat();

  return useQuery<MeResponse>({
    queryKey: ["me", publicKey?.toBase58()],
    queryFn: () => apiFetch("/me"),
    enabled: connected && !!publicKey,
    staleTime: 30_000,
  });
}

export function useTraderHandle(): string | undefined {
  const { data } = useMe();
  return data?.handle;
}
