"use client";

import { tierColor } from "@/lib/types";
import type { ScoreTier } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TierBadgeProps {
  tier: ScoreTier;
  size?: "sm" | "md";
  className?: string;
}

export function TierBadge({ tier, size = "md", className }: TierBadgeProps) {
  const color = tierColor(tier);
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold uppercase tracking-widest tnum",
        size === "sm" ? "text-[9px] px-2 py-0.5" : "text-[10px] px-3 py-1",
        className,
      )}
      style={{
        color,
        background: `${color}15`,
        border: `1px solid ${color}35`,
        fontFamily: "var(--font-body)",
        boxShadow: `0 0 10px ${color}10`,
      }}
    >
      {tier}
    </span>
  );
}