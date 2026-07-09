import type { ArcadiaRole } from "@/lib/role-context";
import { cn } from "@/lib/utils";

/**
 * Shared role affordances for the shell. Quiet by design: the trader accent is
 * iridescent cyan, the investor accent is the advanced tier amber -- acid green
 * stays reserved for active/live states elsewhere in the chrome.
 */

type RoleVisual = {
  label: string;
  chip: string;
};

const ROLE_VISUALS: Record<"trader" | "investor", RoleVisual> = {
  trader: {
    label: "Trader",
    chip: "border-cyan/25 bg-cyan/10 text-cyan",
  },
  investor: {
    label: "Investor",
    chip: "border-tier-advanced/25 bg-tier-advanced/10 text-tier-advanced",
  },
};

/** Pill chip naming the connected role. Renders nothing until a role is set. */
export function RoleBadge({ role, className }: { role: ArcadiaRole; className?: string }) {
  if (!role) return null;
  const v = ROLE_VISUALS[role];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em]",
        v.chip,
        className,
      )}
    >
      {v.label}
    </span>
  );
}
