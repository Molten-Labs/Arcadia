import { useCallback, useMemo, useState } from "react";
import { PublicKey, Transaction, type Connection, type TransactionInstruction } from "@solana/web3.js";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useWallet } from "@/lib/wallet";
import {
  MAGICBLOCK_DELEGATION_PROGRAM_ID,
  PROGRAM_ID,
} from "@/lib/solana/constants";
import {
  MAGICBLOCK_PHASES,
  buildCommitPrivateIntentSessionIx,
  buildDelegatePrivateIntentSessionIx,
  buildInitPrivateIntentSessionIx,
  buildMagicBlockPrivateIntentPlan,
  buildRecordPrivateIntentOnErIx,
  buildUndelegatePrivateIntentSessionIx,
  explorerTxUrl,
  getMagicBlockEnvStatus,
  privateErConnection,
  readOwnerProof,
  requestMagicBlockTeeAuth,
  type MagicBlockPhase,
  type MagicBlockPhaseId,
  type MagicBlockPrivateIntentPlan,
  type MagicBlockTeeAuthSession,
} from "@/lib/solana/magicblockPrivateIntent";
import {
  recordPrivateIntentOnchainProof,
  submitPrivateIntent,
  type PrivateIntentVaultSnapshot,
} from "@/lib/privateIntents";

interface RunRealMagicBlockIntentParams {
  vaultConfigPubkey: string;
  amountUsdcUnits: bigint;
  side?: string;
  maxSlippageBps: number;
  outcome?: "approved-loss" | "rejected";
}

interface RealMagicBlockProofResult {
  plan: MagicBlockPrivateIntentPlan;
  teeAuth: MagicBlockTeeAuthSession;
  reclaimStatus: "reclaimed" | "pending-local-callback";
  intentId?: string;
  signatures: {
    init: string;
    delegate: string;
    erExecution: string;
    commit: string;
    undelegate: string;
  };
  accountOwners: {
    sessionBefore: string | null;
    sessionDelegated: string | null;
    sessionAfter: string | null;
    permissionDelegated: string | null;
    vaultState: string | null;
    treasury: string | null;
  };
  snapshot?: PrivateIntentVaultSnapshot | null;
}

export function useMagicBlockPrivateIntentProof() {
  const { connection } = useWallet();
  const { publicKey, sendTransaction, signMessage } = useSolanaWallet();
  const queryClient = useQueryClient();
  const envStatus = useMemo(() => getMagicBlockEnvStatus(), []);
  const [phases, setPhases] = useState<MagicBlockPhase[]>(MAGICBLOCK_PHASES);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<RealMagicBlockProofResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const markPhase = useCallback((id: MagicBlockPhaseId, patch: Partial<MagicBlockPhase>) => {
    setPhases((current) =>
      current.map((phase) => (phase.id === id ? { ...phase, ...patch } : phase)),
    );
  }, []);

  const reset = useCallback(() => {
    setPhases(MAGICBLOCK_PHASES);
    setLastResult(null);
    setError(null);
  }, []);

  const run = useCallback(async (params: RunRealMagicBlockIntentParams) => {
    if (!connection || !publicKey) throw new Error("Connect a real devnet wallet first.");
    if (!envStatus.ready) {
      throw new Error(`Missing MagicBlock env: ${envStatus.missing.join(", ")}`);
    }
    if (params.amountUsdcUnits <= 0n) {
      throw new Error("Enter a positive USDC amount for the private intent.");
    }

    setRunning(true);
    setError(null);
    setLastResult(null);
    setPhases(MAGICBLOCK_PHASES);

    try {
      const vaultConfig = new PublicKey(params.vaultConfigPubkey);
      markPhase("init-session", {
        status: "active",
        detail: envStatus.localEr
          ? "Using local MagicBlock ER on localhost; TEE auth is skipped for local validation."
          : "Verifying MagicBlock TEE integrity and requesting a wallet-signed auth token.",
      });
      const teeAuth = await requestMagicBlockTeeAuth({
        publicKey,
        signMessage,
      });
      const plan = await buildMagicBlockPrivateIntentPlan({
        manager: publicKey,
        vaultConfig,
        amountUsdcUnits: params.amountUsdcUnits,
        side: params.side ?? "USDC_TO_WSOL",
        maxSlippageBps: params.maxSlippageBps,
        outcome: params.outcome,
      }, teeAuth);
      const erConnection = privateErConnection(teeAuth);
      const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 15 * 60);

      const sessionBefore = await readOwnerProof(connection, plan.sessionPda);
      const vaultStateOwner = await readOwnerProof(connection, plan.vaultStatePda);
      const treasuryOwner = await readOwnerProof(connection, plan.treasuryPda);
      assertOwnerProof(vaultStateOwner, PROGRAM_ID.toBase58(), "Vault state");
      assertOwnerProof(treasuryOwner, PROGRAM_ID.toBase58(), "Vault treasury");
      const intentId = await createBackendIntent({
        vaultConfigPubkey: params.vaultConfigPubkey,
        trader: publicKey.toBase58(),
        amountUsdcUnits: params.amountUsdcUnits,
        side: params.side ?? "USDC_TO_WSOL",
        maxSlippageBps: params.maxSlippageBps,
      });

      const initSig = await sendPhase({
        id: "init-session",
        label: "Private intent session",
        ix: buildInitPrivateIntentSessionIx(
          publicKey,
          vaultConfig,
          plan,
          expiresAt,
          params.amountUsdcUnits,
        ),
        connection,
        publicKey,
        sendTransaction,
        markPhase,
      });

      const delegateSig = await sendPhase({
        id: "delegate",
        label: "MagicBlock delegation",
        ix: buildDelegatePrivateIntentSessionIx(publicKey, vaultConfig, plan),
        connection,
        publicKey,
        sendTransaction,
        markPhase,
      });
      markPhase("create-permission", {
        status: "complete",
        signature: delegateSig,
        explorerUrl: explorerTxUrl(delegateSig),
        detail: "Permission PDA created and delegated in the same base-layer transaction.",
      });

      const expectedDelegationOwner = MAGICBLOCK_DELEGATION_PROGRAM_ID.toBase58();
      const sessionDelegated = (await waitForOwnerProof(
        connection,
        plan.sessionPda,
        expectedDelegationOwner,
        "Session PDA delegation",
      )).owner;
      const permissionDelegated = (await waitForOwnerProof(
        connection,
        plan.permissionPda,
        expectedDelegationOwner,
        "PER permission delegation",
      )).owner;
      await waitForAccountAvailable(erConnection, plan.sessionPda, "Session PDA on MagicBlock PER");
      await waitForAccountAvailable(erConnection, plan.permissionPda, "PER permission account on MagicBlock PER");

      const erExecutionSig = await sendPhase({
        id: "execute-er",
        label: "Private ER guard execution",
        ix: buildRecordPrivateIntentOnErIx(
          publicKey,
          vaultConfig,
          plan,
          params.amountUsdcUnits,
        ),
        connection: erConnection,
        publicKey,
        sendTransaction,
        markPhase,
        skipPreflight: true,
      });

      const commitSig = await sendPhase({
        id: "commit",
        label: "MagicBlock proof commit",
        ix: buildCommitPrivateIntentSessionIx(publicKey, plan),
        connection: erConnection,
        publicKey,
        sendTransaction,
        markPhase,
        skipPreflight: true,
      });

      const undelegateSig = await sendPhase({
        id: "undelegate",
        label: "MagicBlock session reclaim",
        ix: buildUndelegatePrivateIntentSessionIx(publicKey, plan),
        connection: erConnection,
        publicKey,
        sendTransaction,
        markPhase,
        skipPreflight: true,
      });
      const reclaimProof = await waitForOwnerProof(
        connection,
        plan.sessionPda,
        PROGRAM_ID.toBase58(),
        "Session PDA reclaim",
        {
          allowPendingOwner: envStatus.localEr ? expectedDelegationOwner : undefined,
          maxAttempts: envStatus.localEr ? 36 : 24,
        },
      );
      if (!reclaimProof.reached && envStatus.localEr) {
        markPhase("undelegate", {
          status: "complete",
          signature: undelegateSig,
          explorerUrl: explorerTxUrl(undelegateSig),
          detail:
            "MagicBlock ER accepted the undelegate intent; local validator callback is still pending, so proof is recorded honestly as pending-local-callback.",
        });
      }

      const signatures = {
        init: initSig,
        delegate: delegateSig,
        erExecution: erExecutionSig,
        commit: commitSig,
        undelegate: undelegateSig,
      };
      const reclaimStatus = reclaimProof.reached ? "reclaimed" : "pending-local-callback";
      const accountOwners = {
        sessionBefore,
        sessionDelegated,
        sessionAfter: reclaimProof.owner,
        permissionDelegated,
        vaultState: vaultStateOwner,
        treasury: treasuryOwner,
      };
      const snapshot = intentId
        ? await recordPrivateIntentOnchainProof(intentId, {
            vaultConfigPubkey: params.vaultConfigPubkey,
            walletPubkey: publicKey.toBase58(),
            sessionPda: plan.sessionPda.toBase58(),
            permissionPda: plan.permissionPda.toBase58(),
            intentCommitment: plan.intentCommitment.toString("hex"),
            proofHash: plan.proofHash.toString("hex"),
            erStateRoot: plan.erStateRoot.toString("hex"),
            guardDecision: plan.guardDecision,
            settlementResult: plan.settlementResult,
            healthBand: plan.guardDecision === "rejected" ? "blocked" : "critical",
            positionLimitBps: 100,
            juniorDelta: plan.juniorDeltaUsdc,
            seniorDelta: plan.seniorDeltaUsdc,
            signatures,
            accountOwners,
            reclaimStatus,
          })
        : null;

      if (snapshot) {
        queryClient.setQueryData<PrivateIntentVaultSnapshot>(
          ["private-intent-vault", params.vaultConfigPubkey],
          snapshot,
        );
      }
      queryClient.invalidateQueries({ queryKey: ["private-intent-vault", params.vaultConfigPubkey] });

      const result = { plan, teeAuth, reclaimStatus, intentId, signatures, accountOwners, snapshot };
      setLastResult(result);
      toast.success("Real MagicBlock proof flow completed", {
        description:
          reclaimStatus === "pending-local-callback"
            ? "ER execution, commit, and undelegate signatures landed; local base callback is pending."
            : plan.guardDecision === "rejected"
            ? "Guard rejection was recorded on MagicBlock PER and committed."
            : "Session was delegated, executed on ER, committed, and reclaimed.",
      });
      return result;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "MagicBlock proof failed.";
      setError(message);
      setPhases((current) =>
        current.map((phase) => (phase.status === "active" ? { ...phase, status: "failed" } : phase)),
      );
      toast.error("MagicBlock proof failed", { description: message });
      throw caught;
    } finally {
      setRunning(false);
    }
  }, [connection, envStatus, markPhase, publicKey, queryClient, sendTransaction, signMessage]);

  return {
    envStatus,
    phases,
    running,
    error,
    lastResult,
    run,
    reset,
  };
}

async function sendPhase(args: {
  id: MagicBlockPhaseId;
  label: string;
  ix: TransactionInstruction;
  connection: Connection;
  publicKey: PublicKey;
  sendTransaction: ReturnType<typeof useSolanaWallet>["sendTransaction"];
  markPhase: (id: MagicBlockPhaseId, patch: Partial<MagicBlockPhase>) => void;
  skipPreflight?: boolean;
}) {
  args.markPhase(args.id, { status: "active", detail: `${args.label}: awaiting wallet approval.` });
  const tx = new Transaction().add(args.ix);
  tx.feePayer = args.publicKey;
  const blockhash = await args.connection.getLatestBlockhash("confirmed");
  tx.recentBlockhash = blockhash.blockhash;
  const signature = await args.sendTransaction(tx, args.connection, {
    skipPreflight: args.skipPreflight,
  });
  args.markPhase(args.id, {
    signature,
    explorerUrl: explorerTxUrl(signature),
    detail: `${args.label}: confirming ${shortSignature(signature)}.`,
  });
  await args.connection.confirmTransaction(
    {
      signature,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight: blockhash.lastValidBlockHeight,
    },
    "confirmed",
  );
  args.markPhase(args.id, {
    status: "complete",
    signature,
    explorerUrl: explorerTxUrl(signature),
    detail: `${args.label}: confirmed on ${args.skipPreflight ? "MagicBlock ER" : "base Solana"}.`,
  });
  return signature;
}

async function createBackendIntent(input: {
  vaultConfigPubkey: string;
  trader: string;
  amountUsdcUnits: bigint;
  side: string;
  maxSlippageBps: number;
}): Promise<string> {
  const snapshot = await submitPrivateIntent({
    vaultConfigPubkey: input.vaultConfigPubkey,
    trader: input.trader,
    amountUsdc: Number(input.amountUsdcUnits) / 1e6,
    side: input.side,
    maxSlippageBps: input.maxSlippageBps,
    clientRequestId: `magicblock-per-${Date.now()}`,
  });
  const intentId = snapshot.activity[0]?.intentId;
  if (!intentId) {
    throw new Error("Private intent backend did not return an intent id for proof ingestion.");
  }
  return intentId;
}

function shortSignature(signature: string) {
  return `${signature.slice(0, 8)}...${signature.slice(-6)}`;
}

function assertOwnerProof(actual: string | null, expected: string, label: string) {
  if (actual !== expected) {
    throw new Error(`${label} owner proof failed. Expected ${expected}, got ${actual ?? "not found"}.`);
  }
}

async function waitForOwnerProof(
  connection: Connection,
  pubkey: PublicKey,
  expectedOwner: string,
  label: string,
  options: {
    allowPendingOwner?: string;
    maxAttempts?: number;
  } = {},
): Promise<{ owner: string; reached: boolean }> {
  const maxAttempts = options.maxAttempts ?? 18;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const owner = await readOwnerProof(connection, pubkey);
    if (owner === expectedOwner) return { owner, reached: true };
    await sleep(700);
  }
  const owner = await readOwnerProof(connection, pubkey);
  if (owner && options.allowPendingOwner && owner === options.allowPendingOwner) {
    return { owner, reached: false };
  }
  throw new Error(`${label} did not reach expected owner ${expectedOwner}. Current owner: ${owner ?? "not found"}.`);
}

async function waitForAccountAvailable(
  connection: Connection,
  pubkey: PublicKey,
  label: string,
): Promise<void> {
  for (let attempt = 0; attempt < 18; attempt += 1) {
    const account = await connection.getAccountInfo(pubkey, "confirmed");
    if (account) return;
    await sleep(700);
  }
  throw new Error(`${label} was not visible on the MagicBlock PER RPC after delegation.`);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
