import { cn } from "@/lib/utils";
import { Sparkles, Award, Shield, Star, Crown } from "lucide-react";

export type TraderTier = "novice" | "proven" | "established" | "veteran" | "elite";

const config: Record<TraderTier, { label: string; icon: typeof Sparkles; color: string; bg: string }> = {
  novice: { label: "Novice", icon: Sparkles, color: "text-tier-novice", bg: "bg-tier-novice/10 border-tier-novice/30" },
  proven: { label: "Proven", icon: Shield, color: "text-tier-proven", bg: "bg-tier-proven/10 border-tier-proven/30" },
  established: { label: "Established", icon: Award, color: "text-tier-established", bg: "bg-tier-established/10 border-tier-established/30" },
  veteran: { label: "Veteran", icon: Star, color: "text-tier-veteran", bg: "bg-tier-veteran/10 border-tier-veteran/30" },
  elite: { label: "Elite", icon: Crown, color: "text-tier-elite", bg: "bg-tier-elite/10 border-tier-elite/30" },
};

export const TierBadge = ({ tier, className, showIcon = true }: { tier: TraderTier; className?: string; showIcon?: boolean }) => {
  const c = config[tier];
  const Icon = c.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold uppercase tracking-wide", c.bg, c.color, className)}>
      {showIcon && <Icon className="w-3 h-3" />}
      {c.label}
    </span>
  );
};
