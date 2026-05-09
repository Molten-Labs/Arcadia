import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { PositionView, mockPositions } from '../lib/mockData';
import { fetchPositions } from '../lib/api';
import { applyMobileDemoPositions, getMobileDemoVersion, subscribeMobileDemo } from '../lib/demoState';

export function usePositions(walletPubkey: string | null | undefined) {
  const [demoVersion, setDemoVersion] = useState(getMobileDemoVersion());

  useEffect(() => subscribeMobileDemo(() => setDemoVersion(getMobileDemoVersion())), []);

  return useQuery<PositionView[]>({
    queryKey: ['positions', walletPubkey, demoVersion],
    queryFn: async () => {
      if (!walletPubkey) return [];
      const api = await fetchPositions(walletPubkey);
      return applyMobileDemoPositions(api ?? mockPositions(walletPubkey), walletPubkey);
    },
    enabled: !!walletPubkey,
    staleTime: 30_000,
  });
}
