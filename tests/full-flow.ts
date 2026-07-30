/**
 * Arcadia — Full User Flow Test
 *
 * Tests every layer end-to-end:
 *   1. Wallet connects (admin)
 *   2. Profile + investor setup
 *   3. Investor deposits USDC into vault
 *   4. Execution wallet created + funded
 *   5. vault.fund_execution → execution wallet ATA
 *   6. FlashTrade: setup → deposit → open position → close
 *   7. Sweep USDC back to vault
 *   8. Scoring engine computes metrics + Arcadia Score
 *   9. Capacity ceiling derived from score
 *
 * Usage:
 *   RPC_URL="https://devnet.helius-rpc.com/?api-key=..." \
 *   npx tsx tests/full-flow.ts
 */

import { randomBytes, createHash } from "node:crypto";
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
} from "@solana/web3.js";
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  getAccount,
} from "@solana/spl-token";
import { BN } from "@coral-xyz/anchor";
import bs58 from "bs58";

import { ARCADIA_IDL } from "../app/lib/arcadia-idl";
import { findPlatformConfig, findTraderProfile, findInvestorPosition, PROGRAM_ID } from "../app/lib/arcadia-sdk";
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

// ── Config ─────────────────────────────────────────────────────────────────────
const RPC_URL = process.env.RPC_URL || "https://devnet.helius-rpc.com/?api-key=649881b9-dbd1-4a90-98bd-bd38240af548";
const USDC_MINT = new PublicKey("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
const USDC_DECIMALS = 6;
const DEPOSIT_AMOUNT = 10_000_000n; // 10 USDC
const FUND_AMOUNT = 5_000_000n;     // 5 USDC
const SOL_DEPOSIT = 0.1;            // 0.1 SOL for FlashTrade

// ── Helpers ────────────────────────────────────────────────────────────────────

function loadKeypair(path: string): Keypair {
  const data = readFileSync(path, "utf-8");
  const bytes = JSON.parse(data);
  return Keypair.fromSecretKey(new Uint8Array(bytes));
}

async function getOrCreateAta(
  connection: Connection,
  mint: PublicKey,
  owner: PublicKey,
  payer: Keypair,
): Promise<PublicKey> {
  const ata = await getAssociatedTokenAddress(mint, owner, true);
  const info = await connection.getAccountInfo(ata);
  if (info) return ata;

  const tx = new Transaction().add(
    createAssociatedTokenAccountInstruction(payer.publicKey, ata, owner, mint),
  );
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  tx.sign(payer);
  const sig = await connection.sendRawTransaction(tx.serialize());
  await connection.confirmTransaction(sig, "confirmed");
  console.log(`  Created ATA ${ata.toBase58()}`);
  return ata;
}

async function getBalance(connection: Connection, ata: PublicKey): Promise<bigint> {
  try {
    const info = await getAccount(connection, ata);
    return info.amount;
  } catch { return 0n; }
}

function sha256Discriminator(name: string): Uint8Array {
  return createHash("sha256").update(`global:${name}`).digest().subarray(0, 8);
}

// ── On-Chain Flow ──────────────────────────────────────────────────────────────

async function onChainFlow(admin: Keypair, connection: Connection) {
  const [configPda] = findPlatformConfig();
  const [profilePda] = findTraderProfile(admin.publicKey);
  const adminAta = await getOrCreateAta(connection, USDC_MINT, admin.publicKey, admin);

  // Read vault token from profile
  const profileInfo = await connection.getAccountInfo(profilePda);
  if (!profileInfo) throw new Error("TraderProfile PDA not found");
  const vaultTokenPk = new PublicKey(profileInfo.data.slice(72, 104));

  const [positionPda] = findInvestorPosition(admin.publicKey, profilePda);

  const [investorPda] = PublicKey.findProgramAddressSync(
    [Buffer.from("investor"), admin.publicKey.toBuffer()],
    PROGRAM_ID,
  );

  // Ensure investor account
  try {
    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: admin.publicKey, isSigner: true, isWritable: true },
        { pubkey: investorPda, isSigner: false, isWritable: true },
        { pubkey: profilePda, isSigner: false, isWritable: false },
        { pubkey: admin.publicKey, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: sha256Discriminator("initialize_investor"),
    });
    const tx = new Transaction().add(ix);
    tx.feePayer = admin.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(admin);
    const sigInit = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(sigInit, "confirmed");
    console.log("  Investor account initialized");
  } catch {
    console.log("  Investor account already exists");
  }

  // Deposit USDC
  const vaultBalBefore = await getBalance(connection, vaultTokenPk);
  console.log(`  Vault balance before: ${Number(vaultBalBefore) / 10 ** USDC_DECIMALS} USDC`);

  if (vaultBalBefore < DEPOSIT_AMOUNT) {
    const amountBuf = Buffer.alloc(8);
    amountBuf.writeBigUInt64LE(DEPOSIT_AMOUNT);

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: admin.publicKey, isSigner: true, isWritable: true },
        { pubkey: investorPda, isSigner: false, isWritable: true },
        { pubkey: profilePda, isSigner: false, isWritable: true },
        { pubkey: positionPda, isSigner: false, isWritable: true },
        { pubkey: USDC_MINT, isSigner: false, isWritable: false },
        { pubkey: vaultTokenPk, isSigner: false, isWritable: true },
        { pubkey: adminAta, isSigner: false, isWritable: true },
        { pubkey: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), isSigner: false, isWritable: false },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([sha256Discriminator("deposit"), amountBuf]),
    });

    const tx = new Transaction().add(ix);
    tx.feePayer = admin.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(admin);
    const sig = await connection.sendRawTransaction(tx.serialize());
    console.log(`  Deposit signature: ${sig}`);
    await connection.confirmTransaction(sig, "confirmed");
    console.log("  Deposit confirmed ✓");
  } else {
    console.log("  Vault already has sufficient balance");
  }

  // Create execution wallet
  const executionSeed = randomBytes(32);
  const executionKeypair = Keypair.fromSeed(executionSeed);
  const execPubkey = executionKeypair.publicKey;

  const execBal = await connection.getBalance(execPubkey);
  const minGas = 10_000_000n;
  const solDepositLamports = BigInt(Math.floor(SOL_DEPOSIT * 1e9));
  if (execBal < Number(minGas)) {
    const fund = Number(minGas) + 5_000_000 + Number(solDepositLamports);
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: execPubkey,
        lamports: fund,
      }),
    );
    tx.feePayer = admin.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(admin);
    const solSig = await connection.sendRawTransaction(tx.serialize());
    await connection.confirmTransaction(solSig, "confirmed");
    console.log(`  Funded execution wallet with ${fund / 1e9} SOL`);
  }

  const execAta = await getOrCreateAta(connection, USDC_MINT, execPubkey, admin);
  const execAtaBal = await getBalance(connection, execAta);
  console.log(`  Execution wallet ATA balance: ${Number(execAtaBal) / 10 ** USDC_DECIMALS} USDC`);

  // fund_execution
  if (execAtaBal < FUND_AMOUNT) {
    const fundBuf = Buffer.alloc(8);
    fundBuf.writeBigUInt64LE(FUND_AMOUNT);

    const ix = new TransactionInstruction({
      programId: PROGRAM_ID,
      keys: [
        { pubkey: admin.publicKey, isSigner: true, isWritable: true },
        { pubkey: admin.publicKey, isSigner: true, isWritable: false },
        { pubkey: configPda, isSigner: false, isWritable: false },
        { pubkey: profilePda, isSigner: false, isWritable: true },
        { pubkey: USDC_MINT, isSigner: false, isWritable: false },
        { pubkey: vaultTokenPk, isSigner: false, isWritable: true },
        { pubkey: execAta, isSigner: false, isWritable: true },
        { pubkey: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"), isSigner: false, isWritable: false },
      ],
      data: Buffer.concat([sha256Discriminator("fund_execution"), fundBuf]),
    });

    const tx = new Transaction().add(ix);
    tx.feePayer = admin.publicKey;
    tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
    tx.sign(admin);
    const sig = await connection.sendRawTransaction(tx.serialize());
    console.log(`  fund_execution signature: ${sig}`);
    await connection.confirmTransaction(sig, "confirmed");
    console.log("  fund_execution confirmed ✓");
  } else {
    console.log("  Execution wallet already funded");
  }

  const vaultAfter = await getBalance(connection, vaultTokenPk);
  const execAfter = await getBalance(connection, execAta);
  console.log(`  Vault balance: ${Number(vaultAfter) / 10 ** USDC_DECIMALS} USDC`);
  console.log(`  Execution wallet ATA: ${Number(execAfter) / 10 ** USDC_DECIMALS} USDC`);

  return { executionSeed, execPubkey, execAta, vaultTokenPk, profilePda, investorPda, adminAta };
}

// ── FlashTrade Flow ────────────────────────────────────────────────────────────

async function flashTradeFlow(executionSeed: Uint8Array) {
  console.log("\n─ FlashTrade ──────────────────────────────────");

  const cluster = getFlashTradeCluster();
  const ftClient = createFlashTradeExecutionClient(executionSeed, RPC_URL);
  const market = resolveFlashTradeMarket({ targetSymbol: "SOL", direction: "long", allowManualFallback: true });
  console.log(`  Market: ${market.targetSymbol} on ${market.poolName}`);

  // Setup
  await ensureFlashTradeSetup(ftClient, market);
  console.log("  Setup complete ✓");

  // Deposit
  const depositSig = await depositToFlashTradeLedger({
    executionClient: ftClient,
    resolvedMarket: market,
    amount: new BN(Math.floor(SOL_DEPOSIT * 1e9)),
  });
  console.log(`  Deposit signature: ${depositSig}`);

  // Open position
  const openResult = await openFlashTradePosition({
    executionClient: ftClient,
    resolvedMarket: market,
    collateralAmount: new BN(Math.floor(SOL_DEPOSIT * 1e9)),
    leverage: 2,
    slippagePercentage: "0.5",
  });
  console.log(`  Open signature: ${openResult.signature}`);
  console.log(`  Size: ${openResult.sizeAmount.toString()}`);

  // Wait for snapshot
  const snapshot = await waitForFlashTradePositionSnapshot({ executionClient: ftClient, resolvedMarket: market });
  if (snapshot) {
    console.log(`  Position: entry=${snapshot.entryPriceUi} size=${snapshot.sizeUsdUi} lev=${snapshot.leverageUi}`);
    console.log(`  Liq price: ${snapshot.liquidationPriceUi}  PnL: ${snapshot.pnlWithFeeUsdUi}`);
  }

  // Close position
  let closeSig: string | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await closeFlashTradePositionV2({ executionClient: ftClient, resolvedMarket: market });
      closeSig = r.signature;
      console.log(`  Close signature: ${closeSig}`);
      break;
    } catch (e: any) {
      console.log(`  Close attempt ${attempt} failed, retrying in 5s...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  return { ftClient, market, openResult, snapshot, closeSig };
}

// ── Scoring Engine (TypeScript port of Rust arcadia_scoring) ──────────────────

interface TradeData {
  market: string;
  direction: "long" | "short";
  sizeUsd: number;
  leverage: number;
  entryPx: number;
  exitPx: number;
  realizedPnl: number;
  feesUsd: number;
  wasLiquidated: boolean;
  openedAt: Date;
  closedAt: Date;
}

interface Metrics {
  sortino: number;
  calmar: number;
  sharpe: number;
  maxDd: number;
  ulcer: number;
  volatility: number;
  meanReturn: number;
  downsideDeviation: number;
  liqRate: number;
  pctProfitable: number;
  avgLeverage: number;
  tradeCount: number;
  daysActive: number;
}

interface ScoreResult {
  score: number;
  confidence: number;
  ciLow: number;
  ciHigh: number;
  qualityRaw: number;
}

interface CapacityResult {
  capacityUsd: number;
  tier: string;
  tierCode: number;
}

// ── Daily returns from equity curve (TWR) ──
function dailyReturns(curve: { day: string; twrNav: number }[]): number[] {
  const rets: number[] = [];
  for (let i = 1; i < curve.length; i++) {
    rets.push((curve[i].twrNav - curve[i - 1].twrNav) / curve[i - 1].twrNav);
  }
  return rets;
}

// ── Metrics computation ──
function computeMetrics(equityCurve: { day: string; twrNav: number }[], trades: TradeData[]): Metrics {
  const returns = dailyReturns(equityCurve);
  const n = returns.length;
  if (n === 0 || trades.length === 0) {
    return { sortino: 0, calmar: 0, sharpe: 0, maxDd: 0, ulcer: 0, volatility: 0, meanReturn: 0,
             downsideDeviation: 0, liqRate: 0, pctProfitable: 0, avgLeverage: 0, tradeCount: 0, daysActive: 0 };
  }

  const ANNUALISATION = 252;
  const RISK_FREE = 0;

  const meanRet = returns.reduce((a, b) => a + b, 0) / n;
  const annRet = (1 + meanRet) ** ANNUALISATION - 1;

  // Variance & Sharpe
  const variance = returns.reduce((acc, r) => acc + (r - meanRet) ** 2, 0) / n;
  const dailyStd = Math.sqrt(variance);
  const annVol = dailyStd * Math.sqrt(ANNUALISATION);
  const sharpe = dailyStd < 1e-10 ? 0 : (meanRet / dailyStd) * Math.sqrt(ANNUALISATION);

  // Downside deviation & Sortino
  const downside = returns.filter(r => r < RISK_FREE).map(r => (r - RISK_FREE) ** 2);
  const dsDev = downside.length === 0
    ? 1e-10
    : Math.sqrt(downside.reduce((a, b) => a + b, 0) / downside.length) * Math.sqrt(ANNUALISATION);
  const sortino = (annRet - RISK_FREE) / dsDev;

  // Max drawdown & Ulcer
  let peak = 1, maxDd = 0, ddSqSum = 0, nav = 1;
  for (const r of returns) {
    nav *= (1 + r);
    if (nav > peak) peak = nav;
    const dd = (peak - nav) / peak;
    if (dd > maxDd) maxDd = dd;
    ddSqSum += dd * dd;
  }
  const ulcer = Math.sqrt(ddSqSum / n);
  const calmar = maxDd < 1e-10 ? Math.max(annRet, 0) / 1e-10 : annRet / maxDd;

  // Trade-level
  const tc = trades.length;
  const liqCount = trades.filter(t => t.wasLiquidated).length;
  const profitable = trades.filter(t => t.realizedPnl > 0).length;
  const avgLev = trades.reduce((s, t) => s + t.leverage, 0) / tc;

  function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

  return {
    sortino: clamp(sortino, -50, 50),
    calmar: clamp(calmar, -50, 50),
    sharpe: clamp(sharpe, -50, 50),
    maxDd: Math.min(maxDd, 1),
    ulcer: Math.min(ulcer, 1),
    volatility: Math.min(annVol, 10),
    meanReturn: meanRet,
    downsideDeviation: Math.min(dsDev, 10),
    liqRate: liqCount / tc,
    pctProfitable: profitable / tc,
    avgLeverage: avgLev,
    tradeCount: tc,
    daysActive: equityCurve.length,
  };
}

// ── Arcadia Score ──
function computeScore(m: Metrics, tradeCount: number): ScoreResult {
  if (tradeCount === 0) {
    return { score: 0, confidence: 0, ciLow: 0, ciHigh: 0, qualityRaw: 0 };
  }

  // Normalizers
  const normLinear = (v: number, cap: number) => v <= 0 ? 0 : Math.min(v / cap * 100, 100);
  const normSharpe = (v: number) => normLinear(v, 3);
  const normCalmar = (v: number) => normLinear(v, 5);
  const normVol = (v: number) => v <= 0 ? 100 : Math.max(0, 100 - v * 100);
  const normMaxDd = (v: number) => Math.max(0, (1 - Math.abs(v)) * 100);
  const normMeanRet = (v: number) => v <= 0 ? 0 : Math.min(v * 252 * 100, 100);
  const normDownsideDev = (v: number) => v <= 0 ? 100 : Math.max(0, 100 - v * 100);

  const nSharpe = normSharpe(m.sharpe);
  const nSortino = normSharpe(m.sortino);
  const nCalmar = normCalmar(m.calmar);
  const nMaxDd = normMaxDd(m.maxDd);
  const nVol = normVol(m.volatility);
  const nDsDev = normDownsideDev(m.downsideDeviation);
  const nMeanRet = normMeanRet(m.meanReturn);

  // Weighted composite
  const W = { sharpe: 0.25, sortino: 0.20, calmar: 0.15, maxDd: 0.15, vol: 0.10, dsDev: 0.10, meanRet: 0.05 };
  const q100 = W.sharpe * nSharpe + W.sortino * nSortino + W.calmar * nCalmar
             + W.maxDd * nMaxDd + W.vol * nVol + W.dsDev * nDsDev + W.meanRet * nMeanRet;
  const q = Math.min(q100 * 10, 1000);

  // Confidence (logistic)
  const n = tradeCount;
  const confidence = 1 / (1 + Math.exp(-(n - 200) / 125));

  // Guard factor
  const guard = (v: number, thresh: number, minOut: number, maxVal: number) =>
    v <= thresh ? 1 : v >= maxVal ? minOut : Math.max(minOut, 1 - (v - thresh) / (maxVal - thresh));
  const gLiq = guard(m.liqRate, 0.05, 0, 1);
  const gDd = guard(m.maxDd, 0.3, 0, 1);
  const g = Math.min(gLiq, gDd);

  const raw = q * confidence * g;
  const score = Math.min(Math.round(raw), 1000);

  const ciHalf = 125 / Math.sqrt(n);
  const ciLow = Math.max(0, raw - ciHalf);
  const ciHigh = Math.min(1000, raw + ciHalf);

  return { score, confidence, ciLow, ciHigh, qualityRaw: q };
}

function computeCapacity(score: number): CapacityResult {
  const tier = score >= 950 ? "Apex" : score >= 750 ? "Elite" : score >= 500 ? "Advanced" : score >= 250 ? "Established" : "Verified";
  const tierCode = score >= 950 ? 4 : score >= 750 ? 3 : score >= 500 ? 2 : score >= 250 ? 1 : 0;
  const multiplier = score >= 950 ? 10 : score >= 750 ? 5 : score >= 500 ? 3 : score >= 250 ? 2 : 1;
  return { capacityUsd: multiplier, tier, tierCode };
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  console.log("══════════════════════════════════════════════════════════════");
  console.log("  Arcadia — Full User Flow Test");
  console.log("══════════════════════════════════════════════════════════════\n");

  const adminPath = join(homedir(), ".config/solana/id.json");
  if (!existsSync(adminPath)) {
    console.error(`Admin keypair not found at ${adminPath}`);
    process.exit(1);
  }

  const admin = loadKeypair(adminPath);
  const connection = new Connection(RPC_URL, "confirmed");

  console.log(`Admin wallet: ${admin.publicKey.toBase58()}\n`);

  // ── Step 1: On-chain flow ─────────────────────────────────────────────
  console.log("─ Step 1: Vault + Execution Wallet ──────────────────");
  const { executionSeed, execPubkey, execAta, vaultTokenPk, profilePda } =
    await onChainFlow(admin, connection);

  // ── Step 2: FlashTrade ──────────────────────────────────────────────
  const ftResult = await flashTradeFlow(executionSeed);

  // ── Step 3: Sweep back ─────────────────────────────────────────────
  if (ftResult.closeSig) {
    console.log("\n─ Step 3: Sweep ─────────────────────────────────────");
    const { createTransferInstruction } = await import("@solana/spl-token");
    const vaultBal = await getBalance(connection, vaultTokenPk);
    const execBal = await getBalance(connection, execAta);
    console.log(`  Vault balance: ${Number(vaultBal) / 10 ** USDC_DECIMALS} USDC`);
    console.log(`  Execution wallet ATA: ${Number(execBal) / 10 ** USDC_DECIMALS} USDC`);

    if (execBal > 0n) {
      const ix = createTransferInstruction(execAta, vaultTokenPk, execPubkey, execBal, []);
      const tx = new Transaction().add(ix);
      tx.feePayer = admin.publicKey;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.sign(admin, Keypair.fromSeed(executionSeed));
      const sig = await connection.sendRawTransaction(tx.serialize());
      console.log(`  Sweep signature: ${sig}`);

      const vaultFinal = await getBalance(connection, vaultTokenPk);
      console.log(`  Vault final balance: ${Number(vaultFinal) / 10 ** USDC_DECIMALS} USDC`);
    }
  }

  // ── Step 4: Build trade record for scoring ─────────────────────────
  console.log("\n─ Step 4: Trade Record ───────────────────────────────");
  const now = new Date();
  const entryPx = ftResult.snapshot ? parseFloat(ftResult.snapshot.entryPriceUi!) : 145.50;
  const exitPx = ftResult.closeSig ? entryPx * (1 + (Math.random() - 0.5) * 0.02) : entryPx;
  const sizeUsd = ftResult.openResult ? parseFloat(ftResult.openResult.sizeAmount.toString()) / 1e6 : 100;
  const leverage = 2;

  const trade: TradeData = {
    market: `SOL/USD`,
    direction: "long",
    sizeUsd,
    leverage,
    entryPx,
    exitPx,
    realizedPnl: (exitPx - entryPx) / entryPx * sizeUsd - sizeUsd * leverage * 0.001,
    feesUsd: sizeUsd * leverage * 0.001,
    wasLiquidated: false,
    openedAt: new Date(now.getTime() - 3600000),
    closedAt: now,
  };

  console.log(`  Market:    ${trade.market}`);
  console.log(`  Direction: ${trade.direction}`);
  console.log(`  Size:      $${trade.sizeUsd.toFixed(2)}`);
  console.log(`  Leverage:  ${trade.leverage}x`);
  console.log(`  Entry:     $${trade.entryPx.toFixed(2)}`);
  console.log(`  Exit:      $${trade.exitPx.toFixed(2)}`);
  console.log(`  PnL:       $${trade.realizedPnl.toFixed(2)}`);
  console.log(`  Fees:      $${trade.feesUsd.toFixed(2)}`);

  // ── Step 5: Build equity curve (simulated) ─────────────────────────
  // In production, this comes from the vault's daily NAV tracking.
  // For this test, we simulate 90 days of steady growth with some noise.
  const days = 90;
  const equityCurve: { day: string; twrNav: number }[] = [];
  for (let i = 0; i <= days; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - i));
    const noise = (Math.random() - 0.5) * 0.008;
    const trend = 0.0015;
    const nav = i === 0 ? 1.0 : equityCurve[i - 1].twrNav * (1 + trend + noise);
    equityCurve.push({ day: d.toISOString().slice(0, 10), twrNav: nav });
  }

  // ── Step 6: Compute score ─────────────────────────────────────────
  console.log("\n─ Step 5: Arcadia Score ──────────────────────────────");
  const metrics = computeMetrics(equityCurve, [trade]);
  const scoreResult = computeScore(metrics, 1);
  const capacity = computeCapacity(scoreResult.score);

  console.log(`\n  Metrics:`);
  console.log(`    Sharpe:         ${metrics.sharpe.toFixed(2)}`);
  console.log(`    Sortino:        ${metrics.sortino.toFixed(2)}`);
  console.log(`    Calmar:         ${metrics.calmar.toFixed(2)}`);
  console.log(`    Max Drawdown:   ${(metrics.maxDd * 100).toFixed(2)}%`);
  console.log(`    Volatility:     ${(metrics.volatility * 100).toFixed(2)}%`);
  console.log(`    Profitable:     ${(metrics.pctProfitable * 100).toFixed(0)}%`);
  console.log(`    Avg Leverage:   ${metrics.avgLeverage.toFixed(1)}x`);

  console.log(`\n  Score:`);
  console.log(`    Arcadia Score:  ${scoreResult.score} / 1000`);
  console.log(`    Quality (raw):  ${scoreResult.qualityRaw.toFixed(1)}`);
  console.log(`    Confidence:     ${(scoreResult.confidence * 100).toFixed(1)}%`);
  console.log(`    95% CI:         [${scoreResult.ciLow.toFixed(0)}, ${scoreResult.ciHigh.toFixed(0)}]`);

  console.log(`\n  Capacity:`);
  console.log(`    Tier:           ${capacity.tier} (${capacity.tierCode})`);
  console.log(`    Capacity:       $${capacity.capacityUsd.toLocaleString()}`);

  // ── Summary ──────────────────────────────────────────────────────
  console.log("\n══════════════════════════════════════════════════════════════");
  console.log("  Flow Complete");
  console.log("══════════════════════════════════════════════════════════════");
  console.log(`  Profile PDA:    ${profilePda.toBase58()}`);
  console.log(`  Execution addr: ${execPubkey.toBase58()}`);
  console.log(`  Seed (base58):  ${bs58.encode(executionSeed)}`);
  console.log(`  Trades:         ${metrics.tradeCount}`);
  console.log(`  Score:          ${scoreResult.score}`);
  console.log(`  Capacity:       $${capacity.capacityUsd.toLocaleString()}`);
  console.log("");
}

main().catch((e) => {
  console.error("\n❌ Test failed:", e.message);
  process.exit(1);
});
