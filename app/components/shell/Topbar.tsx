"use client";

import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

import { useRole } from "@/lib/role-context";

import { Notifications } from "./Notifications";
import { RoleBadge } from "./RoleBadge";
import { WalletButton } from "./WalletButton";
import { useHydrated } from "./use-hydrated";
import { routeLabel } from "./nav-items";

/**
 * App topbar. Left: current route label + a live network chip (the shell's one
 * sanctioned always-on acid accent) + role chip. Right: notifications, wallet
 * connect/disconnect, and a role avatar. Wallet-derived UI is gated on hydration
 * so SSR and the first client paint agree.
 */
export function Topbar() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const wallet = useWallet();
  const { role: rawRole } = useRole();

  const connected = hydrated && wallet.connected;
  const role = hydrated ? rawRole : null;
  const label = routeLabel(pathname);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-line bg-void/90 px-4 backdrop-blur-[12px] sm:px-5">
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="truncate font-display text-sm uppercase tracking-[-0.01em] text-ink font-bold">
          {label}
        </h1>

      </div>

      <div className="flex items-center gap-2">
        <Notifications
          key={connected ? (role ?? "connected") : "guest"}
          role={role}
          connected={connected}
        />
        <WalletButton />
      </div>
    </header>
  );
}
