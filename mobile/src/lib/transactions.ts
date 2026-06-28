import { Buffer } from 'buffer';
import {
  PublicKey,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';
import {
  PROGRAM_ID,
  PYTH_SOL_USD_ACCOUNT,
  PYTH_USDC_USD_ACCOUNT,
  SOL_MINT,
  TOKEN_PROGRAM_ID,
  USDC_MINT,
} from './constants';
import {
  getAssociatedTokenAddress,
  getCustodyAccounts,
  getInvestorPositionPDA,
  getManagerProfilePDA,
  getTreasuryPDA,
  getVaultConfigPDA,
  getVaultStatePDA,
} from './pdas';

export type JupiterRoute = 'UsdcToSol' | 'SolToUsdc';

export interface JupiterAccountMeta {
  pubkey: PublicKey;
  isSigner: boolean;
  isWritable: boolean;
}

export interface ExecuteJupiterSwapParams {
  route: JupiterRoute;
  inAmount: bigint;
  minimumAmountOut: bigint;
  maxSlippageBps: number;
  quoteExpiryUnix: bigint;
  jupiterProgram: PublicKey;
  tokenProgram: PublicKey;
  sourceTokenAccount: PublicKey;
  destinationTokenAccount: PublicKey;
  solPriceAccount: PublicKey;
  usdcPriceAccount: PublicKey;
  jupiterInstructionData: Buffer;
  jupiterAccounts: JupiterAccountMeta[];
}

export function buildArcadiaInstruction(
  discriminator: number,
  keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[],
  data?: Buffer,
): TransactionInstruction {
  const disc = Buffer.alloc(1);
  disc[0] = discriminator;
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: data ? Buffer.concat([disc, data]) : disc,
  });
}

export function requirePythAccounts() {
  if (!PYTH_SOL_USD_ACCOUNT || !PYTH_USDC_USD_ACCOUNT) {
    throw new Error('Pyth SOL/USD and USDC/USD accounts are not configured');
  }
  return { solPrice: PYTH_SOL_USD_ACCOUNT, usdcPrice: PYTH_USDC_USD_ACCOUNT };
}

function u64Data(amount: bigint): Buffer {
  const data = Buffer.alloc(8);
  data.writeBigUInt64LE(amount, 0);
  return data;
}

export function buildInitManagerIx(manager: PublicKey): TransactionInstruction {
  const [profilePda] = getManagerProfilePDA(manager);
  return buildArcadiaInstruction(0, [
    { pubkey: manager, isSigner: true, isWritable: true },
    { pubkey: profilePda, isSigner: false, isWritable: true },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ]);
}

export function buildCreateVaultIx(
  manager: PublicKey,
  params: {
    name: string;
    feeBps: number;
    maxSlippageBps: number;
    paperWindowSecs: number;
    minQualifyingTrades?: number;
    vaultIndex?: number;
  },
): TransactionInstruction {
  const [profilePda] = getManagerProfilePDA(manager);
  const [configPda] = getVaultConfigPDA(manager, params.vaultIndex ?? 0);
  const [statePda] = getVaultStatePDA(configPda);
  const [treasuryPda] = getTreasuryPDA(configPda);

  const data = Buffer.alloc(48);
  let o = 0;
  data.writeBigInt64LE(BigInt(params.paperWindowSecs), o); o += 8;
  data.writeUInt16LE(params.minQualifyingTrades ?? 10, o); o += 2;
  data.writeUInt16LE(params.maxSlippageBps, o); o += 2;
  data.writeUInt16LE(params.feeBps, o); o += 2;
  data.writeUInt16LE(0, o); o += 2;
  Buffer.from(params.name, 'utf8').subarray(0, 32).copy(data, o);

  return buildArcadiaInstruction(1, [
    { pubkey: manager, isSigner: true, isWritable: true },
    { pubkey: profilePda, isSigner: false, isWritable: true },
    { pubkey: configPda, isSigner: false, isWritable: true },
    { pubkey: statePda, isSigner: false, isWritable: true },
    { pubkey: treasuryPda, isSigner: false, isWritable: true },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ], data);
}

export function buildDepositJuniorIx(manager: PublicKey, vaultConfig: PublicKey, usdcUnits: bigint): TransactionInstruction {
  const [profilePda] = getManagerProfilePDA(manager);
  const [statePda] = getVaultStatePDA(vaultConfig);
  const [treasuryPda] = getTreasuryPDA(vaultConfig);
  const { vaultUsdc } = getCustodyAccounts(treasuryPda, SOL_MINT, USDC_MINT);
  const managerUsdc = getAssociatedTokenAddress(manager, USDC_MINT);

  return buildArcadiaInstruction(2, [
    { pubkey: manager, isSigner: true, isWritable: true },
    { pubkey: profilePda, isSigner: false, isWritable: true },
    { pubkey: vaultConfig, isSigner: false, isWritable: false },
    { pubkey: statePda, isSigner: false, isWritable: true },
    { pubkey: treasuryPda, isSigner: false, isWritable: false },
    { pubkey: managerUsdc, isSigner: false, isWritable: true },
    { pubkey: vaultUsdc, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ], u64Data(usdcUnits));
}

export function buildDepositSeniorIx(investor: PublicKey, vaultConfig: PublicKey, usdcUnits: bigint): TransactionInstruction {
  const [statePda] = getVaultStatePDA(vaultConfig);
  const [treasuryPda] = getTreasuryPDA(vaultConfig);
  const [positionPda] = getInvestorPositionPDA(investor, vaultConfig);
  const { vaultUsdc } = getCustodyAccounts(treasuryPda, SOL_MINT, USDC_MINT);
  const investorUsdc = getAssociatedTokenAddress(investor, USDC_MINT);

  return buildArcadiaInstruction(5, [
    { pubkey: investor, isSigner: true, isWritable: true },
    { pubkey: vaultConfig, isSigner: false, isWritable: false },
    { pubkey: statePda, isSigner: false, isWritable: true },
    { pubkey: treasuryPda, isSigner: false, isWritable: false },
    { pubkey: positionPda, isSigner: false, isWritable: true },
    { pubkey: investorUsdc, isSigner: false, isWritable: true },
    { pubkey: vaultUsdc, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ], u64Data(usdcUnits));
}

export function buildWithdrawSeniorIx(investor: PublicKey, vaultConfig: PublicKey, amountUsdcUnits: bigint): TransactionInstruction {
  const { solPrice, usdcPrice } = requirePythAccounts();
  const [statePda] = getVaultStatePDA(vaultConfig);
  const [treasuryPda] = getTreasuryPDA(vaultConfig);
  const [positionPda] = getInvestorPositionPDA(investor, vaultConfig);
  const { vaultUsdc, vaultWsol } = getCustodyAccounts(treasuryPda, SOL_MINT, USDC_MINT);
  const investorUsdc = getAssociatedTokenAddress(investor, USDC_MINT);

  return buildArcadiaInstruction(6, [
    { pubkey: investor, isSigner: true, isWritable: true },
    { pubkey: vaultConfig, isSigner: false, isWritable: false },
    { pubkey: statePda, isSigner: false, isWritable: true },
    { pubkey: treasuryPda, isSigner: false, isWritable: false },
    { pubkey: positionPda, isSigner: false, isWritable: true },
    { pubkey: vaultUsdc, isSigner: false, isWritable: true },
    { pubkey: vaultWsol, isSigner: false, isWritable: true },
    { pubkey: investorUsdc, isSigner: false, isWritable: true },
    { pubkey: solPrice, isSigner: false, isWritable: false },
    { pubkey: usdcPrice, isSigner: false, isWritable: false },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
  ], u64Data(amountUsdcUnits));
}

export function buildWithdrawJuniorIx(manager: PublicKey, vaultConfig: PublicKey, amountUsdcUnits: bigint): TransactionInstruction {
  const [profilePda] = getManagerProfilePDA(manager);
  const [statePda] = getVaultStatePDA(vaultConfig);
  const [treasuryPda] = getTreasuryPDA(vaultConfig);
  const { vaultUsdc } = getCustodyAccounts(treasuryPda, SOL_MINT, USDC_MINT);
  const managerUsdc = getAssociatedTokenAddress(manager, USDC_MINT);

  return buildArcadiaInstruction(7, [
    { pubkey: manager, isSigner: true, isWritable: true },
    { pubkey: profilePda, isSigner: false, isWritable: true },
    { pubkey: vaultConfig, isSigner: false, isWritable: false },
    { pubkey: statePda, isSigner: false, isWritable: true },
    { pubkey: treasuryPda, isSigner: false, isWritable: false },
    { pubkey: vaultUsdc, isSigner: false, isWritable: true },
    { pubkey: managerUsdc, isSigner: false, isWritable: true },
    { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
  ], u64Data(amountUsdcUnits));
}

export function buildUpdateNavIx(caller: PublicKey, vaultConfig: PublicKey): TransactionInstruction {
  const [statePda] = getVaultStatePDA(vaultConfig);
  const [treasuryPda] = getTreasuryPDA(vaultConfig);
  return buildArcadiaInstruction(3, [
    { pubkey: caller, isSigner: true, isWritable: false },
    { pubkey: vaultConfig, isSigner: false, isWritable: false },
    { pubkey: statePda, isSigner: false, isWritable: true },
    { pubkey: treasuryPda, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
  ], Buffer.from([0]));
}

export function buildGraduateVaultIx(caller: PublicKey, vaultConfig: PublicKey, manager: PublicKey): TransactionInstruction {
  const [profilePda] = getManagerProfilePDA(manager);
  const [statePda] = getVaultStatePDA(vaultConfig);
  const [treasuryPda] = getTreasuryPDA(vaultConfig);
  return buildArcadiaInstruction(4, [
    { pubkey: caller, isSigner: true, isWritable: false },
    { pubkey: statePda, isSigner: false, isWritable: true },
    { pubkey: vaultConfig, isSigner: false, isWritable: false },
    { pubkey: treasuryPda, isSigner: false, isWritable: false },
    { pubkey: profilePda, isSigner: false, isWritable: true },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
  ]);
}

export function buildClaimFeesIx(manager: PublicKey, vaultConfig: PublicKey): TransactionInstruction {
  const [profilePda] = getManagerProfilePDA(manager);
  const [statePda] = getVaultStatePDA(vaultConfig);
  const [treasuryPda] = getTreasuryPDA(vaultConfig);
  return buildArcadiaInstruction(8, [
    { pubkey: manager, isSigner: true, isWritable: true },
    { pubkey: profilePda, isSigner: false, isWritable: false },
    { pubkey: vaultConfig, isSigner: false, isWritable: false },
    { pubkey: statePda, isSigner: false, isWritable: true },
    { pubkey: treasuryPda, isSigner: false, isWritable: true },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
  ]);
}

export function buildExecuteGuardedSwapIx(
  manager: PublicKey,
  vaultConfig: PublicKey,
  inAmount: bigint,
  minimumAmountOut: bigint,
): TransactionInstruction {
  const [profilePda] = getManagerProfilePDA(manager);
  const [statePda] = getVaultStatePDA(vaultConfig);
  const [treasuryPda] = getTreasuryPDA(vaultConfig);
  const data = Buffer.alloc(16);
  data.writeBigUInt64LE(inAmount, 0);
  data.writeBigUInt64LE(minimumAmountOut, 8);
  return buildArcadiaInstruction(9, [
    { pubkey: manager, isSigner: true, isWritable: false },
    { pubkey: profilePda, isSigner: false, isWritable: false },
    { pubkey: vaultConfig, isSigner: false, isWritable: false },
    { pubkey: statePda, isSigner: false, isWritable: true },
    { pubkey: treasuryPda, isSigner: false, isWritable: true },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
  ], data);
}

export function buildExecuteJupiterSwapIx(
  manager: PublicKey,
  vaultConfig: PublicKey,
  params: ExecuteJupiterSwapParams,
): TransactionInstruction {
  const [profilePda] = getManagerProfilePDA(manager);
  const [statePda] = getVaultStatePDA(vaultConfig);
  const [treasuryPda] = getTreasuryPDA(vaultConfig);
  const data = Buffer.alloc(32 + params.jupiterInstructionData.length);
  data.writeUInt8(params.route === 'UsdcToSol' ? 2 : 1, 0);
  data.writeUInt8(0, 1);
  data.writeUInt16LE(params.maxSlippageBps, 2);
  data.writeUInt32LE(0, 4);
  data.writeBigUInt64LE(params.inAmount, 8);
  data.writeBigUInt64LE(params.minimumAmountOut, 16);
  data.writeBigInt64LE(BigInt(params.quoteExpiryUnix), 24);
  params.jupiterInstructionData.copy(data, 32);

  return buildArcadiaInstruction(9, [
    { pubkey: manager, isSigner: true, isWritable: false },
    { pubkey: profilePda, isSigner: false, isWritable: false },
    { pubkey: vaultConfig, isSigner: false, isWritable: false },
    { pubkey: statePda, isSigner: false, isWritable: true },
    { pubkey: treasuryPda, isSigner: false, isWritable: true },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: params.jupiterProgram, isSigner: false, isWritable: false },
    { pubkey: params.tokenProgram, isSigner: false, isWritable: false },
    { pubkey: params.sourceTokenAccount, isSigner: false, isWritable: true },
    { pubkey: params.destinationTokenAccount, isSigner: false, isWritable: true },
    { pubkey: params.solPriceAccount, isSigner: false, isWritable: false },
    { pubkey: params.usdcPriceAccount, isSigner: false, isWritable: false },
    ...params.jupiterAccounts,
  ], data);
}
