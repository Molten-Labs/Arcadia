"use client";

import { AlertTriangle } from "lucide-react";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "Something went wrong", onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center rounded-xl border border-dashed border-[var(--color-red-dim)] bg-[rgba(239,68,68,0.02)]">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-[var(--color-red-dim)]">
        <AlertTriangle size={20} style={{ color: "var(--color-red)" }} />
      </div>
      <p className="text-sm font-semibold mb-4" style={{ color: "var(--color-red)" }}>
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs px-5 py-2 rounded-lg font-bold transition-all hover:bg-[var(--color-mint-bright)]"
          style={{
            background: "var(--color-mint)",
            color: "#08090c",
          }}
        >
          Retry request
        </button>
      )}
    </div>
  );
}