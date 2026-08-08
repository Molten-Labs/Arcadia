"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PrivyProvider, useLogin } from "@privy-io/react-auth";
import { toSolanaWalletConnectors } from "@privy-io/react-auth/solana";

import { AcidButton } from "@/components/acid";
import { describePrivyError } from "@/lib/privy-error";

const PRIVY_APP_ID = "cmowmjzxf002r0cl5zonkvtai";

function TryDemoButtonInner({
  size,
  className,
}: {
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  const router = useRouter();
  const [loginError, setLoginError] = useState<string | null>(null);
  const { login } = useLogin({
    onComplete: () => router.push("/onboarding"),
    onError(error) {
      console.error("[privy] login error:", error);
      setLoginError(describePrivyError(error));
    },
  });

  return (
    <div className="flex flex-col items-center gap-1">
      <AcidButton
        size={size}
        className={className}
        onClick={() => {
          setLoginError(null);
          login();
        }}
      >
        Try Demo <ArrowRight />
      </AcidButton>
      {loginError && (
        <span className="font-mono text-[10px] leading-tight text-danger">
          {loginError}
        </span>
      )}
    </div>
  );
}

/**
 * Client island for the nav "Try Demo" CTA. Carries its own lean Privy
 * provider (the landing page is a server component and is not wrapped in the
 * app root providers), then opens Privy login and routes to /onboarding on
 * completion. Mirrors the wallet/email/google config from `Providers`.
 */
export function TryDemoButton({
  size,
  className,
}: {
  size?: "sm" | "default" | "lg";
  className?: string;
}) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "#222224",
          walletChainType: "solana-only",
          walletList: [
            "detected_solana_wallets",
            "phantom",
            "solflare",
            "backpack",
          ],
        },
        loginMethods: ["email", "google", "wallet"],
        embeddedWallets: {
          showWalletUIs: true,
          solana: {
            createOnLogin: "users-without-wallets",
          },
        },
        externalWallets: {
          solana: {
            connectors: toSolanaWalletConnectors(),
          },
        },
      }}
    >
      <TryDemoButtonInner size={size} className={className} />
    </PrivyProvider>
  );
}
