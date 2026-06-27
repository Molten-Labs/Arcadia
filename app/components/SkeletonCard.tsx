"use client";

import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded", className)}
      style={{ background: "var(--color-panel-2)" }}
    />
  );
}

export function SkeletonStatCard() {
  return (
    <div
      className="rounded-lg p-4"
      style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
    >
      <Skeleton className="h-3 w-20 mb-2" />
      <Skeleton className="h-6 w-24" />
    </div>
  );
}

export function SkeletonTraderCard() {
  return (
    <div
      className="rounded-xl p-5 space-y-4"
      style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
    >
      <div className="flex justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-10 w-14 rounded" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-4 w-28 rounded-full" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Skeleton className="h-2.5 w-12 mb-1.5" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <tr>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="py-3 px-4">
          <Skeleton className="h-3.5 w-full max-w-[80px]" />
        </td>
      ))}
    </tr>
  );
}
