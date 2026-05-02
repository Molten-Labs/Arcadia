import { Link } from "react-router-dom";
import type { ManagerView } from "@/hooks/useVaults";
import { fmtUSD } from "@/lib/format";
import { ArrowUpRight, BadgeCheck } from "lucide-react";
import { shortAddr } from "@/lib/wallet";

const AVATAR_GRADIENTS = [
  "from-emerald-500 to-teal-600",
  "from-violet-500 to-purple-600",
  "from-sky-500 to-blue-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
];

export const TraderCard = ({ manager }: { manager: ManagerView }) => {
  const initials = manager.owner.slice(0, 2).toUpperCase();
  const gradientIdx = manager.owner.charCodeAt(0) % AVATAR_GRADIENTS.length;
  const gradient = AVATAR_GRADIENTS[gradientIdx];

  return (
    <Link
      to={`/trader/${manager.owner}`}
      className="relative group surface rounded-[11px] p-5 flex flex-col gap-4 hover:border-border-strong hover:-translate-y-0.5 hover:shadow-[0_12px_40px_hsl(var(--background)/0.55)] transition-all duration-200"
    >
      {/* Avatar + identity */}
      <div className="flex items-start gap-3.5">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-display font-bold text-[15px] shrink-0 shadow-signal`}>
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-mono font-semibold text-[14px] text-foreground truncate">
              {shortAddr(manager.owner)}
            </h3>
            <BadgeCheck className="w-3.5 h-3.5 text-success/70 shrink-0" />
          </div>
          <div className="font-mono text-[11px] text-muted-foreground mt-0.5">
            Joined {new Date(manager.createdAt * 1000).toLocaleDateString("en-US", { month: "short", year: "numeric" })}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Vaults", value: manager.totalVaults },
          { label: "Active", value: manager.activeVaults },
          { label: "Junior", value: fmtUSD(manager.totalJuniorDeposited, { compact: true }) },
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

      {/* Footer */}
      <div className="flex items-center justify-between pt-0.5 border-t border-border/40">
        <div className="flex items-center gap-1.5">
          {manager.activeVaults > 0 && (
            <span className="inline-flex items-center gap-1 font-mono text-[10px] text-success/80 bg-success/8 border border-success/15 rounded-full px-2 py-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse-glow" />
              {manager.activeVaults} live
            </span>
          )}
        </div>
        <span className="text-[12px] text-primary/70 font-medium inline-flex items-center gap-1 group-hover:text-primary transition-colors">
          Profile <ArrowUpRight className="w-3 h-3" />
        </span>
      </div>
    </Link>
  );
};
