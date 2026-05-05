import { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { fmtUSD } from "@/lib/format";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Tier = "established" | "veteran" | "elite";
type Horizon = 30 | 90 | 365;

const tierApy: Record<Tier, { conservative: number; expected: number; optimistic: number; label: string }> = {
  established: { conservative: 8,  expected: 14, optimistic: 22, label: "Established" },
  veteran:     { conservative: 11, expected: 19, optimistic: 28, label: "Veteran"     },
  elite:       { conservative: 14, expected: 24, optimistic: 36, label: "Elite"       },
};

export const VaultCalculator = () => {
  const [deposit, setDeposit] = useState(10_000);
  const [horizon, setHorizon] = useState<Horizon>(90);
  const [tier, setTier] = useState<Tier>("veteran");

  const { conservative, expected, optimistic, label } = tierApy[tier];
  const yr = horizon / 365;

  const conservativeOut = useMemo(() => deposit * Math.pow(1 + conservative / 100, yr), [deposit, yr, conservative]);
  const expectedOut     = useMemo(() => deposit * Math.pow(1 + expected     / 100, yr), [deposit, yr, expected]);
  const optimisticOut   = useMemo(() => deposit * Math.pow(1 + optimistic   / 100, yr), [deposit, yr, optimistic]);

  return (
    <section id="calculator" className="container py-16 scroll-mt-20">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display type-h2 font-semibold">
            Projected <span className="text-gradient-signal">Outcomes</span>
          </h2>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            Model potential results across capital size, time horizon, and trader tier.
          </p>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground max-w-xs text-right leading-relaxed hidden sm:block">
          Planning scenarios · not guaranteed returns
        </p>
      </div>

      <div className="surface rounded-2xl overflow-hidden">
        {/* Controls row */}
        <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-border/50">

          {/* Deposit */}
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Deposit</span>
                  <span className="font-display font-bold text-[17px] text-primary tabular">${fmtUSD(deposit, { compact: true })}</span>
            </div>
            <Slider value={[deposit]} onValueChange={([v]) => setDeposit(v)} min={500} max={250_000} step={500} className="mb-2" />
            <div className="flex gap-1.5 mt-3">
              {[1_000, 10_000, 50_000, 100_000].map(v => (
                <button
                  key={v}
                  onClick={() => setDeposit(v)}
                  className={cn(
                    "flex-1 h-7 text-[11px] font-mono rounded border transition-colors",
                    deposit === v ? "border-primary bg-primary/10 text-primary" : "border-border bg-background/70 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  ${v >= 1000 ? `${v / 1000}k` : v}
                </button>
              ))}
            </div>
          </div>

          {/* Horizon */}
          <div className="p-5">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Horizon</div>
            <div className="grid grid-cols-3 gap-2">
              {([30, 90, 365] as Horizon[]).map(h => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={cn(
                    "py-2.5 rounded-lg border text-[12px] font-display font-semibold transition-colors",
                    horizon === h ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-background/70 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {h === 365 ? "1yr" : `${h}d`}
                </button>
              ))}
            </div>
          </div>

          {/* Tier */}
          <div className="p-5">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground">Trader tier</div>
            <div className="flex gap-2">
              {(Object.keys(tierApy) as Tier[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={cn(
                    "flex-1 py-2.5 rounded-lg border text-[12px] font-display font-semibold transition-colors",
                    tier === t ? "border-primary bg-primary/10 text-primary" : "border-border/60 bg-background/70 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  {tierApy[t].label}
                </button>
              ))}
            </div>
            <div className="mt-2 font-mono text-[10px] text-muted-foreground">
              Scenario range · {tierApy[tier].conservative}–{tierApy[tier].optimistic}% APY
            </div>
          </div>
        </div>

        {/* Results row */}
        <div className="grid grid-cols-3 divide-x divide-border/50 border-t border-border/50">
          {[
            { label: "Conservative", value: conservativeOut, apy: conservative, muted: true  },
            { label: "Base case",    value: expectedOut,     apy: expected,     muted: false },
            { label: "Optimistic",   value: optimisticOut,   apy: optimistic,   muted: true  },
          ].map(s => (
            <div
              key={s.label}
              className={cn(
                "p-5",
                !s.muted && "bg-primary/[0.04]"
              )}
            >
              <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground mb-2">{s.label}</div>
              <div className={cn(
                "font-display font-bold tabular leading-none",
                s.muted ? "text-[20px] text-foreground" : "text-[26px] text-primary"
              )}>
                ${fmtUSD(s.value, { decimals: 0, compact: true })}
              </div>
              <div className="font-mono text-[10px] text-muted-foreground mt-1.5">
                +${fmtUSD(s.value - deposit, { decimals: 0, compact: true })} · {s.apy}% APY
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-t border-border/50 bg-background/55">
          <p className="font-mono text-[10px] text-muted-foreground">
            Illustrative only. Net of {label.toLowerCase()} performance fees above the high-water mark.
          </p>
          <Button asChild size="sm" className="h-8 shrink-0 bg-primary text-primary-foreground hover:bg-primary-glow border-0 text-[12px] font-semibold">
            <Link to="/vaults">Browse vaults <ArrowRight className="w-3.5 h-3.5 ml-1.5" /></Link>
          </Button>
        </div>
      </div>
    </section>
  );
};
