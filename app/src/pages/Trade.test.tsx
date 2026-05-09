import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";

const mocks = vi.hoisted(() => ({
  toastError: vi.fn(),
  toastLoading: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/wallet", () => ({
  useWallet: () => ({ connected: true, role: "trader" }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: mocks.toastError,
    loading: mocks.toastLoading,
    success: mocks.toastSuccess,
  },
}));

vi.mock("@/components/Layout", () => ({
  Layout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/lib/solana/constants", () => ({
  ARCADIA_EXECUTION_ENV: "surfpool",
  SOLANA_CLUSTER: "mainnet-beta",
}));

import Trade from "./Trade";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("Trade simulated swap screen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => null,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the trade action on the client-side simulation path", async () => {
    render(
      <MemoryRouter>
        <Trade />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: /simulate guarded quote/i }));
    expect(mocks.toastLoading).toHaveBeenCalledWith("Simulating guarded quote…", { id: "swap" });

    await act(async () => {
      vi.advanceTimersByTime(1_400);
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      "Simulation complete",
      expect.objectContaining({ id: "swap" }),
    );
  });
});
