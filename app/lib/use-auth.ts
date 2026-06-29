"use client";

/**
 * useAuth — Sign-In With Solana (SIWS) hook.
 *
 * Flow:
 *  1. signIn() fetches a nonce from /api/v1/auth/challenge
 *  2. Builds the canonical SIWS message (matches Rust auth.rs siws_message)
 *  3. Asks the wallet to sign the message bytes
 *  4. Encodes the signature as base58
 *  5. POSTs { pubkey, signature, nonce } to /api/v1/auth/verify
 *  6. Stores the returned token in localStorage
 *
 * apiFetch (utils.ts) reads the token and sends it as Authorization: Bearer.
 */

import { useCallback, useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import bs58 from "bs58";

const TOKEN_KEY  = "arcadia_jwt";
const WALLET_KEY = "arcadia_wallet";

/** Canonical SIWS message — must match Rust `siws_message()` in auth.rs */
function buildSiwsMessage(pubkey: string, nonce: string): string {
  return `Arcadia wants you to sign in with your Solana account:\n${pubkey}\n\nNonce: ${nonce}`;
}

export function useAuth() {
  const { publicKey, signMessage, connected, disconnect } = useWallet();
  const [token,   setToken]   = useState<string | null>(null);
  const [wallet,  setWallet]  = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  // Hydrate from localStorage on mount and whenever the connected wallet changes.
  // If the stored wallet doesn't match the currently-connected key, wipe the
  // stale session so protected requests don't leak credentials.
  useEffect(() => {
    const storedToken  = localStorage.getItem(TOKEN_KEY);
    const storedWallet = localStorage.getItem(WALLET_KEY);
    const currentKey   = publicKey?.toBase58() ?? null;

    if (storedToken && storedWallet && storedWallet === currentKey) {
      setToken(storedToken);
      setWallet(storedWallet);
    } else {
      // Wallet changed or no wallet — clear stale session
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(WALLET_KEY);
      setToken(null);
      setWallet(null);
    }
  }, [publicKey]);

  const signIn = useCallback(async () => {
    if (!publicKey || !signMessage) {
      setError("Wallet not connected or does not support message signing.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch nonce
      const challengeRes = await fetch("/api/v1/auth/challenge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!challengeRes.ok) throw new Error("Failed to get auth challenge.");
      const { nonce } = await challengeRes.json() as { nonce: string };

      // 2. Build canonical SIWS message
      const message = buildSiwsMessage(publicKey.toBase58(), nonce);

      // 3. Sign
      const encoded   = new TextEncoder().encode(message);
      const sigBytes  = await signMessage(encoded);

      // 4. Encode as base58 (matches Rust bs58::decode expectation)
      const sigBase58 = bs58.encode(sigBytes);

      // 5. Verify → receive token
      const verifyRes = await fetch("/api/v1/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pubkey:    publicKey.toBase58(),
          signature: sigBase58,
          nonce,
        }),
      });
      if (!verifyRes.ok) {
        const body = await verifyRes.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? "Signature verification failed.");
      }
      const { token: jwt } = await verifyRes.json() as { token: string };

      // 6. Persist
      localStorage.setItem(TOKEN_KEY,  jwt);
      localStorage.setItem(WALLET_KEY, publicKey.toBase58());
      setToken(jwt);
      setWallet(publicKey.toBase58());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [publicKey, signMessage]);

  const signOut = useCallback(async () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(WALLET_KEY);
    setToken(null);
    setWallet(null);
    await disconnect();
  }, [disconnect]);

  return {
    token,
    wallet,
    isAuthenticated: !!token && !!wallet,
    loading,
    error,
    signIn,
    signOut,
  };
}
