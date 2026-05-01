import { useState, useMemo } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { fmtUSD } from "@/lib/format";
import { Calculator, ArrowRight } from "lucide-react";

type Tier = "established" | "veteran" | "elite";
type Horizon = 30 | 90 | 365;

const tierApy: Record<Tier, { conservative: number; expected: number; optimistic: number; label: string; subtitle: string }> = {
  established: {
    conservative: 8, expected: 14, optimistic: 22,
    label: "Established trader",
    subtitle: "2+ graduated vaults, mid drawdowns",
  },
  veteran: {
    conservative: 11, expected: 19, optimistic: 28,
    label: "Veteran trader",
    subtitle: "Proven multi-cycle record",
  },
  elite: {
    conservative: 14, expected: 24, optimistic: 36,
    label: "Elite trader",
    subtitle: "Top-tier track record, low DD",
  },
};

export const VaultCalculator = () => {
  const [deposit, setDeposit] = useState(10_000);
  const [horizon, setHorizon] = useState<Horizon>(90);
  const [tier, setTier] = useState<Tier>("veteran");

  const { conservative, expected, optimistic, label, subtitle } = tierApy[tier];

  const conservativeOut = useMemo(() => {
    const years = horizon / 365;
    return deposit * Math.pow(1 + conservative / 100, years);
  }, [deposit, horizon, conservative]);

  const expectedOut = useMemo(() => {
    const years = horizon / 365;
    return deposit * Math.pow(1 + expected / 100, years);
  }, [deposit, horizon, expected]);

  const optimisticOut = useMemo(() => {
    const years = horizon / 365;
    return deposit * Math.pow(1 + optimistic / 100, years);
  }, [deposit, horizon, optimistic]);

  return (
    <section id="calculator" className="container py-20 scroll-mt-20">
      <div className="text-center max-w-2xl mx-auto mb-10">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Returns calculator
        </div>
        <h2 className="font-display type-h2 font-semibold">
          Project your <span className="text-gradient-signal">expected returns</span>
        </h2>
        <p className="text-muted-foreground mt-3">
          Risk-adjusted projections based on historical performance by trader tier.
        </p>
      </div>

      <div className="grid lg:grid-cols-2 rounded-lg overflow-hidden border border-border">
        {/* LEFT - inputs */}
        <div className="bg-card p-8 lg:p-10 space-y-8 divide-y divide-border">
          {/* Deposit */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold flex items-center gap-2">
                <Calculator className="w-4 h-4 text-primary" /> Deposit amount
              </h3>
              <span className="font-display type-h3 font-semibold text-primary tabular">${fmtUSD(deposit)}</span>
            </div>
            <Slider value={[deposit]} onValueChange={([v]) => setDeposit(v)} min={500} max={250_000} step={500} />
            <div className="flex justify-between text-xs text-muted-foreground mt-2 tabular">
              <span>$500</span><span>$250k</span>
            </div>
            <div className="flex gap-2 mt-3">
              {[1000, 5000, 25_000, 100_000].map(v => (
                <button
                  key={v}
                  onClick={() => setDeposit(v)}
                  className={`flex-1 text-xs py-1.5 rounded-md border transition-colors ${
                    deposit === v ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary hover:bg-accent"
                  }`}
                >
                  ${v >= 1000 ? `${v / 1000}k` : v}
                </button>
              ))}
            </div>
          </div>

          {/* Horizon */}
          <div className="pt-8">
            <h3 className="font-display font-semibold mb-4">Investment horizon</h3>
            <div className="grid grid-cols-3 gap-2">
              {([30, 90, 365] as Horizon[]).map(h => (
                <button
                  key={h}
                  onClick={() => setHorizon(h)}
                  className={`py-3 rounded-lg border text-sm transition-colors ${
                    horizon === h ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary hover:bg-accent"
                  }`}
                >
                  <div className="font-display font-bold">{h === 365 ? "1 year" : `${h} days`}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Tier */}
          <div className="pt-8">
            <h3 className="font-display font-semibold mb-4">Trader tier</h3>
            <div className="space-y-2">
              {(Object.keys(tierApy) as Tier[]).map(t => {
                const info = tierApy[t];
                return (
                  <button
                    key={t}
                    onClick={() => setTier(t)}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left transition-colors ${
                      tier === t ? "border-primary bg-primary/5" : "border-border hover:bg-secondary"
                    }`}
                  >
                    <span className={`mt-1 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      tier === t ? "border-primary" : "border-muted-foreground"
                    }`}>
                      {tier === t && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
                    </span>
                    <div className="flex-1">
                      <div className="font-semibold text-sm capitalize">{info.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{info.subtitle}</div>
                    </div>
                    <div className="text-xs tabular text-muted-foreground self-center">{info.expected}% target</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* RIGHT - results */}
        <div className="bg-background-secondary/40 p-8 lg:p-10 space-y-4">
          <h3 className="font-display font-semibold">Projected outcomes</h3>
          <p className="text-sm text-muted-foreground">
            Three scenarios based on {label.toLowerCase()} historical bands. Past performance doesn't guarantee future results.
          </p>

          {/* Conservative */}
          <div className="surface rounded-lg p-6 space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Conservative case</div>
            <div className="font-display type-h2 font-semibold tabular">${fmtUSD(conservativeOut, { decimals: 0 })}</div>
            <div className="text-xs text-muted-foreground">+ ${fmtUSD(conservativeOut - deposit, { decimals: 0 })} at {conservative}% APY</div>
          </div>

          {/* Expected */}
          <div className="rounded-lg p-6 space-y-2 bg-gradient-signal text-primary-foreground shadow-signal relative overflow-hidden">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl" />
            <div className="text-xs uppercase tracking-wider text-primary-foreground/80 relative">Expected case</div>
            <div className="font-display type-h1 font-semibold tabular relative">${fmtUSD(expectedOut, { decimals: 0 })}</div>
            <div className="text-sm text-primary-foreground/90 relative">+ ${fmtUSD(expectedOut - deposit, { decimals: 0 })} at {expected}% APY</div>
          </div>

          {/* Optimistic */}
          <div className="surface rounded-lg p-6 space-y-2">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Optimistic case</div>
            <div className="font-display type-h2 font-semibold tabular">${fmtUSD(optimisticOut, { decimals: 0 })}</div>
            <div className="text-xs text-muted-foreground">+ ${fmtUSD(optimisticOut - deposit, { decimals: 0 })} at {optimistic}% APY</div>
          </div>

          <Button asChild size="lg" className="w-full bg-gradient-signal text-primary-foreground border-0 mt-4">
            <Link to="/vaults">Browse {label.split(" ")[0].toLowerCase()} vaults <ArrowRight className="w-4 h-4 ml-2" /></Link>
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Returns are net of performance fees (15–20% above HWM). Junior buffer absorbs losses before any senior capital.
          </p>
        </div>
      </div>
    </section>
  );
};
