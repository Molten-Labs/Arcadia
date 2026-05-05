import { ReactNode } from "react";
import { Inbox } from "lucide-react";
import { cn } from "@/lib/utils";

export const EmptyState = ({ icon, title, description, action, className }: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}) => (
  <div className={cn("surface rounded-2xl p-10 text-center flex flex-col items-center gap-3", className)}>
    <div className="w-12 h-12 rounded-2xl border border-primary/20 bg-primary/10 flex items-center justify-center text-primary shadow-signal">
      {icon ?? <Inbox className="w-5 h-5" />}
    </div>
    <h3 className="font-display font-semibold">{title}</h3>
    {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
    {action && <div className="mt-2">{action}</div>}
  </div>
);
