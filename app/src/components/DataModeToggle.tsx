import { Database, FlaskConical } from "lucide-react";

import { useDataMode } from "@/hooks/useDataMode";
import { cn } from "@/lib/utils";

export const DataModeToggle = ({ compact = false }: { compact?: boolean }) => {
  const { mode, setMode } = useDataMode();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-border bg-card/80 p-1 shadow-card backdrop-blur",
        compact ? "h-9" : "h-10",
      )}
      aria-label="Data source mode"
    >
      {[
        { value: "mock" as const, label: "Mock data", icon: FlaskConical },
        { value: "real" as const, label: "Real server", icon: Database },
      ].map((item) => (
        <button
          key={item.value}
          type="button"
          onClick={() => setMode(item.value)}
          aria-label={item.label}
          aria-pressed={mode === item.value}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            mode === item.value
              ? "bg-primary/15 text-primary"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground",
          )}
        >
          <item.icon className="h-3.5 w-3.5" aria-hidden="true" />
          <span className={compact ? "hidden sm:inline" : ""}>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default DataModeToggle;
