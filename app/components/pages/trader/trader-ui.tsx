import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared acid-graphic primitives for the trader-side app pages (analytics,
 * reputation, payouts, manage). Aggressive skin, readable core: quiet
 * void/panel surfaces, Space Mono micro-labels, acid only in accents. All
 * presentational (no hooks) so they compose from server or client pages.
 */

/** Mono uppercase micro-label — the system's data caption. */
export function MicroLabel({ className, ...props }: ComponentProps<"p">) {
  return (
    <p
      className={cn(
        "font-mono text-[0.62rem] tracking-[0.18em] text-faint uppercase",
        className,
      )}
      {...props}
    />
  );
}

/** Quiet panel surface for dense, readable content. */
export function Panel({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("rounded-2xl border border-white/10 bg-panel", className)}
      {...props}
    />
  );
}

/** Signature acid live dot (pulses; held static under reduced motion). */
export function LiveDot({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "acid-animate inline-block size-1.5 shrink-0 rounded-full bg-acid shadow-[0_0_8px_var(--color-acid)]",
        className,
      )}
      style={{ animation: "acid-pulse 2s infinite" }}
    />
  );
}

/** Mono status chip (e.g. "Solana devnet", "@nova - simulation"). */
export function EnvChip({
  children,
  live = false,
  className,
}: {
  children: ReactNode;
  live?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/10 bg-panel px-3 py-1.5 font-mono text-[0.62rem] tracking-[0.14em] text-faint uppercase",
        className,
      )}
    >
      {live && <LiveDot />}
      {children}
    </span>
  );
}

/** Page header: display title (Syne) + optional icon + right-slot children. */
export function PageHeader({
  title,
  icon,
  children,
  className,
}: {
  title: string;
  icon?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("mb-6 flex flex-wrap items-center justify-between gap-3", className)}
    >
      <div className="flex items-center gap-2.5">
        {icon && <span className="text-acid">{icon}</span>}
        <h1
          className="origin-left font-display text-2xl leading-none font-extrabold tracking-tight text-ink uppercase"
          style={{ transform: "scaleX(1.04)" }}
        >
          {title}
        </h1>
      </div>
      {children}
    </div>
  );
}

type DeltaTone = "up" | "down" | "flat";

const DELTA_TONE: Record<DeltaTone, string> = {
  up: "text-success",
  down: "text-danger",
  flat: "text-muted",
};

/** Stat tile — mono micro-label, big tabular value, optional delta. */
export function StatTile({
  label,
  value,
  sub,
  delta,
  tone = "flat",
  accent = false,
  className,
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  delta?: string;
  tone?: DeltaTone;
  accent?: boolean;
  className?: string;
}) {
  return (
    <Panel className={cn("group acid-int p-4", className)}>
      <MicroLabel className="mb-2 transition-colors duration-300 ease-[cubic-bezier(0.19,1,0.22,1)] group-hover:text-muted motion-reduce:transition-none">
        {label}
      </MicroLabel>
      <p
        className={cn(
          "font-mono text-2xl font-bold tracking-tight tabular-nums",
          accent ? "text-acid" : "text-ink",
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-1 text-[0.7rem] text-faint">{sub}</p>}
      {delta && (
        <p
          className={cn(
            "mt-2 font-mono text-xs font-semibold tabular-nums",
            DELTA_TONE[tone],
          )}
        >
          {tone === "up" ? "▲ " : tone === "down" ? "▼ " : ""}
          {delta}
        </p>
      )}
    </Panel>
  );
}

/**
 * Classification badges shown on trader profile / vault / reputation pages.
 * Maps the Rust classify engine output to Badge variants.
 */
import { Badge } from "@/components/ui/badge";
import type { TraderClassification } from "@/lib/types";

const BOT_BADGE: Record<string, "success" | "danger" | "secondary"> = {
  human: "success",
  bot: "danger",
  uncertain: "secondary",
};

const SIZE_BADGE: Record<string, "secondary" | "default" | "verified" | "advanced" | "elite"> = {
  shrimp: "secondary",
  fish: "default",
  dolphin: "verified",
  shark: "advanced",
  whale: "elite",
};

const PROFILE_TONE: Record<string, "default" | "danger" | "success" | "secondary"> = {
  "HFT / market-maker bot": "danger",
  "Wash trader / points farmer": "danger",
  Scalper: "default",
  "Position / swing holder": "success",
  "Active trader": "success",
  Dormant: "secondary",
  "One-shot punter": "secondary",
  "No activity": "secondary",
};

export function ClassificationBadgeSet({ data, className }: { data: TraderClassification; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      <Badge variant={BOT_BADGE[data.bot.verdict] ?? "secondary"}>
        {data.bot.verdict === "human" ? "human" : data.bot.verdict === "bot" ? "bot" : "uncertain"}
      </Badge>
      <Badge variant={SIZE_BADGE[data.size_tier.tier] ?? "secondary"}>
        {data.size_tier.tier}
      </Badge>
      <Badge variant={PROFILE_TONE[data.profile.label] ?? "default"}>
        {data.profile.label}
      </Badge>
      {data.wash.fired > 0 && (
        <Badge variant="danger">
          wash-flagged
        </Badge>
      )}
    </div>
  );
}

export type MetricTone = "acid" | "success" | "danger" | "muted";

const METRIC_FILL: Record<MetricTone, string> = {
  acid: "bg-gradient-to-r from-acid to-cyan",
  success: "bg-success",
  danger: "bg-danger",
  muted: "bg-muted",
};

const METRIC_TEXT: Record<MetricTone, string> = {
  acid: "text-acid",
  success: "text-success",
  danger: "text-danger",
  muted: "text-muted",
};

export type MetricBarItem = {
  label: string;
  value: number;
  max: number;
  display?: string;
  tone?: MetricTone;
};

/** Acid replacement for the legacy RiskBars — quiet gauges, acid accent. */
export function MetricBars({ items }: { items: MetricBarItem[] }) {
  return (
    <div className="space-y-4">
      {items.map((item) => {
        const pct = Math.min(100, Math.max(0, (item.value / item.max) * 100));
        const tone = item.tone ?? "acid";
        return (
          <div key={item.label}>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-mono text-[0.7rem] tracking-wide text-muted uppercase">
                {item.label}
              </span>
              <span
                className={cn("font-mono text-xs font-bold tabular-nums", METRIC_TEXT[tone])}
              >
                {item.display ?? item.value.toFixed(2)}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-panel-2">
              <div
                className={cn("acid-bar h-full rounded-full", METRIC_FILL[tone])}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Labeled key/value row used inside detail panels. */
export function DataRow({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-white/[0.06] py-1.5 last:border-0",
        className,
      )}
    >
      <span className="text-xs text-faint">{label}</span>
      <span className="font-mono text-xs font-medium tabular-nums text-ink">{children}</span>
    </div>
  );
}
