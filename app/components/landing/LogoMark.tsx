import { cn } from "@/lib/utils";

/**
 * Shared acid-orb radial fill (token-driven: acid tinted toward the chrome-white
 * and void-black tokens, no raw hex). Reused by the logo mark and avatars.
 */
export const ORB_GRADIENT =
  "radial-gradient(circle at 34% 30%, color-mix(in srgb, var(--color-acid) 35%, var(--color-chrome-1)), var(--color-acid) 58%, color-mix(in srgb, var(--color-acid) 40%, var(--color-void)))";

export type LogoMarkProps = {
  size?: number;
  className?: string;
};

/**
 * The Arcadia acid orb: a radial acid-green mark with a soft neon halo.
 * Purely presentational; colors come from tokens.
 */
export function LogoMark({ size = 26, className }: LogoMarkProps) {
  return (
    <span
      aria-hidden
      className={cn("inline-block shrink-0 rounded-full", className)}
      style={{
        width: size,
        height: size,
        background: ORB_GRADIENT,
        boxShadow:
          "0 0 14px color-mix(in srgb, var(--color-acid) 70%, transparent), inset 0 0 6px rgba(0,0,0,0.4)",
      }}
    />
  );
}
