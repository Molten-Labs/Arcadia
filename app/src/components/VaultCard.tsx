import { Link } from "react-router-dom";
import type { VaultView } from "@/hooks/useVaults";
import { fmtUSD } from "@/lib/format";
import { StatusBadge } from "./StatusBadge";
import { ArrowUpRight, Zap, Shield } from "lucide-react";
import { shortAddr } from "@/lib/wallet";
import { cn } from "@/lib/utils";

const getHealthColor = (h: number) => {
  if (h < 20) return "text-destructive";
  if (h < 50) return "text-warning";
  return "text-success";
};

const getHealthBarColor = (h: number) => {
  if (h < 20) return "bg-destructive";
  if (h < 50) return "bg-warning";
  return "bg-success";
};

export const VaultCard = ({ vault }: { vault: VaultView }) => {
  const juniorPct = vault.tvl > 0 ? Math.round((vault.juniorCapital / vault.tvl) * 100) : 0;
  const isTop = vault.juniorHealth > 80 && vault.status === "active";

  return (
    <Link
      to={`/vault/${vault.id}`}
      className={cn(
        "relative group surface rounded-[11px] overflow-hidden flex flex-col gap-0",
        "hover:border-border-strong hover:shadow-[0_12px_40px_hsl(var(--background)/0.55),0_0_28px_hsl(var(--primary)/0.06)]",
        "hover:-translate-y-0.5 transition-all duration-200",
        isTop && "border-primary/25"
      )}
    >
      {isTop && (
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      )}

      {/* Header */}
      <div className="p-5 pb-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-semibold text-[15px] leading-tight tracking-tight text-foreground truncate">
              {vault.name}
            </h3>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="font-mono text-[11px] text-muted-foreground">
                by {shortAddr(vault.managerPubkey)}
              </span>
            </div>
          </div>
          <StatusBadge status={vault.status} />
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "TVL", value: vault.tvl > 0 ? fmtUSD(vault.tvl, { compact: true }) : "—" },
            { label: "NAV", value: vault.currentNav > 0 ? fmtUSD(vault.currentNav, { compact: true }) : "—" },
            { label: "Junior %", value: `${juniorPct}%` },
          ].map((s) => (
            <div key={s.label} className="bg-secondary/50 rounded-lg px-2.5 py-2">
              <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground mb-0.5">
                {s.label}
              </div>
              <div className="font-mono font-medium text-[12px] text-foreground tabular">
                {s.value}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Health meter */}
      <div className="px-5 pb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted-foreground flex items-center gap-1.5">
            <Shield className="w-3 h-3" /> Junior health
          </span>
          <span className={cn("font-mono text-[12px] font-semibold tabular", getHealthColor(vault.juniorHealth))}>
            {vault.juniorHealth}%
          </span>
        </div>
        <div className="h-1.5 bg-secondary/70 rounded-full overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", getHealthBarColor(vault.juniorHealth))}
            style={{ width: `${vault.juniorHealth}%` }}
          />
        </div>
      </div>

      {/* Tags & footer */}
      <div className="px-5 pb-5 border-t border-border/40 pt-3 flex items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-secondary/60 text-muted-foreground border border-border/50">
            {vault.feeBps / 100}% fee
          </span>
          {vault.instantExit && (
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary/90 border border-primary/20 inline-flex items-center gap-1">
              <Zap className="w-2.5 h-2.5" /> Instant exit
            </span>
          )}
          {vault.status === "paper" && (
            <span className="font-mono text-[10px] px-2 py-0.5 rounded-full bg-muted/60 text-muted-foreground border border-border/50">
              {vault.paperTradeCount}/{vault.minQualifyingTrades} trades
            </span>
          )}
        </div>
        <span className="shrink-0 text-[12px] text-primary/70 font-medium inline-flex items-center gap-1 group-hover:text-primary transition-colors">
          View <ArrowUpRight className="w-3 h-3" />
        </span>
      </div>
    </Link>
  );
};
