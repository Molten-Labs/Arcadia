"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { useWallet } from "@solana/wallet-adapter-react";

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

/* ── SSR-safe hydration flag ────────────────────────────────────────── */
// wallet-adapter-react 0.15+ uses a Proxy default context that console.errors
// on property access outside a WalletProvider; only dereference it client-side.
const noopSubscribe = () => () => {};

export function RoleProvider({ children }: { children: ReactNode }) {
  const walletAdapter = useWallet();
  const hydrated = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const role = useSyncExternalStore(subscribeRole, getRoleSnapshot, () => null);

  // The gate is derived, not stored: first wallet connection with no role
  // chosen shows it, until the user picks a role or dismisses it for this key.
  const [dismissedForKey, setDismissedForKey] = useState<string | null>(null);

  const connected = hydrated ? walletAdapter.connected : false;
  const publicKey = hydrated ? walletAdapter.publicKey : null;
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
