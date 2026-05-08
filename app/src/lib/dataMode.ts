import { getKilnApiUrl, isArcadiaDemoMode } from "./api";

export type DataMode = "mock" | "real";

export const DATA_MODE_STORAGE_KEY = "kiln:data-mode";

function hasRealApiConfigured(): boolean {
  const apiUrl = getKilnApiUrl();
  return Boolean(apiUrl) && !apiUrl.includes("localhost") && !apiUrl.includes("127.0.0.1");
}

export function getDefaultDataMode(): DataMode {
  return hasRealApiConfigured() ? "real" : "mock";
}

export function isDataMode(value: unknown): value is DataMode {
  return value === "mock" || value === "real";
}

export function getStoredDataMode(storage: Storage | undefined = globalThis.localStorage): DataMode {
  // Demo/local mode: always prefer mock unless real API is configured
  if (isArcadiaDemoMode() || !hasRealApiConfigured()) return "mock";
  try {
    const value = storage?.getItem(DATA_MODE_STORAGE_KEY);
    return isDataMode(value) ? value : getDefaultDataMode();
  } catch {
    return getDefaultDataMode();
  }
}

export function setStoredDataMode(mode: DataMode, storage: Storage | undefined = globalThis.localStorage) {
  storage?.setItem(DATA_MODE_STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent<DataMode>("kiln:data-mode-change", { detail: mode }));
}

export function shouldUseMockData(mode = getStoredDataMode()) {
  return mode === "mock";
}
