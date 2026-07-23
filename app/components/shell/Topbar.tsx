"use client";

import { usePathname } from "next/navigation";
import { useWalletCompat } from "@/lib/use-wallet-compat";

import { useRole } from "@/lib/role-context";

import { Notifications } from "./Notifications";
import { RoleBadge } from "./RoleBadge";
import { WalletButton } from "./WalletButton";
import { useHydrated } from "./use-hydrated";
import { routeLabel } from "./nav-items";

export function Topbar() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const wallet = useWalletCompat();
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
