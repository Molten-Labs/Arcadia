"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { BN } from "@coral-xyz/anchor";
import { useWalletCompat } from "@/lib/use-wallet-compat";
import {
  closeFlashTradePositionV2,
  createFlashTradeExecutionClient,
  openFlashTradePosition,
  readFlashTradePositionSnapshot,
  resolveFlashTradeMarket,
  type FlashTradeExecutionClient,
} from "@/lib/flashtrade/v2";
import {
  deriveExecutionKeypair,
  traderSetupAndDeposit,
  type IdentitySigner,
} from "@/lib/flashtrade/trader-pays";

/**
 * Real Flash Trade execution for the terminal, client-side and trader-pays.
 *
 * The trader's connected Privy Solana wallet is the identity. Signing the
 * domain message "arcadia-flash-v1" (no popup for embedded wallets) derives a
 * deterministic execution wallet that signs the fee-sponsored MagicBlock ER
 * txs but never holds SOL. All base-chain setup + deposit is batched into one
 * identity-signed transaction; the identity pays fees + rent.
 */

export type Direction = "long" | "short";

export type ExecutionStatus = "idle" | "connecting" | "error" | "live";

export type FlashPosition = {
  marketSymbol: string;
  collateralSymbol: string;
  sideUi: string;
  entryPriceUi: string;
  sizeAmountUi: string;
  sizeUsdUi: string;
  collateralUsdUi: string;
  pnlWithFeeUsdUi: string;
  pnlPercentageWithFee: string;
  leverageUi: string;
  liquidationPriceUi: string;
  venuePositionKey: string;
};

type ExecutionError = { message: string } | null;

export interface UseFlashExecution {
  connected: boolean;
  /** Derived execution wallet (base58) once known, else null. */
  executionWallet: string | null;
  status: ExecutionStatus;
  error: ExecutionError;
  position: FlashPosition | null;
  open: (market: string, direction: Direction, amountUsd: number) => Promise<{ ok: boolean; error?: string }>;
  close: (market: string, direction: Direction) => Promise<{ ok: boolean; error?: string; signature?: string }>;
  refresh: (market: string, direction: Direction) => Promise<FlashPosition | null>;
}

const ARCADIA_FLASH_DOMAIN = new TextEncoder().encode("arcadia-flash-v1");

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function marketToTargetSymbol(market: string): string {
  return market.replace("/USD", "").replace("-PERP", "").trim();
}

export function useFlashExecution(): UseFlashExecution {
  const { publicKey, connected, signMessage, signTransaction } = useWalletCompat();
  const [status, setStatus] = useState<ExecutionStatus>("idle");
  const [error, setError] = useState<ExecutionError>(null);
  const [position, setPosition] = useState<FlashPosition | null>(null);
  const [executionWallet, setExecutionWallet] = useState<string | null>(null);

  const clientRef = useRef<{ identity: string; client: FlashTradeExecutionClient } | null>(null);

  const identitySigner = useMemo<IdentitySigner | null>(() => {
    if (!publicKey || !signTransaction) return null;
    return { publicKey, signTransaction };
  }, [publicKey, signTransaction]);

  const ensureClient = useCallback(async (): Promise<FlashTradeExecutionClient> => {
    if (!publicKey || !signMessage) {
      throw new Error("Connect your wallet to trade on Flash.");
    }
    const id = publicKey.toBase58();
    const cached = clientRef.current;
    if (cached?.identity === id) return cached.client;

    const signature = await signMessage(ARCADIA_FLASH_DOMAIN);
    const keypair = deriveExecutionKeypair(signature);
    const client = createFlashTradeExecutionClient(keypair.secretKey.slice(0, 32));
    clientRef.current = { identity: id, client };
    setExecutionWallet(keypair.publicKey.toBase58());
    return client;
  }, [publicKey, signMessage]);

  const open = useCallback(
    async (market: string, side: Direction, amountUsd: number) => {
      if (!identitySigner) {
        setStatus("idle");
        return { ok: false, error: "Connect your wallet first." };
      }
      setStatus("connecting");
      try {
        const executionClient = await ensureClient();
        const targetSymbol = marketToTargetSymbol(market);
        const resolvedMarket = resolveFlashTradeMarket({ targetSymbol, direction: side });
        const amount = new BN(Math.round(amountUsd * 1_000_000));

        // Trader-pays: setup + deposit batched into one identity-signed tx.
        await traderSetupAndDeposit({
          executionClient,
          resolvedMarket,
          amount,
          identitySigner,
        });

        await openFlashTradePosition({
          executionClient,
          resolvedMarket,
          collateralAmount: amount,
          leverage: 2,
          slippagePercentage: "0.5",
        });

        setError(null);
        setStatus("live");
        return { ok: true };
      } catch (err) {
        setStatus("error");
        setError({ message: errorMessage(err) });
        return { ok: false, error: errorMessage(err) };
      }
    },
    [identitySigner, ensureClient],
  );

  const close = useCallback(
    async (market: string, side: Direction) => {
      if (!identitySigner) {
        setStatus("idle");
        return { ok: false, error: "Connect your wallet first." };
      }
      setStatus("connecting");
      try {
        const executionClient = await ensureClient();
        const targetSymbol = marketToTargetSymbol(market);
        const resolvedMarket = resolveFlashTradeMarket({ targetSymbol, direction: side });
        const result = await closeFlashTradePositionV2({ executionClient, resolvedMarket });
        setPosition(null);
        setStatus("idle");
        setError(null);
        return { ok: true, signature: result.signature };
      } catch (err) {
        setStatus("error");
        setError({ message: errorMessage(err) });
        return { ok: false, error: errorMessage(err) };
      }
    },
    [identitySigner, ensureClient],
  );

  const refresh = useCallback(
    async (market: string, side: Direction) => {
      if (!identitySigner) {
        setPosition(null);
        setStatus("idle");
        return null;
      }
      setStatus("connecting");
      try {
        const executionClient = await ensureClient();
        const targetSymbol = marketToTargetSymbol(market);
        const resolvedMarket = resolveFlashTradeMarket({ targetSymbol, direction: side });
        const snapshot = await readFlashTradePositionSnapshot({ executionClient, resolvedMarket });
        const pos = snapshot ? ({ ...snapshot } satisfies FlashPosition) : null;
        setPosition(pos);
        setStatus(pos ? "live" : "idle");
        setError(null);
        return pos;
      } catch (err) {
        setStatus("error");
        setError({ message: errorMessage(err) });
        return null;
      }
    },
    [identitySigner, ensureClient],
  );

  return { connected, executionWallet, status, error, position, open, close, refresh };
}
