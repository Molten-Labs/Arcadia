import { useCallback, useEffect, useState } from "react";
import {
  type DataMode,
  getStoredDataMode,
  setStoredDataMode,
} from "@/lib/dataMode";

export function useDataMode() {
  const [mode, setModeState] = useState<DataMode>(() => getStoredDataMode());

  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === "kiln:data-mode") setModeState(getStoredDataMode());
    };
    const onModeChange = (event: Event) => {
      setModeState((event as CustomEvent<DataMode>).detail);
    };

    window.addEventListener("storage", onStorage);
    window.addEventListener("kiln:data-mode-change", onModeChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("kiln:data-mode-change", onModeChange);
    };
  }, []);

  const setMode = useCallback((nextMode: DataMode) => {
    setStoredDataMode(nextMode);
    setModeState(nextMode);
  }, []);

  return { mode, setMode, isMock: mode === "mock", isReal: mode === "real" };
}
