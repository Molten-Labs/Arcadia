import { useRealtimeStatus } from "@/hooks/realtimeContext";
import { cn } from "@/lib/utils";

export function RealtimeStatusPill({ className }: { className?: string }) {
  const { status, lastEventAt } = useRealtimeStatus();
  const label =
    status === "live"
      ? "Live"
      : status === "reconnecting"
        ? "Reconnecting"
        : status === "connecting"
          ? "Connecting"
          : status === "polling"
            ? "Polling"
            : "Demo";
  const tone =
    status === "live"
      ? "bg-primary text-primary-foreground"
      : status === "polling" || status === "reconnecting"
        ? "bg-warning/15 text-warning"
        : "bg-secondary text-muted-foreground";

  return (
    <div
      className={cn(
        "hidden h-9 items-center gap-2 rounded-lg px-2.5 font-mono text-[10px] uppercase tracking-[0.12em] sm:inline-flex",
        tone,
        className,
      )}
      title={lastEventAt ? `Last live update ${new Date(lastEventAt).toLocaleTimeString()}` : "Arcadia realtime status"}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", status === "live" ? "bg-primary-foreground" : "bg-current")} />
      {label}
    </div>
  );
}
