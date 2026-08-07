"use client";

import { type ReactNode } from "react";
import { PrivyProvider } from "@privy-io/react-auth";

const PRIVY_APP_ID = "cmowmjzxf002r0cl5zonkvtai";

/**
 * Lean Privy wrapper for the public waitlist page — email-only, no wallets,
 * no query/auth providers. Used solely for email OTP verification: Privy
 * sends the code and verifies it; we only submit the resulting access token
 * to the backend as proof of email ownership.
 */
export function WaitlistProviders({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        loginMethods: ["email"],
        appearance: { theme: "#222224" },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
