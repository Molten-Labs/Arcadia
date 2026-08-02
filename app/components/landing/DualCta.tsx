import Link from "next/link";
import { ArrowRight, Mail, ShieldCheck, Sparkle } from "lucide-react";

import { AcidButton, Reveal } from "@/components/acid";
import { Container } from "./bits";
import { DUAL_CTA } from "./data";

/** Dual CTA: trader and investor entry points, single acid accent. */
export function DualCta() {
  return (
    <section aria-label="Get started" className="py-[clamp(5rem,12vw,10rem)]">
      <Container>
        <div className="grid gap-[clamp(1.25rem,2.6vw,1.9rem)] md:grid-cols-2">
          {DUAL_CTA.map((card, i) => {
            const Icon = card.accent === "acid" ? Sparkle : ShieldCheck;
            return (
              <Reveal key={card.heading} delay={i * 80}>
                <div className="group h-full rounded-[26px] border border-line bg-panel">
                  <div className="flex h-full flex-col gap-4 rounded-[24px] p-[clamp(1.75rem,3.5vw,3rem)]">
                    <Icon aria-hidden className={`size-4 text-acid transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:scale-110 motion-reduce:transition-none motion-reduce:group-hover:transform-none ${card.accent === "acid" ? "fill-current" : ""}`} />
                    <h3 className="origin-left font-display text-[clamp(1.5rem,2.8vw,2.3rem)] font-extrabold tracking-[-0.02em] text-ink uppercase" style={{ transform: "scaleX(1.04)" }}>
                      {card.heading}
                    </h3>
                    <p className="flex-1 text-[1.02rem] text-muted">{card.body}</p>
                    <div>
                      <AcidButton asChild variant={card.cta.variant === "chrome" ? "chrome" : "acid"}>
                        <Link href={card.cta.href}>
                          {card.cta.label} <ArrowRight />
                        </Link>
                      </AcidButton>
                    </div>
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
