import { Link } from "react-router-dom";
import type { VaultView } from "@/hooks/useVaults";
import { fmtUSD } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";
import { HealthMeter } from "./HealthMeter";
import { ArrowRight, Zap } from "lucide-react";
import { shortAddr } from "@/lib/wallet";

export const VaultCard = ({ vault }: { vault: VaultView }) => {
  const juniorPct = vault.tvl > 0 ? Math.round((vault.juniorCapital / vault.tvl) * 100) : 0;

  return (
    <Link
      to={`/vault/${vault.id}`}
      className="group matte-panel rounded-lg p-5 transition-colors hover:border-primary/30 hover:bg-card-elevated/80 flex flex-col gap-4"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display font-semibold text-lg leading-tight truncate">{vault.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground truncate font-mono">
              by {shortAddr(vault.managerPubkey)}
            </span>
          </div>
        </div>
        <StatusBadge status={vault.status} />
      </div>

      <div className="grid grid-cols-3 gap-3 py-3 border-y border-border/45">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">TVL</div>
          <div className="tabular font-semibold text-sm mt-0.5">
            {vault.tvl > 0 ? `${fmtUSD(vault.tvl, { compact: true })} USDC` : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">NAV</div>
          <div className="tabular font-semibold text-sm mt-0.5">
            {vault.currentNav > 0 ? `${fmtUSD(vault.currentNav, { compact: true })} USDC` : "—"}
          </div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Junior</div>
          <div className="tabular font-semibold text-sm mt-0.5">{juniorPct}%</div>
        </div>
      </div>

      <HealthMeter health={vault.juniorHealth} />

      <div className="flex flex-wrap gap-1.5">
          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/70 text-muted-foreground">
          Fee: {vault.feeBps / 100}%
        </span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/70 text-muted-foreground">
          Slippage: {vault.maxSlippageBps / 100}%
        </span>
        {vault.instantExit && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/12 text-primary inline-flex items-center gap-1 shadow-[0_0_16px_hsl(var(--primary)/0.12)]">
            <Zap className="w-2.5 h-2.5" /> Instant exit
          </span>
        )}
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground">
          {vault.status === "paper"
            ? `${vault.paperTradeCount}/${vault.minQualifyingTrades} trades`
            : vault.graduatedAt > 0
            ? `Graduated ${new Date(vault.graduatedAt * 1000).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}`
            : ""}
        </span>
        <span className="text-xs text-primary inline-flex items-center gap-1 group-hover:gap-2 transition-[gap]">
          View vault <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </Link>
  );
};
