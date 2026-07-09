"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/components/acid";

export type AnimatedBarProps = {
  /** Fill percentage (0..100). */
  pct: number;
  /** CSS gradient/color for the fill. Token-driven values only. */
  fill?: string;
  /** Track height in px. */
  height?: number;
  className?: string;
};

const DEFAULT_FILL =
  "linear-gradient(90deg, var(--color-acid), var(--color-cyan))";

/**
 * Horizontal progress bar that grows from 0 to `pct` the first time it scrolls
 * into view. Reduced-motion renders fully filled with no transition. All motion
 * is JS-gated, so no new global keyframes are needed.
 */
export function AnimatedBar({
  pct,
  fill = DEFAULT_FILL,
  height = 6,
  className,
}: AnimatedBarProps) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setShown(true);
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.35 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  const filled = shown || reduced;
  const fillStyle: CSSProperties = {
    width: `${filled ? pct : 0}%`,
    backgroundImage: fill,
    transition: reduced
      ? undefined
      : "width 1.4s cubic-bezier(0.19,1,0.22,1)",
  };

  return (
    <div
      ref={ref}
      className={cn("overflow-hidden rounded-full bg-white/[0.08]", className)}
      style={{ height }}
    >
      <div className="h-full rounded-full" style={fillStyle} />
    </div>
  );
}
