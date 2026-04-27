import { getKilnApiUrl } from "./api";

export type DataMode = "mock" | "real";

export const DATA_MODE_STORAGE_KEY = "kiln:data-mode";

export function getDefaultDataMode(): DataMode {
  return getKilnApiUrl() ? "real" : "mock";
}

export function isDataMode(value: unknown): value is DataMode {
  return value === "mock" || value === "real";
}

export function getStoredDataMode(storage: Storage | undefined = globalThis.localStorage): DataMode {
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
