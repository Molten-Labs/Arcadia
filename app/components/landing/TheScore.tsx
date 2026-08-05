import { ChromeText, CountUp, Reveal } from "@/components/acid";
import { AnimatedBar } from "./AnimatedBar";
import { Container, Kicker } from "./bits";
import { SCORE_BREAKDOWN, TIER_DOT, TIERS } from "./data";

const ghostWord = {
  color: "transparent",
  WebkitTextStroke: "1px color-mix(in srgb, var(--color-acid) 35%, transparent)",
  transform: "scaleX(1.12)",
} as const;

/** The Score: the signature reputation moment + breakdown + tier ladder. */
export function TheScore() {
  return (
    <section id="score" aria-label="The Arcadia Score" className="overflow-hidden bg-void py-[clamp(5rem,12vw,10rem)]">
      <Container>
        <Reveal>
          <Kicker>The Reputation Layer</Kicker>
        </Reveal>

        <div className="mt-[clamp(2rem,4vw,3rem)] grid items-center gap-[clamp(2rem,5vw,4rem)] lg:grid-cols-2">
          {/* Big score */}
          <Reveal delay={80}>
            <div className="relative grid min-h-[340px] place-items-center">
              <span
                aria-hidden
                className="pointer-events-none absolute inset-0 grid place-items-center font-display text-[clamp(6rem,20vw,15rem)] font-bold tracking-[-0.05em] uppercase select-none"
                style={ghostWord}
              >
                PROVEN
              </span>
              <div className="relative z-10 text-center">
                <ChromeText
                  as="div"
                  className="font-display text-[clamp(7rem,24vw,17rem)] leading-[0.8] font-bold tracking-[-0.05em]"
                >
                  <CountUp value={912} />
                </ChromeText>
                <div className="mt-1.5 font-mono text-[1.1rem] tracking-[0.1em] text-faint">/ 1000</div>
                <span className="mt-4 inline-flex items-center gap-2 rounded-full border border-tier-elite/60 px-4 py-2 font-mono text-[0.8rem] tracking-[0.14em] text-tier-elite uppercase">
                  <span className="h-2 w-2 rounded-full bg-tier-elite" />
                  Elite Tier
                </span>
              </div>
            </div>
          </Reveal>

          {/* Breakdown */}
          <Reveal delay={160}>
            <div>
              <p className="mb-6 text-[1.06rem] leading-[1.6] text-muted">
                The score is the trust layer: a 0-1000 reputation number built from real trading history.
                It helps capital find traders with consistency, discipline, and proof.
              </p>
              <div className="grid gap-[18px]">
                {SCORE_BREAKDOWN.map((row) => (
                  <div key={row.label}>
                    <div className="mb-2.5 flex items-baseline justify-between">
                      <span>
                        <span className="text-base font-semibold text-ink">{row.label}</span>
                        <span className="ml-2 font-mono text-[0.7rem] tracking-[0.1em] text-faint">{row.weight}% WEIGHT</span>
                      </span>
                      <span className="font-mono text-[1.05rem] font-bold text-acid tabular-nums">
                        {row.value}
                        <span className="text-[0.7em] text-faint">/100</span>
                      </span>
                    </div>
                    <AnimatedBar pct={row.value} height={11} />
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </div>

        {/* Tiers */}
        <Reveal delay={80}>
          <div
            role="table"
            aria-label="Reputation tiers"
            className="mt-[clamp(2.5rem,6vw,4rem)] overflow-hidden rounded-[20px] border border-acid/20 bg-void/70"
          >
            {TIERS.map((tier, i) => (
              <div
                key={tier.key}
                role="row"
                className={`group grid grid-cols-[16px_1fr_auto] items-center gap-4 px-[clamp(1rem,2.4vw,1.6rem)] py-4 transition-colors hover:bg-acid/[0.04] sm:grid-cols-[16px_1fr_1fr_auto] ${i > 0 ? "border-t border-white/[0.07]" : ""}`}
              >
                <span aria-hidden className={`h-3 w-3 rounded-full transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:scale-125 motion-reduce:transition-none motion-reduce:group-hover:transform-none ${TIER_DOT[tier.key]}`} />
                <span role="cell" className="text-[1.02rem] font-semibold text-ink">{tier.name}</span>
                <span role="cell" className="hidden font-mono text-[0.86rem] text-muted transition-colors duration-300 group-hover:text-ink sm:block motion-reduce:transition-none">{tier.criteria}</span>
                <span role="cell" className="text-right font-mono text-base font-bold text-acid tabular-nums">{tier.share}</span>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal>
          <p className="mt-4 font-mono text-[0.8rem] tracking-[0.04em] text-faint">
            {"// Higher reputation unlocks more vault capacity."}
          </p>
        </Reveal>
      </Container>
    </section>
  );
}
