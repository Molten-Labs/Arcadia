import { Badge } from "@/components/ui/badge";
import type { ScoreTier } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIER_VARIANT = {
  Verified: "verified",
  Established: "established",
  Advanced: "advanced",
  Elite: "elite",
} as const;

/**
 * Acid tier chip. Reuses the acid-themed `Badge` tier variants so the tokens
 * stay in one place (the legacy `TierBadge` is left untouched).
 */
export function TierChip({
  tier,
  size = "md",
  className,
}: {
  tier: ScoreTier;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <Badge
      variant={TIER_VARIANT[tier]}
      className={cn(size === "sm" && "px-2 py-0 text-[0.6rem]", className)}
    >
      {tier}
    </Badge>
  );
}
