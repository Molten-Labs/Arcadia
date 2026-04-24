import { cn } from "@/lib/utils";

interface Props {
  health: number; // 0-100
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
  className?: string;
}

const getColor = (h: number) => {
  if (h < 10) return "bg-status-frozen";
  if (h < 20) return "bg-status-frozen";
  if (h < 50) return "bg-status-cooldown";
  return "bg-status-active";
};

const getTextColor = (h: number) => {
  if (h < 20) return "text-status-frozen";
  if (h < 50) return "text-status-cooldown";
  return "text-status-active";
};

export const HealthMeter = ({ health, size = "md", showLabel = true, className }: Props) => {
  const heights = { sm: "h-1", md: "h-1.5", lg: "h-2.5" };
  return (
    <div className={cn("w-full", className)}>
      {showLabel && (
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">Junior health</span>
          <span className={cn("text-xs tabular font-semibold", getTextColor(health))}>{health}%</span>
        </div>
      )}
      <div className={cn("w-full rounded-full bg-secondary overflow-hidden relative", heights[size])}>
        <div
          className={cn("h-full rounded-full transition-all", getColor(health))}
          style={{ width: `${Math.max(2, health)}%` }}
        />
        {/* Threshold markers */}
        <div className="absolute inset-y-0 left-[20%] w-px bg-background/40" />
        <div className="absolute inset-y-0 left-[50%] w-px bg-background/40" />
      </div>
    </div>
  );
};
