"use client";

import { useCallback, useSyncExternalStore } from "react";

const KEY = "arcadia_watchlist";
const EVENT = "arcadia-watchlist-change";
const EMPTY: string[] = [];

// Cached snapshot so getSnapshot() returns a stable reference between reads
// (required by useSyncExternalStore to avoid render loops).
let cache: string[] = EMPTY;
let cacheRaw: string | null = null;

function read(): string[] {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return cache;
  }
  if (raw !== cacheRaw) {
    cacheRaw = raw;
    try {
      const parsed: unknown = raw ? JSON.parse(raw) : [];
      cache = Array.isArray(parsed) ? (parsed as string[]) : EMPTY;
    } catch {
      cache = EMPTY;
    }
  }
  return cache;
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/**
 * localStorage-backed watchlist shared across discovery pages. Uses
 * useSyncExternalStore (SSR-safe, no set-state-in-effect) so the marketplace,
 * profile, and any other consumer stay in sync within and across tabs.
 */
export function useWatchlist() {
  const watchlist = useSyncExternalStore(subscribe, read, () => EMPTY);

  const toggle = useCallback((handle: string) => {
    const current = read();
    const next = current.includes(handle)
      ? current.filter((h) => h !== handle)
      : [...current, handle];
    const serialized = JSON.stringify(next);
    try {
      window.localStorage.setItem(KEY, serialized);
    } catch {
      // ignore write failures (private mode / quota)
    }
    // Refresh the cache synchronously, then notify subscribers.
    cacheRaw = serialized;
    cache = next;
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { watchlist, toggle };
}
