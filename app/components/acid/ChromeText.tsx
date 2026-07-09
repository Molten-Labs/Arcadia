import type { ElementType, ReactNode } from "react";

import { cn } from "@/lib/utils";

export type ChromeTextProps = {
  /** Element/tag to render (defaults to `span`). */
  as?: ElementType;
  className?: string;
  /**
   * Adds RGB-split chromatic-aberration ghosts behind the text. Only applies
   * when `children` is a plain string (the ghosts are drawn from `data-text`).
   * Automatically disabled under prefers-reduced-motion.
   */
  aberration?: boolean;
  children: ReactNode;
};

/**
 * Liquid-chrome gradient text. Purely presentational (server component).
 *
 * @example
 * <ChromeText as="h1" aberration className="text-8xl">PROVE</ChromeText>
 */
export function ChromeText({
  as: Tag = "span",
  className,
  aberration = false,
  children,
}: ChromeTextProps) {
  const ghostText = aberration && typeof children === "string" ? children : undefined;

  return (
    <Tag
      data-text={ghostText}
      className={cn("acid-chrome", ghostText && "acid-aberration", className)}
    >
      {children}
    </Tag>
  );
}
