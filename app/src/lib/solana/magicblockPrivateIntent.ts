import {
  Connection,
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAuthToken,
  verifyTeeRpcIntegrity,
} from "@magicblock-labs/ephemeral-rollups-sdk/privacy";
import { Buffer } from "buffer";
import {
  MAGICBLOCK_DELEGATION_PROGRAM_ID,
  MAGICBLOCK_DEVNET_TEE_VALIDATOR,
  MAGICBLOCK_ER_RPC_URL,
  MAGICBLOCK_LOCAL_ER,
  MAGICBLOCK_MAGIC_CONTEXT_ID,
  MAGICBLOCK_MAGIC_PROGRAM_ID,
  MAGICBLOCK_PERMISSION_PROGRAM_ID,
  MAGICBLOCK_TEE_AUTH_TOKEN,
  MAGICBLOCK_TEE_RPC_URL,
  PROGRAM_ID,
} from "@/lib/solana/constants";
import {
  getMagicBlockDelegationBufferPDA,
  getMagicBlockDelegationMetadataPDA,
  getMagicBlockDelegationRecordPDA,
  getMagicBlockPermissionPDA,
  getManagerProfilePDA,
  getPrivateIntentSessionPDA,
  getVaultStatePDA,
  getTreasuryPDA,
} from "@/lib/solana/pdas";

export type MagicBlockPhaseId =
  | "init-session"
  | "create-permission"
  | "delegate"
  | "execute-er"
  | "commit"
  | "undelegate";

export type MagicBlockPhaseStatus = "pending" | "active" | "complete" | "failed";

export interface MagicBlockPhase {
  id: MagicBlockPhaseId;
  label: string;
  detail: string;
  status: MagicBlockPhaseStatus;
  signature?: string;
  explorerUrl?: string;
}

export interface MagicBlockPrivateIntentPlan {
  sessionId: Buffer;
  sessionPda: PublicKey;
  permissionPda: PublicKey;
  vaultStatePda: PublicKey;
  treasuryPda: PublicKey;
  intentCommitment: Buffer;
  proofHash: Buffer;
  erStateRoot: Buffer;
  teeRpcUrl: string;
  erRpcUrl: string;
  validator: PublicKey;
  explorerCluster: string;
  guardDecision: "approved" | "rejected";
  settlementResult: "loss" | "failed";
  juniorDeltaUsdc: number;
  seniorDeltaUsdc: number;
}

export interface MagicBlockEnvStatus {
  ready: boolean;
  missing: string[];
  localEr: boolean;
  teeRpcUrl: string;
  erRpcUrl: string;
  validator: string;
  permissionProgram: string;
  delegationProgram: string;
}

export interface MagicBlockTeeAuthSession {
  token: string;
  connectionUrl: string;
  integrityVerified: boolean;
  source: "wallet-challenge" | "env-token" | "local-er";
  issuedAt: number;
}

export interface RealMagicBlockIntentInput {
  manager: PublicKey;
  vaultConfig: PublicKey;
  amountUsdcUnits: bigint;
  side: string;
  maxSlippageBps: number;
  outcome?: "approved-loss" | "rejected";
}

export const MAGICBLOCK_PHASES: MagicBlockPhase[] = [
  {
    id: "init-session",
    label: "Initialize session PDA",
    detail: "Create a public PrivateIntentSession with only commitment data.",
    status: "pending",
  },
  {
    id: "create-permission",
    label: "Create PER permission",
    detail: "Create the MagicBlock permission account that gates private visibility.",
    status: "pending",
  },
  {
    id: "delegate",
    label: "Delegate to MagicBlock",
    detail: "Delegate only the session and permission PDAs, never vault custody.",
    status: "pending",
  },
  {
    id: "execute-er",
    label: "Execute hidden guard on ER",
    detail: "Record redacted guard and settlement hashes on the Private ER.",
    status: "pending",
  },
  {
    id: "commit",
    label: "Commit proof result",
    detail: "Commit redacted state back while preserving public investor safety.",
    status: "pending",
  },
  {
    id: "undelegate",
    label: "Reclaim session",
    detail: "Return the session PDA to Arcadia after the judge-facing proof.",
    status: "pending",
  },
];

const DISC_INIT_PRIVATE_INTENT_SESSION = 11;
const DISC_DELEGATE_PRIVATE_INTENT_SESSION = 12;
const DISC_RECORD_PRIVATE_INTENT_ON_ER = 13;
const DISC_COMMIT_PRIVATE_INTENT_SESSION = 14;
const DISC_UNDELEGATE_PRIVATE_INTENT_SESSION = 15;

const PRIVATE_INTENT_STATUS_EXECUTING = 3;
const PRIVATE_INTENT_STATUS_FAILED = 7;
const PRIVATE_INTENT_GUARD_APPROVED = 1;
const PRIVATE_INTENT_GUARD_REJECTED = 2;
const PRIVATE_INTENT_SETTLEMENT_LOSS = 2;
const PRIVATE_INTENT_SETTLEMENT_FAILED = 3;

export function getMagicBlockEnvStatus(): MagicBlockEnvStatus {
  const missing: string[] = [];
  if (!MAGICBLOCK_LOCAL_ER && !MAGICBLOCK_TEE_RPC_URL) missing.push("VITE_MAGICBLOCK_TEE_RPC_URL");
  if (!MAGICBLOCK_ER_RPC_URL) missing.push("VITE_MAGICBLOCK_ER_RPC_URL");

  return {
    ready: missing.length === 0,
    missing,
    localEr: MAGICBLOCK_LOCAL_ER,
    teeRpcUrl: MAGICBLOCK_TEE_RPC_URL,
    erRpcUrl: MAGICBLOCK_ER_RPC_URL,
    validator: MAGICBLOCK_DEVNET_TEE_VALIDATOR.toBase58(),
    permissionProgram: MAGICBLOCK_PERMISSION_PROGRAM_ID.toBase58(),
    delegationProgram: MAGICBLOCK_DELEGATION_PROGRAM_ID.toBase58(),
  };
}

export function privateErConnection(auth: MagicBlockTeeAuthSession): Connection {
  return new Connection(auth.connectionUrl, "confirmed");
}

export async function requestMagicBlockTeeAuth(input: {
  publicKey: PublicKey;
  signMessage?: (message: Uint8Array) => Promise<Uint8Array>;
}): Promise<MagicBlockTeeAuthSession> {
  if (!MAGICBLOCK_TEE_RPC_URL) {
    throw new Error("VITE_MAGICBLOCK_TEE_RPC_URL is required for MagicBlock PER.");
  }

  if (MAGICBLOCK_LOCAL_ER) {
    return {
      token: "",
      connectionUrl: MAGICBLOCK_ER_RPC_URL || MAGICBLOCK_TEE_RPC_URL,
      integrityVerified: false,
      source: "local-er",
      issuedAt: Date.now(),
    };
  }

  if (MAGICBLOCK_TEE_AUTH_TOKEN) {
    return {
      token: MAGICBLOCK_TEE_AUTH_TOKEN,
      connectionUrl: withTeeAuthToken(MAGICBLOCK_TEE_RPC_URL, MAGICBLOCK_TEE_AUTH_TOKEN),
      integrityVerified: false,
      source: "env-token",
      issuedAt: Date.now(),
    };
  }

  if (!input.signMessage) {
    throw new Error(
      "This wallet does not expose signMessage, so Arcadia cannot request a MagicBlock TEE auth token. Use Phantom/Solflare with message signing enabled.",
    );
  }

  const integrityVerified = await verifyTeeRpcIntegrity(MAGICBLOCK_TEE_RPC_URL);
  if (!integrityVerified) {
    throw new Error("MagicBlock TEE integrity verification failed. Refusing to use the private ER endpoint.");
  }

  const authToken = await getAuthToken(
    MAGICBLOCK_TEE_RPC_URL,
    input.publicKey,
    input.signMessage,
  );
  const token = normalizeTeeAuthToken(authToken);

  return {
    token,
    connectionUrl: withTeeAuthToken(MAGICBLOCK_TEE_RPC_URL, token),
    integrityVerified,
    source: "wallet-challenge",
    issuedAt: Date.now(),
  };
}

export async function buildMagicBlockPrivateIntentPlan(
  input: RealMagicBlockIntentInput,
  auth: MagicBlockTeeAuthSession,
): Promise<MagicBlockPrivateIntentPlan> {
  const rejected = input.outcome === "rejected";
  const nonce = cryptoRandomBytes(16);
  const sessionId = await sha256Buffer(
    Buffer.concat([
      input.manager.toBuffer(),
      input.vaultConfig.toBuffer(),
      u64Buffer(input.amountUsdcUnits),
      Buffer.from(input.side),
      nonce,
    ]),
  );
  const intentCommitment = await sha256Json({
    manager: input.manager.toBase58(),
    vaultConfig: input.vaultConfig.toBase58(),
    amountBand: amountBand(input.amountUsdcUnits),
    side: input.side,
    maxSlippageBps: input.maxSlippageBps,
    nonce: nonce.toString("hex"),
    redacted: ["routeLogic", "timingLogic", "hiddenSizeLogic", "privateNotes"],
  });
  const proofHash = await sha256Json({
    intentCommitment: intentCommitment.toString("hex"),
    guardDecision: rejected ? "rejected" : "approved",
    settlementResult: rejected ? "guard_blocked" : "junior_loss",
    publicRiskProof: rejected ? "vault-guard-rejection" : "junior-first-loss",
  });
  const erStateRoot = await sha256Json({
    sessionId: sessionId.toString("hex"),
    proofHash: proofHash.toString("hex"),
    executor: "magicblock-per",
  });
  const [sessionPda] = getPrivateIntentSessionPDA(input.vaultConfig, sessionId);
  const [permissionPda] = getMagicBlockPermissionPDA(sessionPda);
  const [vaultStatePda] = getVaultStatePDA(input.vaultConfig);
  const [treasuryPda] = getTreasuryPDA(input.vaultConfig);

  return {
    sessionId,
    sessionPda,
    permissionPda,
    vaultStatePda,
    treasuryPda,
    intentCommitment,
    proofHash,
    erStateRoot,
    teeRpcUrl: auth.connectionUrl,
    erRpcUrl: MAGICBLOCK_ER_RPC_URL,
    validator: MAGICBLOCK_DEVNET_TEE_VALIDATOR,
    explorerCluster: "devnet",
    guardDecision: rejected ? "rejected" : "approved",
    settlementResult: rejected ? "failed" : "loss",
    juniorDeltaUsdc: rejected ? 0 : -Number(input.amountUsdcUnits) / 1e6,
    seniorDeltaUsdc: 0,
  };
}

export function buildInitPrivateIntentSessionIx(
  manager: PublicKey,
  vaultConfig: PublicKey,
  plan: MagicBlockPrivateIntentPlan,
  expiresAtUnix: bigint,
  maxInAmount: bigint,
): TransactionInstruction {
  const [managerProfile] = getManagerProfilePDA(manager);
  const data = Buffer.alloc(1 + 32 + 32 + 8 + 8);
  data.writeUInt8(DISC_INIT_PRIVATE_INTENT_SESSION, 0);
  plan.sessionId.copy(data, 1);
  plan.intentCommitment.copy(data, 33);
  data.writeBigUInt64LE(maxInAmount, 65);
  data.writeBigInt64LE(expiresAtUnix, 73);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: manager, isSigner: true, isWritable: true },
      { pubkey: managerProfile, isSigner: false, isWritable: false },
      { pubkey: vaultConfig, isSigner: false, isWritable: false },
      { pubkey: plan.sessionPda, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function buildDelegatePrivateIntentSessionIx(
  manager: PublicKey,
  vaultConfig: PublicKey,
  plan: MagicBlockPrivateIntentPlan,
): TransactionInstruction {
  const [sessionBuffer] = getMagicBlockDelegationBufferPDA(plan.sessionPda, PROGRAM_ID);
  const [sessionRecord] = getMagicBlockDelegationRecordPDA(plan.sessionPda);
  const [sessionMetadata] = getMagicBlockDelegationMetadataPDA(plan.sessionPda);
  const [permissionBuffer] = getMagicBlockDelegationBufferPDA(
    plan.permissionPda,
    MAGICBLOCK_PERMISSION_PROGRAM_ID,
  );
  const [permissionRecord] = getMagicBlockDelegationRecordPDA(plan.permissionPda);
  const [permissionMetadata] = getMagicBlockDelegationMetadataPDA(plan.permissionPda);

  const data = Buffer.alloc(1 + 4 + 4 + 32);
  data.writeUInt8(DISC_DELEGATE_PRIVATE_INTENT_SESSION, 0);
  data.writeUInt32LE(1_000, 1);
  data.writeUInt32LE(0, 5);
  plan.validator.toBuffer().copy(data, 9);

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: manager, isSigner: true, isWritable: true },
      { pubkey: vaultConfig, isSigner: false, isWritable: false },
      { pubkey: plan.sessionPda, isSigner: false, isWritable: true },
      { pubkey: PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: sessionBuffer, isSigner: false, isWritable: true },
      { pubkey: sessionRecord, isSigner: false, isWritable: true },
      { pubkey: sessionMetadata, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: MAGICBLOCK_DELEGATION_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: plan.permissionPda, isSigner: false, isWritable: true },
      { pubkey: MAGICBLOCK_PERMISSION_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: permissionBuffer, isSigner: false, isWritable: true },
      { pubkey: permissionRecord, isSigner: false, isWritable: true },
      { pubkey: permissionMetadata, isSigner: false, isWritable: true },
      { pubkey: plan.validator, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function buildRecordPrivateIntentOnErIx(
  manager: PublicKey,
  vaultConfig: PublicKey,
  plan: MagicBlockPrivateIntentPlan,
  observedInAmount: bigint,
): TransactionInstruction {
  const data = Buffer.alloc(1 + 32 + 32 + 8 + 1 + 1 + 1 + 5);
  data.writeUInt8(DISC_RECORD_PRIVATE_INTENT_ON_ER, 0);
  plan.proofHash.copy(data, 1);
  plan.erStateRoot.copy(data, 33);
  data.writeBigUInt64LE(observedInAmount, 65);
  data.writeUInt8(
    plan.guardDecision === "rejected" ? PRIVATE_INTENT_GUARD_REJECTED : PRIVATE_INTENT_GUARD_APPROVED,
    73,
  );
  data.writeUInt8(
    plan.settlementResult === "failed" ? PRIVATE_INTENT_SETTLEMENT_FAILED : PRIVATE_INTENT_SETTLEMENT_LOSS,
    74,
  );
  data.writeUInt8(
    plan.guardDecision === "rejected" ? PRIVATE_INTENT_STATUS_FAILED : PRIVATE_INTENT_STATUS_EXECUTING,
    75,
  );

  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: manager, isSigner: true, isWritable: false },
      { pubkey: vaultConfig, isSigner: false, isWritable: false },
      { pubkey: plan.sessionPda, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function buildCommitPrivateIntentSessionIx(
  manager: PublicKey,
  plan: MagicBlockPrivateIntentPlan,
): TransactionInstruction {
  return buildMagicBlockCommitIx(DISC_COMMIT_PRIVATE_INTENT_SESSION, manager, plan);
}

export function buildUndelegatePrivateIntentSessionIx(
  manager: PublicKey,
  plan: MagicBlockPrivateIntentPlan,
): TransactionInstruction {
  return buildMagicBlockCommitIx(DISC_UNDELEGATE_PRIVATE_INTENT_SESSION, manager, plan);
}

export function explorerTxUrl(signature: string, cluster = "devnet"): string {
  return `https://explorer.solana.com/tx/${signature}?cluster=${cluster}`;
}

export async function readOwnerProof(connection: Connection, pubkey: PublicKey): Promise<string | null> {
  const account = await connection.getAccountInfo(pubkey, "confirmed");
  return account?.owner.toBase58() ?? null;
}

function buildMagicBlockCommitIx(
  discriminator: number,
  manager: PublicKey,
  plan: MagicBlockPrivateIntentPlan,
): TransactionInstruction {
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: manager, isSigner: true, isWritable: true },
      { pubkey: plan.sessionPda, isSigner: false, isWritable: true },
      { pubkey: MAGICBLOCK_MAGIC_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: MAGICBLOCK_MAGIC_CONTEXT_ID, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: plan.permissionPda, isSigner: false, isWritable: true },
      { pubkey: MAGICBLOCK_PERMISSION_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([discriminator]),
  });
}

function normalizeTeeAuthToken(authToken: unknown): string {
  if (typeof authToken === "string" && authToken.length > 0) return authToken;
  if (
    authToken &&
    typeof authToken === "object" &&
    "token" in authToken &&
    typeof authToken.token === "string" &&
    authToken.token.length > 0
  ) {
    return authToken.token;
  }
  throw new Error("MagicBlock returned an empty TEE auth token.");
}

function withTeeAuthToken(teeRpcUrl: string, token: string): string {
  const separator = teeRpcUrl.includes("?") ? "&" : "?";
  return `${teeRpcUrl}${separator}token=${encodeURIComponent(token)}`;
}

async function sha256Json(value: unknown): Promise<Buffer> {
  return sha256Buffer(Buffer.from(JSON.stringify(value)));
}

async function sha256Buffer(value: Buffer): Promise<Buffer> {
  const bytes = new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer);
  return Buffer.from(digest);
}

function cryptoRandomBytes(length: number): Buffer {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes);
}

function u64Buffer(value: bigint): Buffer {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64LE(value);
  return buffer;
}

function amountBand(amountUsdcUnits: bigint): string {
  const usdc = Number(amountUsdcUnits / 1_000_000n);
  if (usdc >= 100_000) return "100k+ USDC";
  if (usdc >= 10_000) return "10k-100k USDC";
  if (usdc >= 1_000) return "1k-10k USDC";
  return "<1k USDC";
}
