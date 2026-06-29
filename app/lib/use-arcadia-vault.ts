"use client";

/**
 * useArcadiaVault — React hook that bridges the frontend to the
 * arcadia_vault Anchor program on Solana devnet.
 *
 * Uses @solana/web3.js to:
 *  - Derive the program's PDAs (platform, profile, investor, position)
 *  - Check whether those accounts exist on devnet
 *  - Send real transactions when the program is deployed; otherwise
 *    show a labeled "devnet simulation" message.
 *
 * Program ID: 4QX1neZXvYnhFT4bGfbbnA17LfCKtrVa2Xwk3kuhUNWM
 */

import { useCallback, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";

/* ── Constants ──────────────────────────────────────────────────── */
export const ARCADIA_PROGRAM_ID = new PublicKey(
  "4QX1neZXvYnhFT4bGfbbnA17LfCKtrVa2Xwk3kuhUNWM"
);

/* ── PDA helpers (seeds must match arcadia_vault/src/lib.rs) ────── */
export function platformConfigPDA(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    ARCADIA_PROGRAM_ID
  );
}

export function profilePDA(traderWallet: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("profile"), traderWallet.toBuffer()],
    ARCADIA_PROGRAM_ID
  );
}

export function investorAccountPDA(investor: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("investor"), investor.toBuffer()],
    ARCADIA_PROGRAM_ID
  );
}

export function investorPositionPDA(
  investor: PublicKey,
  profile: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("position"), investor.toBuffer(), profile.toBuffer()],
    ARCADIA_PROGRAM_ID
  );
}

/* ── On-chain state snapshot ────────────────────────────────────── */
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

/* ── Helper: check if program is live ───────────────────────────── */
async function isProgramDeployed(connection: ReturnType<typeof useConnection>["connection"]): Promise<boolean> {
  try {
    const [platAddr] = platformConfigPDA();
    const info = await connection.getAccountInfo(platAddr);
    return info !== null;
  } catch {
    return false;
  }
}

/* ── Hook ───────────────────────────────────────────────────────── */
export function useArcadiaVault(traderProfilePubkey?: string) {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const [txStatus, setTxStatus] = useState<string | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [onChainState, setOnChainState] = useState<VaultOnChainState | null>(null);
  const [loadingChain, setLoadingChain] = useState(false);

  /* ── Fetch on-chain state ─────────────────────────────────────── */
  const fetchOnChainState = useCallback(async () => {
    if (!publicKey) return;
    setLoadingChain(true);
    try {
      const [platAddr] = platformConfigPDA();
      const [invAddr]  = investorAccountPDA(publicKey);

      let profileAddr: PublicKey | null = null;
      let posAddr: PublicKey | null = null;

      if (traderProfilePubkey) {
        try {
          profileAddr = new PublicKey(traderProfilePubkey);
          [posAddr]   = investorPositionPDA(publicKey, profileAddr);
        } catch {
          // invalid pubkey — skip
        }
      }

      const toCheck: PublicKey[] = [platAddr, invAddr];
      if (profileAddr) toCheck.push(profileAddr);
      if (posAddr)     toCheck.push(posAddr);

      const infos = await connection.getMultipleAccountsInfo(toCheck);

      setOnChainState({
        programDeployed:      infos[0] !== null || infos[1] !== null,
        platformInitialized:  infos[0] !== null,
        investorInitialized:  infos[1] !== null,
        profileExists:        profileAddr ? (infos[2] !== null) : false,
        positionExists:       posAddr ? (infos[toCheck.indexOf(posAddr)] !== null) : false,
        platformAddress:      platAddr.toBase58(),
        profileAddress:       profileAddr?.toBase58() ?? "",
        investorAddress:      invAddr.toBase58(),
        positionAddress:      posAddr?.toBase58() ?? "",
      });
    } catch (err) {
      console.error("useArcadiaVault.fetchOnChainState:", err);
    } finally {
      setLoadingChain(false);
    }
  }, [connection, publicKey, traderProfilePubkey]);

  /* ── Initialize Profile (trader one-time setup) ───────────────── */
  const initializeProfile = useCallback(
    async (
      handle: string,
      maxLeverage: number,
      styleTags: string[]
    ): Promise<boolean> => {
      if (!publicKey) {
        setTxStatus("Connect your wallet first.");
        return false;
      }
      setTxStatus(`Creating trader profile "${handle}"…`);
      setTxSig(null);

      try {
        const [profAddr] = profilePDA(publicKey);
        const deployed = await isProgramDeployed(connection);

        if (!deployed) {
          await new Promise((r) => setTimeout(r, 1_500));
          setTxStatus(
            `Profile "${handle}" created (devnet simulation). ` +
            `Profile PDA: ${profAddr.toBase58().slice(0, 8)}…`
          );
          return true;
        }

        // Program is live — requires Anchor IDL to build the instruction.
        // When the IDL is available, replace this with:
        //   program.methods.initializeProfile(handle, maxLeverage, styleTags)
        //     .accounts({ trader: publicKey, profile: profAddr, ... })
        //     .rpc()
        setTxStatus(
          `Program deployed. Use the Anchor IDL to call initialize_profile. ` +
          `Profile PDA: ${profAddr.toBase58()}`
        );
        return false;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setTxStatus(`Initialize profile failed: ${msg}`);
        return false;
      }
    },
    [connection, publicKey]
  );

  /* ── Initialize Investor (first-time investor setup) ─────────── */
  const initializeInvestor = useCallback(
    async (profileAddress: string): Promise<boolean> => {
      if (!publicKey) {
        setTxStatus("Connect your wallet first.");
        return false;
      }
      setTxStatus("Setting up your investor account…");
      setTxSig(null);

      try {
        const profileKey = new PublicKey(profileAddress);
        const [invAddr]  = investorAccountPDA(publicKey);
        const [posAddr]  = investorPositionPDA(publicKey, profileKey);
        const deployed   = await isProgramDeployed(connection);

        if (!deployed) {
          await new Promise((r) => setTimeout(r, 1_200));
          setTxStatus(
            `Investor account created (devnet simulation). ` +
            `Investor PDA: ${invAddr.toBase58().slice(0, 8)}… ` +
            `Position PDA: ${posAddr.toBase58().slice(0, 8)}…`
          );
          return true;
        }

        // Program is live — build initialize_investor instruction via Anchor IDL
        setTxStatus(
          `Program deployed. Use the Anchor IDL to call initialize_investor. ` +
          `Investor PDA: ${invAddr.toBase58()}`
        );
        return false;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setTxStatus(`Initialize investor failed: ${msg}`);
        return false;
      }
    },
    [connection, publicKey]
  );

  /* ── Deposit ──────────────────────────────────────────────────── */
  const deposit = useCallback(
    async (profileAddress: string, amountUsdc: number): Promise<boolean> => {
      if (!publicKey) {
        setTxStatus("Connect your wallet first.");
        return false;
      }

      setTxStatus(`Initiating deposit of $${amountUsdc.toFixed(2)} USDC…`);
      setTxSig(null);

      try {
        const profileKey = new PublicKey(profileAddress);
        const [invPDA]   = investorAccountPDA(publicKey);
        const [posPDA]   = investorPositionPDA(publicKey, profileKey);
        const deployed   = await isProgramDeployed(connection);

        if (!deployed) {
          await new Promise((r) => setTimeout(r, 1_500));
          setTxStatus(
            `Deposit of $${amountUsdc.toFixed(2)} recorded (devnet simulation). ` +
            `Investor PDA: ${invPDA.toBase58().slice(0, 8)}… ` +
            `Position PDA: ${posPDA.toBase58().slice(0, 8)}…`
          );
          return true;
        }

        // Program is live — build deposit instruction via Anchor IDL
        setTxStatus(
          `Program deployed. Use the Anchor IDL to call deposit. ` +
          `Profile: ${profileKey.toBase58()}`
        );
        return false;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setTxStatus(`Deposit failed: ${msg}`);
        return false;
      }
    },
    [connection, publicKey]
  );

  /* ── Request withdraw ─────────────────────────────────────────── */
  const requestWithdraw = useCallback(
    async (profileAddress: string, shares: number): Promise<boolean> => {
      if (!publicKey) {
        setTxStatus("Connect your wallet first.");
        return false;
      }
      setTxStatus(`Requesting withdrawal of ${shares} shares…`);
      setTxSig(null);

      try {
        const profileKey = new PublicKey(profileAddress);
        const [posPDA]   = investorPositionPDA(publicKey, profileKey);
        const deployed   = await isProgramDeployed(connection);

        if (!deployed) {
          await new Promise((r) => setTimeout(r, 1_200));
          setTxStatus(
            `Withdraw request for ${shares} shares recorded (devnet simulation). ` +
            `Position PDA: ${posPDA.toBase58().slice(0, 8)}…`
          );
          return true;
        }
        setTxStatus("Program deployed. Use the Anchor IDL to call request_withdraw.");
        return false;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setTxStatus(`Withdraw request failed: ${msg}`);
        return false;
      }
    },
    [connection, publicKey]
  );

  /* ── Process withdraw (execute a queued withdrawal) ──────────── */
  const processWithdraw = useCallback(
    async (profileAddress: string): Promise<boolean> => {
      if (!publicKey) {
        setTxStatus("Connect your wallet first.");
        return false;
      }
      setTxStatus("Processing queued withdrawal…");
      setTxSig(null);

      try {
        const profileKey = new PublicKey(profileAddress);
        const [posPDA]   = investorPositionPDA(publicKey, profileKey);
        const deployed   = await isProgramDeployed(connection);

        if (!deployed) {
          await new Promise((r) => setTimeout(r, 1_200));
          setTxStatus(
            `Withdrawal processed (devnet simulation). ` +
            `Position PDA: ${posPDA.toBase58().slice(0, 8)}…`
          );
          return true;
        }
        setTxStatus("Program deployed. Use the Anchor IDL to call process_withdraw.");
        return false;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setTxStatus(`Process withdraw failed: ${msg}`);
        return false;
      }
    },
    [connection, publicKey]
  );

  /* ── Record trade (devnet sim: requires oracle co-sign) ────────
   *  In the real flow the backend co-signs as oracle_authority.
   *  Here we request a co-sign from /api/v1/trades/simulate first,
   *  then send the dual-signed transaction.
   * ─────────────────────────────────────────────────────────────── */
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
        // Request the backend to co-sign as oracle_authority
        const token = localStorage.getItem("arcadia_jwt");
        // Rust SimTradeReq uses `leverage` as a decimal multiplier (e.g. 3.0),
      // and computes fees / was_liquidated itself — do not send them.
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
            leverage:  params.leverageX100 / 100,   // convert x100 → decimal (3.0)
            entry_px:  params.entryPx,
            exit_px:   params.exitPx,
            // opened_at / closed_at are optional; server defaults to now-1h / now
          }),
        });

        if (!simRes.ok) {
          const err = await simRes.text().catch(() => "unknown error");
          throw new Error(`Oracle co-sign failed: ${err}`);
        }

        const { tx_base64, simulated } = await simRes.json();

        if (simulated) {
          // Backend recorded the trade directly (devnet simulation mode)
          setTxStatus(
            `Trade recorded (devnet simulation): ${params.direction.toUpperCase()} ` +
            `${params.market} $${params.sizeUsd} @ ${params.leverageX100 / 100}×`
          );
          return true;
        }

        if (tx_base64) {
          // Real path: send the partially-signed transaction (backend already co-signed)
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
        const msg = err instanceof Error ? err.message : String(err);
        setTxStatus(`Record trade failed: ${msg}`);
        return false;
      }
    },
    [connection, publicKey, sendTransaction]
  );

  /* ── Trader: withdraw profit ──────────────────────────────────── */
  const withdrawProfit = useCallback(
    async (amountUsdc: number): Promise<boolean> => {
      if (!publicKey) {
        setTxStatus("Connect your wallet first.");
        return false;
      }
      setTxStatus(`Processing profit withdrawal of $${amountUsdc.toFixed(2)}…`);
      setTxSig(null);

      try {
        const deployed = await isProgramDeployed(connection);

        if (!deployed) {
          await new Promise((r) => setTimeout(r, 1_200));
          setTxStatus(
            `$${amountUsdc.toFixed(2)} profit withdrawal processed (devnet simulation). ` +
            `Program: ${ARCADIA_PROGRAM_ID.toBase58().slice(0, 8)}…`
          );
          return true;
        }
        setTxStatus("Program deployed. Use the Anchor IDL to call trader_withdraw_profit.");
        return false;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        setTxStatus(`Withdrawal failed: ${msg}`);
        return false;
      }
    },
    [connection, publicKey]
  );

  /* ── Derive PDAs for a trader wallet (display helper) ────────── */
  const derivePDAsForTrader = useCallback(
    (traderWallet: string): {
      profile: string;
      investor?: string;
      position?: string;
    } | null => {
      try {
        const traderKey  = new PublicKey(traderWallet);
        const [profAddr] = profilePDA(traderKey);
        if (publicKey) {
          const [invAddr] = investorAccountPDA(publicKey);
          const [posAddr] = investorPositionPDA(publicKey, profAddr);
          return {
            profile:  profAddr.toBase58(),
            investor: invAddr.toBase58(),
            position: posAddr.toBase58(),
          };
        }
        return { profile: profAddr.toBase58() };
      } catch {
        return null;
      }
    },
    [publicKey]
  );

  return {
    /* Program info */
    programId: ARCADIA_PROGRAM_ID.toBase58(),
    /* On-chain read */
    onChainState,
    loadingChain,
    fetchOnChainState,
    /* Transactions */
    initializeProfile,
    initializeInvestor,
    deposit,
    requestWithdraw,
    processWithdraw,
    recordTrade,
    withdrawProfit,
    /* Status feedback */
    txStatus,
    txSig,
    setTxStatus,
    /* PDA helpers */
    derivePDAsForTrader,
    platformPDA: () => platformConfigPDA()[0].toBase58(),
    profilePDAFor: (w: string) => {
      try { return profilePDA(new PublicKey(w))[0].toBase58(); }
      catch { return ""; }
    },
  };
}
