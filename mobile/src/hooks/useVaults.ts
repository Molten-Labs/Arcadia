import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { MOCK_VAULTS, VaultView, mockNavHistory, NavPoint } from '../lib/mockData';
import { fetchVaults, fetchVault, fetchNavHistory } from '../lib/api';
import { applyMobileDemoVaults, getMobileDemoVersion, subscribeMobileDemo } from '../lib/demoState';

export function useVaults() {
  const [demoVersion, setDemoVersion] = useState(getMobileDemoVersion());

  useEffect(() => subscribeMobileDemo(() => setDemoVersion(getMobileDemoVersion())), []);

  return useQuery<VaultView[]>({
    queryKey: ['vaults', demoVersion],
    queryFn: async () => {
      const api = await fetchVaults();
      return applyMobileDemoVaults(api ?? MOCK_VAULTS);
    },
    staleTime: 30_000,
  });
}

export function useVault(configPubkey: string | undefined) {
  const [demoVersion, setDemoVersion] = useState(getMobileDemoVersion());

  useEffect(() => subscribeMobileDemo(() => setDemoVersion(getMobileDemoVersion())), []);

  return useQuery<VaultView | null>({
    queryKey: ['vault', configPubkey, demoVersion],
    queryFn: async () => {
      if (!configPubkey) return null;
      const api = await fetchVault(configPubkey);
      const vaults = applyMobileDemoVaults(api ? [api] : MOCK_VAULTS);
      return vaults.find(v => v.configPubkey === configPubkey || v.id === configPubkey) ?? null;
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
