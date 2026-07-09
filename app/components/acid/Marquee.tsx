"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

export type MarqueeProps = {
  children: ReactNode;
  /** Seconds for one full loop (lower = faster). */
  speed?: number;
  direction?: "left" | "right";
  /** Degrees of rotation, for the diagonal acid band. */
  rotation?: number;
  /** Pause the scroll while hovered. */
  pauseOnHover?: boolean;
  className?: string;
  trackClassName?: string;
};

/**
 * Seamless infinite marquee. The track is two identical halves translated -50%,
 * so the loop is gapless -- but only if each half is at least as wide as the
 * container, otherwise empty space scrolls in near the seam. We measure one set
 * against the container and repeat the children enough times per half to always
 * overflow it (recomputed on resize). Reduced-motion renders a static row.
 */
export function Marquee({
  children,
  speed = 30,
  direction = "left",
  rotation = 0,
  pauseOnHover = true,
  className,
  trackClassName,
}: MarqueeProps) {
  const reduced = usePrefersReducedMotion();
  const animationName = direction === "left" ? "acid-marquee" : "acid-marquee-rev";

  const containerRef = useRef<HTMLDivElement>(null);
  const setRef = useRef<HTMLDivElement>(null);
  // Total sets across the track. Even, so -50% lands exactly on a set boundary.
  // Starts at 2 (SSR + first paint), then grows to fill wide viewports on mount.
  const [copies, setCopies] = useState(2);

  useEffect(() => {
    const container = containerRef.current;
    const set = setRef.current;
    if (!container || !set) return;

    const measure = () => {
      const setWidth = set.scrollWidth;
      const containerWidth = container.clientWidth;
      if (!setWidth || !containerWidth) return;
      // Each animated half must be >= the container width; +1 keeps the seam
      // covered even mid-cycle. Two halves -> multiply by 2.
      const perHalf = Math.ceil(containerWidth / setWidth) + 1;
      setCopies(perHalf * 2);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(container);
    ro.observe(set);
    return () => ro.disconnect();
  }, [children]);

  const trackStyle: CSSProperties | undefined = reduced
    ? undefined
    : { animation: `${animationName} ${speed}s linear infinite` };

  return (
    <div
      ref={containerRef}
      className={cn("group relative w-full overflow-hidden", className)}
      style={rotation ? { transform: `rotate(${rotation}deg)` } : undefined}
    >
      <div
        className={cn(
          "acid-animate flex w-max shrink-0 items-center",
          pauseOnHover && "group-hover:[animation-play-state:paused]",
          trackClassName
        )}
        style={trackStyle}
      >
        {Array.from({ length: copies }).map((_, i) => (
          <div
            key={i}
            ref={i === 0 ? setRef : undefined}
            aria-hidden={i === 0 ? undefined : true}
            className="flex shrink-0 items-center"
          >
            {children}
          </div>
        ))}
      </div>
    </div>
  );
}
