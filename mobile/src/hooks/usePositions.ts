import { useQuery } from '@tanstack/react-query';
import { PositionView, mockPositions } from '../lib/mockData';
import { fetchPositions } from '../lib/api';

export function usePositions(walletPubkey: string | null | undefined) {
  return useQuery<PositionView[]>({
    queryKey: ['positions', walletPubkey],
    queryFn: async () => {
      if (!walletPubkey) return [];
      const api = await fetchPositions(walletPubkey);
      return api ?? mockPositions(walletPubkey);
    },
    enabled: !!walletPubkey,
    staleTime: 30_000,
  });
}
