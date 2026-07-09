import { cn } from "@/lib/utils";

/**
 * Shared acid-orb radial fill (token-driven: acid tinted toward the chrome-white
 * and void-black tokens, no raw hex). Used by avatars.
 */
export const ORB_GRADIENT =
  "radial-gradient(circle at 34% 30%, color-mix(in srgb, var(--color-acid) 35%, var(--color-chrome-1)), var(--color-acid) 58%, color-mix(in srgb, var(--color-acid) 40%, var(--color-void)))";

export type LogoMarkProps = {
  size?: number;
  className?: string;
};

/**
 * The Arcadia mark: a flat-top geometric "A" cut into an acid tile, with a
 * soft neon halo. Token-driven; same geometry as app/icon.svg (the favicon)
 * and the OG image - keep the three in sync.
 */
export function LogoMark({ size = 26, className }: LogoMarkProps) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={cn("inline-block shrink-0", className)}
      style={{
        filter: "drop-shadow(0 0 8px color-mix(in srgb, var(--color-acid) 55%, transparent))",
      }}
    >
      <rect width="64" height="64" rx="14" fill="var(--color-acid)" />
      <path
        fill="var(--color-void)"
        d="M26.5 14 H37.5 L55 50 H43.5 L32 27 L20.5 50 H9 Z M21 38 H43 V45.5 H21 Z"
      />
    </svg>
  );
}
