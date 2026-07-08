/**
 * Arcadia Protocol — TypeScript client SDK
 *
 * Uses @coral-xyz/anchor to interact with the deployed Arcadia Vault program.
 * Falls back gracefully when the wallet is not connected.
 *
 * Seeds (mirrors constants.rs):
 *   PLATFORM  = b"platform"
 *   PROFILE   = b"profile"
 *   INVESTOR  = b"investor"
 *   POSITION  = b"position"
 */
import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { IDL } from "./arcadia-idl";

export const PROGRAM_ID = new PublicKey("gTHauBMdJHs45tc8tjCKL7MejvBECQHgD184io3hx1C");

export const HELIUS_RPC =
  process.env.NEXT_PUBLIC_HELIUS_RPC ?? "https://api.devnet.solana.com";

export function getConnection(): Connection {
  return new Connection(HELIUS_RPC, "confirmed");
}

// ── PDA helpers ──────────────────────────────────────────────────────────────

export function findPlatformConfig(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("platform")],
    PROGRAM_ID,
  );
}

export function findTraderProfile(trader: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), trader.toBuffer()],
    PROGRAM_ID,
  );
}

export function findInvestorAccount(wallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("investor"), wallet.toBuffer()],
    PROGRAM_ID,
  );
}

export function findInvestorPosition(
  owner: PublicKey,
  profile: PublicKey,
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), owner.toBuffer(), profile.toBuffer()],
    PROGRAM_ID,
  );
}

// ── On-chain account reads ───────────────────────────────────────────────────

export interface TraderProfileData {
  trader: PublicKey;
  baseMint: PublicKey;
  vaultToken: PublicKey;
  totalShares: bigint;
  traderShares: bigint;
  hwmPerShare: bigint;
  capacityCapUsd: bigint;
  traderClaimable: bigint;
  lastSettleTs: bigint;
  createdAt: bigint;
  status: number;
  scoreTier: number;
  maxLeverage: number;
  bump: number;
}

export interface InvestorAccountData {
  owner: PublicKey;
  positionCount: number;
  totalDepositedUsd: bigint;
  createdAt: bigint;
  bump: number;
}

export interface InvestorPositionData {
  owner: PublicKey;
  profile: PublicKey;
  shares: bigint;
  costBasisUsd: bigint;
  pendingWithdrawShares: bigint;
  withdrawReadyTs: bigint;
  depositedAt: bigint;
  bump: number;
}

/**
 * Fetch a TraderProfile on-chain account.
 * Returns null if the account doesn't exist yet.
 */
export async function fetchTraderProfile(
  connection: Connection,
  trader: PublicKey,
): Promise<TraderProfileData | null> {
  const [profilePda] = findTraderProfile(trader);
  const info = await connection.getAccountInfo(profilePda);
  if (!info) return null;
  return decodeTraderProfile(info.data);
}

/**
 * Fetch an InvestorAccount on-chain account.
 */
export async function fetchInvestorAccount(
  connection: Connection,
  wallet: PublicKey,
): Promise<InvestorAccountData | null> {
  const [accountPda] = findInvestorAccount(wallet);
  const info = await connection.getAccountInfo(accountPda);
  if (!info) return null;
  return decodeInvestorAccount(info.data);
}

/**
 * Fetch an InvestorPosition on-chain account.
 */
export async function fetchInvestorPosition(
  connection: Connection,
  owner: PublicKey,
  profile: PublicKey,
): Promise<InvestorPositionData | null> {
  const [positionPda] = findInvestorPosition(owner, profile);
  const info = await connection.getAccountInfo(positionPda);
  if (!info) return null;
  return decodeInvestorPosition(info.data);
}

// ── Binary decoders (Anchor borsh layout, skip 8-byte discriminator) ─────────

function readPubkey(buf: Buffer, offset: number): [PublicKey, number] {
  const pk = new PublicKey(buf.subarray(offset, offset + 32));
  return [pk, offset + 32];
}

function readU8(buf: Buffer, offset: number): [number, number] {
  return [buf.readUInt8(offset), offset + 1];
}

function readU16(buf: Buffer, offset: number): [number, number] {
  return [buf.readUInt16LE(offset), offset + 2];
}

function readU32(buf: Buffer, offset: number): [number, number] {
  return [buf.readUInt32LE(offset), offset + 4];
}

function readU64(buf: Buffer, offset: number): [bigint, number] {
  const lo = BigInt(buf.readUInt32LE(offset));
  const hi = BigInt(buf.readUInt32LE(offset + 4));
  return [(hi << 32n) | lo, offset + 8];
}

function readI64(buf: Buffer, offset: number): [bigint, number] {
  const lo = BigInt(buf.readUInt32LE(offset));
  const hi = BigInt(buf.readInt32LE(offset + 4));
  return [(hi << 32n) | lo, offset + 8];
}

function decodeTraderProfile(data: Buffer): TraderProfileData {
  let o = 8; // skip discriminator
  let trader: PublicKey, baseMint: PublicKey, vaultToken: PublicKey;
  [trader, o] = readPubkey(data, o);
  [baseMint, o] = readPubkey(data, o);
  [vaultToken, o] = readPubkey(data, o);
  let totalShares: bigint, traderShares: bigint, hwmPerShare: bigint,
      capacityCapUsd: bigint, traderClaimable: bigint;
  let lastSettleTs: bigint, createdAt: bigint;
  [totalShares, o] = readU64(data, o);
  [traderShares, o] = readU64(data, o);
  [hwmPerShare, o] = readU64(data, o);
  [capacityCapUsd, o] = readU64(data, o);
  [traderClaimable, o] = readU64(data, o);
  [lastSettleTs, o] = readI64(data, o);
  [createdAt, o] = readI64(data, o);
  let status: number, scoreTier: number, maxLeverage: number, bump: number;
  [status, o] = readU8(data, o);
  [scoreTier, o] = readU8(data, o);
  [maxLeverage, o] = readU8(data, o);
  [bump] = readU8(data, o);
  return { trader, baseMint, vaultToken, totalShares, traderShares, hwmPerShare,
           capacityCapUsd, traderClaimable, lastSettleTs, createdAt,
           status, scoreTier, maxLeverage, bump };
}

function decodeInvestorAccount(data: Buffer): InvestorAccountData {
  let o = 8;
  let owner: PublicKey;
  let positionCount: number;
  let totalDepositedUsd: bigint, createdAt: bigint, bump: number;
  [owner, o] = readPubkey(data, o);
  [positionCount, o] = readU32(data, o);
  [totalDepositedUsd, o] = readU64(data, o);
  [createdAt, o] = readI64(data, o);
  [bump] = readU8(data, o);
  return { owner, positionCount, totalDepositedUsd, createdAt, bump };
}

function decodeInvestorPosition(data: Buffer): InvestorPositionData {
  let o = 8;
  let owner: PublicKey, profile: PublicKey;
  let shares: bigint, costBasisUsd: bigint, pendingWithdrawShares: bigint,
      withdrawReadyTs: bigint, depositedAt: bigint;
  let bump: number;
  [owner, o] = readPubkey(data, o);
  [profile, o] = readPubkey(data, o);
  [shares, o] = readU64(data, o);
  [costBasisUsd, o] = readU64(data, o);
  [pendingWithdrawShares, o] = readU64(data, o);
  [withdrawReadyTs, o] = readI64(data, o);
  [depositedAt, o] = readI64(data, o);
  [bump] = readU8(data, o);
  return { owner, profile, shares, costBasisUsd, pendingWithdrawShares,
           withdrawReadyTs, depositedAt, bump };
}

// ── Utility helpers ──────────────────────────────────────────────────────────

/** Convert raw USDC u64 (6 decimals) to a human-readable number. */
export function usdcToUsd(raw: bigint): number {
  return Number(raw) / 1_000_000;
}

/** Convert share amount (scaled by SHARE_SCALE = 1_000_000) to human-readable. */
export function sharesToHuman(raw: bigint): number {
  return Number(raw) / 1_000_000;
}

/** NAV per share: both raw values use 1_000_000 scale. Returns multiplier (e.g. 1.18). */
export function navPerShareToMultiplier(hwmPerShare: bigint): number {
  return Number(hwmPerShare) / 1_000_000;
}

export { IDL };
