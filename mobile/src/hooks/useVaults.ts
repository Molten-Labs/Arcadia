import { useQuery } from '@tanstack/react-query';
import { MOCK_VAULTS, VaultView, mockNavHistory, NavPoint } from '../lib/mockData';
import { fetchVaults, fetchVault, fetchNavHistory } from '../lib/api';

export function useVaults() {
  return useQuery<VaultView[]>({
    queryKey: ['vaults'],
    queryFn: async () => {
      const api = await fetchVaults();
      return api ?? MOCK_VAULTS;
    },
    staleTime: 30_000,
  });
}

export function useVault(configPubkey: string | undefined) {
  return useQuery<VaultView | null>({
    queryKey: ['vault', configPubkey],
    queryFn: async () => {
      if (!configPubkey) return null;
      const api = await fetchVault(configPubkey);
      if (api) return api;
      return MOCK_VAULTS.find(v => v.configPubkey === configPubkey || v.id === configPubkey) ?? null;
    },
    enabled: !!configPubkey,
    staleTime: 30_000,
  });
}

export function useNavHistory(configPubkey: string | undefined) {
  return useQuery<NavPoint[]>({
    queryKey: ['nav-history', configPubkey],
    queryFn: async () => {
      if (!configPubkey) return [];
      const api = await fetchNavHistory(configPubkey);
      return api ?? mockNavHistory(configPubkey);
    },
    enabled: !!configPubkey,
    staleTime: 60_000,
  });
}
