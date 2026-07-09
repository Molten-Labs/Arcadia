import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Circle, MoveRight, Zap } from "lucide-react";

import { AcidButton, ChromeText, Marquee, Reveal } from "@/components/acid";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Container } from "./bits";
import { ORB_GRADIENT } from "./LogoMark";
import { LINKS, SLASH_PHRASES } from "./data";

// "PROVE" is one unbreakable word ~5.7x the font-size wide; its min-content
// sets the copy column's width at every breakpoint. Sized so it always fits
// the column (16vw starved the card column to 8px slivers at 1440px, and a
// 4.2rem floor clipped the whole copy column on phones).
const HUGE = "font-display text-[clamp(3.4rem,14.5vw,6.5rem)] lg:text-[clamp(5.5rem,8.75vw,10rem)] leading-[0.82] font-extrabold tracking-[-0.05em] uppercase";

const acidGlow =
  "0 0 34px color-mix(in srgb, var(--color-acid) 60%, transparent), 0 0 70px color-mix(in srgb, var(--color-acid) 30%, transparent)";

function Avatar({ letter }: { letter: string }) {
  return (
    <span
      aria-hidden
      className="grid h-10 w-10 place-items-center rounded-xl font-display text-base font-extrabold text-void transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:-rotate-6 group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:transform-none"
      style={{
        background: ORB_GRADIENT,
        boxShadow: "0 0 14px color-mix(in srgb, var(--color-acid) 40%, transparent)",
      }}
    >
      {letter}
    </span>
  );
}

function StaticBar({ pct }: { pct: number }) {
  return (
    <span className="block h-[5px] overflow-hidden rounded-full bg-white/[0.07]">
      <span className="acid-bar block h-full rounded-full bg-acid" style={{ width: `${pct}%` }} />
    </span>
  );
}

/**
 * Hero product tile: sharp terminal-style panel (hairline border, acid corner
 * ticks, mono kicker + index). Rectangular on purpose - the old breathing
 * blobs clipped their own kickers and data rows at the curved edges.
 */
function HeroTile({
  index,
  label,
  className,
  floatDelay,
  children,
}: {
  index: string;
  label: string;
  className?: string;
  floatDelay?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn("hero-float", className)}
      style={floatDelay ? { animationDelay: floatDelay } : undefined}
    >
      <div className="group acid-int acid-sheen relative flex h-full flex-col rounded-xl border border-white/10 bg-panel/80 p-5 backdrop-blur-[6px]">
        <span
          aria-hidden
          className="absolute top-0 left-0 h-3 w-3 rounded-tl-xl border-t-2 border-l-2 border-acid/80 transition-all duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:h-5 group-hover:w-5 group-hover:border-acid"
        />
        <span
          aria-hidden
          className="absolute right-0 bottom-0 h-3 w-3 rounded-br-xl border-r-2 border-b-2 border-acid/25 transition-all duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:h-5 group-hover:w-5 group-hover:border-acid/80"
        />
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <p className="min-w-0 font-mono text-[0.62rem] tracking-[0.16em] text-faint uppercase transition-colors duration-300 group-hover:text-muted">
            {label}
          </p>
          <span
            aria-hidden
            className="font-mono text-[0.6rem] text-faint/60 transition-colors duration-300 group-hover:text-acid"
          >
            {index}
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section aria-label="Hero" className="relative overflow-hidden pt-[clamp(3rem,8vh,6rem)] pb-6">
      {/* Hero breaks out of the reading-width container: on wide screens it
          stretches toward full width so the copy sits hard left and the card
          cluster fills the right side. */}
      <Container className="max-w-[1660px]">
        {/* minmax floor: the card column can never be starved below readable width */}
        <div className="grid items-center gap-10 lg:grid-cols-[1.15fr_minmax(360px,0.85fr)] lg:gap-14">
          {/* Copy column */}
          <div>
            <Reveal>
              <span className="inline-flex flex-wrap items-center gap-2.5 rounded-full border border-acid/20 bg-acid/[0.04] px-3.5 py-2 font-mono text-[clamp(0.62rem,1.3vw,0.75rem)] tracking-[0.18em] text-acid uppercase">
                <span
                  className="acid-animate h-2 w-2 rounded-full bg-acid"
                  style={{ boxShadow: "0 0 10px var(--color-acid)", animation: "acid-pulse 2s infinite" }}
                />
                Arcadia // Proof-of-Performance Protocol / Online
              </span>
            </Reveal>

            <Reveal delay={80}>
              <h1 aria-label="Prove it." className="relative my-8">
                <ChromeText as="span" aberration className={`block origin-left ${HUGE}`}>
                  PROVE
                </ChromeText>
                <span
                  className={`block origin-left text-acid ${HUGE}`}
                  style={{ textShadow: acidGlow }}
                >
                  IT
                  <span
                    className="text-pink"
                    style={{ textShadow: "0 0 30px color-mix(in srgb, var(--color-pink) 70%, transparent)" }}
                  >
                    .
                  </span>
                </span>
              </h1>
            </Reveal>

            <div className="max-w-[52ch]">
              <Reveal delay={160}>
                <p className="mb-4 inline-flex items-center gap-2.5 font-mono text-[0.72rem] tracking-[0.16em] text-muted uppercase">
                  <span
                    className="acid-animate h-2 w-2 rounded-full bg-success"
                    style={{ boxShadow: "0 0 10px var(--color-success)", animation: "acid-pulse 2s infinite" }}
                  />
                  Verified reputation / On-chain allocation
                </p>
                <p className="mb-7 text-[clamp(1.05rem,1.7vw,1.28rem)] leading-[1.55] text-muted">
                  Arcadia turns real{" "}
                  <b className="font-semibold text-ink">on-chain trading history</b>{" "}
                  into verified reputation. Investor capital flows to the traders who have earned it.
                </p>
              </Reveal>

              <Reveal delay={240}>
                <div className="flex flex-wrap gap-4">
                  <AcidButton asChild variant="chrome">
                    <Link href={LINKS.traders}>
                      Browse the proven <ArrowRight />
                    </Link>
                  </AcidButton>
                  <AcidButton asChild variant="acid">
                    <Link href={LINKS.terminal}>
                      Prove yourself <Circle className="fill-current" />
                    </Link>
                  </AcidButton>
                </div>
              </Reveal>
            </div>
          </div>

          {/* Product tile cluster */}
          <Reveal delay={240}>
            <div className="relative" aria-label="Live protocol cards">
              {/* Soft acid seat glow behind the cluster */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-10 rounded-[48px]"
                style={{
                  background:
                    "radial-gradient(60% 55% at 50% 42%, color-mix(in srgb, var(--color-acid) 7%, transparent), transparent 72%)",
                }}
              />
              <div className="relative grid gap-4 sm:grid-cols-2">
                {/* Trader */}
                <HeroTile index="01" label="Trader" floatDelay="0s">
                  <div className="mb-3.5 flex items-center gap-3">
                    <Avatar letter="N" />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[0.95rem] text-ink">@nova</span>
                        <Badge variant="elite">Elite</Badge>
                      </div>
                      <span className="font-mono text-[0.64rem] tracking-[0.12em] text-faint uppercase">SOL perps / momentum</span>
                    </div>
                  </div>
                  <div className="mb-2.5 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                    <span className="font-mono text-3xl font-bold tracking-[-0.02em] text-ink tabular-nums">912</span>
                    <span className="font-mono text-sm text-faint">/1000</span>
                    <span className="ml-auto font-mono text-[1.05rem] font-bold text-success tabular-nums">+41.2%</span>
                  </div>
                  <StaticBar pct={91.2} />
                  <div className="mt-2 flex justify-between font-mono text-[0.7rem] text-faint">
                    <span>Arcadia Score</span>
                    <span>91.2%</span>
                  </div>
                </HeroTile>

                {/* Vault */}
                <HeroTile index="02" label="Allocation vault / @nova" className="sm:translate-y-5" floatDelay="-3s">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-mono text-[1.7rem] font-bold text-ink tabular-nums">$387K</span>
                    <span className="rounded-full border border-acid/25 bg-acid/[0.05] px-2.5 py-1 font-mono text-[0.62rem] tracking-[0.08em] whitespace-nowrap text-acid uppercase">
                      Open / $525K left
                    </span>
                  </div>
                  <div className="mt-auto pt-3">
                    <StaticBar pct={42} />
                    <div className="mt-2 flex justify-between font-mono text-[0.7rem] text-faint">
                      <span>Capacity used</span>
                      <span>42%</span>
                    </div>
                  </div>
                </HeroTile>

                {/* Payout */}
                <HeroTile index="03" label="Profit split / Solana" floatDelay="-1.5s">
                  <p className="font-mono text-[1.7rem] font-bold text-success tabular-nums">+$6,810</p>
                  <p className="mt-1.5 font-mono text-[0.7rem] leading-relaxed text-faint">
                    performance share above high-water mark / settles in 1.8s
                  </p>
                  <span className="mt-3 inline-flex max-w-full items-center gap-2 rounded-lg border border-cyan/25 bg-cyan/[0.06] px-2.5 py-1.5 font-mono text-[0.7rem] text-cyan">
                    <Zap className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">4PqRtLv9Xw...M3kN</span>
                  </span>
                </HeroTile>

                {/* Reputation inputs */}
                <HeroTile index="04" label="Reputation inputs" className="sm:translate-y-5" floatDelay="-4.5s">
                  <div className="flex flex-col gap-2.5">
                    {[
                      { label: "Risk-adj return", value: 91 },
                      { label: "Consistency", value: 88 },
                      { label: "Drawdown ctrl", value: 72 },
                    ].map((row) => (
                      <div key={row.label} className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1.5">
                        <span className="font-mono text-[0.7rem] text-muted">{row.label}</span>
                        <span className="font-mono text-[0.76rem] text-ink tabular-nums">{row.value}</span>
                        <div className="col-span-2">
                          <StaticBar pct={row.value} />
                        </div>
                      </div>
                    ))}
                  </div>
                </HeroTile>
              </div>
            </div>
          </Reveal>
        </div>
      </Container>

      {/* Diagonal acid marquee band */}
      <div className="mt-[clamp(3rem,9vh,7rem)]">
        <div
          className="relative -mx-[7%] w-[114%] -rotate-[4deg] bg-acid text-void"
          style={{ boxShadow: "0 0 40px color-mix(in srgb, var(--color-acid) 35%, transparent)" }}
        >
          <Marquee speed={26} pauseOnHover={false} className="py-4">
            {SLASH_PHRASES.map((phrase) => (
              <Fragment key={phrase}>
                <span className="flex items-center px-5 font-display text-[clamp(1.1rem,2.4vw,1.9rem)] font-extrabold tracking-[-0.02em] uppercase">
                  {phrase}
                </span>
                <MoveRight aria-hidden className="mx-1 size-5 opacity-50" />
              </Fragment>
            ))}
          </Marquee>
        </div>
      </div>
    </section>
  );
}
