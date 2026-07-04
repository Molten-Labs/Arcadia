"use client";

/**
 * useArcadiaVault — React hook for Arcadia Protocol on-chain interactions.
 *
 * Wires real Anchor transactions when the program + profile exist on devnet.
 * Falls back to a clean, realistic devnet simulation otherwise.
 *
 * Program ID: gTHauBMdJHs45tc8tjCKL7MejvBECQHgD184io3hx1C
 * Seeds: platform=["platform"], profile=["profile", trader], investor=["investor", wallet], position=["position", investor, profile]
 */

import { useCallback, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, Program, BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { IDL } from "./arcadia-idl";
import {
  PROGRAM_ID,
  findPlatformConfig,
  findTraderProfile,
  findInvestorAccount,
  findInvestorPosition,
  fetchTraderProfile,
} from "./arcadia-sdk";

export const ARCADIA_PROGRAM_ID = PROGRAM_ID;

export const DEVNET_USDC_MINT = new PublicKey(
  "DLkVtDD4zfFJzWgGRLqjzqkBhaBs5sVNzDeBCQ2hPgMz"
);

/* ── PDA helpers (backward compat, re-export from sdk) ─────────────── */
export function platformConfigPDA(): [PublicKey, number] {
  return findPlatformConfig();
}
export function profilePDA(traderWallet: PublicKey): [PublicKey, number] {
  return findTraderProfile(traderWallet);
}
export function investorAccountPDA(investor: PublicKey): [PublicKey, number] {
  return findInvestorAccount(investor);
}
export function investorPositionPDA(investor: PublicKey, profile: PublicKey): [PublicKey, number] {
  return findInvestorPosition(investor, profile);
}

/* ── On-chain state snapshot ────────────────────────────────────────── */
export interface VaultOnChainState {
  programDeployed: boolean;
  platformInitialized: boolean;
  profileExists: boolean;
  investorInitialized: boolean;
  positionExists: boolean;
  platformAddress: string;
  profileAddress: string;
  investorAddress: string;
  positionAddress: string;
}

/* ── Simulation helpers ─────────────────────────────────────────────── */
function simulatedSig(): string {
  const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  const arr = new Uint8Array(64);
  if (typeof crypto !== "undefined") crypto.getRandomValues(arr);
  return Array.from(arr).map(b => B58[b % 58]).join("").slice(0, 88);
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/* ── Build Anchor program ───────────────────────────────────────────── */
function makeProgram(
  connection: ReturnType<typeof useConnection>["connection"],
  publicKey: PublicKey,
  signTransaction: Parameters<AnchorProvider["wallet"]["signTransaction"]>[0] extends never ? never : any,
  signAllTransactions: any,
) {
  const provider = new AnchorProvider(
    connection,
    { publicKey, signTransaction, signAllTransactions } as any,
    { commitment: "confirmed" },
  );
  return new Program(IDL as any, provider);
}

/* ── Check if program + profile are live on-chain ──────────────────── */
async function checkLive(
  connection: ReturnType<typeof useConnection>["connection"],
  traderWallet: PublicKey,
  depositorKey: PublicKey,
): Promise<{
  isLive: boolean;
  investorExists: boolean;
  baseMint: PublicKey;
  vaultToken: PublicKey;
}> {
  const [platformPDA] = findPlatformConfig();
  const [profilePDAAddr] = findTraderProfile(traderWallet);
  const [investorPDAAddr] = findInvestorAccount(depositorKey);

  let isLive = false;
  let investorExists = false;
  let baseMint = DEVNET_USDC_MINT;
  let vaultToken = PublicKey.default;

  try {
    const [platInfo, profInfo, invInfo] = await connection.getMultipleAccountsInfo([
      platformPDA, profilePDAAddr, investorPDAAddr,
    ]);
    investorExists = invInfo !== null;
    isLive = platInfo !== null && profInfo !== null;
    if (isLive && profInfo) {
      const d = Buffer.from(profInfo.data);
      baseMint = new PublicKey(d.slice(40, 72));
      vaultToken = new PublicKey(d.slice(72, 104));
    }
  } catch {
    /* treat as offline */
  }

  return { isLive, investorExists, baseMint, vaultToken };
}

/* ── Hook ───────────────────────────────────────────────────────────── */
export function useArcadiaVault(traderProfilePubkey?: string) {
  const { connection } = useConnection();
  const { publicKey, signTransaction, signAllTransactions, sendTransaction } = useWallet();

  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [onChainState, setOnChainState] = useState<VaultOnChainState | null>(null);
  const [loadingChain, setLoadingChain] = useState(false);

  /* ── Fetch on-chain state ─────────────────────────────────────── */
  const fetchOnChainState = useCallback(async () => {
    if (!publicKey) return;
    setLoadingChain(true);
    try {
      const [platAddr] = findPlatformConfig();
      const [invAddr] = findInvestorAccount(publicKey);

      let profileAddr: PublicKey | null = null;
      let posAddr: PublicKey | null = null;

      if (traderProfilePubkey) {
        try {
          profileAddr = new PublicKey(traderProfilePubkey);
          [posAddr] = findInvestorPosition(publicKey, profileAddr);
        } catch { /* invalid pubkey */ }
      }

      const toCheck: PublicKey[] = [platAddr, invAddr];
      if (profileAddr) toCheck.push(profileAddr);
      if (posAddr) toCheck.push(posAddr);

      const infos = await connection.getMultipleAccountsInfo(toCheck);

      setOnChainState({
        programDeployed:     infos[0] !== null || infos[1] !== null,
        platformInitialized: infos[0] !== null,
        investorInitialized: infos[1] !== null,
        profileExists:       profileAddr ? (infos[2] !== null) : false,
        positionExists:      posAddr ? (infos[toCheck.indexOf(posAddr)] !== null) : false,
        platformAddress:     platAddr.toBase58(),
        profileAddress:      profileAddr?.toBase58() ?? "",
        investorAddress:     invAddr.toBase58(),
        positionAddress:     posAddr?.toBase58() ?? "",
      });
    } catch (err) {
      console.error("useArcadiaVault.fetchOnChainState:", err);
    } finally {
      setLoadingChain(false);
    }
  }, [connection, publicKey, traderProfilePubkey]);

  /* ── Initialize Profile ───────────────────────────────────────── */
  const initializeProfile = useCallback(
    async (handle: string, maxLeverage: number, _styleTags: string[]): Promise<boolean> => {
      if (!publicKey || !signTransaction || !signAllTransactions) {
        setTxStatus("Connect your wallet first.");
        return false;
      }
      setTxStatus(`Creating trader profile "${handle}"…`);
      setTxSig(null);
      try {
        const [profAddr] = findTraderProfile(publicKey);
        const { isLive } = await checkLive(connection, publicKey, publicKey);

        if (!isLive) {
          await sleep(1_400);
          const sig = simulatedSig();
          setTxSig(sig);
          setTxStatus(`Profile "${handle}" created. PDA: ${profAddr.toBase58().slice(0, 8)}… (devnet simulation)`);
          return true;
        }

        const program = makeProgram(connection, publicKey, signTransaction, signAllTransactions);
        const [configPDA] = findPlatformConfig();
        const sig = await (program.methods as any)
          .initializeProfile(maxLeverage)
          .accounts({
            trader: publicKey,
            config: configPDA,
            profile: profAddr,
            baseMint: DEVNET_USDC_MINT,
            systemProgram: SystemProgram.programId,
          })
          .rpc();
        setTxSig(sig);
        setTxStatus(`Profile "${handle}" created on-chain. Signature: ${sig.slice(0, 8)}…`);
        return true;
      } catch (err: unknown) {
        setTxStatus(`Initialize profile failed: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      }
    },
    [connection, publicKey, signTransaction, signAllTransactions],
  );

  /* ── Initialize Investor ──────────────────────────────────────── */
  const initializeInvestor = useCallback(
    async (profileAddress: string): Promise<boolean> => {
      if (!publicKey || !signTransaction || !signAllTransactions) {
        setTxStatus("Connect your wallet first.");
        return false;
      }
      setTxStatus("Setting up your investor account…");
      setTxSig(null);
      try {
        let traderKey: PublicKey;
        try { traderKey = new PublicKey(profileAddress); }
        catch { traderKey = publicKey; }

        const [invAddr] = findInvestorAccount(publicKey);
        const { isLive, investorExists } = await checkLive(connection, traderKey, publicKey);

        if (!isLive) {
          await sleep(1_100);
          const sig = simulatedSig();
          setTxSig(sig);
          setTxStatus(`Investor account initialized. PDA: ${invAddr.toBase58().slice(0, 8)}… (devnet simulation)`);
          return true;
        }

        if (investorExists) {
          setTxStatus("Investor account already initialized.");
          return true;
        }

        const program = makeProgram(connection, publicKey, signTransaction, signAllTransactions);
        const sig = await (program.methods as any).initializeInvestor().accounts({
          wallet: publicKey,
          investorAccount: invAddr,
          systemProgram: SystemProgram.programId,
        }).rpc();
        setTxSig(sig);
        setTxStatus(`Investor account created. Signature: ${sig.slice(0, 8)}…`);
        return true;
      } catch (err: unknown) {
        setTxStatus(`Initialize investor failed: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      }
    },
    [connection, publicKey, signTransaction, signAllTransactions],
  );

  /* ── Deposit ──────────────────────────────────────────────────── */
  const deposit = useCallback(
    async (traderWalletOrProfile: string, amountUsdc: number): Promise<boolean> => {
      if (!publicKey || !signTransaction || !signAllTransactions) {
        setTxStatus("Connect your wallet first.");
        return false;
      }
      setTxStatus(`Checking on-chain state…`);
      setTxSig(null);
      try {
        let traderKey: PublicKey;
        try { traderKey = new PublicKey(traderWalletOrProfile); }
        catch { traderKey = publicKey; }

        const [profilePDAAddr] = findTraderProfile(traderKey);
        const [investorPDAAddr] = findInvestorAccount(publicKey);
        const [positionPDAAddr] = findInvestorPosition(publicKey, profilePDAAddr);

        const { isLive, investorExists, baseMint, vaultToken } =
          await checkLive(connection, traderKey, publicKey);

        if (!isLive) {
          if (!investorExists) {
            setTxStatus("Initializing investor account…");
            await sleep(900);
          }
          setTxStatus(`Confirm deposit of $${amountUsdc.toFixed(2)} in wallet…`);
          await sleep(1_400);
          setTxStatus("Broadcasting to Solana devnet…");
          await sleep(700);
          const sig = simulatedSig();
          setTxSig(sig);
          setTxStatus(`Deposit of $${amountUsdc.toFixed(2)} confirmed (devnet simulation). Signature: ${sig.slice(0, 8)}…`);
          return true;
        }

        const program = makeProgram(connection, publicKey, signTransaction, signAllTransactions);

        if (!investorExists) {
          setTxStatus("Initializing investor account…");
          await (program.methods as any).initializeInvestor().accounts({
            wallet: publicKey,
            investorAccount: investorPDAAddr,
            systemProgram: SystemProgram.programId,
          }).rpc();
        }

        setTxStatus(`Confirm deposit of $${amountUsdc.toFixed(2)} in wallet…`);
        const amountU64 = new BN(Math.floor(amountUsdc * 1_000_000));
        const depositorToken = getAssociatedTokenAddressSync(baseMint, publicKey);

        const sig = await (program.methods as any).deposit(amountU64).accounts({
          depositor: publicKey,
          investorAccount: investorPDAAddr,
          profile: profilePDAAddr,
          position: positionPDAAddr,
          baseMint,
          vaultToken,
          depositorToken,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        }).rpc();

        setTxSig(sig);
        setTxStatus(`Deposit of $${amountUsdc.toFixed(2)} confirmed. Signature: ${sig.slice(0, 8)}…`);
        return true;
      } catch (err: unknown) {
        setTxStatus(`Deposit failed: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      }
    },
    [connection, publicKey, signTransaction, signAllTransactions],
  );

  /* ── Request Withdraw ─────────────────────────────────────────── */
  const requestWithdraw = useCallback(
    async (traderWalletOrProfile: string, shares: number): Promise<boolean> => {
      if (!publicKey || !signTransaction || !signAllTransactions) {
        setTxStatus("Connect your wallet first.");
        return false;
      }
      setTxStatus(`Requesting withdrawal of ${shares.toFixed(4)} shares…`);
      setTxSig(null);
      try {
        let traderKey: PublicKey;
        try { traderKey = new PublicKey(traderWalletOrProfile); }
        catch { traderKey = publicKey; }

        const [profilePDAAddr] = findTraderProfile(traderKey);
        const [positionPDAAddr] = findInvestorPosition(publicKey, profilePDAAddr);
        const { isLive } = await checkLive(connection, traderKey, publicKey);

        if (!isLive) {
          await sleep(1_200);
          const sig = simulatedSig();
          setTxSig(sig);
          setTxStatus(`Withdraw request recorded (devnet simulation). Signature: ${sig.slice(0, 8)}…`);
          return true;
        }

        const program = makeProgram(connection, publicKey, signTransaction, signAllTransactions);
        const sharesU64 = new BN(Math.floor(shares * 1_000_000));
        const { vaultToken } = await checkLive(connection, traderKey, publicKey);

        const sig = await (program.methods as any).requestWithdraw(sharesU64).accounts({
          owner: publicKey,
          profile: profilePDAAddr,
          vaultToken,
          position: positionPDAAddr,
        }).rpc();

        setTxSig(sig);
        setTxStatus(`Withdraw request submitted. Signature: ${sig.slice(0, 8)}…`);
        return true;
      } catch (err: unknown) {
        setTxStatus(`Withdraw request failed: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      }
    },
    [connection, publicKey, signTransaction, signAllTransactions],
  );

  /* ── Process Withdraw ─────────────────────────────────────────── */
  const processWithdraw = useCallback(
    async (traderWalletOrProfile: string): Promise<boolean> => {
      if (!publicKey || !signTransaction || !signAllTransactions) {
        setTxStatus("Connect your wallet first.");
        return false;
      }
      setTxStatus("Processing queued withdrawal…");
      setTxSig(null);
      try {
        let traderKey: PublicKey;
        try { traderKey = new PublicKey(traderWalletOrProfile); }
        catch { traderKey = publicKey; }

        const { isLive } = await checkLive(connection, traderKey, publicKey);
        if (!isLive) {
          await sleep(1_200);
          const sig = simulatedSig();
          setTxSig(sig);
          setTxStatus(`Withdrawal processed (devnet simulation). Signature: ${sig.slice(0, 8)}…`);
          return true;
        }

        const [profilePDAAddr] = findTraderProfile(traderKey);
        const [positionPDAAddr] = findInvestorPosition(publicKey, profilePDAAddr);
        const { baseMint, vaultToken } = await checkLive(connection, traderKey, publicKey);
        const ownerToken = getAssociatedTokenAddressSync(baseMint, publicKey);
        const program = makeProgram(connection, publicKey, signTransaction, signAllTransactions);

        const sig = await (program.methods as any).processWithdraw().accounts({
          owner: publicKey,
          profile: profilePDAAddr,
          position: positionPDAAddr,
          baseMint,
          vaultToken,
          ownerToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        }).rpc();

        setTxSig(sig);
        setTxStatus(`Withdrawal executed. Signature: ${sig.slice(0, 8)}…`);
        return true;
      } catch (err: unknown) {
        setTxStatus(`Process withdraw failed: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      }
    },
    [connection, publicKey, signTransaction, signAllTransactions],
  );

  /* ── Record Trade (oracle co-sign via backend) ────────────────── */
  const recordTrade = useCallback(
    async (params: {
      profileAddress: string;
      market: string;
      direction: "long" | "short";
      sizeUsd: number;
      leverageX100: number;
      entryPx: number;
      exitPx: number;
      feesUsd: number;
      wasLiquidated: boolean;
      openedAt: number;
      closedAt: number;
    }): Promise<boolean> => {
      if (!publicKey) {
        setTxStatus("Connect your wallet first.");
        return false;
      }
      setTxStatus(`Recording trade: ${params.direction.toUpperCase()} ${params.market}…`);
      setTxSig(null);
      try {
        const token = typeof localStorage !== "undefined" ? localStorage.getItem("arcadia_jwt") : null;
        const simRes = await fetch("/api/v1/trades/simulate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            profile:   params.profileAddress,
            market:    params.market,
            direction: params.direction === "long" ? 0 : 1,
            size_usd:  params.sizeUsd,
            leverage:  params.leverageX100 / 100,
            entry_px:  params.entryPx,
            exit_px:   params.exitPx,
          }),
        });

        if (!simRes.ok) {
          const errText = await simRes.text().catch(() => "unknown error");
          throw new Error(`Oracle co-sign failed: ${errText}`);
        }

        const { tx_base64, simulated } = await simRes.json();

        if (simulated) {
          setTxStatus(`Trade recorded (devnet simulation): ${params.direction.toUpperCase()} ${params.market} $${params.sizeUsd} @ ${(params.leverageX100 / 100).toFixed(1)}×`);
          return true;
        }

        if (tx_base64) {
          const { Transaction } = await import("@solana/web3.js");
          const tx = Transaction.from(Buffer.from(tx_base64, "base64"));
          const sig = await sendTransaction(tx, connection);
          await connection.confirmTransaction(sig, "confirmed");
          setTxSig(sig);
          setTxStatus(`Trade recorded on-chain. Signature: ${sig.slice(0, 8)}…`);
          return true;
        }

        setTxStatus("Trade simulation completed.");
        return true;
      } catch (err: unknown) {
        setTxStatus(`Record trade failed: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      }
    },
    [connection, publicKey, sendTransaction],
  );

  /* ── Withdraw Profit (trader) ─────────────────────────────────── */
  const withdrawProfit = useCallback(
    async (amountUsdc: number): Promise<boolean> => {
      if (!publicKey || !signTransaction || !signAllTransactions) {
        setTxStatus("Connect your wallet first.");
        return false;
      }
      setTxStatus(`Processing profit withdrawal of $${amountUsdc.toFixed(2)}…`);
      setTxSig(null);
      try {
        const { isLive } = await checkLive(connection, publicKey, publicKey);
        if (!isLive) {
          await sleep(1_200);
          const sig = simulatedSig();
          setTxSig(sig);
          setTxStatus(`$${amountUsdc.toFixed(2)} profit withdrawn (devnet simulation). Signature: ${sig.slice(0, 8)}…`);
          return true;
        }

        const [profilePDAAddr] = findTraderProfile(publicKey);
        const { baseMint, vaultToken } = await checkLive(connection, publicKey, publicKey);
        const traderToken = getAssociatedTokenAddressSync(baseMint, publicKey);
        const amountU64 = new BN(Math.floor(amountUsdc * 1_000_000));
        const program = makeProgram(connection, publicKey, signTransaction, signAllTransactions);

        const sig = await (program.methods as any).traderWithdrawProfit(amountU64).accounts({
          trader: publicKey,
          profile: profilePDAAddr,
          baseMint,
          vaultToken,
          traderToken,
          tokenProgram: TOKEN_PROGRAM_ID,
        }).rpc();

        setTxSig(sig);
        setTxStatus(`$${amountUsdc.toFixed(2)} profit withdrawn. Signature: ${sig.slice(0, 8)}…`);
        return true;
      } catch (err: unknown) {
        setTxStatus(`Withdrawal failed: ${err instanceof Error ? err.message : String(err)}`);
        return false;
      }
    },
    [connection, publicKey, signTransaction, signAllTransactions],
  );

  /* ── Derive PDAs for a trader wallet (display helper) ─────────── */
  const derivePDAsForTrader = useCallback(
    (traderWallet: string): { profile: string; investor?: string; position?: string } | null => {
      try {
        const traderKey = new PublicKey(traderWallet);
        const [profAddr] = findTraderProfile(traderKey);
        if (publicKey) {
          const [invAddr] = findInvestorAccount(publicKey);
          const [posAddr] = findInvestorPosition(publicKey, profAddr);
          return { profile: profAddr.toBase58(), investor: invAddr.toBase58(), position: posAddr.toBase58() };
        }
        return { profile: profAddr.toBase58() };
      } catch {
        return null;
      }
    },
    [publicKey],
  );

  return {
    programId:           ARCADIA_PROGRAM_ID.toBase58(),
    onChainState,
    loadingChain,
    fetchOnChainState,
    initializeProfile,
    initializeInvestor,
    deposit,
    requestWithdraw,
    processWithdraw,
    recordTrade,
    withdrawProfit,
    txStatus,
    txSig,
    setTxStatus,
    derivePDAsForTrader,
    platformPDA:   () => findPlatformConfig()[0].toBase58(),
    profilePDAFor: (w: string) => { try { return findTraderProfile(new PublicKey(w))[0].toBase58(); } catch { return ""; } },
  };
}
