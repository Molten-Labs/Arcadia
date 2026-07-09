import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDownRight, ArrowUpRight, Ghost } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Bordered void/panel surface — the readable-core container. */
export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-line bg-panel", className)}>{children}</div>;
}

/** Faint mono label used inside panels and stat blocks. */
export function PanelLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("font-mono text-[0.62rem] tracking-[0.2em] text-faint uppercase", className)}>
      {children}
    </p>
  );
}

/**
 * KPI tile. `value` is a `ReactNode` so callers can pass a pre-formatted string
 * or a `<CountUp />` for the big animated figures. Financial data stays in
 * tabular mono; only `accent` tints the number acid.
 */
export function StatTile({
  label,
  value,
  delta,
  deltaPositive,
  accent = false,
  className,
}: {
  label: string;
  value: ReactNode;
  delta?: string;
  deltaPositive?: boolean;
  accent?: boolean;
  className?: string;
}) {
  return (
    <Panel className={cn("group acid-int p-5", className)}>
      <PanelLabel className="mb-2 transition-colors duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:text-muted motion-reduce:transition-none">
        {label}
      </PanelLabel>
      <p
        className={cn(
          "font-mono text-2xl font-bold tracking-tight tabular-nums",
          accent ? "text-acid" : "text-ink",
        )}
      >
        {value}
      </p>
      {delta ? (
        <p
          className={cn(
            "mt-2 flex items-center gap-1 text-xs font-semibold tabular-nums",
            deltaPositive === true
              ? "text-success"
              : deltaPositive === false
                ? "text-danger"
                : "text-muted",
          )}
        >
          {deltaPositive === true ? <ArrowUpRight className="size-3" aria-hidden /> : null}
          {deltaPositive === false ? <ArrowDownRight className="size-3" aria-hidden /> : null}
          {delta}
        </p>
      ) : null}
    </Panel>
  );
}

/** Acid empty state; drop-in for the legacy `EmptyState` (same props). */
export function InvestorEmptyState({
  title,
  description,
  cta,
}: {
  title: string;
  description?: string;
  cta?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line bg-panel/60 py-20 text-center">
      <div className="mb-5 flex size-14 items-center justify-center rounded-full border border-acid/20 bg-acid/[0.06]">
        <Ghost className="size-6 text-acid" aria-hidden />
      </div>
      <p className="font-display text-lg font-bold tracking-tight text-ink uppercase">{title}</p>
      {description ? (
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{description}</p>
      ) : null}
      {cta ? (
        <Button asChild className="mt-6">
          <Link href={cta.href}>{cta.label}</Link>
        </Button>
      ) : null}
    </div>
  );
}
