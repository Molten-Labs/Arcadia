import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Droplets, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useUsdcBalance } from "@/hooks/useBalance";
import { getKilnApiUrl, isArcadiaDemoMode } from "@/lib/api";
import { USDC_MINT, SOLANA_CLUSTER } from "@/lib/solana/constants";
import { useWallet } from "@/lib/wallet";
import { cn } from "@/lib/utils";

interface FaucetResponse {
  ok: boolean;
  amountUi: string;
  signature: string;
}

async function requestDemoUsdc(wallet: string): Promise<FaucetResponse> {
  const baseUrl = getKilnApiUrl();

  if (!baseUrl) {
    // No backend configured — open the public Solana devnet faucet in a new tab
    window.open(`https://faucet.circle.com/`, "_blank", "noopener,noreferrer");
    throw new Error("No Arcadia server running. Opened the Circle devnet USDC faucet in a new tab — paste your wallet address there to receive test USDC.");
  }

  const response = await fetch(`${baseUrl}/devnet/faucet/usdc`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ wallet }),
  });

  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(detail || `Demo USDC request failed (${response.status})`);
  }

  return response.json() as Promise<FaucetResponse>;
}

export function DevnetUsdcFaucet({ compact = false }: { compact?: boolean }) {
  const { connected, publicKey } = useWallet();
  const queryClient = useQueryClient();
  const balance = useUsdcBalance();
  const isDevnet = SOLANA_CLUSTER === "devnet";
  const canShow = connected && publicKey && isDevnet && !isArcadiaDemoMode();

  const mutation = useMutation({
    mutationFn: () => requestDemoUsdc(publicKey!.toBase58()),
    onSuccess: async (response) => {
      await queryClient.invalidateQueries({ queryKey: ["usdc-balance"] });
      toast.success(`Funded ${Number(response.amountUi).toLocaleString()} devnet USDC`);
    },
    onError: (error) => {
      toast.error("Demo USDC request failed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  if (!canShow) return null;

  const value = balance.data ?? 0;
  const label = balance.isLoading ? "Checking..." : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/50 bg-secondary/45",
        compact ? "p-3" : "p-4"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Droplets className="h-3.5 w-3.5" />
            </span>
            <div>
              <p className="font-display text-[13px] font-semibold text-foreground">Devnet USDC</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
            </div>
          </div>
          {!compact && (
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              Test token for Arcadia devnet vault deposits. No real value.
            </p>
          )}
        </div>
        <Button
          size="sm"
          className="h-8 shrink-0 px-3 text-[12px]"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          Request
        </Button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[10px] text-muted-foreground">
        <span className="truncate">Mint {USDC_MINT.toBase58()}</span>
        {mutation.data?.signature && (
          <a
            href={`https://explorer.solana.com/tx/${mutation.data.signature}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-primary hover:text-primary-glow"
          >
            Tx <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  );
}
