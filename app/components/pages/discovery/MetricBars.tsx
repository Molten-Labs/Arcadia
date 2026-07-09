export interface MetricItem {
  label: string;
  value: number;
  max: number;
  fmt?: (v: number) => string;
  invert?: boolean;
}

/** Risk-metric bars in the acid palette (acid/cyan for good, danger/amber inverted). */
export function MetricBars({ items }: { items: MetricItem[] }) {
  return (
    <div className="space-y-4">
      {items.map((item) => {
        const pct = Math.min(100, Math.max(0, (item.value / item.max) * 100));
        const display = item.fmt ? item.fmt(item.value) : item.value.toFixed(2);
        const color = item.invert
          ? pct > 60
            ? "var(--color-danger)"
            : pct > 30
              ? "var(--color-tier-advanced)"
              : "var(--color-success)"
          : pct > 60
            ? "var(--color-acid)"
            : "var(--color-cyan)";

        return (
          <div key={item.label}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-[0.14em] text-muted uppercase">
                {item.label}
              </span>
              <span className="font-mono text-xs font-bold tabular-nums" style={{ color }}>
                {display}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
              <div
                className="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
