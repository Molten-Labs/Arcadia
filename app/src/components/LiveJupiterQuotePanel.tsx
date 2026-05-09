import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Activity, Loader2, RadioTower, Route, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { fetchSurfpoolJupiterQuote, runSurfpoolDemoStep, type MarketQuote } from "@/lib/surfpoolDemo";
import { fmtUSD } from "@/lib/format";
import { cn } from "@/lib/utils";

interface LiveJupiterQuotePanelProps {
  vaultConfigPubkey: string;
}

export function LiveJupiterQuotePanel({ vaultConfigPubkey }: LiveJupiterQuotePanelProps) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["market-quote", vaultConfigPubkey],
    queryFn: fetchSurfpoolJupiterQuote,
    enabled: false,
    staleTime: 10_000,
  });
  const quote = query.data ?? queryClient.getQueryData<MarketQuote>(["market-quote", vaultConfigPubkey]);

  const run = async (label: string, path: string) => {
    try {
      await runSurfpoolDemoStep(path);
      toast.success(label);
    } catch (error) {
      toast.error(`${label} failed`, {
        description: error instanceof Error ? error.message : "Check Surfpool demo mode.",
      });
    }
  };

  return (
    <div className="surface rounded-lg p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-display text-[16px] font-semibold">
            <RadioTower className="h-4 w-4 text-primary" /> Preview SOL exposure
          </h3>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
            Live Jupiter quote. Execution simulated with Surfpool. No mainnet funds touched.
          </p>
        </div>
        <span className="rounded-md bg-primary/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-primary">
          Surfpool
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <QuoteMetric label="Route" value={quote?.route ?? "USDC -> SOL"} icon={<Route className="h-3.5 w-3.5" />} />
        <QuoteMetric
          label="Input"
          value={quote ? `${fmtUSD(quote.inputAmount, { compact: true })} ${quote.inputSymbol}` : "30K USDC"}
        />
        <QuoteMetric
          label="Expected output"
          value={quote ? `${quote.expectedOutput.toFixed(3)} ${quote.outputSymbol}` : "Awaiting quote"}
        />
        <QuoteMetric
          label="Price impact"
          value={quote ? `${quote.priceImpactPct.toFixed(3)}%` : "-"}
          tone={quote && quote.priceImpactPct > 0.5 ? "warning" : "neutral"}
        />
      </div>

      <div className="mt-3 rounded-lg bg-secondary/30 p-3">
        <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">Route source</div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[12px] text-foreground/85">
          {(quote?.routeLabels?.length ? quote.routeLabels : ["Jupiter route"]).map((label) => (
            <span key={label} className="rounded-md bg-background/50 px-2 py-1">
              {label}
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 text-[12px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 text-primary" />
          {quote
            ? `${quote.quoteSource} · ${quote.executionEnv}`
            : "Fetch a quote before applying the Surfpool market preview."}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button variant="outline" className="h-10" onClick={() => query.refetch()} disabled={query.isFetching}>
          {query.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Activity className="mr-2 h-4 w-4" />}
          Fetch live quote
        </Button>
        <Button
          className="h-10 bg-primary text-primary-foreground hover:bg-primary-glow"
          onClick={() => run("Surfpool swap simulated", "/demo/surfpool/simulate-swap")}
          disabled={!quote}
        >
          Simulate on Surfpool
        </Button>
      </div>
    </div>
  );
}

function QuoteMetric({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className="rounded-lg bg-secondary/35 p-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 flex items-center gap-1.5 font-display text-[17px] font-semibold tabular-nums",
          tone === "warning" ? "text-warning" : "text-foreground"
        )}
      >
        {icon}
        {value}
      </div>
    </div>
  );
}
