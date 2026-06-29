"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
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

const STORAGE_KEY = "arcadia_role";

export function RoleProvider({ children }: { children: ReactNode }) {
  const { connected, publicKey } = useWallet();
  const [role, setRoleState] = useState<ArcadiaRole>(null);
  const [showRoleGate, setShowRoleGate] = useState(false);
  const [mounted, setMounted] = useState(false);

  /* Hydrate from localStorage on mount */
  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY) as ArcadiaRole;
    if (stored === "trader" || stored === "investor") {
      setRoleState(stored);
    }
  }, []);

  /* Show gate when wallet connects for first time with no role stored */
  useEffect(() => {
    if (!mounted) return;
    if (connected && publicKey && !role) {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        setShowRoleGate(true);
      }
    }
    if (!connected) {
      setShowRoleGate(false);
    }
  }, [connected, publicKey, role, mounted]);

  const setRole = useCallback((r: "trader" | "investor") => {
    localStorage.setItem(STORAGE_KEY, r);
    setRoleState(r);
    setShowRoleGate(false);
  }, []);

  const dismissRoleGate = useCallback(() => {
    setShowRoleGate(false);
  }, []);

  return (
    <RoleContext.Provider value={{ role, setRole, showRoleGate, dismissRoleGate }}>
      {children}
    </RoleContext.Provider>
  );
}
