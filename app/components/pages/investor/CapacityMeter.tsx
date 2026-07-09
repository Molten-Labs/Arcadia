import type { CSSProperties } from "react";

/**
 * Vault capacity meter: how much of a trader's reputation-based capacity is
 * filled. Fills acid -> cyan; turns danger when effectively full. Numbers stay
 * in tabular mono.
 */
export function CapacityMeter({
  aum,
  capacity_usd,
  className,
}: {
  aum: number;
  capacity_usd: number;
  className?: string;
}) {
  const pct = capacity_usd > 0 ? Math.min(100, (aum / capacity_usd) * 100) : 0;
  const left = Math.max(0, capacity_usd - aum);
  const isFull = pct >= 95;

  const fillStyle: CSSProperties = {
    width: `${pct}%`,
    background: isFull
      ? "var(--color-danger)"
      : "linear-gradient(90deg, var(--color-acid), var(--color-cyan))",
    boxShadow: isFull ? "none" : "0 0 12px color-mix(in srgb, var(--color-acid) 45%, transparent)",
  };

  return (
    <div className={className}>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-[cubic-bezier(0.22,1,0.36,1)]"
          style={fillStyle}
        />
      </div>
      <p className="mt-1.5 font-mono text-[0.6rem] tracking-[0.16em] tabular-nums uppercase">
        <span className={isFull ? "text-danger" : "text-muted"}>
          ${(left / 1000).toFixed(0)}k left
        </span>
        <span className="text-faint"> / ${(capacity_usd / 1000).toFixed(0)}k max</span>
      </p>
    </div>
  );
}
