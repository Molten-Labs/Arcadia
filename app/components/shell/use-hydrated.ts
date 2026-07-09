import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

/**
 * Returns `false` during SSR and the first client render, then `true` after
 * hydration. Lets shell chrome gate wallet-derived UI (connected state, pubkey)
 * without a `setState`-in-effect, matching the codebase's role-context pattern.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
