"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useWalletCompat } from "@/lib/use-wallet-compat";

export type ArcadiaRole = "trader" | "investor" | null;

interface RoleContextValue {
  role: ArcadiaRole;
  setRole: (r: "trader" | "investor") => void;
  showRoleGate: boolean;
  dismissRoleGate: () => void;
}

const RoleContext = createContext<RoleContextValue>({
  role: null,
  setRole: () => {},
  showRoleGate: false,
  dismissRoleGate: () => {},
});

export function useRole() {
  return useContext(RoleContext);
}

/* ── localStorage-backed role store ─────────────────────────────────── */

const STORAGE_KEY = "arcadia_role";
const ROLE_EVENT = "arcadia-role-change";

function getRoleSnapshot(): ArcadiaRole {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === "trader" || stored === "investor" ? stored : null;
}

function subscribeRole(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(ROLE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(ROLE_EVENT, onChange);
  };
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const { connected, publicKey } = useWalletCompat();
  const role = useSyncExternalStore(subscribeRole, getRoleSnapshot, () => null);

  const [dismissedForKey, setDismissedForKey] = useState<string | null>(null);

  const currentKey = publicKey?.toBase58() ?? null;

  const showRoleGate =
    connected && currentKey !== null && role === null && dismissedForKey !== currentKey;

  const setRole = useCallback((r: "trader" | "investor") => {
    localStorage.setItem(STORAGE_KEY, r);
    window.dispatchEvent(new Event(ROLE_EVENT));
  }, []);

  const dismissRoleGate = useCallback(() => {
    setDismissedForKey(currentKey);
  }, [currentKey]);

  return (
    <RoleContext.Provider value={{ role, setRole, showRoleGate, dismissRoleGate }}>
      {children}
    </RoleContext.Provider>
  );
}
