"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWalletCompat } from "@/lib/use-wallet-compat";

import { LogoMark } from "@/components/landing/LogoMark";
import { useRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

import { useHydrated } from "./use-hydrated";
import {
  BOTTOM_LINKS,
  getHomeHref,
  getNavLinks,
  isActivePath,
  type NavLink,
} from "./nav-items";

function NavItem({ href, icon: Icon, label, active, dimmed }: NavLink & { active: boolean; dimmed?: boolean }) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
        "outline-none focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-panel",
        active
          ? "bg-acid/[0.07] text-acid"
          : dimmed
            ? "text-faint hover:bg-white/[0.04] hover:text-muted"
            : "text-muted hover:bg-white/[0.04] hover:text-ink",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute top-1/2 left-0 h-5 w-0.5 -translate-y-1/2 origin-center rounded-full bg-acid transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] motion-reduce:transition-none",
          active
            ? "scale-y-100"
            : "scale-y-0 group-hover:scale-y-100 group-focus-visible:scale-y-100",
        )}
      />
      <Icon
        className="size-4 shrink-0 transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:translate-x-0.5 group-focus-visible:translate-x-0.5 motion-reduce:translate-x-0 motion-reduce:transition-none"
        strokeWidth={active ? 2.2 : 1.8}
        aria-hidden
      />

      {/* Tooltip */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-md border border-line bg-panel px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.11em] text-ink shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150"
      >
        {label}
      </span>
    </Link>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const hydrated = useHydrated();
  const wallet = useWalletCompat();
  const { role: rawRole } = useRole();

  const connected = hydrated && wallet.connected;
  const role = hydrated ? rawRole : null;
  const publicKey = hydrated ? wallet.publicKey : null;

  const navLinks = getNavLinks(role, connected);
  const primaryLinks = navLinks.filter((l) => l.primary);
  const secondaryLinks = navLinks.filter((l) => !l.primary);
  const homeHref = getHomeHref(role, connected);

  const base58 = publicKey?.toBase58();
  const initial = base58 ? base58.slice(0, 1).toUpperCase() : "?";

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden w-14 flex-col items-center border-r border-line bg-panel py-3 md:flex"
      aria-label="Sidebar"
    >
      {/* Logo */}
      <Link
        href={homeHref}
        aria-label="Arcadia home"
        className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-acid focus-visible:ring-offset-2 focus-visible:ring-offset-panel"
      >
        <LogoMark size={22} />
      </Link>

      <div className="w-8 border-t border-line mb-3" />

      {/* Primary nav */}
      <nav aria-label="Main" className="flex flex-1 flex-col items-center gap-0.5 overflow-y-auto">
        {primaryLinks.map((l) => (
          <NavItem key={l.href} {...l} active={isActivePath(pathname, l.href)} />
        ))}
        {secondaryLinks.length > 0 && (
          <>
            <div className="my-2 w-8 border-t border-line" />
            {secondaryLinks.map((l) => (
              <NavItem key={l.href} {...l} active={isActivePath(pathname, l.href)} dimmed />
            ))}
          </>
        )}
      </nav>

      <div className="w-8 border-t border-line my-2" />

      {/* Bottom links */}
      <div className="flex flex-col items-center gap-0.5">
        {connected ? (
          <>
            {BOTTOM_LINKS.map((l) => (
              <NavItem key={l.href} {...l} active={isActivePath(pathname, l.href)} />
            ))}
            {/* Avatar */}
            <div className="group relative mt-1 flex h-10 w-10 items-center justify-center">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full border border-acid/30 bg-acid/10 font-mono text-[11px] font-bold text-acid"
                aria-hidden
              >
                {initial}
              </span>
              <span
                aria-hidden
                className="pointer-events-none absolute left-full ml-3 z-50 whitespace-nowrap rounded-md border border-line bg-panel px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.11em] text-ink shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150"
              >
                Devnet
              </span>
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}
