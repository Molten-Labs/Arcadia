import { LineChart, ShieldCheck, XCircle } from "lucide-react";

import { CountUp, Reveal } from "@/components/acid";
import { AnimatedBar } from "./AnimatedBar";
import { Container, Kicker, SectionHeading } from "./bits";
import { GateConnector } from "./GateConnector";
import { HOW_STEPS, PROBLEMS, WEEK_TRACK } from "./data";

const TAG_ICON = { acid: LineChart, cyan: ShieldCheck } as const;

const ghostStroke = {
  color: "transparent",
  WebkitTextStroke: "1px color-mix(in srgb, var(--color-acid) 16%, transparent)",
} as const;

/**
 * Unified Problems → Arcadia Gate → How It Works flow.
 * Replaces the two separate ProblemSection + HowItWorks sections.
 */
export function FlowSection() {
  return (
    <section aria-label="Problem to solution flow">

      {/* ── 1. Problems ─────────────────────────────────────────────── */}
      <Container className="pt-[clamp(5rem,12vw,10rem)]">
        <Reveal>
          <Kicker>The Problem</Kicker>
        </Reveal>
        <Reveal delay={80}>
          <SectionHeading className="mt-4 max-w-[16ch]">
            Skilled traders can&apos;t prove it. Capital has no trusted rail.
          </SectionHeading>
        </Reveal>

        <div className="mt-[clamp(2.5rem,6vw,4rem)] grid gap-6 md:grid-cols-2">
          {PROBLEMS.map((panel, i) => {
            const Icon = TAG_ICON[panel.accent];
            const accentClass = panel.accent === "acid" ? "text-acid" : "text-cyan";
            return (
              <Reveal key={panel.tag} delay={i * 80}>
                <div className="group acid-int h-full rounded-[22px] border border-white/10 bg-gradient-to-br from-panel/90 to-void/85 p-[clamp(1.5rem,3vw,2.4rem)]">
                  <span
                    className={`mb-4 inline-flex items-center gap-2.5 font-mono text-[0.7rem] tracking-[0.2em] uppercase ${accentClass}`}
                  >
                    <Icon
                      aria-hidden
                      className="size-4 transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:transform-none"
                    />
                    {panel.tag}
                  </span>
                  <h3
                    className="mb-3.5 origin-left font-display text-[clamp(1.35rem,2.4vw,1.9rem)] font-extrabold tracking-[-0.02em] text-ink uppercase"
                    style={{ transform: "scaleX(1.04)" }}
                  >
                    {panel.heading}
                  </h3>
                  <p className="mb-5 text-[1.02rem] leading-relaxed text-muted">{panel.body}</p>
                  <ul className="flex flex-col">
                    {panel.points.map((point, j) => (
                      <li
                        key={point}
                        className={`flex items-start gap-3 py-2.5 text-ink ${j > 0 ? "border-t border-dashed border-white/10" : ""}`}
                      >
                        <XCircle aria-hidden className="mt-0.5 size-[22px] shrink-0 text-danger" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>

      {/* ── 2. Arcadia Gate connector (client island) ───────────────── */}
      <GateConnector />

      {/* ── 3. How It Works solutions ───────────────────────────────── */}
      <Container className="pb-[clamp(5rem,12vw,10rem)]">
        <div className="grid gap-[clamp(1.1rem,2.6vw,1.9rem)] md:grid-cols-2">
          {HOW_STEPS.map((step, i) => (
            <Reveal
              key={step.n}
              delay={(i % 2) * 80}
              className={step.wide ? "md:col-span-2" : undefined}
            >
              <div className="group acid-int relative h-full overflow-hidden rounded-[20px] border border-white/10 bg-gradient-to-br from-panel/90 to-void/85 p-[clamp(1.4rem,2.6vw,1.9rem)]">
                <span
                  aria-hidden
                  className="pointer-events-none absolute -top-8 right-0 font-display text-[8rem] leading-none font-extrabold opacity-70 transition-opacity duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] select-none group-hover:opacity-100 motion-reduce:transition-none"
                  style={ghostStroke}
                >
                  {step.n}
                </span>
                <span className="font-mono text-[0.8rem] tracking-[0.2em] text-acid">
                  STEP {step.n}
                </span>
                <h3
                  className="mt-3 mb-2.5 origin-left font-display text-[clamp(1.15rem,2vw,1.5rem)] font-extrabold tracking-[-0.02em] text-ink uppercase"
                  style={{ transform: "scaleX(1.03)" }}
                >
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
                  <p className="font-mono text-[0.66rem] tracking-[0.12em] text-faint uppercase">
                    {week.label}
                  </p>
                  <CountUp
                    value={week.score}
                    className={`mt-1.5 block text-[clamp(1.3rem,3vw,2rem)] font-bold ${
                      week.peak ? "text-acid" : "text-ink"
                    }`}
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
