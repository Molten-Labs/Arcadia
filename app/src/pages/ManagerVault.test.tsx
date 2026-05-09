import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Keypair, PublicKey } from "@solana/web3.js";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VaultView } from "@/hooks/useVaults";

const mocks = vi.hoisted(() => ({
  vault: undefined as VaultView | undefined,
  balance: 10,
  depositJunior: vi.fn(),
  withdrawJunior: vi.fn(),
  updateNav: vi.fn(),
  graduateVault: vi.fn(),
  executeSwap: vi.fn(),
  claimFees: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/hooks/useVaults", () => ({
  useVault: () => ({ data: mocks.vault, isLoading: false, error: null }),
}));

vi.mock("@/hooks/useBalance", () => ({
  useBalance: () => ({ data: mocks.balance }),
}));

vi.mock("@/hooks/useTransactions", () => ({
  useKilnTransactions: () => ({
    depositJunior: mocks.depositJunior,
    withdrawJunior: mocks.withdrawJunior,
    updateNav: mocks.updateNav,
    graduateVault: mocks.graduateVault,
    executeSwap: mocks.executeSwap,
    claimFees: mocks.claimFees,
  }),
}));

vi.mock("@/hooks/useDataMode", () => ({
  useDataMode: () => ({ isMock: false, mode: "real" }),
}));

vi.mock("@/lib/solana/jupiter", () => ({
  isRealJupiterEnabled: () => false,
}));

vi.mock("@/lib/wallet", () => ({
  shortAddr: (address: string) => `${address.slice(0, 4)}...${address.slice(-4)}`,
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
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

import ManagerVault from "./ManagerVault";

function key(seed: number): PublicKey {
  return Keypair.fromSeed(new Uint8Array(32).fill(seed)).publicKey;
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/manager/vault/test-vault"]}>
        <Routes>
          <Route path="/manager/vault/:id" element={<ManagerVault />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ManagerVault transaction flows", () => {
  const configPubkey = key(1).toBase58();
  const managerPubkey = key(2).toBase58();

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.depositJunior.mockResolvedValue("sig");
    mocks.withdrawJunior.mockResolvedValue("sig");
    mocks.updateNav.mockResolvedValue("sig");
    mocks.graduateVault.mockResolvedValue("sig");
    mocks.executeSwap.mockResolvedValue("sig");
    mocks.claimFees.mockResolvedValue("sig");
    mocks.vault = {
      id: configPubkey,
      name: "Manager Vault",
      configPubkey,
      statePubkey: key(3).toBase58(),
      treasuryPubkey: key(4).toBase58(),
      managerPubkey,
      status: "paper",
      tvl: 4,
      juniorCapital: 4,
      seniorCapital: 0,
      originalJuniorDepositLamports: 1_000_000n,
      juniorCapitalLamports: 4_000_000n,
      seniorCapitalLamports: 0n,
      juniorSharesOutstanding: 2_000_000,
      seniorSharesOutstanding: 0,
      juniorSharesOutstandingRaw: 2_000_000n,
      seniorSharesOutstandingRaw: 0n,
      juniorHealth: 100,
      currentNav: 4,
      currentNavLamports: 4_000_000n,
      highWaterMark: 1,
      highWaterMarkLamports: 1_000_000n,
      feeBps: 2_000,
      maxSlippageBps: 100,
      createdAt: 1,
      paperWindowSecs: 1,
      graduatedAt: 0,
      paperTradeCount: 10,
      minQualifyingTrades: 10,
      rolling24hLossBps: 0,
      rolling7dLossBps: 0,
      tradingEnabled: true,
      instantExit: false,
      vaultIndex: 0,
    };
  });

  it("withdraws junior capital by requested USDC amount", async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/junior amount/i), {
      target: { value: "1" },
    });
    fireEvent.click(screen.getAllByRole("button", { name: /withdraw junior/i })[0]);

    await waitFor(() => expect(mocks.withdrawJunior).toHaveBeenCalled());
    const [vaultConfig, amountUsdc] = mocks.withdrawJunior.mock.calls[0];
    expect(vaultConfig.toBase58()).toBe(configPubkey);
    expect(amountUsdc).toBe(1_000_000n);
  });

  it("wires manager nav, graduation, and guard-swap actions", async () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /update nav/i }));
    await waitFor(() => expect(mocks.updateNav).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /^graduate$/i }));
    await waitFor(() => expect(mocks.graduateVault).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText(/junior amount/i), {
      target: { value: "0.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /run guard swap/i }));

    await waitFor(() => expect(mocks.executeSwap).toHaveBeenCalled());
    expect(mocks.updateNav.mock.calls[0][0].toBase58()).toBe(configPubkey);
    expect(mocks.graduateVault.mock.calls[0][0].toBase58()).toBe(configPubkey);
    expect(mocks.graduateVault.mock.calls[0][1].toBase58()).toBe(managerPubkey);
    expect(mocks.executeSwap.mock.calls[0][0].toBase58()).toBe(configPubkey);
    expect(mocks.executeSwap.mock.calls[0][1]).toBe(500_000n);
    expect(mocks.executeSwap.mock.calls[0][2]).toBe(0n);
  });
});
