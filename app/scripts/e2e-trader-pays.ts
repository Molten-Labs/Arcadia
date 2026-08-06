/**
 * E2E: trader-pays Flash execution on devnet, from the perspective of a normal
 * user. The "identity wallet" here is a plain Keypair standing in for the Privy
 * embedded wallet (Privy itself cannot run headlessly).
 *
 *  1. Identity gets devnet SOL (airdrop) + devnet USDC (Credix faucet mint).
 *  2. The execution wallet is DERIVED from the identity (arcadia-flash-v1).
 *  3. Base chain (setup + deposit) is sent in ONE identity-signed transaction.
 *  4. Open/close run on the MagicBlock ER, signed by the execution keypair.
 *
 * Assertions we care about:
 *  - The execution wallet is never funded: SOL stays 0 (MagicBlock sponsors ER,
 *    the identity pays base fees + rent).
 *  - The identity's SOL drops (base fees + rent) and USDC drops (deposit).
 *
 * Run from app/:  npx tsx scripts/e2e-trader-pays.ts
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import bs58 from "bs58";
import { BN } from "@coral-xyz/anchor";
import { sign as naclSign } from "tweetnacl";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  closeFlashTradePositionV2,
  createFlashTradeExecutionClient,
  openFlashTradePosition,
  resolveFlashTradeMarket,
  waitForFlashTradePositionSnapshot,
} from "../lib/flashtrade/v2";
import {
  deriveExecutionKeypair,
  keypairIdentitySigner,
  traderSetupAndDeposit,
} from "../lib/flashtrade/trader-pays";

const RPC = "https://api.devnet.solana.com";
const FAUCET_PROGRAM_ID = new PublicKey("4sN8PnN2ki2W4TFXAfzR645FWs8nimmsYeNtxM8RBK6A");
const USDC_MINT = new PublicKey("Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr");
const USDC_DECIMALS = 1_000_000n;
const DISCRIMINATOR = createHash("sha256").update("global:airdrop").digest().subarray(0, 8);
const ARCADIA_FLASH_DOMAIN = new TextEncoder().encode("arcadia-flash-v1");

async function airdropSol(connection: Connection, pubkey: PublicKey, lamports: number) {
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    try {
      const sig = await connection.requestAirdrop(pubkey, lamports);
      await connection.confirmTransaction(sig, "confirmed");
      return sig;
    } catch (err) {
      if (attempt === 5) throw err;
      console.log(`  ⚠ airdrop attempt ${attempt} failed, retrying…`);
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
  }
  throw new Error("unreachable");
}

/**
 * Devnet SOL source for the test identity. Public airdrop faucets are often
 * exhausted, so prefer transferring from a funded devnet wallet (defaults to
 * the repo admin keypair) and only fall back to requestAirdrop when none is set.
 */
async function fundSol(
  connection: Connection,
  dest: PublicKey,
  lamports: number,
): Promise<string> {
  const funder = loadFunderKeypair();
  if (funder) {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: funder.publicKey,
        toPubkey: dest,
        lamports,
      }),
    );
    tx.feePayer = funder.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    const sig = await connection.sendTransaction(tx, [funder]);
    await connection.confirmTransaction(sig, "confirmed");
    return sig;
  }
  return airdropSol(connection, dest, lamports);
}

function loadFunderKeypair(): Keypair | null {
  const configured = process.env.FUND_KEYPAIR_PATH;
  const candidates = configured
    ? [configured]
    : [
        "/home/abduo/.config/solana/id.json",
        path.join(os.homedir(), ".config/solana/id.json"),
      ];
  for (const file of candidates) {
    try {
      if (!fs.existsSync(file)) continue;
      const json = JSON.parse(fs.readFileSync(file, "utf8"));
      if (Array.isArray(json) && json.length === 64) {
        return Keypair.fromSecretKey(Uint8Array.from(json));
      }
    } catch {
      // try the next candidate
    }
  }
  return null;
}

async function mintDevnetUsdc(
  connection: Connection,
  identity: Keypair,
  amountRaw: bigint,
) {
  const destination = getAssociatedTokenAddressSync(USDC_MINT, identity.publicKey);
  const bump = 255;
  const amountBuf = Buffer.alloc(8);
  amountBuf.writeBigUInt64LE(amountRaw);
  const data = Buffer.concat([DISCRIMINATOR, Buffer.from([bump]), amountBuf]);

  const ix = new TransactionInstruction({
    programId: FAUCET_PROGRAM_ID,
    keys: [
      { pubkey: USDC_MINT, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: identity.publicKey, isSigner: true, isWritable: true },
      { pubkey: identity.publicKey, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = identity.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  const sig = await connection.sendTransaction(tx, [identity]);
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

async function usdcBalance(connection: Connection, owner: PublicKey): Promise<bigint> {
  const ata = getAssociatedTokenAddressSync(USDC_MINT, owner);
  const info = await connection.getAccountInfo(ata).catch(() => null);
  if (!info) return 0n;
  const balance = await connection.getTokenAccountBalance(ata).catch(() => null);
  return balance ? BigInt(balance.value.amount) : 0n;
}

async function main() {
  const args = process.argv.slice(2);
  const amountUsd = Number(args[0] ?? "100");
  const symbol = args[1] ?? "SOL";
  const direction = (args[2] ?? "long") as "long" | "short";

  const connection = new Connection(RPC, "confirmed");
  const identity = Keypair.generate();
  console.log(`Identity (simulated Privy wallet): ${identity.publicKey.toBase58()}`);
  console.log(`   secret (base58): ${bs58.encode(identity.secretKey)}`);
  console.log(`Market: ${symbol} ${direction} | amount: ${amountUsd} USDC | RPC: ${RPC}`);

  console.log("\n[1/5] Funding identity…");
  await fundSol(connection, identity.publicKey, LAMPORTS_PER_SOL);
  const idSolBefore = await connection.getBalance(identity.publicKey);
  console.log(`   identity SOL: ${(idSolBefore / LAMPORTS_PER_SOL).toFixed(4)}`);

  const usdcBefore = await usdcBalance(connection, identity.publicKey);
  console.log(`   identity USDC before: ${(usdcBefore / USDC_DECIMALS).toString()}`);
  const mintUsd = amountUsd + 100;
  await mintDevnetUsdc(connection, identity, BigInt(mintUsd) * USDC_DECIMALS);
  const usdcAfterMint = await usdcBalance(connection, identity.publicKey);
  console.log(`   identity USDC after mint: ${(usdcAfterMint / USDC_DECIMALS).toString()}`);

  console.log("\n[2/5] Deriving execution wallet from identity…");
  const signature = naclSign.detached(ARCADIA_FLASH_DOMAIN, identity.secretKey);
  const executionKeypair = deriveExecutionKeypair(signature);
  console.log(`   execution wallet: ${executionKeypair.publicKey.toBase58()} (never funded)`);
  const execSolBefore = await connection.getBalance(executionKeypair.publicKey);
  console.log(`   execution SOL: ${execSolBefore} (expected 0)`);

  const executionClient = createFlashTradeExecutionClient(
    executionKeypair.secretKey.slice(0, 32),
  );
  const resolvedMarket = resolveFlashTradeMarket({ targetSymbol: symbol, direction });
  const amount = new BN(amountUsd * 1_000_000);
  const identitySigner = keypairIdentitySigner(identity);

  console.log("\n[3/5] Base chain — setup + deposit in ONE identity-signed tx…");
  let t0 = Date.now();
  const base = await traderSetupAndDeposit({
    executionClient,
    resolvedMarket,
    amount,
    identitySigner,
  });
  console.log(
    `   base tx (${base.setupIxCount} setup ix + deposit) signed by identity: ${base.signature}`,
  );
  console.log(`   base confirm: ${((Date.now() - t0) / 1000).toFixed(2)}s`);
  const usdcAfterDeposit = await usdcBalance(connection, identity.publicKey);
  console.log(
    `   identity USDC after: ${(usdcAfterDeposit / USDC_DECIMALS).toString()} ` +
      `(deposited ${((usdcAfterMint - usdcAfterDeposit) / USDC_DECIMALS).toString()} USDC)`,
  );

  console.log("\n[4/5] Opening position on the MagicBlock ER…");
  t0 = Date.now();
  const open = await openFlashTradePosition({
    executionClient,
    resolvedMarket,
    collateralAmount: amount,
    leverage: 2,
    slippagePercentage: "0.5",
  });
  console.log(`   ER open: ${open.signature} (${((Date.now() - t0) / 1000).toFixed(2)}s)`);

  const snapshot = await waitForFlashTradePositionSnapshot({ executionClient, resolvedMarket });
  if (!snapshot) {
    throw new Error("position snapshot returned null after open");
  }
  console.log(
    `   position: ${snapshot.marketSymbol} ${snapshot.sideUi} | size ${snapshot.sizeUsdUi} USDC ` +
      `| entry ${snapshot.entryPriceUi} | lev ${snapshot.leverageUi}x | liq ${snapshot.liquidationPriceUi}`,
  );

  console.log("\n[5/5] Closing position on the MagicBlock ER…");
  t0 = Date.now();
  const close = await closeFlashTradePositionV2({ executionClient, resolvedMarket });
  console.log(`   ER close: ${close.signature} (${((Date.now() - t0) / 1000).toFixed(2)}s)`);

  const execSolAfter = await connection.getBalance(executionKeypair.publicKey);
  const idSolAfter = await connection.getBalance(identity.publicKey);
  console.log("\n── Summary ─────────────────────────────────────────────");
  console.log(`Execution wallet SOL: ${execSolAfter} (started ${execSolBefore}; expected 0 — never paid)`);
  console.log(
    `Identity SOL: ${(idSolAfter / LAMPORTS_PER_SOL).toFixed(6)} ` +
      `(spent ${((idSolBefore - idSolAfter) / LAMPORTS_PER_SOL).toFixed(6)} on fees + rent)`,
  );
  console.log("Trader-pays base (identity signed), sponsored ER open/close (execution signed).");
  console.log(`Explorer: https://explorer.solana.com/tx/${base.signature}?cluster=devnet`);
}

main().catch((err) => {
  console.error("\nE2E failed:", err.message);
  process.exit(1);
});
