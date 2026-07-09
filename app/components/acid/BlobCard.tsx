"use client";

import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

const RADIUS_PRESETS = {
  organic: {
    value: "42% 58% 63% 37% / 45% 42% 58% 55%",
    breathe: "acid-breathe-organic",
  },
  soft: {
    value: "38% 62% 58% 42% / 52% 40% 60% 48%",
    breathe: "acid-breathe-soft",
  },
  blob: {
    value: "60% 40% 55% 45% / 48% 62% 38% 52%",
    breathe: "acid-breathe-blob",
  },
} as const;

export type BlobRadius = keyof typeof RADIUS_PRESETS;

export type BlobCardProps = {
  /** Which asymmetric "amoeba" radius preset to breathe around. */
  radius?: BlobRadius;
  className?: string;
  innerClassName?: string;
  children: ReactNode;
};

/**
 * Card with an asymmetric amoeba border-radius that slowly breathes, an
 * iridescent gradient border (acid -> white -> cyan -> pink), and a solid inner
 * panel so content stays readable. Reduced-motion holds a static shape.
 */
export function BlobCard({
  radius = "organic",
  className,
  innerClassName,
  children,
}: BlobCardProps) {
  const reduced = usePrefersReducedMotion();
  const preset = RADIUS_PRESETS[radius];

  const breathe = reduced ? undefined : `${preset.breathe} 12s ease-in-out infinite`;

  const outerStyle: CSSProperties = {
    borderRadius: preset.value,
    backgroundImage: "var(--acid-iris-gradient)",
    backgroundSize: "200% 200%",
    animation: reduced
      ? undefined
      : `${preset.breathe} 12s ease-in-out infinite, acid-iris-shift 8s linear infinite`,
  };

  const innerStyle: CSSProperties = {
    borderRadius: preset.value,
    animation: breathe,
  };

  return (
    <div className={cn("acid-animate relative p-[2px]", className)} style={outerStyle}>
      <div
        className={cn(
          "acid-animate relative h-full bg-panel/95 p-5 backdrop-blur-[10px]",
          innerClassName
        )}
        style={innerStyle}
      >
        {children}
      </div>
    </div>
  );
}
