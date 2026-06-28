import { Moon, Sun } from "lucide-react";
import { useTheme } from "@/lib/theme";
import { cn } from "@/lib/utils";

export const ThemeToggle = ({ className }: { className?: string }) => {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className={cn(
        "relative h-9 w-9 inline-flex items-center justify-center rounded-lg",
        "border border-border/45 bg-card/50 text-muted-foreground shadow-card",
        "hover:border-primary/30 hover:bg-secondary/70 hover:text-foreground",
        "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className
      )}
    >
      <Sun
        className={cn(
          "absolute w-[15px] h-[15px] transition-all duration-300",
          theme === "dark"
            ? "opacity-0 rotate-90 scale-50"
            : "opacity-100 rotate-0 scale-100"
        )}
      />
      <Moon
        className={cn(
          "absolute w-[15px] h-[15px] transition-all duration-300",
          theme === "dark"
            ? "opacity-100 rotate-0 scale-100"
            : "opacity-0 -rotate-90 scale-50"
        )}
      />
    </button>
  );
};
