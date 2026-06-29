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
        className="inline-flex items-center rounded-full text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider"
        style={{
          color: "var(--color-mint)",
          background: "var(--color-mint-dim)",
          border: "1px solid var(--color-mint)33",
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-mint)] mr-1.5 animate-pulse" />
        Open
        {capacityLeft !== undefined && capacityLeft > 0 && (
          <span className="ml-1 opacity-70 font-mono">
            ${(capacityLeft / 1000).toFixed(0)}k left
          </span>
        )}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded-full text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider"
      style={{
        color: "var(--color-red)",
        background: "var(--color-red-dim)",
        border: "1px solid var(--color-red)33",
      }}
    >
      Closed
    </span>
  );
}