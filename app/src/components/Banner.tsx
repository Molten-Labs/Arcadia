import { cn } from "@/lib/utils";
import { ReactNode } from "react";
import { AlertTriangle, Flame, Snowflake, Info } from "lucide-react";

type Variant = "warning" | "danger" | "info" | "signal";

const config: Record<Variant, { bg: string; border: string; text: string; icon: typeof Info }> = {
  warning: { bg: "bg-status-cooldown/10", border: "border-status-cooldown/30", text: "text-status-cooldown", icon: AlertTriangle },
  danger: { bg: "bg-destructive/10", border: "border-destructive/30", text: "text-destructive", icon: Snowflake },
  info: { bg: "bg-info/10", border: "border-info/30", text: "text-info", icon: Info },
  signal: { bg: "bg-primary/10", border: "border-primary/30", text: "text-primary", icon: Flame },
};

export const Banner = ({ variant = "info", title, children, action }: {
  variant?: Variant; title: string; children?: ReactNode; action?: ReactNode;
}) => {
  const c = config[variant];
  const Icon = c.icon;
  return (
    <div className={cn("rounded-lg border p-4 flex items-start gap-3", c.bg, c.border)}>
      <Icon className={cn("w-5 h-5 shrink-0 mt-0.5", c.text)} />
      <div className="flex-1">
        <div className={cn("font-semibold text-sm", c.text)}>{title}</div>
        {children && <div className="text-sm text-foreground/80 mt-1">{children}</div>}
      </div>
      {action}
    </div>
  );
};
