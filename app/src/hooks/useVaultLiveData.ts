import { useQuery } from "@tanstack/react-query";
import { fetchKilnApi, type ApiItems } from "@/lib/api";
import type { NavPoint, TradeEvent, VaultActivityEvent } from "@/lib/realtime";

export function useVaultNavHistory(vaultConfigPubkey?: string) {
  return useQuery({
    queryKey: ["vault-nav", vaultConfigPubkey],
    queryFn: async () => {
      if (!vaultConfigPubkey) return [];
      const response = await fetchKilnApi<ApiItems<NavPoint>>(`/vaults/${vaultConfigPubkey}/nav-history`);
      return response?.items ?? [];
    },
    enabled: !!vaultConfigPubkey,
    staleTime: 30_000,
  });
}

export function useVaultTrades(vaultConfigPubkey?: string) {
  return useQuery({
    queryKey: ["vault-trades", vaultConfigPubkey],
    queryFn: async () => {
      if (!vaultConfigPubkey) return [];
      const response = await fetchKilnApi<ApiItems<TradeEvent>>(`/vaults/${vaultConfigPubkey}/trades`);
      return response?.items ?? [];
    },
    enabled: !!vaultConfigPubkey,
    staleTime: 30_000,
  });
}

export function useVaultActivity(vaultConfigPubkey?: string) {
  return useQuery({
    queryKey: ["vault-activity", vaultConfigPubkey],
    queryFn: async () => [] as VaultActivityEvent[],
    enabled: !!vaultConfigPubkey,
    staleTime: Infinity,
  });
}
