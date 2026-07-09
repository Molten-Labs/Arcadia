"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

export type CountUpProps = {
  /** Target value. */
  value: number;
  /** Animation duration in ms. */
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
};

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

/**
 * Counts from 0 to `value` (rAF, ease-out-cubic) the first time it scrolls into
 * view. Renders tabular monospace figures. Reduced-motion jumps to the final
 * value with no animation.
 */
export function CountUp({
  value,
  duration = 1600,
  decimals = 0,
  prefix = "",
  suffix = "",
  className,
}: CountUpProps) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const started = useRef(false);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || reduced) return;

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || started.current) return;
          started.current = true;
          io.unobserve(entry.target);

          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min((now - start) / duration, 1);
            setDisplay(easeOutCubic(p) * value);
            if (p < 1) requestAnimationFrame(tick);
            else setDisplay(value);
          };
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced, value, duration]);

  // Reduced-motion shows the final value directly; no animation state involved.
  const formatted = (reduced ? value : display).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });

  return (
    <span ref={ref} className={cn("font-mono tabular-nums", className)}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
