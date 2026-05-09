import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { ManagerView, MOCK_MANAGERS, MOCK_VAULTS, VaultView } from '../lib/mockData';
import { fetchManagers, fetchManager } from '../lib/api';
import { applyMobileDemoVaults, getMobileDemoVersion, subscribeMobileDemo } from '../lib/demoState';

export interface ManagerWithVaults extends ManagerView {
  vaults: VaultView[];
}

export function useManagers() {
  const [demoVersion, setDemoVersion] = useState(getMobileDemoVersion());

  useEffect(() => subscribeMobileDemo(() => setDemoVersion(getMobileDemoVersion())), []);

  return useQuery<ManagerWithVaults[]>({
    queryKey: ['managers', demoVersion],
    queryFn: async () => {
      const api = await fetchManagers();
      const managers: ManagerView[] = api ?? MOCK_MANAGERS;
      const vaults = applyMobileDemoVaults(MOCK_VAULTS);
      return managers.map(m => ({
        ...m,
        vaults: vaults.filter(v => v.managerPubkey === m.pubkey),
      }));
    },
    staleTime: 30_000,
  });
}

export function useManager(pubkey: string | undefined) {
  const [demoVersion, setDemoVersion] = useState(getMobileDemoVersion());

  useEffect(() => subscribeMobileDemo(() => setDemoVersion(getMobileDemoVersion())), []);

  return useQuery<ManagerWithVaults | null>({
    queryKey: ['manager', pubkey, demoVersion],
    queryFn: async () => {
      if (!pubkey) return null;
      const api = await fetchManager(pubkey);
      const m: ManagerView = api ?? MOCK_MANAGERS.find(m => m.pubkey === pubkey) ?? MOCK_MANAGERS[0];
      const vaults = applyMobileDemoVaults(MOCK_VAULTS);
      return {
        ...m,
        vaults: vaults.filter(v => v.managerPubkey === m.pubkey),
      };
    },
    enabled: !!pubkey,
    staleTime: 30_000,
  });
}
