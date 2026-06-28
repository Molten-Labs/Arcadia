import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchKilnApi, getArcadiaRealtimeUrl, isArcadiaDemoMode, postKilnApi } from "./api";

describe("Arcadia API client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("derives the realtime websocket URL from the configured API URL", () => {
    vi.stubEnv("VITE_KILN_API_URL", "http://127.0.0.1:8787/");

    expect(getArcadiaRealtimeUrl()).toBe("ws://127.0.0.1:8787/live");

    vi.stubEnv("VITE_KILN_API_URL", "https://api.arcadia.example");

    expect(getArcadiaRealtimeUrl()).toBe("wss://api.arcadia.example/live");
  });

  it("detects demo mode from the frontend environment", () => {
    vi.stubEnv("VITE_ARCADIA_DEMO_MODE", "true");

    expect(isArcadiaDemoMode()).toBe(true);

    vi.stubEnv("VITE_ARCADIA_DEMO_MODE", "0");

    expect(isArcadiaDemoMode()).toBe(false);
  });

  it("fetches the same vault list endpoint used by the frontend first load", async () => {
    vi.stubEnv("VITE_KILN_API_URL", "http://127.0.0.1:8787");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ items: [{ configPubkey: "vault-demo", name: "Proof Vault" }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchKilnApi<{ items: Array<{ configPubkey: string; name: string }> }>("/vaults");

    expect(fetchMock).toHaveBeenCalledWith("http://127.0.0.1:8787/vaults");
    expect(response?.items[0]).toMatchObject({ configPubkey: "vault-demo", name: "Proof Vault" });
  });

  it("posts demo actions with JSON like the demo control panel", async () => {
    vi.stubEnv("VITE_KILN_API_URL", "http://127.0.0.1:8787");
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ ok: true, step: "run-full" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await postKilnApi<{ ok: boolean; step: string }>("/demo/run-full", { speed: "screen-record" });

    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8787/demo/run-full",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ speed: "screen-record" }),
      }),
    );
    expect(response).toEqual({ ok: true, step: "run-full" });
  });

  it("surfaces non-ok API responses for recovery UI", async () => {
    vi.stubEnv("VITE_KILN_API_URL", "http://127.0.0.1:8787");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 500 })));

    await expect(postKilnApi("/demo/run-full")).rejects.toThrow("Arcadia API request failed: 500");
  });
});
