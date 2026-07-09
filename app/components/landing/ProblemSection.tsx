import { LineChart, ShieldCheck, XCircle } from "lucide-react";

import { Reveal } from "@/components/acid";
import { Container, Kicker, SectionHeading } from "./bits";
import { PROBLEMS } from "./data";

const TAG_ICON = {
  acid: LineChart,
  cyan: ShieldCheck,
} as const;

/** The Problem: paired trader / investor panels with failure checklists. */
export function ProblemSection() {
  return (
    <section aria-label="The problem" className="py-[clamp(5rem,12vw,10rem)]">
      <Container>
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
                  <span className={`mb-4 inline-flex items-center gap-2.5 font-mono text-[0.7rem] tracking-[0.2em] uppercase ${accentClass}`}>
                    <Icon aria-hidden className="size-4 transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:transform-none" />
                    {panel.tag}
                  </span>
                  <h3 className="mb-3.5 origin-left font-display text-[clamp(1.35rem,2.4vw,1.9rem)] font-extrabold tracking-[-0.02em] text-ink uppercase" style={{ transform: "scaleX(1.04)" }}>
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
    </section>
  );
}
