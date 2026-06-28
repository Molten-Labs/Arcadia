import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

interface Props {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trend?: number;
  className?: string;
}

export const StatCard = ({ label, value, hint, trend, className }: Props) => (
  <div className={cn(
    "surface apex-lift rounded-2xl p-4 flex flex-col gap-1",
    className
  )}>
    <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
      {label}
    </div>
    <div className="font-display font-semibold text-xl mt-0.5 tabular text-foreground leading-tight">
      {value}
    </div>
    {(hint != null || trend != null) && (
      <div className="flex items-center gap-1.5 mt-0.5">
        {trend != null && (
          <span className={cn(
            "inline-flex items-center gap-0.5 tabular font-mono text-[11px] font-semibold",
            trend >= 0 ? "text-success" : "text-destructive"
          )}>
            {trend >= 0
              ? <TrendingUp className="w-3 h-3" />
              : <TrendingDown className="w-3 h-3" />
            }
            {trend >= 0 ? "+" : ""}{trend.toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-muted-foreground text-[11px] font-mono">{hint}</span>}
      </div>
    )}
  </div>
);
