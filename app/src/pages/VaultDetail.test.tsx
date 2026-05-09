import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Keypair, PublicKey } from "@solana/web3.js";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PositionView } from "@/hooks/usePositions";
import type { VaultView } from "@/hooks/useVaults";

const mocks = vi.hoisted(() => ({
  vault: undefined as VaultView | undefined,
  positions: [] as Partial<PositionView>[],
  balance: 10,
  depositSenior: vi.fn(),
  withdrawSenior: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/hooks/useVaults", () => ({
  useVault: () => ({ data: mocks.vault, isLoading: false, error: null }),
}));

vi.mock("@/hooks/usePositions", () => ({
  usePositions: () => ({ data: mocks.positions }),
}));

vi.mock("@/hooks/useBalance", () => ({
  useBalance: () => ({ data: mocks.balance }),
}));

vi.mock("@/hooks/useTransactions", () => ({
  useKilnTransactions: () => ({
    depositSenior: mocks.depositSenior,
    withdrawSenior: mocks.withdrawSenior,
  }),
}));

vi.mock("@/hooks/useDataMode", () => ({
  useDataMode: () => ({ isMock: false, mode: "real" }),
}));

vi.mock("@/lib/wallet", () => ({
  useWallet: () => ({ connected: true, role: "investor" }),
  shortAddr: (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

vi.mock("@/components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/StatusBadge", () => ({ StatusBadge: () => <span>Status</span> }));
vi.mock("@/components/HealthMeter", () => ({ HealthMeter: () => <div>Health</div> }));
vi.mock("@/components/CapitalStack", () => ({ CapitalStack: () => <div>Capital</div> }));
vi.mock("@/components/StatCard", () => ({ StatCard: ({ label }: { label: string }) => <div>{label}</div> }));
vi.mock("@/components/Banner", () => ({
  Banner: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      {title}
      {children}
    </div>
  ),
}));
vi.mock("@/components/CandlestickChart", () => ({ CandlestickChart: () => <div>Chart</div> }));
vi.mock("@/components/OrderBook", () => ({ OrderBook: () => <div>Order book</div> }));
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import VaultDetail from "./VaultDetail";

function key(seed: number): PublicKey {
  return Keypair.fromSeed(new Uint8Array(32).fill(seed)).publicKey;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/vaults/test-vault"]}>
        <Routes>
          <Route path="/vaults/:id" element={<VaultDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("VaultDetail investor withdrawal", () => {
  const configPubkey = key(10).toBase58();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.depositSenior.mockResolvedValue("sig");
    mocks.withdrawSenior.mockResolvedValue("sig");
    mocks.vault = {
      id: configPubkey,
      name: "Senior Vault",
      configPubkey,
      statePubkey: key(11).toBase58(),
      treasuryPubkey: key(12).toBase58(),
      managerPubkey: key(13).toBase58(),
      status: "active",
      tvl: 5,
      juniorCapital: 1,
      seniorCapital: 4,
      originalJuniorDepositLamports: 1_000_000n,
      juniorCapitalLamports: 1_000_000n,
      seniorCapitalLamports: 4_000_000n,
      juniorSharesOutstanding: 1_000_000,
      seniorSharesOutstanding: 2_000_000,
      juniorSharesOutstandingRaw: 1_000_000n,
      seniorSharesOutstandingRaw: 2_000_000n,
      juniorHealth: 100,
      currentNav: 5,
      currentNavLamports: 5_000_000n,
      highWaterMark: 5,
      highWaterMarkLamports: 5_000_000n,
      feeBps: 2_000,
      maxSlippageBps: 100,
      createdAt: 1,
      paperWindowSecs: 1,
      graduatedAt: 2,
      paperTradeCount: 10,
      minQualifyingTrades: 10,
      rolling24hLossBps: 0,
      rolling7dLossBps: 0,
      tradingEnabled: true,
      instantExit: false,
      vaultIndex: 0,
    };
    mocks.positions = [
      {
        vaultConfigPubkey: configPubkey,
        seniorPrincipalRemainingRaw: 600_000n,
        currentValueRaw: 1_200_000n,
      },
    ];
  });

  it("deposits senior capital by requested USDC amount", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/^amount$/i), {
      target: { value: "1.25" },
    });
    fireEvent.click(screen.getByRole("button", { name: /deposit usdc/i }));

    await waitFor(() => expect(mocks.depositSenior).toHaveBeenCalled());
    const [vaultConfig, amountUsdc] = mocks.depositSenior.mock.calls[0];
    expect(vaultConfig.toBase58()).toBe(configPubkey);
    expect(amountUsdc).toBe(1_250_000n);
  });

  it("withdraws senior capital by requested USDC amount", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /^withdraw$/i }));
    fireEvent.change(screen.getByLabelText(/^amount$/i), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /withdraw usdc/i }));

    await waitFor(() => expect(mocks.withdrawSenior).toHaveBeenCalled());
    const [vaultConfig, amountUsdc] = mocks.withdrawSenior.mock.calls[0];
    expect(vaultConfig.toBase58()).toBe(configPubkey);
    expect(amountUsdc).toBe(1_000_000n);
  });

  it("rejects withdrawals above the connected investor position", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /^withdraw$/i }));
    fireEvent.change(screen.getByLabelText(/^amount$/i), {
      target: { value: "2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /withdraw usdc/i }));

    await waitFor(() =>
      expect(mocks.toastError).toHaveBeenCalledWith("Exceeds your current claim"),
    );
    expect(mocks.withdrawSenior).not.toHaveBeenCalled();
  });
});
