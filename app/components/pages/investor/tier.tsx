import type { CSSProperties } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ScoreTier } from "@/lib/types";

/**
 * Acid-system tier presentation for the investor pages. Maps a reputation tier
 * to the acid tier tokens (never the legacy muted palette). Use these instead of
 * the legacy `TierBadge` so the investor surfaces read as one system.
 */

type TierVariant = "verified" | "established" | "advanced" | "elite";

const TIER_META: Record<ScoreTier, { variant: TierVariant; token: string }> = {
  Verified: { variant: "verified", token: "var(--color-tier-verified)" },
  Established: { variant: "established", token: "var(--color-tier-established)" },
  Advanced: { variant: "advanced", token: "var(--color-tier-advanced)" },
  Elite: { variant: "elite", token: "var(--color-tier-elite)" },
};

/** CSS token (custom property reference) for a tier's accent color. */
export function tierToken(tier: ScoreTier): string {
  return TIER_META[tier].token;
}

/** Acid tier badge. */
export function TierChip({ tier, className }: { tier: ScoreTier; className?: string }) {
  return (
    <Badge variant={TIER_META[tier].variant} className={className}>
      {tier}
    </Badge>
  );
}

/** Vault deposits open / closed pill. */
export function DepositsBadge({
  open,
  capacityLeft,
}: {
  open: boolean;
  capacityLeft?: number;
}) {
  if (!open) return <Badge variant="danger">Closed</Badge>;
  return (
    <Badge variant="success">
      <span aria-hidden className="size-1.5 rounded-full bg-success motion-safe:animate-pulse" />
      Open
      {capacityLeft !== undefined && capacityLeft > 0 && (
        <span className="opacity-70">${(capacityLeft / 1000).toFixed(0)}k left</span>
      )}
    </Badge>
  );
}

/** Round, tier-tinted identity monogram. */
export function TraderAvatar({
  handle,
  tier,
  size = 40,
  className,
}: {
  handle: string;
  tier: ScoreTier;
  size?: number;
  className?: string;
}) {
  const token = tierToken(tier);
  const style: CSSProperties = {
    width: size,
    height: size,
    fontSize: Math.round(size * 0.32),
    color: token,
    background: `color-mix(in srgb, ${token} 12%, transparent)`,
    border: `1px solid color-mix(in srgb, ${token} 40%, transparent)`,
  };
  return (
    <div
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-mono font-bold tracking-tight",
        className,
      )}
      style={style}
    >
      {handle.slice(0, 2).toUpperCase()}
    </div>
  );
}
