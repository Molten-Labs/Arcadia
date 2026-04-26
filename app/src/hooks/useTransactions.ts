import { useCallback } from "react";
import {
  Transaction,
  TransactionInstruction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { useWallet } from "@/lib/wallet";
import { PROGRAM_ID } from "@/lib/solana/constants";
import {
  getManagerProfilePDA,
  getVaultConfigPDA,
  getVaultStatePDA,
  getTreasuryPDA,
  getInvestorPositionPDA,
} from "@/lib/solana/pdas";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

function buildInstruction(
  discriminator: number,
  keys: { pubkey: PublicKey; isSigner: boolean; isWritable: boolean }[],
  data?: Buffer
): TransactionInstruction {
  const disc = Buffer.alloc(1);
  disc[0] = discriminator;
  const ixData = data ? Buffer.concat([disc, data]) : disc;
  return new TransactionInstruction({
    programId: PROGRAM_ID,
    keys,
    data: ixData,
  });
}

export function useKilnTransactions() {
  const { connection } = useWallet();
  const { publicKey, sendTransaction } = useSolanaWallet();
  const queryClient = useQueryClient();

  const send = useCallback(
    async (ix: TransactionInstruction, label: string) => {
      if (!connection || !publicKey) throw new Error("Wallet not connected");
      const tx = new Transaction().add(ix);
      tx.feePayer = publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      const sig = await sendTransaction(tx, connection);
      toast.info(`${label} submitted`, { description: sig.slice(0, 16) + "..." });

      const confirmation = await connection.confirmTransaction(sig, "confirmed");
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      queryClient.invalidateQueries({ queryKey: ["vaults"] });
      queryClient.invalidateQueries({ queryKey: ["managers"] });
      queryClient.invalidateQueries({ queryKey: ["positions"] });

      toast.success(`${label} confirmed`, { description: sig.slice(0, 16) + "..." });
      return sig;
    },
    [connection, publicKey, sendTransaction, queryClient]
  );

  const initManager = useCallback(async () => {
    if (!publicKey) throw new Error("Wallet not connected");
    const [profilePda] = getManagerProfilePDA(publicKey);
    const ix = buildInstruction(0, [
      { pubkey: publicKey, isSigner: true, isWritable: true },
      { pubkey: profilePda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ]);
    return send(ix, "Init Manager");
  }, [publicKey, send]);

  const createVault = useCallback(
    async (params: {
      name: string;
      feeBps: number;
      maxSlippageBps: number;
      paperWindowSecs: number;
      juniorDepositLamports: bigint;
    }) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const [profilePda] = getManagerProfilePDA(publicKey);

      // We need to know the vault index from the manager profile
      // For now, fetch the manager profile to get total_vaults
      if (!connection) throw new Error("No connection");
      const profileInfo = await connection.getAccountInfo(profilePda);
      let vaultIndex = 0;
      if (profileInfo) {
        vaultIndex = Buffer.from(profileInfo.data).readUInt16LE(56);
      }

      const [configPda] = getVaultConfigPDA(publicKey, vaultIndex);
      const [statePda] = getVaultStatePDA(configPda);
      const [treasuryPda] = getTreasuryPDA(configPda);

      const data = Buffer.alloc(2 + 2 + 8 + 8 + 32);
      let offset = 0;
      data.writeUInt16LE(params.feeBps, offset); offset += 2;
      data.writeUInt16LE(params.maxSlippageBps, offset); offset += 2;
      data.writeBigInt64LE(BigInt(params.paperWindowSecs), offset); offset += 8;
      data.writeBigUInt64LE(params.juniorDepositLamports, offset); offset += 8;
      const nameBytes = Buffer.from(params.name, "utf8").subarray(0, 32);
      nameBytes.copy(data, offset);

      const ix = buildInstruction(1, [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: profilePda, isSigner: false, isWritable: true },
        { pubkey: configPda, isSigner: false, isWritable: true },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ], data);
      return send(ix, "Create Vault");
    },
    [publicKey, connection, send]
  );

  const depositJunior = useCallback(
    async (vaultConfigPubkey: PublicKey, lamports: bigint) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const [profilePda] = getManagerProfilePDA(publicKey);
      const [statePda] = getVaultStatePDA(vaultConfigPubkey);
      const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);

      const data = Buffer.alloc(8);
      data.writeBigUInt64LE(lamports, 0);

      const ix = buildInstruction(2, [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: profilePda, isSigner: false, isWritable: true },
        { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ], data);
      return send(ix, "Deposit Junior");
    },
    [publicKey, send]
  );

  const depositSenior = useCallback(
    async (vaultConfigPubkey: PublicKey, lamports: bigint) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const [statePda] = getVaultStatePDA(vaultConfigPubkey);
      const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);
      const [positionPda] = getInvestorPositionPDA(publicKey, vaultConfigPubkey);

      const data = Buffer.alloc(8);
      data.writeBigUInt64LE(lamports, 0);

      const ix = buildInstruction(5, [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: true },
        { pubkey: positionPda, isSigner: false, isWritable: true },
        { pubkey: new PublicKey("SysvarRent111111111111111111111111"), isSigner: false, isWritable: false },
        { pubkey: new PublicKey("SysvarC1ock11111111111111111111111111111111"), isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ], data);
      return send(ix, "Deposit Senior");
    },
    [publicKey, send]
  );

  const withdrawSenior = useCallback(
    async (vaultConfigPubkey: PublicKey, sharesToBurn: bigint) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const [statePda] = getVaultStatePDA(vaultConfigPubkey);
      const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);
      const [positionPda] = getInvestorPositionPDA(publicKey, vaultConfigPubkey);

      const data = Buffer.alloc(8);
      data.writeBigUInt64LE(sharesToBurn, 0);

      const ix = buildInstruction(6, [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: true },
        { pubkey: positionPda, isSigner: false, isWritable: true },
        { pubkey: new PublicKey("SysvarC1ock11111111111111111111111111111111"), isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ], data);
      return send(ix, "Withdraw Senior");
    },
    [publicKey, send]
  );

  const withdrawJunior = useCallback(
    async (vaultConfigPubkey: PublicKey, lamports: bigint) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const [profilePda] = getManagerProfilePDA(publicKey);
      const [statePda] = getVaultStatePDA(vaultConfigPubkey);
      const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);

      const data = Buffer.alloc(8);
      data.writeBigUInt64LE(lamports, 0);

      const ix = buildInstruction(7, [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: profilePda, isSigner: false, isWritable: false },
        { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ], data);
      return send(ix, "Withdraw Junior");
    },
    [publicKey, send]
  );

  const claimFees = useCallback(
    async (vaultConfigPubkey: PublicKey) => {
      if (!publicKey) throw new Error("Wallet not connected");
      const [profilePda] = getManagerProfilePDA(publicKey);
      const [statePda] = getVaultStatePDA(vaultConfigPubkey);
      const [treasuryPda] = getTreasuryPDA(vaultConfigPubkey);

      const ix = buildInstruction(9, [
        { pubkey: publicKey, isSigner: true, isWritable: true },
        { pubkey: profilePda, isSigner: false, isWritable: false },
        { pubkey: vaultConfigPubkey, isSigner: false, isWritable: false },
        { pubkey: statePda, isSigner: false, isWritable: true },
        { pubkey: treasuryPda, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ]);
      return send(ix, "Claim Fees");
    },
    [publicKey, send]
  );

  return {
    initManager,
    createVault,
    depositJunior,
    depositSenior,
    withdrawSenior,
    withdrawJunior,
    claimFees,
  };
}
