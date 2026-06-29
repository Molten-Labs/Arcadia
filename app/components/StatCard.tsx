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
    <div className={cn("rounded-xl p-5 card relative overflow-hidden group", className)}>
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-panel-2)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="relative z-10">
        <p
          className="text-[10px] font-bold uppercase tracking-widest mb-2"
          style={{ color: "var(--color-faint)" }}
        >
          {label}
        </p>
        <p
          className="text-2xl font-black tnum tracking-tight"
          style={{ color: "var(--color-ink)", fontFamily: "var(--font-sans)" }}
        >
          {value}
        </p>
        {delta && (
          <p
            className="text-xs mt-2 tnum font-semibold flex items-center gap-1"
            style={{
              color: deltaPositive
                ? "var(--color-mint)"
                : deltaPositive === false
                ? "var(--color-red)"
                : "var(--color-muted)",
            }}
          >
            {deltaPositive && <span className="text-[10px]">↗</span>}
            {deltaPositive === false && <span className="text-[10px]">↘</span>}
            {delta}
          </p>
        )}
      </div>
    </div>
  );
}