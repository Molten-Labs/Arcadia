import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/utils";
import { shortAddr } from "@/lib/types";

/** Long/short pill. */
export function SideBadge({ direction }: { direction: "long" | "short" }) {
  const long = direction === "long";
  return (
    <span
      className={cn(
        "inline-flex rounded px-1.5 py-0.5 font-mono text-[9px] font-bold tracking-[0.12em] uppercase",
        long ? "bg-success/15 text-success" : "bg-danger/15 text-danger",
      )}
    >
      {direction}
    </span>
  );
}

/** Solscan devnet transaction link (or an em-less dash when unsigned). */
export function SolscanTxLink({
  sig,
  chars = 6,
  className,
}: {
  sig?: string;
  chars?: number;
  className?: string;
}) {
  if (!sig) return <span className="text-faint">-</span>;
  return (
    <a
      href={`https://solscan.io/tx/${sig}?cluster=devnet`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[10px] text-cyan transition-opacity hover:opacity-70",
        className,
      )}
    >
      {sig.slice(0, chars)}... <ExternalLink className="size-2.5" aria-hidden />
    </a>
  );
}

/** Solscan devnet account link with a shortened address. */
export function SolscanAccountLink({ wallet, className }: { wallet: string; className?: string }) {
  return (
    <a
      href={`https://solscan.io/account/${wallet}?cluster=devnet`}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "inline-flex items-center gap-1 font-mono text-[11px] text-faint transition-colors hover:text-cyan",
        className,
      )}
    >
      {shortAddr(wallet)} <ExternalLink className="size-2.5" aria-hidden />
    </a>
  );
}
