"use client";

/**
 * Shared Arcadia vault client — the single home for wallet-to-program wiring.
 *
 * Both `useArcadiaVault` and any transaction UI (deposit modal, manage page)
 * go through this layer. Two invariants:
 *
 * 1. An RPC failure is an error, never a fake success. `getVaultChainStatus`
 *    throws `RpcUnreachableError` when devnet can't be read; callers surface
 *    that to the user.
 * 2. Simulation is explicit. When the program/profile simply isn't live on
 *    devnet, callers may run a clearly-labelled simulated flow — with
 *    `simulated: true` and NO fabricated signature.
 */

import type { Connection, PublicKey } from "@solana/web3.js";
import { AnchorProvider, Program } from "@coral-xyz/anchor";
import type { AnchorWallet } from "./use-wallet-compat";
import { ARCADIA_IDL, type ArcadiaIdl } from "./arcadia-idl";
import {
  decodePlatformConfig,
  decodeTraderProfile,
  findInvestorAccount,
  findPlatformConfig,
  findTraderProfile,
} from "./arcadia-sdk";

/* ── Transaction state (consumed by tx UIs) ─────────────────────────── */

export type VaultTxPhase =
  | "idle"
  | "checking"
  | "init-investor"
  | "signing"
  | "confirming"
  | "success"
  | "error";

export interface VaultTxState {
  phase: VaultTxPhase;
  message: string;
  /** Real on-chain signature. Always null for simulated flows. */
  sig: string | null;
  /** True when the flow ran as a devnet simulation (program not live). */
  simulated: boolean;
}

export const IDLE_TX_STATE: VaultTxState = {
  phase: "idle",
  message: "",
  sig: null,
  simulated: false,
};

/* ── Chain status ───────────────────────────────────────────────────── */

/** Thrown when devnet can't be reached; distinct from "program not live". */
export class RpcUnreachableError extends Error {
  constructor(cause: unknown) {
    super(
      `Couldn't reach Solana devnet: ${cause instanceof Error ? cause.message : String(cause)}`,
    );
    this.name = "RpcUnreachableError";
  }
}

export type VaultChainStatus =
  /** PlatformConfig account missing — program not initialized on devnet. */
  | { kind: "offline"; investorExists: boolean }
  /** Platform initialized, but this trader's profile doesn't exist yet. */
  | { kind: "platform"; investorExists: boolean; platformBaseMint: PublicKey }
  /** Platform + profile both live — real vault transactions are possible. */
  | {
      kind: "vault-live";
      investorExists: boolean;
      platformBaseMint: PublicKey;
      baseMint: PublicKey;
      vaultToken: PublicKey;
    };

/**
 * Read platform + profile + investor accounts in one RPC round trip.
 * Throws {@link RpcUnreachableError} on RPC failure — callers must not
 * confuse an outage with "program not deployed".
 */
export async function getVaultChainStatus(
  connection: Connection,
  traderWallet: PublicKey,
  depositor: PublicKey,
): Promise<VaultChainStatus> {
  const [platformPda] = findPlatformConfig();
  const [profilePda] = findTraderProfile(traderWallet);
  const [investorPda] = findInvestorAccount(depositor);

  let infos: Awaited<ReturnType<Connection["getMultipleAccountsInfo"]>>;
  try {
    infos = await connection.getMultipleAccountsInfo([platformPda, profilePda, investorPda]);
  } catch (err) {
    throw new RpcUnreachableError(err);
  }

  const [platInfo, profInfo, invInfo] = infos;
  const investorExists = invInfo !== null;

  if (platInfo === null) {
    return { kind: "offline", investorExists };
  }

  const platform = decodePlatformConfig(Buffer.from(platInfo.data));
  if (profInfo === null) {
    return { kind: "platform", investorExists, platformBaseMint: platform.baseMint };
  }

  const profile = decodeTraderProfile(Buffer.from(profInfo.data));
  return {
    kind: "vault-live",
    investorExists,
    platformBaseMint: platform.baseMint,
    baseMint: profile.baseMint,
    vaultToken: profile.vaultToken,
  };
}

/* ── Program construction ───────────────────────────────────────────── */

export function makeArcadiaProgram(
  connection: Connection,
  wallet: AnchorWallet,
): Program<ArcadiaIdl> {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program<ArcadiaIdl>(ARCADIA_IDL, provider);
}

/* ── Backend event push (best-effort indexer notification) ──────────── */

export async function pushEvent(event: Record<string, unknown>): Promise<void> {
  const token =
    typeof localStorage !== "undefined" ? localStorage.getItem("arcadia_jwt") : null;
  try {
    await fetch("/api/v1/events", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ events: [event] }),
    });
  } catch {
    // best-effort: the indexer catches up from chain state
  }
}
