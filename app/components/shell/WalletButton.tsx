"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { useHydrated } from "./use-hydrated";

/**
 * Wallet connect / disconnect entry point (wallet-adapter modal). Rendered only
 * after hydration so the server markup and the first client paint agree; a sized
 * placeholder reserves the button's footprint to avoid a layout shift on mount.
 * The button's visual styling comes from the global wallet-adapter stylesheet.
 */
export function WalletButton() {
  const hydrated = useHydrated();

  if (!hydrated) {
    return <span aria-hidden className="h-[30px] w-[132px] rounded-lg bg-panel-2" />;
  }

  return <WalletMultiButton />;
}
