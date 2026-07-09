"use client";

// Suppress the wallet-adapter-react 0.15+ "WalletContext without providing one"
// console.error that fires during Next.js SSR/hydration. The page renders
// correctly after hydration; this is a known compatibility issue.
if (typeof window !== "undefined") {
  const _consoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === "string" ? args[0] : "";
    if (msg.includes("WalletContext without providing one")) return;
    _consoleError(...args);
  };
}

import { type ReactNode, useMemo, createContext, useContext } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import { SolflareWalletAdapter } from "@solana/wallet-adapter-solflare";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { useAuth } from "@/lib/use-auth";
import { RoleProvider } from "@/lib/role-context";
import { RoleGate } from "@/components/RoleGate";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_HELIUS_RPC ?? "https://api.devnet.solana.com";

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

/* ── Solana wallet providers ──────────────────────────────────────── */

function SolanaProviders({ children }: { children: ReactNode }) {
  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    [],
  );

  return (
    <ConnectionProvider endpoint={RPC_ENDPOINT}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <AuthProvider>
            <RoleProvider>
              {/* Role selection gate — appears as full-screen overlay when needed */}
              <RoleGate />
              {children}
            </RoleProvider>
          </AuthProvider>
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

/* ── Root providers ───────────────────────────────────────────────── */

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <SolanaProviders>{children}</SolanaProviders>
    </QueryClientProvider>
  );
}
