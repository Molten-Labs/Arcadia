"use client";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = "Something went wrong", onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <p className="text-sm mb-3" style={{ color: "var(--color-red)" }}>
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs px-3 py-1.5 rounded"
          style={{
            border: "1px solid var(--color-line)",
            color: "var(--color-muted)",
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
}
