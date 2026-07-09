"use client";

/**
 * useAuth — Sign-In With Solana (SIWS) hook.
 *
 * Flow:
 *  1. signIn() fetches a nonce from /api/v1/auth/challenge
 *  2. Builds the canonical SIWS message (lib/siws, matches Rust auth.rs)
 *  3. Asks the wallet to sign the message bytes
 *  4. POSTs { pubkey, signature (base58), nonce } to /api/v1/auth/verify
 *  5. Stores the returned token in localStorage
 *
 * The stored session is exposed via useSyncExternalStore (single source of
 * truth: localStorage), and only counts as authenticated while the stored
 * wallet matches the currently connected key. apiFetch (utils.ts) reads the
 * same token for Authorization: Bearer.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";
import { buildSiwsMessage } from "./siws";

const TOKEN_KEY = "arcadia_jwt";
const WALLET_KEY = "arcadia_wallet";
const AUTH_EVENT = "arcadia-auth-change";

interface StoredSession {
  token: string;
  wallet: string;
}

/* ── localStorage-backed session store ──────────────────────────────── */

let cachedSession: StoredSession | null = null;

function getSessionSnapshot(): StoredSession | null {
  const token = localStorage.getItem(TOKEN_KEY);
  const wallet = localStorage.getItem(WALLET_KEY);
  if (!token || !wallet) return (cachedSession = null);
  if (!cachedSession || cachedSession.token !== token || cachedSession.wallet !== wallet) {
    cachedSession = { token, wallet };
  }
  return cachedSession;
}

function subscribeSession(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(AUTH_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(AUTH_EVENT, onChange);
  };
}

function writeSession(session: StoredSession | null) {
  if (session) {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(WALLET_KEY, session.wallet);
  } else {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(WALLET_KEY);
  }
  window.dispatchEvent(new Event(AUTH_EVENT));
}

/* ── SSR-safe hydration flag ────────────────────────────────────────── */
// wallet-adapter-react 0.15+ uses a Proxy default context that console.errors
// on property access outside a WalletProvider; only dereference it client-side.
const noopSubscribe = () => () => {};
function useHydrated(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function useAuth() {
  const walletAdapter = useWallet();
  const hydrated = useHydrated();
  const session = useSyncExternalStore(subscribeSession, getSessionSnapshot, () => null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const publicKey = hydrated ? walletAdapter.publicKey : null;
  const signMessage = hydrated ? walletAdapter.signMessage : undefined;
  const disconnect = hydrated ? walletAdapter.disconnect : undefined;

  const currentKey = publicKey?.toBase58() ?? null;
  const sessionValid = session !== null && session.wallet === currentKey;

  // A stored session for a *different* connected wallet is stale — wipe it so
  // apiFetch (which reads localStorage directly) can't send its credentials.
  // When no wallet is connected yet (autoConnect still resolving) the session
  // is kept; it simply doesn't count as authenticated until the keys match.
  useEffect(() => {
    if (session && currentKey && session.wallet !== currentKey) {
      writeSession(null);
    }
  }, [session, currentKey]);

  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setError("Wallet not connected or does not support message signing.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const challengeRes = await fetch("/api/v1/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!challengeRes.ok) throw new Error("Failed to get auth challenge.");
      const { nonce } = (await challengeRes.json()) as { nonce: string };

      const message = buildSiwsMessage(publicKey.toBase58(), nonce);
      const sigBytes = await signMessage(new TextEncoder().encode(message));
      const sigBase58 = bs58.encode(sigBytes);

      const verifyRes = await fetch("/api/v1/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pubkey: publicKey.toBase58(),
          signature: sigBase58,
          nonce,
        }),
      });
      if (!verifyRes.ok) {
        const body = (await verifyRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Signature verification failed.");
      }
      const { token } = (await verifyRes.json()) as { token: string };

      writeSession({ token, wallet: publicKey.toBase58() });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [publicKey, signMessage]);

  const signOut = useCallback(async () => {
    writeSession(null);
    await disconnect?.();
  }, [disconnect]);

  return {
    token: sessionValid ? session.token : null,
    wallet: sessionValid ? session.wallet : null,
    isAuthenticated: sessionValid,
    loading,
    error,
    signIn,
    signOut,
  };
}
