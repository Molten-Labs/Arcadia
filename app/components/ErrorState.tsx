"use client";

import { AlertTriangle } from "lucide-react";

import { AcidButton } from "@/components/acid";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "Something went wrong", onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-danger/30 bg-danger/[0.03] px-6 py-20 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full border border-danger/25 bg-danger/10">
        <AlertTriangle className="size-5 text-danger" />
      </div>
      <p className="mb-1.5 font-mono text-[0.5625rem] tracking-[0.22em] text-faint uppercase">
        Request failed
      </p>
      <p className="mb-5 max-w-[34ch] text-sm font-semibold text-danger">{message}</p>
      {onRetry && (
        <AcidButton variant="ghost" size="sm" onClick={onRetry}>
          Retry request
        </AcidButton>
      )}
    </div>
  );
}
