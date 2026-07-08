"use client";

import type { CSSProperties, ReactNode } from "react";

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
 * Seamless infinite marquee. The track is duplicated and translated -50%, so
 * the loop is gapless. Reduced-motion renders a static, non-scrolling row.
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

  const trackStyle: CSSProperties | undefined = reduced
    ? undefined
    : { animation: `${animationName} ${speed}s linear infinite` };

  return (
    <div
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
        <div className="flex shrink-0 items-center">{children}</div>
        <div aria-hidden className="flex shrink-0 items-center">
          {children}
        </div>
      </div>
    </div>
  );
}
