"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";

import { useRole } from "@/lib/role-context";

/**
 * Side-effect only: once a wallet is connected and a role is chosen, send the
 * user into their app home (traders -> terminal, investors -> dashboard).
 * Preserves the legacy landing's auto-redirect. Renders nothing.
 */
export function LandingRedirect() {
  const router = useRouter();
  const { connected } = useWallet();
  const { role } = useRole();

  useEffect(() => {
    if (connected && role) {
      router.replace(role === "trader" ? "/terminal" : "/dashboard");
    }
  }, [connected, role, router]);

  return null;
}
