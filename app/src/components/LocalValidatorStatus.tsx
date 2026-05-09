import { useEffect, useMemo, useState } from "react";
import { Activity, CheckCircle2, RadioTower, RefreshCw, Server, ShieldCheck, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getKilnApiUrl } from "@/lib/api";
import {
  IS_LOCAL_SOLANA_RPC,
  MAGICBLOCK_DISPLAY_NAME,
  MAGICBLOCK_ER_RPC_URL,
  MAGICBLOCK_LOCAL_ER,
  RPC_DISPLAY_NAME,
  RPC_URL,
} from "@/lib/solana/constants";
import { cn } from "@/lib/utils";

type ProbeStatus = "idle" | "checking" | "ok" | "failed";

interface ProbeState {
  base: ProbeStatus;
  er: ProbeStatus;
  backend: ProbeStatus;
  details: {
    base?: string;
    er?: string;
    backend?: string;
  };
}

const INITIAL: ProbeState = {
  base: "idle",
  er: "idle",
  backend: "idle",
  details: {},
};

export function LocalValidatorStatus({ compact = false }: { compact?: boolean }) {
  const apiUrl = getKilnApiUrl();
  const enabled = IS_LOCAL_SOLANA_RPC || MAGICBLOCK_LOCAL_ER;
  const [probes, setProbes] = useState<ProbeState>(INITIAL);

  const label = useMemo(() => {
    if (!enabled) return "";
    return `${RPC_DISPLAY_NAME} + ${MAGICBLOCK_DISPLAY_NAME}`;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;
    void runProbes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, apiUrl]);

  async function runProbes() {
    setProbes({ base: "checking", er: "checking", backend: "checking", details: {} });
    const [base, er, backend] = await Promise.allSettled([
      probeJsonRpc(RPC_URL),
      probeJsonRpc(MAGICBLOCK_ER_RPC_URL),
      probeBackend(apiUrl),
    ]);
    setProbes({
      base: base.status === "fulfilled" ? "ok" : "failed",
      er: er.status === "fulfilled" ? "ok" : "failed",
      backend: backend.status === "fulfilled" ? "ok" : "failed",
      details: {
        base: base.status === "fulfilled" ? base.value : errorMessage(base.reason),
        er: er.status === "fulfilled" ? er.value : errorMessage(er.reason),
        backend: backend.status === "fulfilled" ? backend.value : errorMessage(backend.reason),
      },
    });
  }

  if (!enabled) return null;

  return (
    <div className="border-b border-primary/15 bg-primary/[0.035] backdrop-blur">
      <div
        className={cn(
          "container flex flex-col gap-2 py-2 text-xs text-foreground/85",
          compact ? "lg:flex-row lg:items-center lg:justify-between" : "md:flex-row md:items-center md:justify-between",
        )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-background/70 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-primary">
            <RadioTower className="h-3 w-3" />
            Local recording stack
          </span>
          <span className="font-display text-sm font-semibold">{label}</span>
          <span className="text-muted-foreground">Wallet approvals use the local base RPC, ER phases use the local MagicBlock RPC.</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <ProbePill icon={Server} label="Surfpool" status={probes.base} detail={probes.details.base ?? RPC_URL} />
          <ProbePill icon={ShieldCheck} label="MagicBlock ER" status={probes.er} detail={probes.details.er ?? MAGICBLOCK_ER_RPC_URL} />
          <ProbePill icon={Activity} label="Backend" status={probes.backend} detail={probes.details.backend ?? apiUrl} />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => void runProbes()}
            className="h-7 rounded-full px-2 text-[11px]"
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Check
          </Button>
        </div>
      </div>
    </div>
  );
}

function ProbePill({
  icon: Icon,
  label,
  status,
  detail,
}: {
  icon: typeof Server;
  label: string;
  status: ProbeStatus;
  detail?: string;
}) {
  const ok = status === "ok";
  const failed = status === "failed";
  const checking = status === "checking";
  return (
    <span
      title={detail}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 rounded-full border px-2 font-mono text-[10px]",
        ok && "border-success/30 bg-success/10 text-success",
        failed && "border-destructive/30 bg-destructive/10 text-destructive",
        checking && "border-warning/30 bg-warning/10 text-warning",
        status === "idle" && "border-border/60 bg-background/60 text-muted-foreground",
      )}
    >
      <Icon className="h-3 w-3" />
      {label}
      {ok && <CheckCircle2 className="h-3 w-3" />}
      {failed && <XCircle className="h-3 w-3" />}
      {checking && <RefreshCw className="h-3 w-3 animate-spin" />}
    </span>
  );
}

async function probeJsonRpc(url: string): Promise<string> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (body?.result !== "ok") throw new Error(body?.error?.message ?? "RPC health not ok");
  return `${url} · getHealth ok`;
}

async function probeBackend(apiUrl: string): Promise<string> {
  if (!apiUrl) throw new Error("VITE_KILN_API_BASE_URL missing");
  const response = await fetch(`${apiUrl}/health`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  if (body?.status !== "ok") throw new Error("Backend health not ok");
  return `${apiUrl} · ${body.database ?? "store"} store`;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Health check failed";
}

export default LocalValidatorStatus;
