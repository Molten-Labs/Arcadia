import { cn } from "@/lib/utils";

export type NoiseOverlayProps = {
  /** Grain opacity (0..1). Defaults to 0.07. */
  opacity?: number;
  className?: string;
};

/**
 * Full-screen film-grain overlay (SVG feTurbulence). Static, non-interactive,
 * hidden from assistive tech. Drop once near the root of a page.
 */
export function NoiseOverlay({ opacity = 0.07, className }: NoiseOverlayProps) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 z-[60] mix-blend-overlay", className)}
      style={{ opacity }}
    >
      <svg className="h-full w-full" xmlns="http://www.w3.org/2000/svg">
        <filter id="acid-noise-overlay">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="3"
            stitchTiles="stitch"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#acid-noise-overlay)" />
      </svg>
    </div>
  );
}
