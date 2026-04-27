import { Database, FlaskConical } from "lucide-react";

import { useDataMode } from "@/hooks/useDataMode";
import { cn } from "@/lib/utils";

export const DataModeToggle = ({ compact = false }: { compact?: boolean }) => {
  const { mode, setMode } = useDataMode();

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-md bg-card/45 p-1 shadow-card ring-1 ring-border/35 backdrop-blur",
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
            "relative inline-flex h-8 items-center gap-1.5 rounded-none px-3 text-xs font-semibold transition-colors after:absolute after:inset-x-3 after:bottom-0 after:h-px after:origin-center after:scale-x-0 after:bg-primary after:shadow-[0_0_16px_hsl(var(--primary)/0.8)] after:transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            mode === item.value
              ? "text-primary-glow after:scale-x-100"
              : "text-muted-foreground hover:text-foreground",
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
