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
    <div className="space-y-4">
      {items.map((item) => {
        const pct = Math.min(100, Math.max(0, (item.value / item.max) * 100));
        const display = item.fmt ? item.fmt(item.value) : item.value.toFixed(2);
        
        let color = "var(--color-mint)";
        if (item.invert) {
          color = pct > 60 ? "var(--color-red)" : pct > 30 ? "var(--color-gold)" : "var(--color-green)";
        } else {
          color = pct > 75 ? "var(--color-mint-bright)" : pct > 40 ? "var(--color-mint)" : "var(--color-muted)";
        }
        
        return (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: "var(--color-muted)" }}>
                {item.label}
              </span>
              <span
                className="text-xs tnum font-bold"
                style={{ color, fontFamily: "var(--font-mono)" }}
              >
                {display}
              </span>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden"
              style={{ background: "var(--color-panel-2)", border: "1px solid var(--color-line)" }}
            >
              <div
                className="h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}80` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}