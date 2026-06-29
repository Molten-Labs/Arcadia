"use client";

interface CapacityBarProps {
  aum: number;
  capacity_usd: number;
}

export function CapacityBar({ aum, capacity_usd }: CapacityBarProps) {
  const pct = capacity_usd > 0 ? Math.min(100, (aum / capacity_usd) * 100) : 0;
  const left = Math.max(0, capacity_usd - aum);
  const isFull = pct >= 95;
  
  return (
    <div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ background: "var(--color-line)" }}
      >
        <div
          className="h-full rounded-full transition-all duration-500 ease-out relative"
          style={{
            width: `${pct}%`,
            background: isFull ? "var(--color-red)" : "linear-gradient(90deg, var(--color-mint-mid), var(--color-mint-bright))",
          }}
        >
          {!isFull && (
            <div className="absolute top-0 right-0 bottom-0 w-4 bg-white opacity-30" style={{ filter: "blur(2px)" }} />
          )}
        </div>
      </div>
      <p className="text-[9px] mt-1.5 tnum font-mono uppercase tracking-widest" style={{ color: "var(--color-faint)" }}>
        <span style={{ color: isFull ? "var(--color-red)" : "var(--color-muted)" }}>${(left / 1000).toFixed(0)}k left</span> / ${(capacity_usd / 1000).toFixed(0)}k max
      </p>
    </div>
  );
}