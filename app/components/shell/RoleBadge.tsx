import { Crown, TrendingUp } from "lucide-react";

import type { ArcadiaRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

/**
 * Shared role affordances for the shell. Quiet by design: the trader accent is
 * iridescent cyan, the investor accent is the advanced tier amber -- acid green
 * stays reserved for active/live states elsewhere in the chrome.
 */

type RoleVisual = {
  label: string;
  icon: typeof TrendingUp;
  chip: string;
  avatar: string;
  iconColor: string;
};

const ROLE_VISUALS: Record<"trader" | "investor", RoleVisual> = {
  trader: {
    label: "Trader",
    icon: TrendingUp,
    chip: "border-cyan/25 bg-cyan/10 text-cyan",
    avatar: "border-cyan/30 bg-cyan/10 text-cyan",
    iconColor: "text-cyan",
  },
  investor: {
    label: "Investor",
    icon: Crown,
    chip: "border-tier-advanced/25 bg-tier-advanced/10 text-tier-advanced",
    avatar: "border-tier-advanced/30 bg-tier-advanced/10 text-tier-advanced",
    iconColor: "text-tier-advanced",
  },
};

/** Pill chip naming the connected role. Renders nothing until a role is set. */
export function RoleBadge({ role, className }: { role: ArcadiaRole; className?: string }) {
  if (!role) return null;
  const v = ROLE_VISUALS[role];
  const Icon = v.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em]",
        v.chip,
        className,
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {v.label}
    </span>
  );
}

/** Round role glyph for the topbar. Shows a neutral placeholder when role-less. */
export function RoleAvatar({ role }: { role: ArcadiaRole }) {
  if (!role) {
    return (
      <span
        aria-hidden
        className="flex size-8 shrink-0 items-center justify-center rounded-full border border-line bg-panel-2 font-mono text-[11px] font-bold text-faint"
      >
        ?
      </span>
    );
  }
  const v = ROLE_VISUALS[role];
  const Icon = v.icon;
  return (
    <span
      className={cn("flex size-8 shrink-0 items-center justify-center rounded-full border", v.avatar)}
      aria-label={`${v.label} account`}
      role="img"
    >
      <Icon className="size-3.5" aria-hidden />
    </span>
  );
}
