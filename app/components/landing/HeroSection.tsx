import { Fragment } from "react";
import Link from "next/link";
import { ArrowRight, Circle, MoveRight, Zap } from "lucide-react";

import { AcidButton, BlobCard, ChromeText, Marquee, Reveal } from "@/components/acid";
import { Badge } from "@/components/ui/badge";
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
      className="grid h-10 w-10 place-items-center rounded-xl font-display text-base font-extrabold text-void"
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
    <span className="block h-[6px] overflow-hidden rounded-full bg-white/[0.08]">
      <span
        className="block h-full rounded-full"
        style={{ width: `${pct}%`, backgroundImage: "linear-gradient(90deg, var(--color-acid), var(--color-pink))" }}
      />
    </span>
  );
}

export function HeroSection() {
  return (
    <section aria-label="Hero" className="relative overflow-hidden pt-[clamp(3rem,8vh,6rem)] pb-6">
      {/* Hero breaks out of the reading-width container: on wide screens it
          stretches toward full width so the copy hugs the left rail and the
          card cluster fills the right side. */}
      <Container className="max-w-[1660px] xl:pl-[92px] 2xl:pl-[110px]">
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
                      <span className="relative z-[1] inline-flex items-center gap-2.5 mix-blend-difference">
                        Browse the proven <ArrowRight />
                      </span>
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

          {/* Product card cluster */}
          <Reveal delay={240}>
            <div className="grid gap-4 sm:grid-cols-2" aria-label="Live protocol cards">
              {/* Trader */}
              <BlobCard radius="organic" className="lg:-rotate-1" innerClassName="p-5">
                <p className="mb-2 font-mono text-[0.62rem] tracking-[0.16em] text-faint uppercase">Trader</p>
                <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <Avatar letter="N" />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-mono text-[0.95rem] text-ink">@nova</span>
                      <span className="font-mono text-[0.68rem] tracking-[0.12em] text-tier-elite uppercase">Elite tier</span>
                    </div>
                  </div>
                  <Badge variant="elite">Elite</Badge>
                </div>
                <div className="mb-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="font-mono text-3xl font-bold tracking-[-0.02em] text-ink tabular-nums">912</span>
                  <span className="font-mono text-sm text-faint">/1000</span>
                  <span className="ml-auto font-mono text-[1.05rem] font-bold text-success tabular-nums">+41.2%</span>
                </div>
                <StaticBar pct={91.2} />
                <div className="mt-2.5 flex justify-between font-mono text-[0.72rem] text-faint">
                  <span>Arcadia Score</span>
                  <span>91.2%</span>
                </div>
              </BlobCard>

              {/* Vault */}
              <BlobCard radius="soft" className="lg:rotate-1" innerClassName="p-5">
                <p className="mb-3 font-mono text-[0.62rem] tracking-[0.16em] text-faint uppercase">Allocation vault / @nova</p>
                <div className="flex flex-wrap items-center justify-between gap-2.5">
                  <span className="font-mono text-2xl font-bold text-ink tabular-nums">$387K</span>
                  <span className="rounded-full border border-acid/20 px-2.5 py-1 font-mono text-[0.64rem] tracking-[0.08em] whitespace-nowrap text-acid uppercase">
                    Open / $525K left
                  </span>
                </div>
                <p className="mt-2 font-mono text-[0.72rem] text-faint">capacity / reputation-based</p>
              </BlobCard>

              {/* Payout */}
              <BlobCard radius="blob" className="lg:-rotate-1" innerClassName="p-5">
                <p className="mb-2 font-mono text-[0.62rem] tracking-[0.16em] text-faint uppercase">Profit split / Solana</p>
                <p className="font-mono text-[1.8rem] font-bold text-success tabular-nums">+$6,810</p>
                <p className="mt-2 font-mono text-[0.72rem] text-faint">
                  performance share above high-water mark / settles in 1.8s
                </p>
                <span className="mt-3 inline-flex items-center gap-2 rounded-lg border border-cyan/25 bg-cyan/[0.06] px-2.5 py-1.5 font-mono text-[0.72rem] text-cyan">
                  <Zap className="size-3.5" aria-hidden />
                  4PqRtLv9Xw...M3kN
                </span>
              </BlobCard>

              {/* Reputation inputs */}
              <BlobCard radius="organic" className="lg:rotate-1" innerClassName="p-5">
                <p className="mb-3 font-mono text-[0.62rem] tracking-[0.16em] text-faint uppercase">Reputation inputs</p>
                <div className="flex flex-col gap-2.5">
                  {[
                    { label: "Risk-adj return", value: 91 },
                    { label: "Consistency", value: 88 },
                    { label: "Drawdown ctrl", value: 72 },
                  ].map((row) => (
                    <div key={row.label} className="grid grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1.5">
                      <span className="font-mono text-[0.72rem] text-muted">{row.label}</span>
                      <span className="font-mono text-[0.78rem] text-ink tabular-nums">{row.value}</span>
                      <div className="col-span-2">
                        <StaticBar pct={row.value} />
                      </div>
                    </div>
                  ))}
                </div>
              </BlobCard>
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
