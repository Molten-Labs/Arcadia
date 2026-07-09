import { Fragment } from "react";
import Link from "next/link";
import { Sparkle } from "lucide-react";

import { Marquee } from "@/components/acid";
import { Container } from "./bits";
import { LogoMark } from "./LogoMark";
import { FOOTER_PHRASES, LINKS, NAV_LINKS } from "./data";

/** Landing footer: closing marquee + brand row + links. */
export function LandingFooter() {
  return (
    <footer aria-label="Footer">
      <div className="border-y border-white/10 bg-onyx" aria-hidden>
        <Marquee speed={38} className="py-4">
          {FOOTER_PHRASES.map((phrase) => (
            <Fragment key={phrase}>
              <span className="px-8 font-mono text-[0.95rem] tracking-[0.1em] text-faint uppercase">{phrase}</span>
              <Sparkle className="size-3 fill-current text-pink" />
            </Fragment>
          ))}
        </Marquee>
      </div>

      <div className="bg-void py-[clamp(3rem,7vw,5rem)]">
        <Container>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <Link
              href={LINKS.home}
              aria-label="Arcadia home"
              className="flex items-center gap-2.5 font-display text-xl font-extrabold tracking-[-0.03em] text-ink uppercase"
            >
              <LogoMark />
              Arcadia
            </Link>
            <nav aria-label="Footer" className="flex flex-wrap gap-6">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="group relative py-1 font-mono text-[0.82rem] tracking-[0.1em] text-muted uppercase transition-colors hover:text-ink focus-visible:text-ink motion-reduce:transition-none"
                >
                  {link.label}
                  <span
                    aria-hidden
                    className="absolute bottom-0 left-0 h-0.5 w-0 bg-acid transition-[width] duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:w-full group-focus-visible:w-full motion-reduce:transition-none"
                  />
                </Link>
              ))}
            </nav>
          </div>
          <p className="mt-8 border-t border-white/10 pt-5 font-mono text-[0.8rem] tracking-[0.06em] text-faint">
            <span className="text-acid">Proof replaces promises</span> / (c) 2026 Arcadia
          </p>
        </Container>
      </div>
    </footer>
  );
}
