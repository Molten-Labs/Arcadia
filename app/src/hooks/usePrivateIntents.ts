import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchPrivateIntentVaultSnapshot,
  mergePrivateIntentSnapshot,
  submitPrivateIntent,
  type PrivateIntentVaultSnapshot,
  type SubmitPrivateIntentRequest,
} from "@/lib/privateIntents";

export function usePrivateIntentVault(vaultConfigPubkey?: string) {
  return useQuery({
    queryKey: ["private-intent-vault", vaultConfigPubkey],
    queryFn: () => fetchPrivateIntentVaultSnapshot(vaultConfigPubkey!),
    enabled: !!vaultConfigPubkey,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function useSubmitPrivateIntent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (request: SubmitPrivateIntentRequest) => submitPrivateIntent(request),
    onSuccess: (snapshot, request) => {
      queryClient.setQueryData<PrivateIntentVaultSnapshot>(
        ["private-intent-vault", request.vaultConfigPubkey],
        (old) => mergePrivateIntentSnapshot(old, snapshot),
      );
      queryClient.invalidateQueries({ queryKey: ["vault-activity", request.vaultConfigPubkey] });
    },
  });
}
