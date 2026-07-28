import { randomBytes } from "node:crypto";
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import nacl from "tweetnacl";

export function createExecutionWalletSeed(): Uint8Array {
  return randomBytes(32);
}

export function createExecutionWalletSignerFromSeed(
  seedBytes: Uint8Array,
): Keypair {
  const fullSecret = nacl.sign.keyPair.fromSeed(seedBytes).secretKey;
  // @ts-expect-error - exists in @solana/web3.js v1 runtime (v2 types shadowed)
  return Keypair.fromSecretKey(fullSecret);
}

export async function ensureExecutionWalletAta(
  connection: Connection,
  executionWalletAddress: PublicKey,
  mint: PublicKey,
  broadcaster: Keypair,
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, executionWalletAddress);
  const ataInfo = await connection.getAccountInfo(ata);
  if (ataInfo) return ata;

  const tx = new Transaction().add(
    createAssociatedTokenAccountInstruction(
      broadcaster.publicKey,
      ata,
      executionWalletAddress,
      mint,
    ),
  );
  tx.feePayer = broadcaster.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(broadcaster);
  await connection.sendTransaction(tx);
  return ata;
}

export async function getExecutionWalletTokenBalance(
  connection: Connection,
  ata: PublicKey,
): Promise<bigint> {
  try {
    const info = await getAccount(connection, ata);
    return info.amount;
  } catch {
    return 0n;
  }
}

export async function assertExecutionWalletHasGas(
  connection: Connection,
  address: PublicKey,
  minimumLamports: number = 5_000_000,
): Promise<void> {
  const balance = await connection.getBalance(address);
  if (balance < minimumLamports) {
    throw new Error(
      `Execution wallet ${address.toBase58()} has insufficient SOL (${balance} < ${minimumLamports})`,
    );
  }
}
