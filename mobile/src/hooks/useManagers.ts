import { useQuery } from '@tanstack/react-query';
import { ManagerView, MOCK_MANAGERS, MOCK_VAULTS, VaultView } from '../lib/mockData';
import { fetchManagers, fetchManager } from '../lib/api';

export interface ManagerWithVaults extends ManagerView {
  vaults: VaultView[];
}

export function useManagers() {
  return useQuery<ManagerWithVaults[]>({
    queryKey: ['managers'],
    queryFn: async () => {
      const api = await fetchManagers();
      const managers: ManagerView[] = api ?? MOCK_MANAGERS;
      return managers.map(m => ({
        ...m,
        vaults: MOCK_VAULTS.filter(v => v.managerPubkey === m.pubkey),
      }));
    },
    staleTime: 30_000,
  });
}

export function useManager(pubkey: string | undefined) {
  return useQuery<ManagerWithVaults | null>({
    queryKey: ['manager', pubkey],
    queryFn: async () => {
      if (!pubkey) return null;
      const api = await fetchManager(pubkey);
      const m: ManagerView = api ?? MOCK_MANAGERS.find(m => m.pubkey === pubkey) ?? MOCK_MANAGERS[0];
      return {
        ...m,
        vaults: MOCK_VAULTS.filter(v => v.managerPubkey === m.pubkey),
      };
    },
    enabled: !!pubkey,
    staleTime: 30_000,
  });
}
