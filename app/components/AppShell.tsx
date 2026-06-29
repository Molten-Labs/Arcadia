"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useState, useEffect } from "react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { connected } = useWallet();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  return (
    <div
      className="flex flex-col flex-1 min-w-0 overflow-hidden transition-all duration-200"
      style={{ paddingLeft: mounted && connected ? "12rem" : 0 }}
    >
      {/* Extra bottom padding on mobile so content isn't hidden behind the bottom nav */}
      <div className="flex flex-col flex-1 overflow-hidden pb-safe-bottom md:pb-0">
        {children}
      </div>
    </div>
  );
}
