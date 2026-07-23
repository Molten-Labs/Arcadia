"use client";

import { type ReactNode, createContext, useContext } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PrivyProvider } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";
import { useAuth } from "@/lib/use-auth";
import { RoleProvider } from "@/lib/role-context";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

/* ── Auth context ─────────────────────────────────────────────────── */

interface AuthContextValue {
  token: string | null;
  wallet: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  token: null,
  wallet: null,
  isAuthenticated: false,
  loading: false,
  error: null,
  signIn: async () => {},
  signOut: async () => {},
});

export function useAuthContext() {
  return useContext(AuthContext);
}

function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useAuth();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

/* ── Privy config ─────────────────────────────────────────────────── */

const PRIVY_APP_ID = "cmowmjzxf002r0cl5zonkvtai";

/* ── Root providers ───────────────────────────────────────────────── */

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <PrivyProvider
        appId={PRIVY_APP_ID}
        config={{
          appearance: {
            theme: "#222224",
            walletChainType: "solana-only",
            walletList: [
              "detected_solana_wallets",
              "phantom",
              "solflare",
              "backpack",
            ],
          },
          loginMethods: ["email", "google", "wallet"],
          embeddedWallets: {
            showWalletUIs: true,
            solana: {
              createOnLogin: "users-without-wallets",
            },
          },
          externalWallets: {
            solana: {
              connectors: toSolanaWalletConnectors(),
            },
          },
        }}
      >
        <AuthProvider>
          <RoleProvider>
            {children}
          </RoleProvider>
        </AuthProvider>
      </PrivyProvider>
    </QueryClientProvider>
  );
}
