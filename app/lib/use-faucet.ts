"use client";

import { useCallback, useState } from "react";

/**
 * "Get test funds" for the terminal: requests devnet USDC + SOL for the
 * trader's identity wallet from the /api/v1/faucet reserve. Under trader-pays
 * the identity is the fee payer and collateral holder, so the funds land in
 * the connected wallet — no separate execution wallet to fund.
 */

export type FaucetState = "idle" | "funding" | "done" | "error";

export function useFaucet(): {
  state: FaucetState;
  message: string | null;
  fund: (address: string) => Promise<boolean>;
} {
  const [state, setState] = useState<FaucetState>("idle");
  const [message, setMessage] = useState<string | null>(null);

  const fund = useCallback(async (address: string): Promise<boolean> => {
    setState("funding");
    setMessage(null);

    try {
      const res = await fetch("/api/v1/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const data = await res.json().catch(() => ({ error: `Faucet ${res.status}` }));

      if (!res.ok || !data.ok) {
        setState("error");
        setMessage(
          (data?.error as string) ??
            (res.status === 503
              ? "Faucet is not configured on this deployment."
              : "Faucet request failed."),
        );
        return false;
      }

      setState("done");
      setMessage(`Funded with ${data.usdcAmount} USDC + ${data.solAmount} SOL.`);
      return true;
    } catch {
      setState("error");
      setMessage("Could not reach the faucet.");
      return false;
    }
  }, []);

  return { state, message, fund };
}
