import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ScoreTier } from "@/lib/types";

/** Capitalised tier -> lowercase design-system key (Badge variant + acid ScoreDial tier). */
const TIER_KEY = {
  Verified: "verified",
  Established: "established",
  Advanced: "advanced",
  Elite: "elite",
} as const;

export type AcidTier = (typeof TIER_KEY)[ScoreTier];

export function acidTier(tier: ScoreTier): AcidTier {
  return TIER_KEY[tier];
}

const TIER_DOT: Record<ScoreTier, string> = {
  Verified: "bg-tier-verified",
  Established: "bg-tier-established",
  Advanced: "bg-tier-advanced",
  Elite: "bg-tier-elite",
};

/** Acid-themed tier badge (delegates to the shadcn Badge tier variants). */
export function TierChip({ tier, className }: { tier: ScoreTier; className?: string }) {
  return (
    <Badge variant={TIER_KEY[tier]} className={className}>
      {tier}
    </Badge>
  );
}

/** Small glowing tier dot for table rows. */
export function TierDot({ tier, className }: { tier: ScoreTier; className?: string }) {
  return <span aria-hidden className={cn("size-2.5 rounded-full", TIER_DOT[tier], className)} />;
}
