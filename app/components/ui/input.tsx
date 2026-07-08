import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-9 w-full min-w-0 rounded-lg border border-white/10 bg-panel-2 px-3 py-1 text-sm text-ink shadow-none transition-[color,box-shadow,border-color] outline-none",
        "placeholder:text-faint selection:bg-acid selection:text-void",
        "file:inline-flex file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink",
        "focus-visible:border-acid focus-visible:ring-2 focus-visible:ring-acid/30",
        "aria-invalid:border-danger aria-invalid:ring-2 aria-invalid:ring-danger/30",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
}

export { Input };
