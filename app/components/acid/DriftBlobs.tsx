"use client";

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

type BlobSpec = {
  size: number;
  alpha: number;
  position: CSSProperties;
};

// A single, static, very low-alpha acid halo for depth. No animation, no
// competing hues — the page background stays calm void with one accent.
const BLOBS: BlobSpec[] = [
  {
    size: 800,
    alpha: 6,
    position: { left: "-14vw", top: "-18vh" },
  },
];

export type DriftBlobsProps = {
  className?: string;
};

/**
 * Fixed background layer of a single blurred acid halo. Static (no drift), GPU
 * composited, invisible to the reader unless it brings depth to the void canvas.
 *
 * Sits at z-0; render it as the first child of a page and wrap the page content
 * in a `relative z-10` container so it reads as a backdrop.
 */
export function DriftBlobs({ className }: DriftBlobsProps) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 z-0 overflow-hidden", className)}
    >
      {BLOBS.map((blob, i) => (
        <span
          key={i}
          className="absolute rounded-full blur-[120px] will-change-transform"
          style={{
            width: blob.size,
            height: blob.size,
            background: `radial-gradient(circle at 45% 45%, color-mix(in srgb, var(--color-acid) ${blob.alpha}%, transparent), transparent 66%)`,
            ...blob.position,
          }}
        />
      ))}
    </div>
  );
}
