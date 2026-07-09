"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(QUERY).matches;
// SSR snapshot: assume motion is allowed; the client value takes over on hydration.
const getServerSnapshot = () => false;

/**
 * Reactive `prefers-reduced-motion` flag. Every JS-driven acid animation gates
 * on this so motion is fully disabled for users who ask for it.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
