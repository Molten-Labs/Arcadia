"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "./utils";

export interface MeResponse {
  role: "trader" | "investor";
  wallet: string | null;
  handle?: string;
  profile?: string;
}

/**
 * Resolve the connected wallet to a trader handle + role.
 * Returns `{ role: "investor", wallet: null }` when wallet is not connected
 * or the backend is unreachable.
 */
export function useMe() {
  const { connected, publicKey } = useWallet();

  return useQuery<MeResponse>({
    queryKey: ["me", publicKey?.toBase58()],
    queryFn: () => apiFetch("/me"),
    enabled: connected && !!publicKey,
    staleTime: 30_000,
  });
}

/**
 * Get the trader handle for the connected wallet.
 * Shortcut for `useMe().data?.handle`.
 */
export function useTraderHandle(): string | undefined {
  const { data } = useMe();
  return data?.handle;
}
