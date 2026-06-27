"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useState, useEffect } from "react";

export function Nav() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div
      className="flex items-center justify-end gap-3 h-11 px-5 sticky top-0 z-30"
      style={{
        background: "var(--color-bg)",
        borderBottom: "1px solid var(--color-line)",
      }}
    >
      <span
        className="text-[10px] font-mono px-2 py-0.5 rounded"
        style={{
          background: "var(--color-panel-2)",
          color: "var(--color-faint)",
          border: "1px solid var(--color-line)",
        }}
      >
        devnet
      </span>
      {mounted && <WalletMultiButton />}
    </div>
  );
}
