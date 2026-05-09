import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchJupiterQuote } from "./jupiter";

describe("Jupiter proxy client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("surfaces the Rust backend devnet guard message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({
        mode: "mock",
        reason: "Real Jupiter swaps are mainnet-beta only; devnet swaps remain guard-only.",
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      fetchJupiterQuote({
        route: "SolToUsdc",
        amount: 1_000n,
        slippageBps: 50,
      })
    ).rejects.toThrow("Real Jupiter swaps are mainnet-beta only");

    expect(String(fetchMock.mock.calls[0][0])).toContain("/jupiter/quote");
  });
});
