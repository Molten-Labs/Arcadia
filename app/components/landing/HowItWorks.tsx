import { CountUp, Reveal } from "@/components/acid";
import { AnimatedBar } from "./AnimatedBar";
import { Container, Kicker, SectionHeading } from "./bits";
import { HOW_STEPS, WEEK_TRACK } from "./data";

const ghostStroke = {
  color: "transparent",
  WebkitTextStroke: "1px color-mix(in srgb, var(--color-acid) 16%, transparent)",
} as const;

/** How it works: five numbered steps + a score-builds week track. */
export function HowItWorks() {
  return (
    <section aria-label="How it works" className="py-[clamp(5rem,12vw,10rem)]">
      <Container>
        <Reveal>
          <Kicker>How It Works</Kicker>
        </Reveal>
        <Reveal delay={80}>
          <SectionHeading className="mt-4">From wallet to allocated capital.</SectionHeading>
        </Reveal>

        <div className="mt-[clamp(2.5rem,6vw,4rem)] grid gap-[clamp(1.1rem,2.6vw,1.9rem)] md:grid-cols-2">
          {HOW_STEPS.map((step, i) => (
            <Reveal key={step.n} delay={(i % 2) * 80} className={step.wide ? "md:col-span-2" : undefined}>
              <div className="group acid-int relative h-full overflow-hidden rounded-[20px] border border-white/10 bg-gradient-to-br from-panel/90 to-void/85 p-[clamp(1.4rem,2.6vw,1.9rem)]">
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-8 right-0 font-display text-[8rem] leading-none font-extrabold opacity-70 transition-opacity duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] select-none group-hover:opacity-100 motion-reduce:transition-none"
                  style={ghostStroke}
                >
                  {step.n}
                </span>
                <span className="font-mono text-[0.8rem] tracking-[0.2em] text-acid">STEP {step.n}</span>
                <h3 className="mt-3 mb-2.5 origin-left font-display text-[clamp(1.15rem,2vw,1.5rem)] font-extrabold tracking-[-0.02em] text-ink uppercase" style={{ transform: "scaleX(1.03)" }}>
                  {step.title}
                </h3>
                <p className="text-[0.98rem] leading-relaxed text-muted">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        {/* Score builds as you trade */}
        <Reveal delay={80}>
          <div className="mt-[clamp(2rem,4vw,3rem)] rounded-[20px] border border-acid/20 bg-void/70 p-[clamp(1.4rem,3vw,2.1rem)]">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <span className="font-mono text-[0.74rem] tracking-[0.16em] text-faint uppercase">
                Score builds as you trade
              </span>
              <span className="rounded-full border border-acid/20 px-3 py-1.5 font-mono text-[0.8rem] text-acid">
                Elite tier unlocked / 35% profit share
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {WEEK_TRACK.map((week) => (
                <div
                  key={week.label}
                  className={`rounded-[14px] border p-3.5 text-center ${
                    week.peak
                      ? "border-acid/60 shadow-[0_0_22px_color-mix(in_srgb,var(--color-acid)_18%,transparent)]"
                      : "border-white/10"
                  }`}
                >
                  <p className="font-mono text-[0.66rem] tracking-[0.12em] text-faint uppercase">{week.label}</p>
                  <CountUp
                    value={week.score}
                    className={`mt-1.5 block text-[clamp(1.3rem,3vw,2rem)] font-bold ${week.peak ? "text-acid" : "text-ink"}`}
                  />
                  <AnimatedBar pct={week.pct} height={5} className="mt-3" />
                </div>
              ))}
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
