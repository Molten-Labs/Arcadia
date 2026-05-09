import { getKilnApiUrl, isArcadiaDemoMode, isArcadiaDevnetProductMode } from "./api";

export type DataMode = "mock" | "real";

export const DATA_MODE_STORAGE_KEY = "kiln:data-mode";

function hasRealApiConfigured(): boolean {
  if (isArcadiaDevnetProductMode()) return true;
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
  // Cinematic demo mode owns its local/mock state. Real devnet mode must not
  // silently downgrade wallet actions to mock just because the API is local,
  // but an explicit user/test selection is still honored.
  if (isArcadiaDemoMode()) return "mock";
  try {
    const value = storage?.getItem(DATA_MODE_STORAGE_KEY);
    if (isDataMode(value)) return value;
  } catch {
    return getDefaultDataMode();
  }
  if (isArcadiaDevnetProductMode()) return "real";
  if (!hasRealApiConfigured()) return "mock";
  return getDefaultDataMode();
}

export function setStoredDataMode(mode: DataMode, storage: Storage | undefined = globalThis.localStorage) {
  storage?.setItem(DATA_MODE_STORAGE_KEY, mode);
  window.dispatchEvent(new CustomEvent<DataMode>("kiln:data-mode-change", { detail: mode }));
}

export function shouldUseMockData(mode = getStoredDataMode()) {
  return mode === "mock";
}
