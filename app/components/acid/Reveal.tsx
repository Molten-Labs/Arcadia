"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

export type RevealProps = {
  children: ReactNode;
  /** Stagger delay in ms. */
  delay?: number;
  /** Initial translate-Y distance in px. */
  y?: number;
  className?: string;
};

/**
 * Fade + translate-in on first scroll into view (fires once). Reduced-motion
 * renders fully visible with no transition.
 */
export function Reveal({ children, delay = 0, y = 28, className }: RevealProps) {
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
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div
      ref={ref}
      className={cn(
        "transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.19,1,0.22,1)] will-change-[opacity,transform]",
        className
      )}
      style={{
        opacity: shown || reduced ? 1 : 0,
        transform: shown || reduced ? "none" : `translateY(${y}px)`,
        transitionDelay: `${delay}ms`,
      }}
    >
      {children}
    </div>
  );
}
