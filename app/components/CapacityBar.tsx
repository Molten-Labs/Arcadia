"use client";

interface CapacityBarProps {
  aum: number;
  capacity_usd: number;
}

export function CapacityBar({ aum, capacity_usd }: CapacityBarProps) {
  const pct = capacity_usd > 0 ? Math.min(100, (aum / capacity_usd) * 100) : 0;
  const left = Math.max(0, capacity_usd - aum);
  const barColor =
    pct >= 95
      ? "var(--color-red)"
      : "var(--color-accent)";
  return (
    <div>
      <div
        className="h-1 rounded-full overflow-hidden"
        style={{ background: "var(--color-line)" }}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: barColor,
          }}
        />
      </div>
      <p className="text-[10px] mt-0.5 tnum font-mono" style={{ color: "var(--color-faint)" }}>
        ${(left / 1000).toFixed(0)}k left / ${(capacity_usd / 1000).toFixed(0)}k
      </p>
    </div>
  );
}
