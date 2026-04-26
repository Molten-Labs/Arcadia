import { Connection, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";

// Account discriminators match the on-chain Rust structs
const MANAGER_PROFILE_DISC = 1;
const VAULT_CONFIG_DISC = 2;
const VAULT_STATE_DISC = 3;
const INVESTOR_POSITION_DISC = 4;

export interface ManagerProfileData {
  discriminator: number;
  bump: number;
  owner: PublicKey;
  createdAt: number;
  totalJuniorDeposited: bigint;
  totalVaults: number;
  activeVaults: number;
}

export interface VaultConfigData {
  discriminator: number;
  configBump: number;
  stateBump: number;
  treasuryBump: number;
  managerFeeBps: number;
  maxSlippageBps: number;
  manager: PublicKey;
  managerProfile: PublicKey;
  vaultState: PublicKey;
  treasury: PublicKey;
  paperWindowSecs: bigint;
  createdAt: bigint;
  treasuryRentLamports: bigint;
  vaultIndex: number;
  name: string;
}

export interface VaultStateData {
  discriminator: number;
  bump: number;
  isPaperMode: boolean;
  isGraduated: boolean;
  isPaused: boolean;
  tradingEnabled: boolean;
  vaultConfig: PublicKey;
  originalJuniorDeposit: bigint;
  juniorCapital: bigint;
  seniorCapital: bigint;
  juniorSharesOutstanding: bigint;
  seniorSharesOutstanding: bigint;
  currentNav: bigint;
  lastNav: bigint;
  highWaterMark: bigint;
  createdAt: bigint;
  lastNavUpdateAt: bigint;
  graduatedAt: bigint;
  cooldownUntil: bigint;
  paperTradeCount: number;
  minQualifyingTrades: number;
  rolling24hLossBps: number;
  rolling7dLossBps: number;
}

export interface InvestorPositionData {
  discriminator: number;
  bump: number;
  investor: PublicKey;
  vaultConfig: PublicKey;
  depositedAt: bigint;
  seniorShares: bigint;
  totalDeposited: bigint;
  alertThresholdBps: number;
}

function readPubkey(buf: Buffer, offset: number): PublicKey {
  return new PublicKey(buf.subarray(offset, offset + 32));
}

function readU64(buf: Buffer, offset: number): bigint {
  return buf.readBigUInt64LE(offset);
}

function readI64(buf: Buffer, offset: number): bigint {
  return buf.readBigInt64LE(offset);
}

export function decodeManagerProfile(data: Buffer): ManagerProfileData {
  return {
    discriminator: data[0],
    bump: data[1],
    owner: readPubkey(data, 8),
    createdAt: Number(readI64(data, 40)),
    totalJuniorDeposited: readU64(data, 48),
    totalVaults: data.readUInt16LE(56),
    activeVaults: data.readUInt16LE(58),
  };
}

export function decodeVaultConfig(data: Buffer): VaultConfigData {
  const nameBuf = data.subarray(168, 200);
  const nameEnd = nameBuf.indexOf(0);
  const name = nameBuf.subarray(0, nameEnd === -1 ? nameBuf.length : nameEnd).toString("utf8");

  return {
    discriminator: data[0],
    configBump: data[1],
    stateBump: data[2],
    treasuryBump: data[3],
    managerFeeBps: data.readUInt16LE(4),
    maxSlippageBps: data.readUInt16LE(6),
    manager: readPubkey(data, 8),
    managerProfile: readPubkey(data, 40),
    vaultState: readPubkey(data, 72),
    treasury: readPubkey(data, 104),
    paperWindowSecs: readI64(data, 136),
    createdAt: readI64(data, 144),
    treasuryRentLamports: readU64(data, 152),
    vaultIndex: data.readUInt16LE(160),
    name,
  };
}

export function decodeVaultState(data: Buffer): VaultStateData {
  return {
    discriminator: data[0],
    bump: data[1],
    isPaperMode: data[2] !== 0,
    isGraduated: data[3] !== 0,
    isPaused: data[4] !== 0,
    tradingEnabled: data[5] !== 0,
    vaultConfig: readPubkey(data, 8),
    originalJuniorDeposit: readU64(data, 40),
    juniorCapital: readU64(data, 48),
    seniorCapital: readU64(data, 56),
    juniorSharesOutstanding: readU64(data, 64),
    seniorSharesOutstanding: readU64(data, 72),
    currentNav: readU64(data, 80),
    lastNav: readU64(data, 88),
    highWaterMark: readU64(data, 96),
    createdAt: readI64(data, 104),
    lastNavUpdateAt: readI64(data, 112),
    graduatedAt: readI64(data, 120),
    cooldownUntil: readI64(data, 128),
    paperTradeCount: data.readUInt16LE(136),
    minQualifyingTrades: data.readUInt16LE(138),
    rolling24hLossBps: data.readUInt16LE(140),
    rolling7dLossBps: data.readUInt16LE(142),
  };
}

export function decodeInvestorPosition(data: Buffer): InvestorPositionData {
  return {
    discriminator: data[0],
    bump: data[1],
    investor: readPubkey(data, 8),
    vaultConfig: readPubkey(data, 40),
    depositedAt: readI64(data, 72),
    seniorShares: readU64(data, 80),
    totalDeposited: readU64(data, 88),
    alertThresholdBps: data.readUInt16LE(96),
  };
}

export async function fetchAllVaults(connection: Connection) {
  const { PROGRAM_ID } = await import("./constants");
  const configAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: bs58.encode(Buffer.from([VAULT_CONFIG_DISC])) } }],
  });

  const stateAccounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: bs58.encode(Buffer.from([VAULT_STATE_DISC])) } }],
  });

  const configs = configAccounts.map((a) => ({
    pubkey: a.pubkey,
    data: decodeVaultConfig(Buffer.from(a.account.data)),
  }));

  const stateMap = new Map(
    stateAccounts.map((a) => [
      a.pubkey.toBase58(),
      decodeVaultState(Buffer.from(a.account.data)),
    ])
  );

  return configs.map((c) => ({
    configPubkey: c.pubkey,
    config: c.data,
    state: stateMap.get(c.data.vaultState.toBase58()) ?? null,
  }));
}

export async function fetchAllManagers(connection: Connection) {
  const { PROGRAM_ID } = await import("./constants");
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [{ memcmp: { offset: 0, bytes: bs58.encode(Buffer.from([MANAGER_PROFILE_DISC])) } }],
  });

  return accounts.map((a) => ({
    pubkey: a.pubkey,
    data: decodeManagerProfile(Buffer.from(a.account.data)),
  }));
}
