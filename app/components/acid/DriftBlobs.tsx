"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "./use-prefers-reduced-motion";

type BlobSpec = {
  size: string;
  color: string;
  alpha: number;
  animation: string;
  position: CSSProperties;
};

// Colors pulled from tokens via color-mix (no scattered hex in components).
const BLOBS: BlobSpec[] = [
  {
    size: "52vw",
    color: "var(--color-acid)",
    alpha: 55,
    animation: "acid-drift-1 22s ease-in-out infinite",
    position: { left: "-10vw", top: "-8vw" },
  },
  {
    size: "46vw",
    color: "var(--color-pink)",
    alpha: 42,
    animation: "acid-drift-2 26s ease-in-out infinite",
    position: { right: "-12vw", top: "14vh" },
  },
  {
    size: "60vw",
    color: "var(--color-tier-established)",
    alpha: 48,
    animation: "acid-drift-3 30s ease-in-out infinite",
    position: { left: "18vw", bottom: "-26vw" },
  },
  {
    size: "30vw",
    color: "var(--color-cyan)",
    alpha: 32,
    animation: "acid-drift-2 24s ease-in-out infinite reverse",
    position: { right: "6vw", bottom: "8vh" },
  },
];

export type DriftBlobsProps = {
  className?: string;
};

/**
 * Fixed background layer of large blurred color blobs that drift slowly (GPU
 * transforms). Reduced-motion keeps them static.
 *
 * Sits at z-0; render it as the first child of a page and wrap the page content
 * in a `relative z-10` container so it reads as a backdrop.
 */
export function DriftBlobs({ className }: DriftBlobsProps) {
  const reduced = usePrefersReducedMotion();

  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 z-0 overflow-hidden", className)}
    >
      {BLOBS.map((blob, i) => (
        <span
          key={i}
          className="acid-animate absolute rounded-full opacity-55 blur-[70px] will-change-transform"
          style={{
            width: blob.size,
            height: blob.size,
            background: `radial-gradient(circle at 45% 45%, color-mix(in srgb, ${blob.color} ${blob.alpha}%, transparent), transparent 66%)`,
            animation: reduced ? undefined : blob.animation,
            ...blob.position,
          }}
        />
      ))}
    </div>
  );
}
