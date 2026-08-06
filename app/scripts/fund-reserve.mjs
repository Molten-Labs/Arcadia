/**
 * One-time reserve seed for the devnet USDC faucet.
 *
 * Flash's devnet pool only accepts the spl-token-faucet USDC mint
 * (Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr) as collateral. That mint's
 * authority is a PDA owned by the Credix faucet program, so it can only be
 * minted by calling that program's `airdrop` instruction — exactly what this
 * script does. The minted USDC lands in the reserve wallet (FAUCET_KEYPAIR),
 * which the /api/v1/faucet endpoint then distributes to testers.
 *
 * Usage (from app/):
 *   FAUCET_KEYPAIR=<base58|json> node scripts/fund-reserve.mjs --amount 100000
 *
 *   --amount   whole USDC to mint into the reserve (default 100,000)
 *   --rpc      devnet RPC URL (default api.devnet.solana.com)
 */
import { createHash } from "node:crypto";
import bs58 from "bs58";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

const FAUCET_PROGRAM_ID = new PublicKey("4sN8PnN2ki2W4TFXAfzR645FWs8nimmsYeNtxM8RBK6A");
const USDC_MINT = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");

const DISCRIMINATOR = createHash("sha256").update("global:airdrop").digest().subarray(0, 8);

function parseAmount(argv) {
  const i = argv.indexOf("--amount");
  if (i !== -1 && argv[i + 1]) return Math.max(1, Math.floor(Number(argv[i + 1])));
  return 100_000;
}

function parseRpc(argv) {
  const i = argv.indexOf("--rpc");
  return i !== -1 && argv[i + 1] ? argv[i + 1] : "https://api.devnet.solana.com";
}

function loadReserve() {
  const raw = process.env.FAUCET_KEYPAIR?.trim();
  if (!raw) throw new Error("FAUCET_KEYPAIR env var is required (base58 or JSON secret key).");
  if (raw.startsWith("[")) return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  return Keypair.fromSecretKey(bs58.decode(raw));
}

async function ensureSol(connection, reserve, amountSol) {
  const lamports = await connection.getBalance(reserve.publicKey);
  if (lamports >= amountSol) return null;
  try {
    const sig = await connection.requestAirdrop(reserve.publicKey, amountSol - lamports);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  } catch {
    console.warn("⚠ requestAirdrop failed — ensure the reserve already holds SOL for fees.");
    return null;
  }
}

async function main() {
  const amountUsd = parseAmount(process.argv);
  const rpc = parseRpc(process.argv);
  const reserve = loadReserve();

  const connection = new Connection(rpc, "confirmed");
  const destination = getAssociatedTokenAddressSync(USDC_MINT, reserve.publicKey);
  const bump = 255;

  const amountRaw = BigInt(amountUsd) * 1_000_000n;
  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(amountRaw);

  const data = Buffer.concat([DISCRIMINATOR, Buffer.from([bump]), amountBuf]);

  const ix = new TransactionInstruction({
    programId: FAUCET_PROGRAM_ID,
    keys: [
      { pubkey: USDC_MINT, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: reserve.publicKey, isSigner: true, isWritable: true },
      { pubkey: reserve.publicKey, isSigner: false, isWritable: false }, // receiver
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });

  console.log("Reserve wallet :", reserve.publicKey.toBase58());
  console.log("Destination ATA:", destination.toBase58());
  console.log(`Minting        : ${amountUsd.toLocaleString()} USDC (${amountRaw.toString()} raw)`);
  console.log("RPC            :", rpc);

  await ensureSol(connection, reserve, 0.05 * LAMPORTS_PER_SOL);

  const tx = new Transaction().add(ix);
  tx.feePayer = reserve.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  const sig = await connection.sendTransaction(tx, [reserve], { skipPreflight: false });
  await connection.confirmTransaction(sig, "confirmed");

  const balance = await connection.getTokenAccountBalance(destination).catch(() => null);
  console.log("Transaction    :", sig);
  console.log(
    "Reserve USDC   :",
    balance ? Number(balance.value.uiAmount ?? 0).toLocaleString() : "?",
    "USDC",
  );
}

main().catch((err) => {
  console.error("fund-reserve failed:", err.message);
  process.exit(1);
});
