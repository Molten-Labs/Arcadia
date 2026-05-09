import { afterEach, describe, expect, it, vi } from "vitest";

import {
  DATA_MODE_STORAGE_KEY,
  getDefaultDataMode,
  getStoredDataMode,
  isDataMode,
  setStoredDataMode,
  shouldUseMockData,
} from "./dataMode";

describe("data mode", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllEnvs();
  });

  it("defaults to mock mode when no API URL is configured", () => {
    vi.stubEnv("VITE_KILN_API_URL", "");
    vi.stubEnv("VITE_KILN_API_BASE_URL", "");
    vi.stubEnv("VITE_ARCADIA_EXECUTION_ENV", "");
    vi.stubEnv("VITE_SOLANA_CLUSTER", "");

    expect(getDefaultDataMode()).toBe("mock");
  });

  it("defaults to real mode when an API URL is configured", () => {
    vi.stubEnv("VITE_KILN_API_URL", "https://api.arcadia.test");

    expect(getDefaultDataMode()).toBe("real");
  });

  it("persists explicit user selection", () => {
    setStoredDataMode("mock");

    expect(localStorage.getItem(DATA_MODE_STORAGE_KEY)).toBe("mock");
    expect(getStoredDataMode()).toBe("mock");
    expect(shouldUseMockData()).toBe(true);
  });

  it("rejects invalid stored values", () => {
    localStorage.setItem(DATA_MODE_STORAGE_KEY, "paper");

    expect(isDataMode("paper")).toBe(false);
    expect(getStoredDataMode()).toBe(getDefaultDataMode());
  });
});
