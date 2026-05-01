import { Link } from "react-router-dom";
import type { ManagerView } from "@/hooks/useVaults";
import { fmtUSD } from "@/lib/format";
import { ArrowRight } from "lucide-react";
import { shortAddr } from "@/lib/wallet";

export const TraderCard = ({ manager }: { manager: ManagerView }) => {
  const initials = manager.owner.slice(0, 2).toUpperCase();

  return (
    <Link
      to={`/trader/${manager.owner}`}
      className="group surface rounded-lg p-5 shadow-card hover:border-border-strong hover:bg-card-elevated transition-colors flex flex-col gap-4"
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-gradient-signal flex items-center justify-center text-primary-foreground font-display font-bold text-lg shrink-0 shadow-signal">
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold text-lg truncate font-mono">
            {shortAddr(manager.owner)}
          </h3>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-muted-foreground">Manager profile</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 py-3 border-y border-border">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Vaults</div>
          <div className="tabular font-semibold text-sm mt-0.5">{manager.totalVaults}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Active</div>
          <div className="tabular font-semibold text-sm mt-0.5">{manager.activeVaults}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-wide text-muted-foreground">Junior</div>
          <div className="tabular font-semibold text-sm mt-0.5">{fmtUSD(manager.totalJuniorDeposited, { compact: true })} USDC</div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1">
        <span className="text-xs text-muted-foreground">
          Joined {new Date(manager.createdAt * 1000).toLocaleDateString("en-US", { month: "short", year: "2-digit" })}
        </span>
        <span className="text-xs text-primary inline-flex items-center gap-1 group-hover:gap-2 transition-[gap]">
          View profile <ArrowRight className="w-3 h-3" />
        </span>
      </div>
    </Link>
  );
};
