import { Fragment } from "react";
import {
  CheckCircle2,
  Clock3,
  EyeOff,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePrivateIntentVault } from "@/hooks/usePrivateIntents";
import type { PrivateIntentProofStep, PrivateIntentStageStatus, RedactedPrivateIntentActivity } from "@/lib/privateIntents";
import { cn } from "@/lib/utils";

interface PrivateIntentVaultGuardProps {
  vaultConfigPubkey: string;
  mode: "manager" | "investor";
  className?: string;
  action?: {
    label: string;
    helper: string;
    onClick: () => void;
    disabled?: boolean;
    loading?: boolean;
  };
}

export function PrivateIntentVaultGuard({ vaultConfigPubkey, mode, className, action }: PrivateIntentVaultGuardProps) {
  const { data, isFetching, error, refetch } = usePrivateIntentVault(vaultConfigPubkey);
  const snapshot = data;
  const guard = snapshot?.guard;
  const timeline = snapshot?.timeline ?? [];
  const activity = snapshot?.activity ?? [];
  const visibleActivity = activity.slice(0, 4);
  const hasBackend = guard?.status && guard.status !== "unknown";

  return (
    <section className={cn("surface-elevated rounded-[11px] p-5 relative overflow-hidden", className)}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
            <LockKeyhole className="h-3 w-3" /> MagicBlock ER
          </div>
          <h3 className="font-display text-[18px] font-semibold">Private Intent Vault Guard</h3>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {mode === "manager"
              ? "Seal intent details before execution while the vault guard proves every risk rule was checked."
              : "Investors see guard proofs and redacted activity without exposing the manager's live route, size, or timing."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex h-9 items-center gap-1.5 rounded-md px-2.5 font-mono text-[10px] uppercase tracking-[0.12em]", guardTone(guard?.status))}>
            <ShieldCheck className="h-3.5 w-3.5" />
            {guard?.status === "unknown" ? "Awaiting backend" : guard?.label ?? "Guard"}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => refetch()}
            aria-label="Refresh private intent state"
            disabled={isFetching}
          >
            {isFetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <GuardMetric label="Reserve floor" value={`${((guard?.reserveFloorBps ?? 2_000) / 100).toFixed(0)}%`} />
        <GuardMetric label="Pending intents" value={String(guard?.pendingCount ?? 0)} />
        <GuardMetric label="Approved proofs" value={String(guard?.approvedCount ?? 0)} />
        <GuardMetric label="Rejected" value={String(guard?.rejectedCount ?? 0)} tone={(guard?.rejectedCount ?? 0) > 0 ? "danger" : "neutral"} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
        <div className="rounded-lg border border-border/55 bg-background/35 p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h4 className="font-display text-[14px] font-semibold">Proof timeline</h4>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Intent to redacted settlement
              </p>
            </div>
            {guard?.latencyMs ? (
              <span className="rounded-md bg-secondary px-2 py-1 font-mono text-[10px] text-muted-foreground">
                {guard.latencyMs}ms proof
              </span>
            ) : null}
          </div>
          <div className="space-y-0">
            {timeline.map((step, index) => (
              <Fragment key={step.id}>
                <TimelineStep step={step} />
                {index < timeline.length - 1 ? <div className="ml-[13px] h-4 w-px bg-border/70" /> : null}
              </Fragment>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-border/55 bg-background/35 p-4">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h4 className="font-display text-[14px] font-semibold">Redacted activity</h4>
              <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                Public proof, private route
              </p>
            </div>
            <span className="rounded-md bg-secondary px-2 py-1 font-mono text-[10px] text-muted-foreground">
              {activity.length} intents
            </span>
          </div>

          {error ? (
            <StateBox title="Private intent API error" copy={error instanceof Error ? error.message : "Unable to load proof state."} />
          ) : visibleActivity.length === 0 ? (
            <StateBox
              title={hasBackend ? "No private intents yet" : "Waiting for endpoints"}
              copy={hasBackend
                ? "Sealed intents will appear here with route, size, and timing redacted."
                : "The UI is wired to private-intent endpoints and realtime events; this vault has no backend state yet."}
            />
          ) : (
            <div className="space-y-2">
              {visibleActivity.map((item) => <ActivityRow key={item.id} item={item} />)}
            </div>
          )}

          {action ? (
            <div className="mt-4 rounded-lg border border-primary/20 bg-primary/10 p-3">
              <Button
                type="button"
                className="h-11 w-full bg-gradient-signal text-primary-foreground border-0"
                onClick={action.onClick}
                disabled={action.disabled || action.loading}
              >
                {action.loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LockKeyhole className="mr-2 h-4 w-4" />}
                {action.label}
              </Button>
              <p className="mt-2 text-center text-[12px] leading-relaxed text-muted-foreground">{action.helper}</p>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function GuardMetric({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "neutral" | "danger" }) {
  return (
    <div className="rounded-lg bg-secondary/35 p-3">
      <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 font-display text-[18px] font-semibold tabular-nums", tone === "danger" && "text-destructive")}>{value}</div>
    </div>
  );
}

function TimelineStep({ step }: { step: PrivateIntentProofStep }) {
  return (
    <div className="flex gap-3">
      <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border", stepClass(step.status, true))}>
        {stepIcon(step.status)}
      </span>
      <div className="min-w-0 pb-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="font-medium text-[13px]">{step.label}</div>
          <span className={cn("rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]", stepClass(step.status))}>
            {step.status}
          </span>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{step.detail}</p>
        {step.proofHash ? (
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">proof {shortHash(step.proofHash)}</div>
        ) : null}
      </div>
    </div>
  );
}

function ActivityRow({ item }: { item: RedactedPrivateIntentActivity }) {
  return (
    <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <EyeOff className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium text-[13px]">Intent {item.status}</span>
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{item.detail}</p>
        </div>
        <div className="shrink-0 text-right font-mono text-[10px] text-muted-foreground">{timeLabel(item.occurredAt)}</div>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-[10px]">
        <RedactedPill label="Route" value={item.routeCommitment ? shortHash(item.routeCommitment) : "redacted"} />
        <RedactedPill label="Size" value={item.amountBucket ?? "redacted"} />
        <RedactedPill label="Guard" value={item.guardResult ?? "pending"} />
      </div>
    </div>
  );
}

function RedactedPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-background/45 p-2">
      <div className="text-[8px] uppercase tracking-[0.12em] text-muted-foreground">{label}</div>
      <div className="mt-1 truncate text-foreground/80">{value}</div>
    </div>
  );
}

function StateBox({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-lg border border-dashed border-border/60 p-4">
      <div className="font-medium text-[13px]">{title}</div>
      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{copy}</p>
    </div>
  );
}

function guardTone(status = "unknown") {
  if (status === "online") return "bg-primary/12 text-primary";
  if (status === "degraded") return "bg-warning/15 text-warning";
  if (status === "offline") return "bg-destructive/15 text-destructive";
  return "bg-secondary text-muted-foreground";
}

function stepClass(status: PrivateIntentStageStatus, icon = false) {
  if (status === "complete") return icon ? "border-primary/40 bg-primary/15 text-primary" : "bg-primary/12 text-primary";
  if (status === "active") return icon ? "border-warning/40 bg-warning/15 text-warning" : "bg-warning/15 text-warning";
  if (status === "failed") return icon ? "border-destructive/40 bg-destructive/15 text-destructive" : "bg-destructive/15 text-destructive";
  return icon ? "border-border bg-secondary text-muted-foreground" : "bg-secondary text-muted-foreground";
}

function stepIcon(status: PrivateIntentStageStatus) {
  if (status === "complete") return <CheckCircle2 className="h-4 w-4" />;
  if (status === "active") return <Clock3 className="h-4 w-4" />;
  if (status === "failed") return <XCircle className="h-4 w-4" />;
  return <LockKeyhole className="h-3.5 w-3.5" />;
}

function shortHash(value: string) {
  if (value.length <= 14) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function timeLabel(timestamp: number) {
  if (!timestamp) return "now";
  return new Date(timestamp * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
