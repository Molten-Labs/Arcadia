"use client";

import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaPositive?: boolean;
  className?: string;
}

export function StatCard({ label, value, delta, deltaPositive, className }: StatCardProps) {
  return (
    <div className={cn("rounded-lg p-4 card", className)}>
      <p
        className="text-[10px] font-semibold uppercase tracking-widest mb-1.5"
        style={{ color: "var(--color-faint)" }}
      >
        {label}
      </p>
      <p
        className="text-xl font-black tnum"
        style={{ color: "var(--color-ink)", fontFamily: "var(--font-sans)" }}
      >
        {value}
      </p>
      {delta && (
        <p
          className="text-xs mt-1 tnum font-semibold"
          style={{
            color: deltaPositive
              ? "var(--color-green)"
              : deltaPositive === false
              ? "var(--color-red)"
              : "var(--color-muted)",
          }}
        >
          {delta}
        </p>
      )}
    </div>
  );
}
