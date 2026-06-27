"use client";

interface RiskBarItem {
  label: string;
  value: number;
  max: number;
  fmt?: (v: number) => string;
  invert?: boolean;
}

interface RiskBarsProps {
  items: RiskBarItem[];
}

export function RiskBars({ items }: RiskBarsProps) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const pct = Math.min(100, Math.max(0, (item.value / item.max) * 100));
        const display = item.fmt ? item.fmt(item.value) : item.value.toFixed(2);
        const color = item.invert
          ? pct > 60 ? "var(--color-red)" : "var(--color-green)"
          : "var(--color-accent)";
        return (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs" style={{ color: "var(--color-muted)" }}>
                {item.label}
              </span>
              <span
                className="text-xs tnum font-bold"
                style={{ color, fontFamily: "var(--font-body)" }}
              >
                {display}
              </span>
            </div>
            <div
              className="h-1 rounded-full overflow-hidden"
              style={{ background: "var(--color-line)" }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
