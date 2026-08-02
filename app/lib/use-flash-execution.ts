"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Real Flash Trade execution for the terminal, driven through the execution
 * sidecar proxy (/api/v1/execution/*).
 *
 * The devnet-only signing seed lives in React state for the tab session only;
 * it is never written to localStorage, cookies, or any store. All on-chain
 * reads (open/close/snapshot) are real. When the sidecar is unreachable the
 * hook reports an error; it never fabricates a successful fill.
 */

export type Direction = "long" | "short";

export type ExecutionStatus = "idle" | "no-seed" | "connecting" | "error" | "live";

export type FlashPosition = {
  marketSymbol: string;
  collateralSymbol: string;
  sideUi: string;
  entryPriceUi: string;
  sizeAmountUi: string;
  sizeUsdUi: string;
  collateralUsdUi: string;
  pnlWithFeeUsdUi: string;
  pnlPercentageWithFee: string;
  leverageUi: string;
  liquidationPriceUi: string;
  venuePositionKey: string;
};

type ExecutionError = { message: string } | null;

export interface UseFlashExecution {
  seed: string;
  setSeed: (seed: string) => void;
  status: ExecutionStatus;
  error: ExecutionError;
  position: FlashPosition | null;
  open: (market: string, direction: Direction, amountUsd: number) => Promise<{ ok: boolean; error?: string }>;
  close: (market: string, direction: Direction) => Promise<{ ok: boolean; error?: string; signature?: string }>;
  refresh: (market: string, direction: Direction) => Promise<FlashPosition | null>;
}

async function post(path: string, body: unknown): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({ error: `Upstream ${res.status}` }));
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function useFlashExecution(): UseFlashExecution {
  const [seed, setSeed] = useState("");
  const [status, setStatus] = useState<ExecutionStatus>("idle");
  const [error, setError] = useState<ExecutionError>(null);
  const [position, setPosition] = useState<FlashPosition | null>(null);
  const seedRef = useRef(seed);
  useEffect(() => {
    seedRef.current = seed;
  }, [seed]);

  useEffect(() => {
    return () => {
      seedRef.current = "";
      setSeed("");
    };
  }, []);

  const refresh = useCallback(async (m: string, side: Direction) => {
    const s = seedRef.current.trim();
    if (!s) {
      setStatus("no-seed");
      setPosition(null);
      return null;
    }
    setStatus("connecting");
    const data = await post("/api/v1/execution/snapshot", {
      seedBase58: s,
      market: m,
      direction: side,
    });
    if (!data || data.error) {
      setStatus("error");
      setError({ message: (data?.error as string) ?? "Could not reach execution sidecar." });
      return null;
    }
    setError(null);
    const snap = (data.position ?? null) as FlashPosition | null;
    setPosition(snap);
    setStatus(snap ? "live" : "idle");
    return snap;
  }, []);

  const open = useCallback(async (m: string, side: Direction, amountUsd: number) => {
    const s = seedRef.current.trim();
    if (!s) {
      setStatus("no-seed");
      return { ok: false, error: "Paste a devnet execution seed first." };
    }
    setStatus("connecting");
    const data = await post("/api/v1/execution/open", {
      seedBase58: s,
      market: m,
      direction: side,
      amount: amountUsd,
    });
    if (!data || data.error) {
      setStatus("error");
      setError({ message: (data?.error as string) ?? "Opening the position failed." });
      return { ok: false, error: (data?.error as string) ?? "Open failed." };
    }
    setError(null);
    setStatus("live");
    return { ok: true };
  }, []);

  const close = useCallback(async (m: string, _side: Direction) => {
    const s = seedRef.current.trim();
    if (!s) {
      setStatus("no-seed");
      return { ok: false, error: "Paste a devnet execution seed first." };
    }
    setStatus("connecting");
    const data = await post("/api/v1/execution/close", {
      seedBase58: s,
      market: m,
    });
    if (!data || data.error) {
      setStatus("error");
      setError({ message: (data?.error as string) ?? "Closing the position failed." });
      return { ok: false, error: (data?.error as string) ?? "Close failed." };
    }
    setError(null);
    setPosition(null);
    setStatus("idle");
    return { ok: true, signature: (data.signature as string) ?? undefined };
  }, []);

  return { seed, setSeed, status, error, position, open, close, refresh };
}