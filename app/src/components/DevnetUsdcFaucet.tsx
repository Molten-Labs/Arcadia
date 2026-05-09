import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Droplets, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useBalance, useUsdcBalance } from "@/hooks/useBalance";
import { getKilnApiUrl, isArcadiaDemoMode } from "@/lib/api";
import { ARCADIA_LOCAL_CHAIN_MODE, RPC_DISPLAY_NAME, SOLANA_CLUSTER, USDC_MINT } from "@/lib/solana/constants";
import { useWallet } from "@/lib/wallet";
import { cn } from "@/lib/utils";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";

interface FaucetResponse {
  ok: boolean;
  amountUi: string;
  signature: string;
}

async function requestDemoUsdc(wallet: string): Promise<FaucetResponse> {
  const baseUrl = getKilnApiUrl();
  if (!baseUrl) {
    throw new Error("Start the Arcadia server to request demo USDC.");
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
  const { connected, publicKey, connection } = useWallet();
  const queryClient = useQueryClient();
  const balance = useUsdcBalance();
  const solBalance = useBalance();
  const isDevnet = SOLANA_CLUSTER === "devnet";
  const canShow = connected && publicKey && ((isDevnet && !isArcadiaDemoMode()) || ARCADIA_LOCAL_CHAIN_MODE);

  const mutation = useMutation({
    mutationFn: async () => {
      if (ARCADIA_LOCAL_CHAIN_MODE) {
        if (!connection || !publicKey) throw new Error("Wallet not connected.");
        const signature = await connection.requestAirdrop(publicKey, 5 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(signature, "confirmed");
        return { ok: true, amountUi: "5", signature } satisfies FaucetResponse;
      }
      return requestDemoUsdc(publicKey!.toBase58());
    },
    onSuccess: async (response) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["balance"] }),
        queryClient.invalidateQueries({ queryKey: ["usdc-balance"] }),
      ]);
      toast.success(
        ARCADIA_LOCAL_CHAIN_MODE
          ? `Airdropped ${Number(response.amountUi).toLocaleString()} local SOL`
          : `Funded ${Number(response.amountUi).toLocaleString()} devnet USDC`,
      );
    },
    onError: (error) => {
      toast.error(ARCADIA_LOCAL_CHAIN_MODE ? "Local SOL airdrop failed" : "Demo USDC request failed", {
        description: error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  if (!canShow) return null;

  const value = ARCADIA_LOCAL_CHAIN_MODE ? solBalance.data ?? 0 : balance.data ?? 0;
  const label = ARCADIA_LOCAL_CHAIN_MODE
    ? solBalance.isLoading
      ? "Checking..."
      : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} local SOL`
    : balance.isLoading
      ? "Checking..."
      : `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;

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
              <p className="font-display text-[13px] font-semibold text-foreground">
                {ARCADIA_LOCAL_CHAIN_MODE ? "Local SOL gas + capital" : "Devnet USDC"}
              </p>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
            </div>
          </div>
          {!compact && (
            <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground">
              {ARCADIA_LOCAL_CHAIN_MODE
                ? "Funds wallet actions on local Surfpool. Deposits use Arcadia's lamport-backed local accounting path."
                : "Test token for Arcadia devnet vault deposits. No real value."}
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
          {ARCADIA_LOCAL_CHAIN_MODE ? "Airdrop" : "Request"}
        </Button>
      </div>
      <div className="mt-2 flex items-center justify-between gap-3 font-mono text-[10px] text-muted-foreground">
        <span className="truncate">
          {ARCADIA_LOCAL_CHAIN_MODE ? `${RPC_DISPLAY_NAME} RPC funding` : `Mint ${USDC_MINT.toBase58()}`}
        </span>
        {mutation.data?.signature && !ARCADIA_LOCAL_CHAIN_MODE && (
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
