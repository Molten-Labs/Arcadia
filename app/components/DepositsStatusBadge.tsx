"use client";

interface DepositsStatusBadgeProps {
  deposits_open: boolean;
  capacityLeft?: number;
}

export function DepositsStatusBadge({
  deposits_open,
  capacityLeft,
}: DepositsStatusBadgeProps) {
  if (deposits_open) {
    return (
      <span
        className="inline-flex items-center rounded text-[10px] font-medium px-1.5 py-0.5 uppercase tracking-wide"
        style={{
          color: "var(--color-green)",
          background: "var(--color-green)1a",
          border: "1px solid var(--color-green)33",
        }}
      >
        ● Deposits open
        {capacityLeft !== undefined && capacityLeft > 0 && (
          <span className="ml-1 opacity-70">
            ${(capacityLeft / 1000).toFixed(0)}k left
          </span>
        )}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded text-[10px] font-medium px-1.5 py-0.5 uppercase tracking-wide"
      style={{
        color: "var(--color-gold)",
        background: "var(--color-gold)1a",
        border: "1px solid var(--color-gold)33",
      }}
    >
      Capacity full
    </span>
  );
}
