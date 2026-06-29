"use client";

import { cn } from "@/lib/utils";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded", className)}
      style={{ background: "var(--color-panel-2)", boxShadow: "inset 0 0 0 1px var(--color-line)" }}
    />
  );
}

export function SkeletonStatCard() {
  return (
    <div
      className="rounded-xl p-5"
      style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
    >
      <Skeleton className="h-3 w-20 mb-3" />
      <Skeleton className="h-7 w-28" />
    </div>
  );
}

export function SkeletonTraderCard() {
  return (
    <div
      className="rounded-xl p-5 space-y-5"
      style={{ background: "var(--color-panel)", border: "1px solid var(--color-line)" }}
    >
      <div className="flex justify-between items-start">
        <div className="flex gap-3 items-center">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-8 w-16 rounded-lg" />
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-5 w-24 rounded-full" />
        <Skeleton className="h-5 w-16 rounded-full" />
      </div>
      <div className="grid grid-cols-3 gap-3 pt-2">
        {[0, 1, 2].map((i) => (
          <div key={i}>
            <Skeleton className="h-2.5 w-14 mb-2" />
            <Skeleton className="h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="space-y-2 pt-2">
        <div className="flex justify-between">
          <Skeleton className="h-3 w-10" />
          <Skeleton className="h-3 w-16" />
        </div>
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonRow() {
  return (
    <tr>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <td key={i} className="py-3 px-4">
          <Skeleton className="h-4 w-full max-w-[80px]" />
        </td>
      ))}
    </tr>
  );
}