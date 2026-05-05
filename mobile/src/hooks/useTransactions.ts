import { useCallback } from 'react';
import {
  Transaction,
  TransactionInstruction,
  SystemProgram,
  PublicKey,
  SYSVAR_RENT_PUBKEY,
  SYSVAR_CLOCK_PUBKEY,
} from '@solana/web3.js';
import { useQueryClient } from '@tanstack/react-query';
import { useWallet } from '../lib/wallet';
import { PROGRAM_ID, TOKEN_PROGRAM_ID, USDC_MINT, SOL_MINT } from '../lib/constants';
import {
  getManagerProfilePDA,
  getVaultConfigPDA,
  getVaultStatePDA,
  getTreasuryPDA,
  getInvestorPositionPDA,
  getAssociatedTokenAddress,
  getCustodyAccounts,
} from '../lib/pdas';

function buildIx(
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

export function useArcadiaTransactions() {
  const { connected, publicKey, connection, signAndSendTransaction, isDemoWallet } = useWallet();
  const queryClient = useQueryClient();

  const send = useCallback(
    async (ixs: TransactionInstruction[], label: string): Promise<{ sig: string; demo: boolean }> => {
      if (!connected || !publicKey) throw new Error('Wallet not connected');

      if (isDemoWallet) {
        await new Promise(r => setTimeout(r, 1800));
        queryClient.invalidateQueries({ queryKey: ['vaults'] });
        queryClient.invalidateQueries({ queryKey: ['positions'] });
        return { sig: 'DEMO_' + Math.random().toString(36).slice(2, 14).toUpperCase(), demo: true };
      }

      const tx = new Transaction().add(...ixs);
      tx.feePayer = new PublicKey(publicKey);
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sig = await signAndSendTransaction(tx);
      queryClient.invalidateQueries({ queryKey: ['vaults'] });
      queryClient.invalidateQueries({ queryKey: ['positions'] });
      queryClient.invalidateQueries({ queryKey: ['balance'] });
      return { sig, demo: false };
    },
    [connected, publicKey, connection, signAndSendTransaction, isDemoWallet, queryClient],
  );

  // Disc 0: InitManager
  const initManager = useCallback(async () => {
    if (!publicKey) throw new Error('No wallet');
    const pk = new PublicKey(publicKey);
    const [profilePda] = getManagerProfilePDA(pk);
    const ix = buildIx(0, [
      { pubkey: pk, isSigner: true, isWritable: true },
      { pubkey: profilePda, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ]);
    return send([ix], 'Init Manager');
  }, [publicKey, send]);

  // Disc 1: CreateVault (48-byte args)
  const createVault = useCallback(async (params: {
    name: string; feeBps: number; maxSlippageBps: number;
    paperWindowSecs: number; minQualifyingTrades?: number; vaultIndex?: number;
  }) => {
    if (!publicKey) throw new Error('No wallet');
    const pk = new PublicKey(publicKey);
    const [profilePda] = getManagerProfilePDA(pk);
    const idx = params.vaultIndex ?? 0;
    const [configPda] = getVaultConfigPDA(pk, idx);
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

    const ix = buildIx(1, [
      { pubkey: pk, isSigner: true, isWritable: true },
      { pubkey: profilePda, isSigner: false, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: statePda, isSigner: false, isWritable: true },
      { pubkey: treasuryPda, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ], data);
    return send([ix], 'Create Vault');
  }, [publicKey, send]);

  // Disc 2: DepositJunior (u64 amount)
  const depositJunior = useCallback(async (vaultConfigPubkey: PublicKey, usdcUnits: bigint) => {
    if (!publicKey) throw new Error('No wallet');
    const pk = new PublicKey(publicKey);
    const [profilePda] = getManagerProfilePDA(pk);
    const [statePda] = getVaultStatePDA(vaultConfigPubkey);
    const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);
    const { vaultUsdc } = getCustodyAccounts(treasuryPda, SOL_MINT, USDC_MINT);
    const managerUsdc = getAssociatedTokenAddress(pk, USDC_MINT);

    const data = Buffer.alloc(8);
    data.writeBigUInt64LE(usdcUnits, 0);
    const ix = buildIx(2, [
      { pubkey: pk, isSigner: true, isWritable: true },
      { pubkey: profilePda, isSigner: false, isWritable: true },
      { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
      { pubkey: statePda, isSigner: false, isWritable: true },
      { pubkey: treasuryPda, isSigner: false, isWritable: false },
      { pubkey: managerUsdc, isSigner: false, isWritable: true },
      { pubkey: vaultUsdc, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ], data);
    return send([ix], 'Deposit Junior');
  }, [publicKey, send]);

  // Disc 5: DepositSenior (u64 amount)
  const depositSenior = useCallback(async (vaultConfigPubkey: PublicKey, usdcUnits: bigint) => {
    if (!publicKey) throw new Error('No wallet');
    const pk = new PublicKey(publicKey);
    const [statePda] = getVaultStatePDA(vaultConfigPubkey);
    const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);
    const [positionPda] = getInvestorPositionPDA(pk, vaultConfigPubkey);
    const { vaultUsdc } = getCustodyAccounts(treasuryPda, SOL_MINT, USDC_MINT);
    const investorUsdc = getAssociatedTokenAddress(pk, USDC_MINT);

    const data = Buffer.alloc(8);
    data.writeBigUInt64LE(usdcUnits, 0);
    const ix = buildIx(5, [
      { pubkey: pk, isSigner: true, isWritable: true },
      { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
      { pubkey: statePda, isSigner: false, isWritable: true },
      { pubkey: treasuryPda, isSigner: false, isWritable: false },
      { pubkey: positionPda, isSigner: false, isWritable: true },
      { pubkey: investorUsdc, isSigner: false, isWritable: true },
      { pubkey: vaultUsdc, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ], data);
    return send([ix], 'Deposit Senior');
  }, [publicKey, send]);

  // Disc 6: WithdrawSenior (u64 amount)
  const withdrawSenior = useCallback(async (
    vaultConfigPubkey: PublicKey, amountUsdcUnits: bigint,
    solPriceAccount: PublicKey, usdcPriceAccount: PublicKey,
  ) => {
    if (!publicKey) throw new Error('No wallet');
    const pk = new PublicKey(publicKey);
    const [statePda] = getVaultStatePDA(vaultConfigPubkey);
    const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);
    const [positionPda] = getInvestorPositionPDA(pk, vaultConfigPubkey);
    const { vaultUsdc, vaultWsol } = getCustodyAccounts(treasuryPda, SOL_MINT, USDC_MINT);
    const investorUsdc = getAssociatedTokenAddress(pk, USDC_MINT);

    const data = Buffer.alloc(8);
    data.writeBigUInt64LE(amountUsdcUnits, 0);
    const ix = buildIx(6, [
      { pubkey: pk, isSigner: true, isWritable: true },
      { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
      { pubkey: statePda, isSigner: false, isWritable: true },
      { pubkey: treasuryPda, isSigner: false, isWritable: false },
      { pubkey: positionPda, isSigner: false, isWritable: true },
      { pubkey: vaultUsdc, isSigner: false, isWritable: true },
      { pubkey: vaultWsol, isSigner: false, isWritable: true },
      { pubkey: investorUsdc, isSigner: false, isWritable: true },
      { pubkey: solPriceAccount, isSigner: false, isWritable: false },
      { pubkey: usdcPriceAccount, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    ], data);
    return send([ix], 'Withdraw Senior');
  }, [publicKey, send]);

  // Disc 7: WithdrawJunior (u64 amount)
  const withdrawJunior = useCallback(async (vaultConfigPubkey: PublicKey, amountUsdcUnits: bigint) => {
    if (!publicKey) throw new Error('No wallet');
    const pk = new PublicKey(publicKey);
    const [profilePda] = getManagerProfilePDA(pk);
    const [statePda] = getVaultStatePDA(vaultConfigPubkey);
    const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);
    const { vaultUsdc } = getCustodyAccounts(treasuryPda, SOL_MINT, USDC_MINT);
    const managerUsdc = getAssociatedTokenAddress(pk, USDC_MINT);

    const data = Buffer.alloc(8);
    data.writeBigUInt64LE(amountUsdcUnits, 0);
    const ix = buildIx(7, [
      { pubkey: pk, isSigner: true, isWritable: true },
      { pubkey: profilePda, isSigner: false, isWritable: true },
      { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
      { pubkey: statePda, isSigner: false, isWritable: true },
      { pubkey: treasuryPda, isSigner: false, isWritable: false },
      { pubkey: vaultUsdc, isSigner: false, isWritable: true },
      { pubkey: managerUsdc, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    ], data);
    return send([ix], 'Withdraw Junior');
  }, [publicKey, send]);

  // Disc 4: GraduateVault
  const graduateVault = useCallback(async (vaultConfigPubkey: PublicKey, managerPubkey: PublicKey) => {
    if (!publicKey) throw new Error('No wallet');
    const pk = new PublicKey(publicKey);
    const [profilePda] = getManagerProfilePDA(managerPubkey);
    const [statePda] = getVaultStatePDA(vaultConfigPubkey);
    const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);
    const ix = buildIx(4, [
      { pubkey: pk, isSigner: true, isWritable: false },
      { pubkey: statePda, isSigner: false, isWritable: true },
      { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
      { pubkey: treasuryPda, isSigner: false, isWritable: false },
      { pubkey: profilePda, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    ]);
    return send([ix], 'Graduate Vault');
  }, [publicKey, send]);

  // Disc 8: ClaimFees
  const claimFees = useCallback(async (vaultConfigPubkey: PublicKey) => {
    if (!publicKey) throw new Error('No wallet');
    const pk = new PublicKey(publicKey);
    const [profilePda] = getManagerProfilePDA(pk);
    const [statePda] = getVaultStatePDA(vaultConfigPubkey);
    const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);
    const ix = buildIx(8, [
      { pubkey: pk, isSigner: true, isWritable: true },
      { pubkey: profilePda, isSigner: false, isWritable: false },
      { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
      { pubkey: statePda, isSigner: false, isWritable: true },
      { pubkey: treasuryPda, isSigner: false, isWritable: true },
      { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    ]);
    return send([ix], 'Claim Fees');
  }, [publicKey, send]);

  return { initManager, createVault, depositJunior, depositSenior, withdrawSenior, withdrawJunior, graduateVault, claimFees };
}
