import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trend?: number;
  className?: string;
}

export const StatCard = ({ label, value, hint, trend, className }: Props) => (
  <div className={cn("surface rounded-xl p-4 shadow-card", className)}>
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
    <div className="font-display font-semibold text-2xl mt-1.5 tabular">{value}</div>
    {(hint != null || trend != null) && (
      <div className="flex items-center gap-2 mt-1.5 text-xs">
        {trend != null && (
          <span className={cn("tabular font-medium", trend >= 0 ? "text-success" : "text-destructive")}>
            {trend >= 0 ? "+" : ""}{trend.toFixed(1)}%
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    )}
  </div>
);
