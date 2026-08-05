"use client";

import { useEffect, useState } from "react";

import { Reveal } from "@/components/acid";
import { Container, Kicker, SectionHeading } from "./bits";

const PHASES = [
  { id: "intent",    label: "INTENT SUBMITTED",  dot: "bg-white/30",               text: "text-faint"  },
  { id: "checking",  label: "CHECKING RULES\u2026", dot: "bg-acid animate-pulse",   text: "text-acid"   },
  { id: "approved",  label: "\u2713  APPROVED",    dot: "bg-acid",                   text: "text-acid"   },
  { id: "intent2",   label: "INTENT SUBMITTED",  dot: "bg-white/30",               text: "text-faint"  },
  { id: "checking2", label: "CHECKING RULES\u2026", dot: "bg-acid animate-pulse",   text: "text-acid"   },
  { id: "rejected",  label: "\u2717  REJECTED",    dot: "bg-danger",                 text: "text-danger" },
] as const;

const DURATIONS = [1400, 1200, 1900, 1400, 1200, 2100];

export function GateConnector() {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    let current = 0;
    let t: ReturnType<typeof setTimeout>;
    const tick = () => {
      t = setTimeout(() => {
        current = (current + 1) % PHASES.length;
        setIdx(current);
        tick();
      }, DURATIONS[current]);
    };
    tick();
    return () => clearTimeout(t);
  }, []);

  const phase = PHASES[idx];
  const approved = phase.id === "approved";
  const rejected = phase.id === "rejected";

  return (
    <div className="flex flex-col items-center py-[clamp(2rem,5vw,3.5rem)]">
      {/* Line from problems → gate */}
      <div className="h-14 w-px bg-gradient-to-b from-transparent to-acid/50" />

      {/* Gate card */}
      <Reveal>
        <div
          className="relative rounded-[22px] border px-[clamp(1.8rem,5vw,3.5rem)] py-[clamp(1rem,2vw,1.5rem)] text-center backdrop-blur-sm transition-[border-color,box-shadow] duration-500"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--color-panel) 90%, transparent), color-mix(in srgb, var(--color-void) 85%, transparent))",
            borderColor: rejected
              ? "color-mix(in srgb, var(--color-danger) 45%, transparent)"
              : approved
              ? "color-mix(in srgb, var(--color-acid) 55%, transparent)"
              : "color-mix(in srgb, var(--color-acid) 22%, transparent)",
            boxShadow: rejected
              ? "0 0 80px color-mix(in srgb, var(--color-danger) 16%, transparent)"
              : approved
              ? "0 0 80px color-mix(in srgb, var(--color-acid) 20%, transparent)"
              : "0 0 40px color-mix(in srgb, var(--color-acid) 8%, transparent)",
          }}
        >
          <p className="mb-1 font-mono text-[0.65rem] tracking-[0.26em] text-acid uppercase">
            — Arcadia Layer —
          </p>
          <p
            className="font-display font-bold tracking-[-0.03em] text-ink uppercase"
            style={{ fontSize: "clamp(1.1rem,2.6vw,1.9rem)", transform: "scaleX(1.05)", transformOrigin: "center" }}
          >
            Proof replaces trust.
          </p>
          <div className="mt-3 inline-flex h-7 items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3">
            <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${phase.dot}`} />
            <span className={`font-mono text-[0.64rem] tracking-[0.16em] uppercase transition-colors duration-300 ${phase.text}`}>
              {phase.label}
            </span>
          </div>
        </div>
      </Reveal>

      {/* Animated flowing dots pointing down */}
      <div className="mt-3 flex flex-col items-center gap-[5px]">
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="block h-[5px] w-[5px] rounded-full bg-acid"
            style={{ animation: `gateFlow 1.1s ${i * 0.25}s ease-in-out infinite` }}
          />
        ))}
      </div>

      {/* "How It Works" sub-heading */}
      <Reveal className="mt-10 w-full text-center">
        <Container>
          <div className="flex items-center justify-center">
            <Kicker>How It Works</Kicker>
          </div>
          <SectionHeading as="h2" className="mt-4">
            From proof to capital.
          </SectionHeading>
        </Container>
      </Reveal>

      <style>{`
        @keyframes gateFlow {
          0%, 100% { opacity: 0.15; transform: translateY(0px); }
          50%       { opacity: 0.90; transform: translateY(5px); }
        }
      `}</style>
    </div>
  );
}
