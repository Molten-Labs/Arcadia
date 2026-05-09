import { fetchKilnApi, postKilnApi } from "@/lib/api";

export const DEMO_VAULT_CONFIG = "So11111111111111111111111111111111111111112";

export interface MarketQuote {
  vaultConfigPubkey: string;
  route: string;
  inputAmount: number;
  inputSymbol: string;
  expectedOutput: number;
  outputSymbol: string;
  priceImpactPct: number;
  routeLabels: string[];
  quoteSource: string;
  executionEnv: string;
  contextSlot?: number | null;
  fetchedAt: number;
}

export async function fetchSurfpoolJupiterQuote() {
  return fetchKilnApi<MarketQuote>("/demo/surfpool/jupiter-quote");
}

export async function runSurfpoolDemoStep(path: string) {
  return postKilnApi<{ ok: boolean; step: string; message?: string }>(path);
}
