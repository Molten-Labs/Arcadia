/**
 * Arcadia — Execution Wallet Architecture Devnet Test
 *
 * Tests the full flow:
 *   1. Acquire devnet USDC
 *   2. Deposit USDC into vault
 *   3. Create execution wallet + ATA
 *   4. vault.fund_execution → execution wallet ATA
 *   5. FlashTrade: setup → deposit → open position → close position
 *   6. Sweep USDC back to vault
 *
 * Usage:
 *   RPC_URL="https://devnet.helius-rpc.com/?api-key=..." \
 *   npx tsx tests/devnet-execution-wallet.ts
 */

import { randomBytes } from "node:crypto";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount,
} from "@solana/spl-token";
import { AnchorProvider, Wallet, Program, BN } from "@coral-xyz/anchor";
import bs58 from "bs58";

import { ARCADIA_IDL, type ArcadiaIdl } from "../app/lib/arcadia-idl";
import {
  findPlatformConfig,
  findTraderProfile,
  PROGRAM_ID,
} from "../app/lib/arcadia-sdk";
import {
  createFlashTradeExecutionClient,
  resolveFlashTradeMarket,
  ensureFlashTradeSetup,
  depositToFlashTradeLedger,
  openFlashTradePosition,
  closeFlashTradePositionV2,
  waitForFlashTradePositionSnapshot,
  getFlashTradeCluster,
  getFlashTradePoolConfigs,
  listSupportedFlashTradeMarkets,
} from "../app/lib/flashtrade/v2";

/* ─── Config ─────────────────────────────────────────────────────────── */

const RPC_URL =
  process.env.RPC_URL ?? "https://devnet.helius-rpc.com/?api-key=649881b9-dbd1-4a90-98bd-bd38240af548";
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const USDC_DECIMALS = 6;
const TEST_AMOUNT_USDC = 10_000_000n; // 10 USDC (raw units)
const TEST_SOL_DEPOSIT = 100_000_000n; // 0.1 SOL for FlashTrade deposit
const TEST_SLIPPAGE = "0.5";
const TEST_LEVERAGE = 2;

/* ─── Helpers ────────────────────────────────────────────────────────── */

function loadKeypair(path: string): Keypair {
  const raw = JSON.parse(readFileSync(path, "utf-8"));
  return Keypair.fromSecretKey(new Uint8Array(raw));
}

function fmt(value: bigint, decimals = USDC_DECIMALS): string {
  const whole = value / 10n ** BigInt(decimals);
  const frac = value % 10n ** BigInt(decimals);
  return `${whole}.${frac.toString().padStart(decimals, "0").replace(/0+$/, "")}`;
}

async function getOrCreateAta(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
  payer: Keypair,
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, owner);
  const info = await connection.getAccountInfo(ata);
  if (info) return ata;
  const tx = new Transaction().add(
    createAssociatedTokenAccountInstruction(payer.publicKey, ata, owner, mint),
  );
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(payer);
  await connection.sendRawTransaction(tx.serialize());
  console.log(`  Created ATA ${ata.toBase58()}`);
  return ata;
}

async function getBalance(connection: Connection, ata: PublicKey): Promise<bigint> {
  try {
    const info = await getAccount(connection, ata);
    return info.amount;
  } catch {
    return 0n;
  }
}

async function tryAcquireUsdc(connection: Connection, recipient: PublicKey): Promise<boolean> {
  const ata = await getAssociatedTokenAddress(USDC_MINT, recipient);
  const existing = await getBalance(connection, ata);
  if (existing >= TEST_AMOUNT_USDC) {
    console.log(`  Already have ${fmt(existing)} USDC — skipping faucet`);
    return true;
  }

  console.log("  Trying Circle faucet...");
  try {
    const res = await fetch("https://api.circle.com/v1/faucet/usdc", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        address: recipient.toBase58(),
        amount: "20",
        network: "solana-devnet",
      }),
    });
    const data = await res.json() as Record<string, unknown>;
    if (res.ok || (data as { code?: number }).code === 0) {
      console.log("  Circle faucet request submitted, waiting...");
      await new Promise((r) => setTimeout(r, 5_000));
      const bal = await getBalance(connection, ata);
      if (bal > 0n) {
        console.log(`  Received ${fmt(bal)} USDC from Circle faucet`);
        return true;
      }
    }
  } catch { /* fall through */ }

  console.log("  Circle faucet failed, trying other methods...");
  console.log("  ⚠️  Could not acquire devnet USDC automatically.");
  console.log(`  Please get USDC manually at https://faucet.circle.com`);
  console.log(`  Send to: ${recipient.toBase58()}`);
  console.log(`  USDC mint: ${USDC_MINT.toBase58()}`);
  return false;
}

/* ─── Main ───────────────────────────────────────────────────────────── */

async function main() {
  console.log("═".repeat(60));
  console.log("  Arcadia — Execution Wallet Architecture Devnet Test");
  console.log("═".repeat(60));
  console.log();

  /* ── Connect ── */
  const connection = new Connection(RPC_URL, "confirmed");
  const adminKeypairPath = join(homedir(), ".config", "solana", "id.json");
  if (!existsSync(adminKeypairPath)) {
    console.error("Admin keypair not found at", adminKeypairPath);
    process.exit(1);
  }
  const admin = loadKeypair(adminKeypairPath);
  console.log("Admin wallet:", admin.publicKey.toBase58());

  /* ── Verify platform ── */
  const [configPda] = findPlatformConfig();
  const configInfo = await connection.getAccountInfo(configPda);
  if (!configInfo) {
    console.error("PlatformConfig PDA not found — initialize platform first");
    process.exit(1);
  }
  console.log("PlatformConfig:", configPda.toBase58());
  console.log();

  /* ── Read profile ── */
  const [profilePda] = findTraderProfile(admin.publicKey);
  const profileInfo = await connection.getAccountInfo(profilePda);
  if (!profileInfo) {
    console.error("TraderProfile PDA not found — initialize profile first");
    process.exit(1);
  }
  // Decode vault token address from profile
  const d = profileInfo.data;
  const vaultTokenPk = new PublicKey(d.slice(72, 104));
  console.log("Vault token account:", vaultTokenPk.toBase58());

  /* ── Step 1: Initialize investor account (if needed) ── */
  console.log("─ Step 1: Ensure investor account ────────────────────");
  const [investorPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("investor"), admin.publicKey.toBuffer()],
    PROGRAM_ID,
  );
  const [positionPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("position"), admin.publicKey.toBuffer(), profilePda.toBuffer()],
    PROGRAM_ID,
  );

  const invInfo = await connection.getAccountInfo(investorPda);
  if (!invInfo) {
    const provider = new AnchorProvider(
      connection, new Wallet(admin), { commitment: "confirmed" },
    );
    const program = new Program<ArcadiaIdl>(ARCADIA_IDL, provider);
    const invIx = await program.methods
      .initializeInvestor()
      .accounts({
        wallet: admin.publicKey,
        investorAccount: investorPda,
        systemProgram: new PublicKey("11111111111111111111111111111111"),
      })
      .instruction();
    const { blockhash } = await connection.getLatestBlockhash();
    const tx = new Transaction();
    tx.add(invIx);
    tx.feePayer = admin.publicKey;
    tx.recentBlockhash = blockhash;
    tx.sign(admin);
    const invSig = await connection.sendRawTransaction(tx.serialize());
    console.log("  initializeInvestor signature:", invSig);
    await connection.confirmTransaction(invSig, "confirmed");
    console.log("  Investor account initialized");
  } else {
    console.log("  Investor account already exists");
  }
  console.log();

/* ── Step 2: Acquire USDC ── */
console.log("─ Step 2: Acquire USDC ────────────────────────────────");
  const adminAta = await getOrCreateAta(connection, USDC_MINT, admin.publicKey, admin);
  const hasUsdc = await tryAcquireUsdc(connection, admin.publicKey);
  if (!hasUsdc) {
    console.log("  Skipping until USDC is available.");
    console.log("  Rerun after funding the admin wallet with USDC.");
    process.exit(0);
  }
  console.log();

/* ── Step 3: Deposit into vault ── */
console.log("─ Step 3: Deposit USDC into vault ──────────────────────");
  const vaultBalanceBefore = await getBalance(connection, vaultTokenPk);
  console.log(`  Vault balance before: ${fmt(vaultBalanceBefore)} USDC`);

  if (vaultBalanceBefore < TEST_AMOUNT_USDC) {
    try {
      console.log("  Building deposit instruction...");
      const { blockhash } = await connection.getLatestBlockhash().catch(e => { throw new Error("getLatestBlockhash: " + e.message); });
      console.log("  blockhash obtained");

      const { createHash } = await import("crypto");
      const discriminator = createHash("sha256").update("global:deposit").digest().subarray(0, 8);
      const amountBuf = Buffer.alloc(8);
      amountBuf.writeBigUInt64LE(TEST_AMOUNT_USDC);
      const data = Buffer.concat([discriminator, amountBuf]);
      console.log("  data prepared, length:", data.length);

      const keys = [
        { pubkey: admin.publicKey, isSigner: true, isWritable: true },
        { pubkey: investorPda, isSigner: false, isWritable: true },
        { pubkey: profilePda, isSigner: false, isWritable: true },
        { pubkey: positionPda, isSigner: false, isWritable: true },
        { pubkey: USDC_MINT, isSigner: false, isWritable: false },
        { pubkey: vaultTokenPk, isSigner: false, isWritable: true },
        { pubkey: adminAta, isSigner: false, isWritable: true },
        { pubkey: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), isSigner: false, isWritable: false },
        { pubkey: new PublicKey("11111111111111111111111111111111"), isSigner: false, isWritable: false },
      ];

      const ix = new TransactionInstruction({ programId: PROGRAM_ID, keys, data });
      console.log("  instruction built");
      const tx = new Transaction().add(ix);
      tx.feePayer = admin.publicKey;
      tx.recentBlockhash = blockhash;
      tx.sign(admin);
      console.log("  tx signed");

      const sig = await connection.sendRawTransaction(tx.serialize()).catch(e => { throw new Error("sendRawTransaction: " + e.message); });
      console.log("  Deposit signature:", sig);
      const latest = await connection.getLatestBlockhash();
      const result = await connection.confirmTransaction({
        signature: sig,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      }, "confirmed").catch(e => { throw new Error("confirmTransaction: " + e.message); });

      if (result.value.err) {
        console.log("  TX on-chain error:", JSON.stringify(result.value.err));
      } else {
        console.log("  Deposit confirmed");
        const vaultBalanceAfter = await getBalance(connection, vaultTokenPk);
        console.log(`  Vault balance after: ${fmt(vaultBalanceAfter)} USDC`);
      }
    } catch (err) {
      console.error("  Deposit step error:", (err as Error).message);
    }
    console.log("  Continuing to next step...");
  } else {
    console.log("  Vault already has sufficient balance");
  }
  console.log();

  /* ── Step 3: Create execution wallet ── */
  console.log("─ Step 3: Create execution wallet ──────────────────────");
  const executionSeed = randomBytes(32);
  const executionKeypair = Keypair.fromSeed(executionSeed);
  console.log("  Execution wallet:", executionKeypair.publicKey.toBase58());

  // Fund execution wallet with SOL for fees + FlashTrade deposit
  const minGas = 10_000_000n; // 0.01 SOL
  const execBalance = await connection.getBalance(executionKeypair.publicKey);
  if (execBalance < Number(minGas)) {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: executionKeypair.publicKey,
        lamports: Number(minGas) + 5_000_000 + Number(TEST_SOL_DEPOSIT),
      }),
    );
    tx.feePayer = admin.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(admin);
    await connection.sendRawTransaction(tx.serialize());
    console.log(`  Funded execution wallet with ${(Number(minGas) + 5_000_000 + Number(TEST_SOL_DEPOSIT)) / 1e9} SOL`);
  }

  const execAta = await getOrCreateAta(
    connection,
    USDC_MINT,
    executionKeypair.publicKey,
    admin,
  );
  const execAtaBalance = await getBalance(connection, execAta);
  console.log(`  Execution wallet ATA: ${execAta.toBase58()}`);
  console.log(`  ATA balance: ${fmt(execAtaBalance)} USDC`);
  console.log();

  /* ── Step 4: vault.fund_execution ── */
  console.log("─ Step 4: vault.fund_execution ─────────────────────────");
  const fundAmount = 5_000_000n; // 5 USDC
  console.log(`  Funding ${fmt(fundAmount)} USDC to execution wallet`);

  const { createHash } = await import("crypto");
  const fundDiscriminator = createHash("sha256").update("global:fund_execution").digest().subarray(0, 8);
  const fundAmountBuf = Buffer.alloc(8);
  fundAmountBuf.writeBigUInt64LE(fundAmount);
  const fundData = Buffer.concat([fundDiscriminator, fundAmountBuf]);

  const fundKeys = [
    { pubkey: admin.publicKey, isSigner: true, isWritable: false }, // broadcaster
    { pubkey: admin.publicKey, isSigner: true, isWritable: false }, // admin (same key)
    { pubkey: configPda, isSigner: false, isWritable: false },      // config
    { pubkey: profilePda, isSigner: false, isWritable: true },      // profile
    { pubkey: USDC_MINT, isSigner: false, isWritable: false },      // baseMint
    { pubkey: vaultTokenPk, isSigner: false, isWritable: true },    // vaultToken
    { pubkey: execAta, isSigner: false, isWritable: true },         // executionWalletAta
    { pubkey: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), isSigner: false, isWritable: false }, // tokenProgram
  ];

  const fundIx = new TransactionInstruction({ programId: PROGRAM_ID, keys: fundKeys, data: fundData });
  const { blockhash } = await connection.getLatestBlockhash();
  const fundTx = new Transaction().add(fundIx);
  fundTx.feePayer = admin.publicKey;
  fundTx.recentBlockhash = blockhash;
  fundTx.sign(admin);

  const fundSig = await connection.sendRawTransaction(fundTx.serialize());
  console.log("  fund_execution signature:", fundSig);
  const bh = await connection.getLatestBlockhash();
  const fundResult = await connection.confirmTransaction({ signature: fundSig, blockhash: bh.blockhash, lastValidBlockHeight: bh.lastValidBlockHeight }, "confirmed");
  console.log("  fund_execution confirmed", fundResult.value.err ? "with error: " + JSON.stringify(fundResult.value.err) : "✓");

  const vaultAfter = await getBalance(connection, vaultTokenPk);
  const execAfter = await getBalance(connection, execAta);
  console.log(`  Vault balance: ${fmt(vaultAfter)} USDC`);
  console.log(`  Execution wallet ATA: ${fmt(execAfter)} USDC`);
  console.log();

  /* ── Step 5: FlashTrade integration ── */
  console.log("─ Step 5: FlashTrade integration ───────────────────────");

  const supported = listSupportedFlashTradeMarkets(getFlashTradeCluster());
  console.log(`  Supported markets: ${supported.map((m) => m.targetSymbol).join(", ")}`);

  // Check pool availability
  const pools = getFlashTradePoolConfigs(getFlashTradeCluster());
  console.log(`  Available pools: ${pools.map((p) => p.poolName).join(", ")}`);

  try {
    const market = resolveFlashTradeMarket({
      targetSymbol: "SOL",
      direction: "long",
      allowManualFallback: true,
    });
    console.log(`  Resolved market: ${market.targetSymbol} on ${market.poolName}`);

    // Create FlashTrade client using execution wallet seed
    const ftClient = createFlashTradeExecutionClient(executionSeed, RPC_URL);

    // Setup: deposit ledger, basket, trade vault, delegate
    console.log("  Setting up FlashTrade accounts...");
    const setupResult = await ensureFlashTradeSetup(ftClient, market);
    console.log(`    Deposit ledger setup: ${setupResult.depositLedgerSignature ?? "already done"}`);
    console.log(`    Basket setup: ${setupResult.basketSignature ?? "already done"}`);
    console.log(`    Trade vault setup: ${setupResult.tradeVaultSignature ?? "already done"}`);
    console.log(`    Delegate setup: ${setupResult.delegateSignature ?? "already done"}`);

    // Deposit to FlashTrade ledger
    console.log("  Depositing to FlashTrade ledger...");
    const depositSigFt = await depositToFlashTradeLedger({
      executionClient: ftClient,
      resolvedMarket: market,
      amount: new BN(TEST_SOL_DEPOSIT.toString()),
    });
    console.log("    Deposit signature:", depositSigFt);

    // Open position
    console.log(`  Opening ${market.targetSymbol} long position...`);
    const openResult = await openFlashTradePosition({
      executionClient: ftClient,
      resolvedMarket: market,
      collateralAmount: new BN(TEST_SOL_DEPOSIT.toString()),
      leverage: TEST_LEVERAGE,
      slippagePercentage: TEST_SLIPPAGE,
    });
    console.log("    Open signature:", openResult.signature);

    // Read position snapshot
    console.log("  Waiting for position snapshot...");
    const snapshot = await waitForFlashTradePositionSnapshot({
      executionClient: ftClient,
      resolvedMarket: market,
    });
    if (snapshot) {
      console.log(`    Entry: ${snapshot.entryPriceUi}`);
      console.log(`    Size: ${snapshot.sizeUsdUi} USD`);
      console.log(`    Leverage: ${snapshot.leverageUi}x`);
      console.log(`    Liq. price: ${snapshot.liquidationPriceUi}`);
    } else {
      console.log("    Position snapshot not yet available (may need more time)");
    }

    console.log("  Closing position...");
    let closeResult;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        closeResult = await closeFlashTradePositionV2({
          executionClient: ftClient,
          resolvedMarket: market,
        });
        console.log("    Close signature:", closeResult.signature);
        break;
      } catch (e) {
        if (attempt < 3) {
          console.log(`    Close attempt ${attempt} failed, retrying in 5s...`);
          await new Promise((r) => setTimeout(r, 5_000));
        } else {
          throw e;
        }
      }
    }

    // Wait for close to settle
    console.log("  Waiting for position to settle...");
    await new Promise((r) => setTimeout(r, 10_000));
  } catch (err) {
    console.error("  FlashTrade step failed:");
    if (err instanceof Error) {
      console.error("    message:", err.message);
      console.error("    stack:", err.stack?.split("\n").slice(0, 3).join("\n    "));
    } else {
      try { console.error("    detail:", JSON.stringify(err, null, 2)); }
      catch { console.error("    detail:", String(err)); }
    }
    console.log("  Continuing with sweep test...");
  }
  console.log();

  /* ── Step 6: Sweep back to vault ── */
  console.log("─ Step 6: Sweep back to vault ──────────────────────────");
  const closeBal = await getBalance(connection, execAta);
  console.log(`  Execution wallet ATA after close: ${fmt(closeBal)} USDC`);

  if (closeBal > 0n) {
    const sweepTx = new Transaction().add(
      createTransferInstruction(
        execAta,
        vaultTokenPk,
        executionKeypair.publicKey,
        closeBal,
        [],
      ),
    );
    sweepTx.feePayer = admin.publicKey;
    sweepTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    sweepTx.sign(admin, executionKeypair);
    const sweepSig = await connection.sendRawTransaction(sweepTx.serialize());
    console.log("  Sweep signature:", sweepSig);
    await connection.confirmTransaction(sweepSig, "confirmed");

    const vaultFinal = await getBalance(connection, vaultTokenPk);
    console.log(`  Vault final balance: ${fmt(vaultFinal)} USDC`);
  } else {
    console.log("  No tokens to sweep (already returned to vault or never funded)");
  }
  console.log();

  /* ── Done ── */
  console.log("═".repeat(60));
  console.log("  Test complete");
  console.log("═".repeat(60));
  console.log("  Execution wallet address:", executionKeypair.publicKey.toBase58());
  console.log("  Execution wallet seed (base58):", bs58.encode(executionSeed));
  console.log();
}

main().catch((err) => {
  console.error("Fatal:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
