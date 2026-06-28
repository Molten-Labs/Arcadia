import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PublicKey } from "@solana/web3.js";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  initManager: vi.fn(),
  createVault: vi.fn(),
  depositJunior: vi.fn(),
  getAccountInfo: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  profilePda: "So11111111111111111111111111111111111111112",
  configPda: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
}));

vi.mock("@/hooks/useTransactions", () => ({
  useKilnTransactions: () => ({
    initManager: mocks.initManager,
    createVault: mocks.createVault,
    depositJunior: mocks.depositJunior,
  }),
}));

vi.mock("@/hooks/useDataMode", () => ({
  useDataMode: () => ({ isMock: false, mode: "real" }),
}));

vi.mock("@/lib/wallet", async () => {
  const { Keypair } =
    await vi.importActual<typeof import("@solana/web3.js")>("@solana/web3.js");
  return {
    useWallet: () => ({
      publicKey: Keypair.fromSeed(new Uint8Array(32).fill(91)).publicKey,
      connection: { getAccountInfo: mocks.getAccountInfo },
    }),
  };
});

vi.mock("@/lib/solana/pdas", async () => {
  const { PublicKey } =
    await vi.importActual<typeof import("@solana/web3.js")>("@solana/web3.js");
  return {
    getManagerProfilePDA: () => [new PublicKey(mocks.profilePda), 255],
    getVaultConfigPDA: () => [new PublicKey(mocks.configPda), 254],
  };
});

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    success: mocks.toastSuccess,
  },
}));

vi.mock("@/components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/Banner", () => ({
  Banner: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div>
      {title}
      {children}
    </div>
  ),
}));

import CreateVault from "./CreateVault";

function renderPage() {
  render(
    <MemoryRouter>
      <CreateVault />
    </MemoryRouter>,
  );
}

describe("CreateVault transaction flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.initManager.mockResolvedValue("sig-init");
    mocks.createVault.mockResolvedValue("sig-create");
    mocks.depositJunior.mockResolvedValue("sig-deposit");
    const profileData = Buffer.alloc(64);
    profileData.writeUInt16LE(1, 56);
    mocks.getAccountInfo.mockResolvedValue({ data: profileData });
  });

  it("wires Create & fund vault to initManager, createVault, and depositJunior", async () => {
    const expectedConfigPda = new PublicKey(mocks.configPda);

    renderPage();

    fireEvent.change(screen.getByPlaceholderText(/signal macro/i), {
      target: { value: "Signal Macro III" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "2.5" },
    });
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: /continue/i }));
    fireEvent.click(screen.getByRole("button", { name: /create & fund vault/i }));

    await waitFor(() => expect(mocks.depositJunior).toHaveBeenCalled());
    expect(mocks.initManager).toHaveBeenCalledTimes(1);
    expect(mocks.createVault).toHaveBeenCalledWith({
      name: "Signal Macro III",
      feeBps: 2_000,
      maxSlippageBps: 200,
      paperWindowSecs: 30 * 24 * 60 * 60,
    });
    expect(mocks.depositJunior).toHaveBeenCalledWith(expectedConfigPda, 2_500_000n);
    expect(mocks.initManager.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.createVault.mock.invocationCallOrder[0],
    );
    expect(mocks.createVault.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.depositJunior.mock.invocationCallOrder[0],
    );
  });
});
