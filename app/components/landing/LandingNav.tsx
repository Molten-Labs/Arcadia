import Link from "next/link";

import { LogoMark } from "./LogoMark";
import { MobileMenu } from "./MobileMenu";
import { TryDemoButton } from "./TryDemoButton";
import { LINKS, NAV_LINKS } from "./data";

/**
 * Landing top nav (marketing chrome). Fluid island pill (B7): floats detached
 * from the top edge, glass blurred, rounded-full. The desktop row stays a
 * server component; the hamburger + overlay menu live in the client
 * MobileMenu island.
 */
export function LandingNav() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-50 mt-5 px-4 sm:mt-6 sm:px-6">
      <nav
        aria-label="Primary"
        className="pointer-events-auto mx-auto flex w-max max-w-full items-center gap-4 rounded-full border border-white/10 bg-void/80 px-5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-[14px] sm:gap-6 sm:px-6"
      >
        <Link
          href={LINKS.home}
          aria-label="Arcadia home"
          className="flex items-center gap-2.5 font-display text-lg font-bold tracking-[-0.03em] text-ink uppercase"
        >
          <LogoMark />
          Arcadia
        </Link>

        <ul className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                className="group relative py-2 font-mono text-[0.82rem] tracking-[0.16em] text-muted uppercase transition-colors hover:text-ink focus-visible:text-ink"
              >
                {link.label}
                <span className="absolute bottom-0.5 left-0 h-0.5 w-0 bg-acid transition-[width] duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:w-full group-focus-visible:w-full" />
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <TryDemoButton size="sm" className="hidden sm:inline-flex" />
          <MobileMenu />
        </div>
      </nav>
    </header>
  );
}
