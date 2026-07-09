import Link from "next/link";

import { AcidButton } from "@/components/acid";
import { LogoMark } from "./LogoMark";
import { LINKS, NAV_LINKS } from "./data";

/**
 * Landing top nav (marketing chrome). Sticky, blurred, with the brand mark,
 * primary links, a network chip, and the Launch App CTA. Static, so it stays a
 * server component; the underline hover is CSS-only.
 */
export function LandingNav() {
  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-gradient-to-b from-void/90 to-void/50 backdrop-blur-[14px]">
      {/* Matches the hero's wide container so brand/nav align with the copy column. */}
      <div className="mx-auto flex h-[70px] w-full max-w-[1660px] items-center gap-5 px-5 sm:px-8">
        <Link
          href={LINKS.home}
          aria-label="Arcadia home"
          className="flex items-center gap-2.5 font-display text-xl font-extrabold tracking-[-0.03em] text-ink uppercase"
        >
          <LogoMark />
          Arcadia
        </Link>

        <nav aria-label="Primary" className="ml-6 hidden items-center gap-7 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="group relative py-2 font-mono text-[0.82rem] tracking-[0.16em] text-muted uppercase transition-colors hover:text-ink focus-visible:text-ink"
            >
              {link.label}
              <span className="absolute bottom-0.5 left-0 h-0.5 w-0 bg-acid transition-[width] duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:w-full group-focus-visible:w-full" />
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-3.5">
          <span className="hidden items-center gap-2 rounded-full border border-acid/20 px-3 py-1.5 font-mono text-[0.68rem] tracking-[0.14em] text-acid uppercase sm:inline-flex">
            <span
              className="acid-animate h-[7px] w-[7px] rounded-full bg-acid"
              style={{
                boxShadow: "0 0 8px var(--color-acid)",
                animation: "acid-pulse 2s infinite",
              }}
            />
            Solana / Devnet
          </span>
          <AcidButton asChild size="sm">
            <Link href={LINKS.traders}>Launch App</Link>
          </AcidButton>
        </div>
      </div>
    </header>
  );
}
