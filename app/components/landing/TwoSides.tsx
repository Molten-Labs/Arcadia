"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { AcidButton } from "@/components/acid";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TWO_SIDES } from "./data";

const SIDES = [
  { key: "traders", label: "For Traders" },
  { key: "investors", label: "For Investors" },
] as const;

function Flow({ side }: { side: "traders" | "investors" }) {
  const data = TWO_SIDES[side];
  const chipClass =
    data.accent === "acid"
      ? "bg-acid text-void shadow-[0_0_16px_color-mix(in_srgb,var(--color-acid)_40%,transparent)]"
      : "bg-cyan text-void shadow-[0_0_16px_color-mix(in_srgb,var(--color-cyan)_40%,transparent)]";

  return (
    <div>
      <p className="mb-[clamp(1.5rem,3vw,2.25rem)] max-w-[60ch] text-[1.1rem] text-muted">{data.intro}</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {data.steps.map((step) => (
          <div
            key={step.n}
            className="group acid-int rounded-[18px] border border-white/10 bg-gradient-to-br from-panel/90 to-void/85 p-[1.375rem]"
          >
            <span className={`mb-3.5 grid h-[34px] w-[34px] place-items-center rounded-[10px] font-mono font-bold transition-transform duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:transform-none ${chipClass}`}>
              {step.n}
            </span>
            <h4 className="mb-2 text-[1.02rem] leading-[1.3] font-bold text-ink">{step.title}</h4>
            <p className="text-[0.92rem] text-muted">{step.body}</p>
          </div>
        ))}
      </div>
      <div className="mt-7">
        <AcidButton asChild variant="acid">
          <Link href={data.cta.href}>
            {data.cta.label} <ArrowRight />
          </Link>
        </AcidButton>
      </div>
    </div>
  );
}

/** Two Sides: role-scoped flows behind an accessible tab switch. */
export function TwoSides() {
  return (
    <Tabs defaultValue="traders" className="gap-[clamp(1.5rem,3vw,2.5rem)]">
      <TabsList aria-label="Choose your side">
        {SIDES.map((side) => (
          <TabsTrigger key={side.key} value={side.key}>
            {side.label}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent value="traders">
        <Flow side="traders" />
      </TabsContent>
      <TabsContent value="investors">
        <Flow side="investors" />
      </TabsContent>
    </Tabs>
  );
}
