import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

/** Reading-width wrapper matching the comp's max width + fluid padding. */
export function Container({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-[1180px] px-5 sm:px-8", className)}>
      {children}
    </div>
  );
}

/** Mono eyebrow with a leading acid tick. */
export function Kicker({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2.5 font-mono text-xs tracking-[0.28em] text-acid uppercase">
      <span aria-hidden className="h-px w-[22px] bg-acid" />
      {children}
    </span>
  );
}

/** Big Syne section heading with the signature horizontal stretch. */
export function SectionHeading({
  as: Tag = "h2",
  children,
  className,
}: {
  as?: ElementType;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Tag
      className={cn(
        "origin-left font-display text-[clamp(2.1rem,6vw,4.4rem)] leading-[0.98] font-extrabold tracking-[-0.03em] text-ink uppercase",
        className
      )}
      style={{ transform: "scaleX(1.05)" }}
    >
      {children}
    </Tag>
  );
}
