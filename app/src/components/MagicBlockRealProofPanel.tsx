import { CheckCircle2, ExternalLink, EyeOff, Loader2, LockKeyhole, RotateCcw, ShieldCheck, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useMagicBlockPrivateIntentProof } from "@/hooks/useMagicBlockPrivateIntentProof";
import { MAGICBLOCK_DELEGATION_PROGRAM_ID, PROGRAM_ID } from "@/lib/solana/constants";
import { cn } from "@/lib/utils";

interface MagicBlockRealProofPanelProps {
  vaultConfigPubkey: string;
  amountUsdcUnits: bigint;
  maxSlippageBps: number;
  disabled?: boolean;
}

export function MagicBlockRealProofPanel({
  vaultConfigPubkey,
  amountUsdcUnits,
  maxSlippageBps,
  disabled,
}: MagicBlockRealProofPanelProps) {
  const proof = useMagicBlockPrivateIntentProof();
  const missingEnv = proof.envStatus.missing;
  const canRun = proof.envStatus.ready && !disabled && !proof.running && amountUsdcUnits > 0n;

  return (
    <section className="rounded-[11px] border border-primary/25 bg-primary/8 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-background/60 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
            <LockKeyhole className="h-3 w-3" /> Real MagicBlock PER Proof
          </div>
          <h4 className="mt-2 font-display text-[15px] font-semibold">Private trader alpha, public investor safety</h4>
          <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-muted-foreground">
            This verifies the TEE endpoint, gets a short-lived wallet-signed auth token, initializes a session, delegates only session state, executes redacted guard logic on MagicBlock, commits proof, then reclaims.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={proof.reset}
            disabled={proof.running}
          >
            <RotateCcw className="mr-2 h-3.5 w-3.5" />
            Reset
          </Button>
          <Button
            type="button"
            size="sm"
            className="bg-gradient-signal text-primary-foreground border-0"
            disabled={!canRun}
            onClick={() => {
              void proof.run({
                vaultConfigPubkey,
                amountUsdcUnits,
                maxSlippageBps,
                side: "USDC_TO_WSOL",
                outcome: "approved-loss",
              });
            }}
          >
            {proof.running ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="mr-2 h-3.5 w-3.5" />}
            Run approved loss
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={!canRun}
            onClick={() => {
              void proof.run({
                vaultConfigPubkey,
                amountUsdcUnits,
                maxSlippageBps,
                side: "USDC_TO_WSOL",
                outcome: "rejected",
              });
            }}
          >
            {proof.running ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <XCircle className="mr-2 h-3.5 w-3.5" />}
            Run guard rejection
          </Button>
        </div>
      </div>

      {missingEnv.length ? (
        <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3 text-[12px] leading-relaxed text-warning">
          Real MagicBlock mode is disabled until these env vars are set: <span className="font-mono">{missingEnv.join(", ")}</span>.
          The app will not silently fall back to a fake adapter for this button.
        </div>
      ) : null}

      <div className="mt-4 grid gap-2">
        {proof.phases.map((phase) => (
          <div key={phase.id} className="rounded-lg border border-border/50 bg-background/45 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <PhaseIcon status={phase.status} />
                  <span className="font-medium text-[13px]">{phase.label}</span>
                  <span className={cn("rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em]", phaseTone(phase.status))}>
                    {phase.status}
                  </span>
                </div>
                <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{phase.detail}</p>
              </div>
              {phase.explorerUrl ? (
                <a
                  className="inline-flex shrink-0 items-center gap-1 rounded-md bg-secondary px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
                  href={phase.explorerUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  tx <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {proof.lastResult ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <ProofBox
            title="Delegated and reclaimed"
            rows={[
              ["Session PDA", proof.lastResult.plan.sessionPda.toBase58()],
              ["Permission PDA", proof.lastResult.plan.permissionPda.toBase58()],
              ["TEE auth", proof.lastResult.teeAuth.source],
              ["TEE integrity", proof.lastResult.teeAuth.integrityVerified ? "verified" : "env-token"],
              ["Delegated owner", proof.lastResult.accountOwners.sessionDelegated ?? "pending"],
              ["Permission owner", proof.lastResult.accountOwners.permissionDelegated ?? "pending"],
              ["Reclaimed owner", proof.lastResult.accountOwners.sessionAfter ?? "pending"],
              ["Delegation owner", MAGICBLOCK_DELEGATION_PROGRAM_ID.toBase58()],
              ["Arcadia owner", PROGRAM_ID.toBase58()],
            ]}
          />
          <ProofBox
            title="Custody never delegated"
            rows={[
              ["Vault state owner", proof.lastResult.accountOwners.vaultState ?? "not found"],
              ["Treasury owner", proof.lastResult.accountOwners.treasury ?? "not found"],
              ["Arcadia program", PROGRAM_ID.toBase58()],
              ["Senior delta", `${proof.lastResult.plan.seniorDeltaUsdc} USDC`],
              ["Guard result", proof.lastResult.plan.guardDecision],
              ["Strategy fields", "hidden"],
            ]}
          />
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full bg-background/55 px-2.5 py-1">
          <EyeOff className="h-3 w-3 text-primary" /> route logic hidden
        </span>
        <span className="rounded-full bg-background/55 px-2.5 py-1">size logic hidden</span>
        <span className="rounded-full bg-background/55 px-2.5 py-1">timing hidden</span>
        <span className="rounded-full bg-background/55 px-2.5 py-1">risk proof public</span>
      </div>

      {proof.error ? (
        <div className="mt-3 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-[12px] text-destructive">
          {proof.error}
        </div>
      ) : null}
    </section>
  );
}

function ProofBox({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background/45 p-3">
      <div className="mb-2 font-display text-[13px] font-semibold">{title}</div>
      <div className="space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="grid grid-cols-[110px_1fr] gap-2 text-[11px]">
            <span className="text-muted-foreground">{label}</span>
            <span className="truncate font-mono">{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhaseIcon({ status }: { status: string }) {
  if (status === "complete") return <CheckCircle2 className="h-4 w-4 text-primary" />;
  if (status === "failed") return <XCircle className="h-4 w-4 text-destructive" />;
  if (status === "active") return <Loader2 className="h-4 w-4 animate-spin text-warning" />;
  return <LockKeyhole className="h-4 w-4 text-muted-foreground" />;
}

function phaseTone(status: string) {
  if (status === "complete") return "bg-primary/12 text-primary";
  if (status === "failed") return "bg-destructive/15 text-destructive";
  if (status === "active") return "bg-warning/15 text-warning";
  return "bg-secondary text-muted-foreground";
}
