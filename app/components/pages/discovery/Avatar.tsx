import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared acid-orb radial fill (token-driven: acid tinted toward the chrome-white
 * and void-black tokens, no raw hex).
 */
const ORB_GRADIENT =
  "radial-gradient(circle at 34% 30%, color-mix(in srgb, var(--color-acid) 35%, var(--color-chrome-1)), var(--color-acid) 58%, color-mix(in srgb, var(--color-acid) 40%, var(--color-void)))";

export function Avatar({
  handle,
  size = 40,
  chars = 2,
  className,
  style,
}: {
  handle: string;
  size?: number;
  chars?: number;
  className?: string;
  style?: CSSProperties;
}) {
  const initials = handle.slice(0, chars).toUpperCase();
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-xl font-display font-extrabold text-void",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: ORB_GRADIENT,
        fontSize: Math.round(size * 0.38),
        boxShadow: "0 0 14px color-mix(in srgb, var(--color-acid) 45%, transparent)",
        ...style,
      }}
    >
      {initials}
    </span>
  );
}
