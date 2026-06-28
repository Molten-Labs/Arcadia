import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchKilnApi, getKilnApiUrl, postKilnApi } from "@/lib/api";
import type { DemoStorySnapshot } from "@/lib/realtime";
import { DEMO_VAULT_CONFIG, fetchSurfpoolJupiterQuote, runSurfpoolDemoStep, type MarketQuote } from "@/lib/surfpoolDemo";

const EMPTY_STORY: DemoStorySnapshot = {
  running: false,
  activeStep: null,
  completedSteps: [],
  lastStep: null,
};

export function useDemoStory() {
  const queryClient = useQueryClient();
  const apiUrl = getKilnApiUrl();

  const story = useQuery({
    queryKey: ["demo-story"],
    queryFn: async () => (await fetchKilnApi<DemoStorySnapshot>("/demo/story")) ?? EMPTY_STORY,
    enabled: !!apiUrl,
    initialData: EMPTY_STORY,
    staleTime: 5_000,
    refetchInterval: false,
  });

  const quote = useQuery({
    queryKey: ["market-quote", DEMO_VAULT_CONFIG],
    queryFn: fetchSurfpoolJupiterQuote,
    enabled: false,
    staleTime: 15_000,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["demo-story"] });
    queryClient.invalidateQueries({ queryKey: ["vaults"] });
    queryClient.invalidateQueries({ queryKey: ["managers"] });
    queryClient.invalidateQueries({ queryKey: ["positions"] });
    queryClient.invalidateQueries({ queryKey: ["vault-nav", DEMO_VAULT_CONFIG] });
    queryClient.invalidateQueries({ queryKey: ["vault-trades", DEMO_VAULT_CONFIG] });
  };

  const runStory = useMutation({
    mutationFn: () => postKilnApi<{ ok: boolean; step: string; mode: string }>("/demo/story/run"),
    onSuccess: invalidate,
  });

  const resetStory = useMutation({
    mutationFn: () => postKilnApi<{ ok: boolean; step: string }>("/demo/story/reset"),
    onSuccess: invalidate,
  });

  const stopStory = useMutation({
    mutationFn: () => postKilnApi<{ ok: boolean; step: string }>("/demo/story/stop"),
    onSuccess: invalidate,
  });

  const fetchQuote = useMutation({
    mutationFn: fetchSurfpoolJupiterQuote,
    onSuccess: (data) => {
      queryClient.setQueryData<MarketQuote>(["market-quote", data.vaultConfigPubkey], data);
    },
  });

  const runStep = useMutation({
    mutationFn: runSurfpoolDemoStep,
    onSuccess: invalidate,
  });

  const error =
    story.error ??
    runStory.error ??
    resetStory.error ??
    stopStory.error ??
    fetchQuote.error ??
    runStep.error ??
    null;

  return {
    story: story.data ?? EMPTY_STORY,
    storyQuery: story,
    quote: quote.data ?? queryClient.getQueryData<MarketQuote>(["market-quote", DEMO_VAULT_CONFIG]) ?? null,
    runStory,
    resetStory,
    stopStory,
    fetchQuote,
    runStep,
    error,
    isBusy:
      story.isFetching ||
      runStory.isPending ||
      resetStory.isPending ||
      stopStory.isPending ||
      fetchQuote.isPending ||
      runStep.isPending,
  };
}
