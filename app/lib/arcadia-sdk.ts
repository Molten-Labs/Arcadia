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
import { Connection, PublicKey } from "@solana/web3.js";
import { IDL } from "./arcadia-idl";

export const PROGRAM_ID = new PublicKey("FPoAMRkM3kXfuvFn1iC2cM8B554KfnaPjibjLH31CHtd");

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

export interface PlatformConfigData {
  admin: PublicKey;
  oracleAuthority: PublicKey;
  treasuryToken: PublicKey;
  baseMint: PublicKey;
  perfFeeBps: number;
  mgmtFeeBps: number;
  bump: number;
}

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

/** Sequential borsh reader; starts past the 8-byte account discriminator. */
class AccountReader {
  private o: number;
  constructor(private readonly buf: Buffer, offset = 8) {
    this.o = offset;
  }
  pubkey(): PublicKey {
    const pk = new PublicKey(this.buf.subarray(this.o, this.o + 32));
    this.o += 32;
    return pk;
  }
  u8(): number {
    return this.buf.readUInt8(this.o++);
  }
  u16(): number {
    const v = this.buf.readUInt16LE(this.o);
    this.o += 2;
    return v;
  }
  u32(): number {
    const v = this.buf.readUInt32LE(this.o);
    this.o += 4;
    return v;
  }
  u64(): bigint {
    const lo = BigInt(this.buf.readUInt32LE(this.o));
    const hi = BigInt(this.buf.readUInt32LE(this.o + 4));
    this.o += 8;
    return (hi << 32n) | lo;
  }
  i64(): bigint {
    const lo = BigInt(this.buf.readUInt32LE(this.o));
    const hi = BigInt(this.buf.readInt32LE(this.o + 4));
    this.o += 8;
    return (hi << 32n) | lo;
  }
}

export function decodePlatformConfig(data: Buffer): PlatformConfigData {
  const r = new AccountReader(data);
  return {
    admin: r.pubkey(),
    oracleAuthority: r.pubkey(),
    treasuryToken: r.pubkey(),
    baseMint: r.pubkey(),
    perfFeeBps: r.u16(),
    mgmtFeeBps: r.u16(),
    bump: r.u8(),
  };
}

export function decodeTraderProfile(data: Buffer): TraderProfileData {
  const r = new AccountReader(data);
  return {
    trader: r.pubkey(),
    baseMint: r.pubkey(),
    vaultToken: r.pubkey(),
    totalShares: r.u64(),
    traderShares: r.u64(),
    hwmPerShare: r.u64(),
    capacityCapUsd: r.u64(),
    traderClaimable: r.u64(),
    lastSettleTs: r.i64(),
    createdAt: r.i64(),
    status: r.u8(),
    scoreTier: r.u8(),
    maxLeverage: r.u8(),
    bump: r.u8(),
  };
}

export function decodeInvestorAccount(data: Buffer): InvestorAccountData {
  const r = new AccountReader(data);
  return {
    owner: r.pubkey(),
    positionCount: r.u32(),
    totalDepositedUsd: r.u64(),
    createdAt: r.i64(),
    bump: r.u8(),
  };
}

export function decodeInvestorPosition(data: Buffer): InvestorPositionData {
  const r = new AccountReader(data);
  return {
    owner: r.pubkey(),
    profile: r.pubkey(),
    shares: r.u64(),
    costBasisUsd: r.u64(),
    pendingWithdrawShares: r.u64(),
    withdrawReadyTs: r.i64(),
    depositedAt: r.i64(),
    bump: r.u8(),
  };
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
