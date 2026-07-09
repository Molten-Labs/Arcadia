"use client";

import { useWallet } from "@solana/wallet-adapter-react";

import { cn } from "@/lib/utils";

import { useHydrated } from "./use-hydrated";

/**
 * Content column beside the desktop sidebar. Offsets left by the rail width only
 * at >= md (where the sidebar shows) and only while connected, so guests and
 * mobile render full-bleed. Reserves bottom space on mobile so scrolled content
 * clears the fixed bottom nav + the iOS home-indicator safe area.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const hydrated = useHydrated();
  const wallet = useWallet();
  const connected = hydrated && wallet.connected;

  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col overflow-hidden transition-[padding] duration-200 motion-reduce:transition-none",
        connected && "md:pl-60",
      )}
    >
      <div className="flex flex-1 flex-col overflow-hidden pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
        {children}
      </div>
    </div>
  );
}
