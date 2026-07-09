import { cn } from "@/lib/utils";
import { formatK } from "./bits";

/** Capacity / allocation bar: acid -> cyan fill, danger when near full. */
export function AllocationBar({
  aum,
  total,
  className,
}: {
  aum: number;
  total: number;
  className?: string;
}) {
  const pct = total > 0 ? Math.min(100, (aum / total) * 100) : 0;
  const left = Math.max(0, total - aum);
  const full = pct >= 95;

  return (
    <div className={className}>
      <div className="h-1.5 overflow-hidden rounded-full bg-line">
        <div
          className="acid-bar h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
          style={{
            width: `${pct}%`,
            background: full
              ? "var(--color-danger)"
              : "linear-gradient(90deg, var(--color-acid), var(--color-cyan))",
          }}
        />
      </div>
      <p className="mt-1.5 font-mono text-[10px] tracking-[0.14em] text-faint uppercase tabular-nums">
        <span className={cn(full ? "text-danger" : "text-muted")}>{formatK(left)} left</span> /{" "}
        {formatK(total)} max
      </p>
    </div>
  );
}
