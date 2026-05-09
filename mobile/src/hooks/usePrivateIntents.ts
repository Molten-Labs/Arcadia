import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchPrivateIntentSnapshot, submitPrivateIntent } from '../lib/api';
import {
  emptyPrivateIntentSnapshot,
  mockPrivateIntentSnapshot,
  type PrivateIntentSnapshot,
  type SubmitPrivateIntentRequest,
} from '../lib/privateIntents';

export function usePrivateIntentState(vaultConfigPubkey: string | undefined) {
  return useQuery<PrivateIntentSnapshot>({
    queryKey: ['private-intents', vaultConfigPubkey],
    queryFn: async () => {
      if (!vaultConfigPubkey) return emptyPrivateIntentSnapshot('');
      const api = await fetchPrivateIntentSnapshot(vaultConfigPubkey);
      return api ?? emptyPrivateIntentSnapshot(vaultConfigPubkey);
    },
    enabled: !!vaultConfigPubkey,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useSubmitPrivateIntent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (request: SubmitPrivateIntentRequest & { demoFallback?: boolean }) => {
      const api = await submitPrivateIntent(request);
      if (api) return api;
      if (request.demoFallback) return mockPrivateIntentSnapshot(request.vaultConfigPubkey);
      throw new Error('Private intent backend is unavailable for this vault.');
    },
    onSuccess: (snapshot) => {
      queryClient.setQueryData(['private-intents', snapshot.vaultConfigPubkey], snapshot);
    },
  });
}
