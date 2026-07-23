"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWalletCompat } from "@/lib/use-wallet-compat";

import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

import { useHydrated } from "./use-hydrated";
import { getMobileLinks, isActivePath, type NavLink } from "./nav-items";

function MobileNavItem({ href, icon: Icon, label, active }: NavLink & { active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-acid",
        active ? "text-acid" : "text-faint hover:text-muted",
      )}
    >
      <Icon
        className={cn(
          "size-5 transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] motion-reduce:transition-none motion-reduce:transform-none",
          active ? "scale-110" : "scale-100",
        )}
        strokeWidth={active ? 2.2 : 1.6}
        aria-hidden
      />
      <span className="font-mono text-[9px] uppercase tracking-[0.1em]">{label}</span>
    </Link>
  );
}

/**
 * Mobile bottom navigation (< md). Always present after hydration: guests get a
 * 3-item public bar, connected users get their first four primary routes plus a
 * "More" tab into settings. Mirrors the legacy shell's adaptive bottom nav.
 */
export function MobileNav() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const wallet = useWalletCompat();
  const { role: rawRole } = useRole();

  if (!hydrated) return null;

  const connected = wallet.connected;
  const role = rawRole;
  const items = getMobileLinks(role, connected);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-panel pb-safe-bottom md:hidden"
      aria-label="Bottom navigation"
    >
      {items.map((l) => (
        <MobileNavItem key={l.href} {...l} active={isActivePath(pathname, l.href)} />
      ))}
    </nav>
  );
}
