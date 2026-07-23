"use client";

import { usePrivy } from "@privy-io/react-auth";
import { useWalletCompat } from "@/lib/use-wallet-compat";
import { useHydrated } from "./use-hydrated";

export function WalletButton() {
  const hydrated = useHydrated();
  const privy = usePrivy();
  const { connected, publicKey, disconnect } = useWalletCompat();

  if (!hydrated) {
    return <span aria-hidden className="h-[30px] w-[132px] rounded-lg bg-panel-2" />;
  }

  if (connected && publicKey) {
    const base58 = publicKey.toBase58();
    const display = `${base58.slice(0, 4)}…${base58.slice(-4)}`;
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-md border border-acid/20 bg-acid/10 px-2.5 py-1 font-mono text-[11px] font-bold text-acid">
          {display}
        </span>
        <button
          type="button"
          onClick={() => disconnect?.()}
          className="rounded-md border border-line px-2 py-1 font-mono text-[10px] text-faint transition-colors hover:text-ink"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => privy.login()}
      className="flex h-[30px] items-center gap-1.5 rounded-lg bg-acid px-3 text-[11px] font-bold text-void transition-all hover:bg-acid/90 active:scale-[0.97] motion-reduce:transform-none"
    >
      <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden>
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      Connect
    </button>
  );
}
