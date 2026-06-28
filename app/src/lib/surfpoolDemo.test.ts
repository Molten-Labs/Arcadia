import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchSurfpoolJupiterQuote, runSurfpoolDemoStep } from "./surfpoolDemo";

describe("Surfpool demo client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the live Jupiter quote through the Arcadia API", async () => {
    vi.stubEnv("VITE_KILN_API_URL", "http://127.0.0.1:8787");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        vaultConfigPubkey: "vault-demo",
        route: "USDC -> SOL",
        inputAmount: 30_000,
        inputSymbol: "USDC",
        expectedOutput: 210.4,
        outputSymbol: "SOL",
        priceImpactPct: 0.03,
        routeLabels: ["Meteora", "Orca"],
        quoteSource: "Jupiter mainnet",
        executionEnv: "Surfpool local simulation",
        fetchedAt: 1_778_000_000,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSurfpoolJupiterQuote()).resolves.toMatchObject({
      route: "USDC -> SOL",
      quoteSource: "Jupiter mainnet",
      executionEnv: "Surfpool local simulation",
    });
    expect(String(fetchMock.mock.calls[0][0])).toContain("/demo/surfpool/jupiter-quote");
  });

  it("posts Surfpool demo actions through the backend", async () => {
    vi.stubEnv("VITE_KILN_API_URL", "http://127.0.0.1:8787");
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, step: "surfpool-simulate-swap" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(runSurfpoolDemoStep("/demo/surfpool/simulate-swap")).resolves.toMatchObject({
      ok: true,
    });
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: "POST" });
  });
});
