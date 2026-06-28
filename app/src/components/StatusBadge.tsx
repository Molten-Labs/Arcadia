import { cn } from "@/lib/utils";
import { Circle } from "lucide-react";

export type VaultStatus = "paper" | "active" | "cooldown" | "frozen" | "closed";

const config: Record<VaultStatus, { label: string; color: string; bg: string; dot: string }> = {
  paper: { label: "Paper Mode", color: "text-status-paper", bg: "bg-status-paper/10 border-status-paper/30", dot: "bg-status-paper" },
  active: { label: "Active", color: "text-status-active", bg: "bg-status-active/10 border-status-active/30", dot: "bg-status-active" },
  cooldown: { label: "Cooldown", color: "text-status-cooldown", bg: "bg-status-cooldown/10 border-status-cooldown/30", dot: "bg-status-cooldown" },
  frozen: { label: "Frozen", color: "text-status-frozen", bg: "bg-status-frozen/10 border-status-frozen/30", dot: "bg-status-frozen" },
  closed: { label: "Closed", color: "text-status-closed", bg: "bg-status-closed/10 border-status-closed/30", dot: "bg-status-closed" },
};

export const StatusBadge = ({ status, className }: { status: VaultStatus; className?: string }) => {
  const c = config[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium tabular", c.bg, c.color, className)}>
      <span className={cn("w-1.5 h-1.5 rounded-full", c.dot, status === "active" && "animate-pulse-glow")} />
      {c.label}
    </span>
  );
};
