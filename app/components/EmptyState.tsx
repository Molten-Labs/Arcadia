"use client";

import Link from "next/link";
import { Ghost } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description?: string;
  cta?: { label: string; href: string };
}

export function EmptyState({ title, description, cta }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center rounded-xl border border-dashed border-[var(--color-line)] bg-[var(--color-panel)]">
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center mb-5"
        style={{ background: "var(--color-mint-dim)", border: "1px solid rgba(79,158,255,0.2)" }}
      >
        <Ghost size={24} style={{ color: "var(--color-mint)" }} />
      </div>
      <p className="text-base font-bold mb-2 tracking-tight" style={{ color: "var(--color-ink)" }}>
        {title}
      </p>
      {description && (
        <p className="text-sm mb-6 max-w-sm leading-relaxed" style={{ color: "var(--color-muted)" }}>
          {description}
        </p>
      )}
      {cta && (
        <Link
          href={cta.href}
          className="text-sm px-6 py-2.5 rounded-lg font-bold transition-all hover:bg-[var(--color-mint-bright)]"
          style={{ background: "var(--color-mint)", color: "#08090c" }}
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}