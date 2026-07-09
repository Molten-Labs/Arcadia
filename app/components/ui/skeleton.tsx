import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

/**
 * Shimmer skeleton. The sweep is a transform-only `::before` (60fps) that is
 * disabled under prefers-reduced-motion via the `.acid-animate` guard in
 * globals.css.
 */
function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        "acid-animate relative overflow-hidden rounded-md bg-panel-2",
        "before:absolute before:inset-0 before:-translate-x-full before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent before:content-['']",
        "before:[animation:acid-shimmer_1.6s_ease-in-out_infinite]",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
