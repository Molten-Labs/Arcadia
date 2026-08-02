"use client";

/**
 * useAuth — Authentication via Privy access token.
 *
 * Flow:
 *  1. User logs in through Privy (email, Google, X, or Solana wallet)
 *  2. Privy provides an access token via usePrivy().getAccessToken()
 *  3. The token is sent to the backend as Authorization: Bearer <token>
 *  4. Backend verifies the token via privy-rs and returns an internal JWT
 *  5. The internal JWT is stored in localStorage for apiFetch to use
 *
 * The stored session is exposed via useSyncExternalStore (single source of
 * truth: localStorage), and only counts as authenticated while the stored
 * token is valid. apiFetch (lib/api.ts) reads the same token for Authorization.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { usePrivy, useToken } from "@privy-io/react-auth";
import { useWalletCompat } from "./use-wallet-compat";
import { getStoredToken, setStoredToken, subscribeToStorageChanges } from "./storage";

const AUTH_EVENT = "arcadia-auth-change";

/* ── localStorage-backed session store ──────────────────────────────── */

function getSessionSnapshot(): string | null {
  return getStoredToken();
}

function subscribeSession(onChange: () => void) {
  return subscribeToStorageChanges(AUTH_EVENT, onChange);
}

function writeToken(token: string | null) {
  setStoredToken(token);
  window.dispatchEvent(new Event(AUTH_EVENT));
}

export function useAuth() {
  const privy = usePrivy();
  const { publicKey } = useWalletCompat();
  const { getAccessToken } = useToken();
  const storedToken = useSyncExternalStore(subscribeSession, getSessionSnapshot, () => null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = !!storedToken;

  // When Privy authenticates, exchange the Privy token for our backend JWT.
  useEffect(() => {
    if (!privy.authenticated || !privy.ready) return;
    if (storedToken) return;

    const exchange = async () => {
      setLoading(true);
      setError(null);
      try {
        const accessToken = await getAccessToken();
        if (!accessToken) throw new Error("No Privy access token.");

        const res = await fetch("/api/v1/auth/privy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: accessToken }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? "Token exchange failed.");
        }

        const { jwt } = (await res.json()) as { jwt: string };
        writeToken(jwt);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    };

    void exchange();
  }, [privy.authenticated, privy.ready, storedToken, getAccessToken]);

  // If Privy logs out, clear our session.
  useEffect(() => {
    if (privy.ready && !privy.authenticated && storedToken) {
      writeToken(null);
    }
  }, [privy.ready, privy.authenticated, storedToken]);

  const signIn = useCallback(async () => {
    privy.login();
  }, [privy]);

  const signOut = useCallback(async () => {
    writeToken(null);
    await privy.logout();
  }, [privy]);

  return {
    token: storedToken,
    wallet: publicKey?.toBase58() ?? null,
    isAuthenticated,
    loading,
    error,
    signIn,
    signOut,
  };
}
