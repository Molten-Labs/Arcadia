import { Check } from "lucide-react";

import { Reveal } from "@/components/acid";
import { Container, Kicker } from "./bits";
import { ALLOCATION_SPECS } from "./data";

/** The Allocation Rail: non-custodial guarantee copy + spec table. */
export function AllocationRail() {
  return (
    <section
      id="allocation"
      aria-label="The allocation rail"
      className="border-y border-white/10 bg-onyx py-[clamp(5rem,12vw,10rem)]"
    >
      <Container>
        <div className="grid items-start gap-[clamp(2rem,5vw,4.5rem)] lg:grid-cols-[1fr_1.05fr]">
          <Reveal>
            <div>
              <Kicker>The Allocation Rail</Kicker>
              <h2 className="mt-3.5 mb-5 origin-left font-display text-[clamp(1.9rem,4.6vw,3.4rem)] leading-[1] font-extrabold tracking-[-0.03em] text-ink uppercase" style={{ transform: "scaleX(1.05)" }}>
                Investors don&apos;t send money to traders.
              </h2>
              <p className="max-w-[62ch] text-[clamp(1.02rem,1.6vw,1.22rem)] leading-[1.55] text-muted">
                Investor capital goes into an on-chain vault, not a trader&apos;s wallet. The trader can
                trade under protocol rules but cannot withdraw investor funds. This protects you from
                theft -- not from trading losses, which are shared proportionally like any fund.
              </p>
              <p className="mt-4 font-mono text-[0.78rem] tracking-[0.04em] text-acid">
                {"// NON-CUSTODIAL BY CONSTRUCTION"}
              </p>
            </div>
          </Reveal>

          <Reveal delay={80}>
            <div
              role="table"
              aria-label="Allocation rail guarantees"
              className="overflow-hidden rounded-[20px] border border-acid/20 bg-void/70"
            >
              {ALLOCATION_SPECS.map((spec, i) => (
                <div
                  key={spec.label}
                  role="row"
                  className={`grid grid-cols-[22px_1fr_auto] items-center gap-3.5 px-[clamp(1rem,2.4vw,1.5rem)] py-4 transition-colors hover:bg-acid/[0.04] ${i > 0 ? "border-t border-white/[0.07]" : ""}`}
                >
                  <Check aria-hidden className="size-[22px] text-acid" />
                  <span role="cell" className="text-[0.98rem] text-muted">
                    {spec.label}
                  </span>
                  <span role="cell" className="text-right font-mono text-[0.94rem] font-bold text-ink">
                    {spec.value}
                  </span>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  );
}
