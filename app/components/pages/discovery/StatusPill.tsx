import { formatK } from "./bits";

/** Deposits open/closed pill in the acid palette. */
export function StatusPill({
  deposits_open,
  capacityLeft,
}: {
  deposits_open: boolean;
  capacityLeft?: number;
}) {
  if (deposits_open) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.12em] text-success uppercase">
        <span
          aria-hidden
          className="acid-animate size-1.5 rounded-full bg-success"
          style={{ animation: "acid-pulse 2s infinite" }}
        />
        Open
        {capacityLeft !== undefined && capacityLeft > 0 ? (
          <span className="text-muted">{formatK(capacityLeft)} left</span>
        ) : null}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full border border-danger/30 bg-danger/10 px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-[0.12em] text-danger uppercase">
      Closed
    </span>
  );
}
