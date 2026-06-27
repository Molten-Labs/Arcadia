"use client";

import Link from "next/link";

interface EmptyStateProps {
  title: string;
  description?: string;
  cta?: { label: string; href: string };
}

export function EmptyState({ title, description, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center mb-4"
        style={{ background: "var(--color-panel-2)" }}
      >
        <span style={{ color: "var(--color-faint)" }}>–</span>
      </div>
      <p className="text-sm font-medium mb-1" style={{ color: "var(--color-muted)" }}>
        {title}
      </p>
      {description && (
        <p className="text-xs mb-4" style={{ color: "var(--color-faint)" }}>
          {description}
        </p>
      )}
      {cta && (
        <Link
          href={cta.href}
          className="text-xs px-4 py-2 rounded font-medium"
          style={{ background: "var(--color-accent)", color: "var(--color-ink)" }}
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
