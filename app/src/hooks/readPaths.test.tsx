import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { Keypair, PublicKey } from "@solana/web3.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

import { calculatePositionValue, usePositions } from "./usePositions";
import { useVaults } from "./useVaults";

const mocks = vi.hoisted(() => ({
  publicKey: undefined as PublicKey | undefined,
  connection: undefined as unknown,
  fetchAllVaults: vi.fn(),
  fetchAllManagers: vi.fn(),
}));

vi.mock("@/lib/wallet", () => ({
  useWallet: () => ({
    connection: mocks.connection,
    publicKey: mocks.publicKey ?? null,
  }),
}));

vi.mock("@/lib/solana/accounts", async () => {
  const actual = await vi.importActual<object>("@/lib/solana/accounts");
  return {
    ...actual,
    fetchAllVaults: mocks.fetchAllVaults,
    fetchAllManagers: mocks.fetchAllManagers,
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function key(seed: number): PublicKey {
  return Keypair.fromSeed(new Uint8Array(32).fill(seed)).publicKey;
}

describe("backend-backed read hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("VITE_KILN_API_URL", "http://kiln-api.test");
    vi.stubEnv("VITE_ARCADIA_DEMO_MODE", "false");
    vi.stubEnv("VITE_ARCADIA_EXECUTION_ENV", "");
    localStorage.setItem("kiln:data-mode", "real");
    mocks.publicKey = key(1);
    mocks.connection = null;
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("loads deterministic mock vaults without API, wallet, or RPC when mock mode is selected", async () => {
    vi.unstubAllEnvs();
    localStorage.setItem("kiln:data-mode", "mock");
    mocks.publicKey = undefined;
    mocks.connection = null;

    const { result } = renderHook(() => useVaults(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0].name).toBe("Signal Macro I");
    expect(result.current.data?.length).toBeGreaterThan(1);
    expect(mocks.fetchAllVaults).not.toHaveBeenCalled();
  });

  it("loads vaults from the backend API without requiring an RPC connection", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          items: [
            {
              id: "vault-config-1",
              name: "Backend Vault",
              configPubkey: "vault-config-1",
              statePubkey: "vault-state-1",
              treasuryPubkey: "treasury-1",
              managerPubkey: "manager-1",
              status: "active",
              juniorCapital: 12,
              seniorCapital: 40,
              seniorSharesOutstanding: 400,
              currentNav: 52,
              juniorHealth: 100,
              tradingEnabled: true,
            },
          ],
        }),
      })
    );

    const { result } = renderHook(() => useVaults(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0].name).toBe("Backend Vault");
    expect(result.current.data?.[0].seniorCapitalLamports).toBe(40_000_000n);
    expect(mocks.fetchAllVaults).not.toHaveBeenCalled();
  });

  it("falls back to direct RPC vault reads when the backend is unavailable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    mocks.connection = {};
    mocks.fetchAllVaults.mockResolvedValue([
      {
        configPubkey: key(2),
        config: {
          name: "RPC Vault",
          vaultIndex: 7,
          vaultState: key(3),
          treasury: key(4),
          manager: key(5),
          managerFeeBps: 2000,
          maxSlippageBps: 50,
          createdAt: 100n,
          paperWindowSecs: 86_400n,
        },
        state: {
          isPaperMode: false,
          isGraduated: true,
          isPaused: false,
          juniorCapital: 10_000_000_000n,
          seniorCapital: 40_000_000_000n,
          originalJuniorDeposit: 10_000_000_000n,
          juniorSharesOutstanding: 10_000_000_000n,
          seniorSharesOutstanding: 40_000_000_000n,
          currentNav: 50_000_000_000n,
          highWaterMark: 50_000_000_000n,
          graduatedAt: 120n,
          paperTradeCount: 3,
          minQualifyingTrades: 3,
          rolling24hLossBps: 0,
          rolling7dLossBps: 0,
          tradingEnabled: true,
        },
      },
    ]);

    const { result } = renderHook(() => useVaults(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0].name).toBe("RPC Vault");
    expect(mocks.fetchAllVaults).toHaveBeenCalledOnce();
  });

  it("computes backend position value from senior principal accounting", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.endsWith("/positions/" + mocks.publicKey?.toBase58())) {
          return {
            ok: true,
            json: async () => ({
              items: [
                {
                  pubkey: "position-1",
                  vaultConfigPubkey: "vault-config-1",
                  investorPubkey: mocks.publicKey?.toBase58(),
                  depositedAt: 100,
                  seniorPrincipalRemaining: 100,
                  totalDeposited: 10,
                  alertThresholdBps: 2000,
                  vault: {
                    configPubkey: "vault-config-1",
                    seniorCapital: 40,
                    seniorSharesOutstanding: 400,
                  },
                },
              ],
            }),
          };
        }

        return {
          ok: true,
          json: async () => ({ items: [] }),
        };
      })
    );

    const { result } = renderHook(() => usePositions(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.[0].currentValue).toBe(10);
  });

  it("exposes principal-ledger calculation for raw on-chain values", () => {
    const value = calculatePositionValue(
      100_000_000n,
      10_000_000n,
      {
        seniorCapitalLamports: 40_000_000n,
        seniorSharesOutstandingRaw: 400_000_000n,
      } as never
    );

    expect(value).toBe(10);
  });
});
