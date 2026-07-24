"use client";

import { useCallback, useState } from "react";
import {
  useWalletCompat,
  useConnectionCompat,
  useAnchorWalletCompat,
} from "@/lib/use-wallet-compat";
import { PublicKey, Transaction, Keypair, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { SystemProgram } from "@solana/web3.js";
import {
  findInvestorAccount,
  findInvestorPosition,
  findPlatformConfig,
  findTraderProfile,
} from "./arcadia-sdk";
import {
  getVaultChainStatus,
  makeArcadiaProgram,
  pushEvent,
  IDLE_TX_STATE,
  type VaultChainStatus,
  type VaultTxState,
} from "./vault-client";

export type { VaultTxPhase, VaultTxState } from "./vault-client";

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

function toTraderKey(walletOrProfile: string, fallback: PublicKey): PublicKey {
  try {
    return new PublicKey(walletOrProfile);
  } catch {
    return fallback;
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;
    if (typeof e.message === "string" && e.message) return e.message;
    if (e.logs && Array.isArray(e.logs)) return e.logs.join("\n");
    try { return JSON.stringify(err); } catch { return String(err); }
  }
  return String(err);
}

export function useArcadiaVault(traderProfilePubkey?: string) {
  const { connection } = useConnectionCompat();
  const anchorWallet = useAnchorWalletCompat();
  const { publicKey, sendTransaction } = useWalletCompat();

  const [txState, setTxState] = useState<VaultTxState>(IDLE_TX_STATE);
  const [onChainState, setOnChainState] = useState<VaultOnChainState | null>(null);
  const [chainError, setChainError] = useState<string | null>(null);
  const [loadingChain, setLoadingChain] = useState(false);

  const resetTx = useCallback(() => setTxState(IDLE_TX_STATE), []);

  const progress = useCallback(
    (phase: VaultTxState["phase"], message: string, simulated = false) => {
      setTxState({ phase, message, sig: null, simulated });
    },
    [],
  );

  const succeed = useCallback((message: string, sig: string | null, simulated: boolean) => {
    setTxState({ phase: "success", message, sig, simulated });
  }, []);

  const fail = useCallback((message: string): false => {
    setTxState({ phase: "error", message, sig: null, simulated: false });
    return false;
  }, []);

  const statusOrFail = useCallback(
    async (traderKey: PublicKey, depositor: PublicKey): Promise<VaultChainStatus | null> => {
      try {
        return await getVaultChainStatus(connection, traderKey, depositor);
      } catch (err) {
        fail(errorMessage(err));
        return null;
      }
    },
    [connection, fail],
  );

  const fetchOnChainState = useCallback(async () => {
    if (!publicKey) return;
    setLoadingChain(true);
    setChainError(null);
    try {
      const [platAddr] = findPlatformConfig();
      const [invAddr] = findInvestorAccount(publicKey);

      let profileAddr: PublicKey | null = null;
      let posAddr: PublicKey | null = null;

      if (traderProfilePubkey) {
        try {
          profileAddr = new PublicKey(traderProfilePubkey);
          [posAddr] = findInvestorPosition(publicKey, profileAddr);
        } catch {
          /* invalid pubkey — leave profile/position unchecked */
        }
      }

      const toCheck: PublicKey[] = [platAddr, invAddr];
      if (profileAddr) toCheck.push(profileAddr);
      if (posAddr) toCheck.push(posAddr);

      const infos = await connection.getMultipleAccountsInfo(toCheck);

      setOnChainState({
        programDeployed: infos[0] !== null || infos[1] !== null,
        platformInitialized: infos[0] !== null,
        investorInitialized: infos[1] !== null,
        profileExists: profileAddr ? infos[2] !== null : false,
        positionExists: posAddr ? infos[toCheck.indexOf(posAddr)] !== null : false,
        platformAddress: platAddr.toBase58(),
        profileAddress: profileAddr?.toBase58() ?? "",
        investorAddress: invAddr.toBase58(),
        positionAddress: posAddr?.toBase58() ?? "",
      });
    } catch (err) {
      setOnChainState(null);
      setChainError(errorMessage(err));
    } finally {
      setLoadingChain(false);
    }
  }, [connection, publicKey, traderProfilePubkey]);

  const initializeProfile = useCallback(
    async (handle: string, maxLeverage: number): Promise<boolean> => {
      if (!publicKey || !anchorWallet) return fail("Connect your wallet first.");
      progress("checking", `Creating trader profile "${handle}"…`);
      try {
        const [profAddr] = findTraderProfile(publicKey);
        const status = await statusOrFail(publicKey, publicKey);
        if (!status) return false;

        if (status.kind === "vault-live") {
          succeed(`Profile "${handle}" already exists on-chain.`, null, false);
          return true;
        }

        if (status.kind === "offline") {
          return fail("Vault program not deployed on this cluster — cannot initialize profile.");
        }

        const program = makeArcadiaProgram(connection, anchorWallet);
        const [configPda] = findPlatformConfig();
        const vaultKeypair = Keypair.generate();
        progress("signing", "Confirm in wallet…");
        const tx = await program.methods
          .initializeProfile(maxLeverage)
          .accountsPartial({
            trader: publicKey,
            config: configPda,
            profile: profAddr,
            baseMint: status.platformBaseMint,
            vaultToken: vaultKeypair.publicKey,
            systemProgram: SystemProgram.programId,
            tokenProgram: TOKEN_PROGRAM_ID,
            rent: SYSVAR_RENT_PUBKEY,
          })
          .signers([vaultKeypair])
          .transaction();
        const sig = await sendTransaction!(tx, connection);

        succeed(`Profile "${handle}" created on-chain. Signature: ${sig.slice(0, 8)}…`, sig, false);
        pushEvent({
          event_type: "ProfileInitialized",
          profile: profAddr.toBase58(),
          trader: publicKey.toBase58(),
          ts: Math.floor(Date.now() / 1000),
        });
        return true;
      } catch (err) {
        console.error("[initializeProfile] full error:", err);
        return fail(`Initialize profile failed: ${errorMessage(err)}`);
      }
    },
    [anchorWallet, connection, publicKey, sendTransaction, progress, succeed, fail, statusOrFail],
  );

  const initializeInvestor = useCallback(
    async (): Promise<boolean> => {
      if (!publicKey || !anchorWallet) return fail("Connect your wallet first.");
      progress("checking", "Setting up your investor account…");
      try {
        const [invAddr] = findInvestorAccount(publicKey);
        const status = await statusOrFail(publicKey, publicKey);
        if (!status) return false;

        if (status.investorExists) {
          succeed("Investor account already initialized.", null, false);
          return true;
        }

        if (status.kind === "offline") {
          return fail("Vault program not deployed on this cluster — cannot create investor account.");
        }

        const program = makeArcadiaProgram(connection, anchorWallet);
        progress("signing", "Confirm in wallet…");
        const tx = await program.methods
          .initializeInvestor()
          .accountsPartial({
            wallet: publicKey,
            investorAccount: invAddr,
            systemProgram: SystemProgram.programId,
          })
          .transaction();
        const sig = await sendTransaction!(tx, connection);
        succeed(`Investor account created. Signature: ${sig.slice(0, 8)}…`, sig, false);
        pushEvent({
          event_type: "InvestorInitialized",
          investor: publicKey.toBase58(),
          ts: Math.floor(Date.now() / 1000),
        });
        return true;
      } catch (err) {
        return fail(`Initialize investor failed: ${errorMessage(err)}`);
      }
    },
    [anchorWallet, connection, publicKey, sendTransaction, progress, succeed, fail, statusOrFail],
  );

  const deposit = useCallback(
    async (traderWalletOrProfile: string, amountUsdc: number): Promise<boolean> => {
      if (!publicKey || !anchorWallet) return fail("Connect your wallet first.");
      progress("checking", "Reading on-chain state…");
      try {
        const traderKey = toTraderKey(traderWalletOrProfile, publicKey);
        const [profilePda] = findTraderProfile(traderKey);
        const [investorPda] = findInvestorAccount(publicKey);
        const [positionPda] = findInvestorPosition(publicKey, profilePda);

        const status = await statusOrFail(traderKey, publicKey);
        if (!status) return false;

        if (status.kind !== "vault-live") {
          return fail("Vault program not deployed on this cluster — cannot deposit.");
        }

        const program = makeArcadiaProgram(connection, anchorWallet);

        if (!status.investorExists) {
          progress("init-investor", "Creating investor account on-chain…");
          const initTx = await program.methods
            .initializeInvestor()
            .accountsPartial({
              wallet: publicKey,
              investorAccount: investorPda,
              systemProgram: SystemProgram.programId,
            })
            .transaction();
          await sendTransaction!(initTx, connection);
        }

        progress("signing", `Confirm deposit of $${amountUsdc.toFixed(2)} in wallet…`);
        const amountU64 = new BN(Math.floor(amountUsdc * 1_000_000));
        const depositorToken = getAssociatedTokenAddressSync(status.baseMint, publicKey);

        const tx = await program.methods
          .deposit(amountU64)
          .accountsPartial({
            depositor: publicKey,
            investorAccount: investorPda,
            profile: profilePda,
            position: positionPda,
            baseMint: status.baseMint,
            vaultToken: status.vaultToken,
            depositorToken,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .transaction();
        const sig = await sendTransaction!(tx, connection);

        succeed(
          `Deposit of $${amountUsdc.toFixed(2)} confirmed. Signature: ${sig.slice(0, 8)}…`,
          sig,
          false,
        );
        pushEvent({
          event_type: "Deposited",
          profile: profilePda.toBase58(),
          depositor: publicKey.toBase58(),
          is_trader: false,
          amount_usd: amountUsdc.toString(),
          shares_minted: "0",
          nav_per_share: "0",
          ts: Math.floor(Date.now() / 1000),
        });
        return true;
      } catch (err) {
        return fail(`Deposit failed: ${errorMessage(err)}`);
      }
    },
    [anchorWallet, connection, publicKey, sendTransaction, progress, succeed, fail, statusOrFail],
  );

  const requestWithdraw = useCallback(
    async (traderWalletOrProfile: string, shares: number): Promise<boolean> => {
      if (!publicKey || !anchorWallet) return fail("Connect your wallet first.");
      progress("checking", `Requesting withdrawal of ${shares.toFixed(4)} shares…`);
      try {
        const traderKey = toTraderKey(traderWalletOrProfile, publicKey);
        const [profilePda] = findTraderProfile(traderKey);
        const [positionPda] = findInvestorPosition(publicKey, profilePda);
        const status = await statusOrFail(traderKey, publicKey);
        if (!status) return false;

        if (status.kind !== "vault-live") {
          return fail("Vault program not deployed on this cluster — cannot withdraw.");
        }

        const program = makeArcadiaProgram(connection, anchorWallet);
        const sharesU64 = new BN(Math.floor(shares * 1_000_000));
        progress("signing", "Confirm in wallet…");
        const tx = await program.methods
          .requestWithdraw(sharesU64)
          .accountsPartial({
            owner: publicKey,
            profile: profilePda,
            vaultToken: status.vaultToken,
            position: positionPda,
          })
          .transaction();
        const sig = await sendTransaction!(tx, connection);
        succeed(`Withdraw request submitted. Signature: ${sig.slice(0, 8)}…`, sig, false);
        return true;
      } catch (err) {
        return fail(`Withdraw request failed: ${errorMessage(err)}`);
      }
    },
    [anchorWallet, connection, publicKey, sendTransaction, progress, succeed, fail, statusOrFail],
  );

  const processWithdraw = useCallback(
    async (traderWalletOrProfile: string): Promise<boolean> => {
      if (!publicKey || !anchorWallet) return fail("Connect your wallet first.");
      progress("checking", "Processing queued withdrawal…");
      try {
        const traderKey = toTraderKey(traderWalletOrProfile, publicKey);
        const status = await statusOrFail(traderKey, publicKey);
        if (!status) return false;

        if (status.kind !== "vault-live") {
          return fail("Vault program not deployed on this cluster — cannot process withdrawal.");
        }

        const [profilePda] = findTraderProfile(traderKey);
        const [positionPda] = findInvestorPosition(publicKey, profilePda);
        const ownerToken = getAssociatedTokenAddressSync(status.baseMint, publicKey);
        const program = makeArcadiaProgram(connection, anchorWallet);

        progress("signing", "Confirm in wallet…");
        const tx = await program.methods
          .processWithdraw()
          .accountsPartial({
            owner: publicKey,
            profile: profilePda,
            position: positionPda,
            baseMint: status.baseMint,
            vaultToken: status.vaultToken,
            ownerToken,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .transaction();
        const sig = await sendTransaction!(tx, connection);
        succeed(`Withdrawal executed. Signature: ${sig.slice(0, 8)}…`, sig, false);
        pushEvent({
          event_type: "Withdrawn",
          profile: profilePda.toBase58(),
          owner: publicKey.toBase58(),
          shares_burned: "0",
          amount_usd: "0",
        });
        return true;
      } catch (err) {
        return fail(`Process withdraw failed: ${errorMessage(err)}`);
      }
    },
    [anchorWallet, connection, publicKey, sendTransaction, progress, succeed, fail, statusOrFail],
  );

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
      if (!publicKey) return fail("Connect your wallet first.");
      progress("checking", `Recording trade: ${params.direction.toUpperCase()} ${params.market}…`);
      try {
        const token =
          typeof localStorage !== "undefined" ? localStorage.getItem("arcadia_jwt") : null;
        const simRes = await fetch("/api/v1/trades/simulate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            profile: params.profileAddress,
            market: params.market,
            direction: params.direction === "long" ? 0 : 1,
            size_usd: params.sizeUsd,
            leverage: params.leverageX100 / 100,
            entry_px: params.entryPx,
            exit_px: params.exitPx,
            opened_at: new Date(params.openedAt * 1000).toISOString(),
            closed_at: new Date(params.closedAt * 1000).toISOString(),
          }),
        });

        if (!simRes.ok) {
          const errText = await simRes.text().catch(() => "unknown error");
          throw new Error(`Oracle co-sign failed: ${errText}`);
        }

        const { tx_base64, simulated } = (await simRes.json()) as {
          tx_base64?: string;
          simulated?: boolean;
        };

        if (simulated) {
          succeed(
            `Trade recorded: ${params.direction.toUpperCase()} ${params.market} $${params.sizeUsd} @ ${(params.leverageX100 / 100).toFixed(1)}×`,
            null,
            true,
          );
          return true;
        }

        if (tx_base64) {
          progress("signing", "Confirm in wallet…");
          const tx = Transaction.from(Buffer.from(tx_base64, "base64"));
          const sig = await sendTransaction!(tx, connection);
          progress("confirming", "Confirming on Solana…");
          await connection.confirmTransaction(sig, "confirmed");
          succeed(`Trade recorded on-chain. Signature: ${sig.slice(0, 8)}…`, sig, false);
          return true;
        }

        succeed("Trade recorded.", null, false);
        return true;
      } catch (err) {
        return fail(`Record trade failed: ${errorMessage(err)}`);
      }
    },
    [connection, publicKey, sendTransaction, progress, succeed, fail],
  );

  const withdrawProfit = useCallback(
    async (amountUsdc: number): Promise<boolean> => {
      if (!publicKey || !anchorWallet) return fail("Connect your wallet first.");
      progress("checking", `Processing profit withdrawal of $${amountUsdc.toFixed(2)}…`);
      try {
        const status = await statusOrFail(publicKey, publicKey);
        if (!status) return false;

        if (status.kind !== "vault-live") {
          return fail("Vault program not deployed on this cluster — cannot withdraw profits.");
        }

        const [profilePda] = findTraderProfile(publicKey);
        const traderToken = getAssociatedTokenAddressSync(status.baseMint, publicKey);
        const amountU64 = new BN(Math.floor(amountUsdc * 1_000_000));
        const program = makeArcadiaProgram(connection, anchorWallet);

        progress("signing", "Confirm in wallet…");
        const tx = await program.methods
          .traderWithdrawProfit(amountU64)
          .accountsPartial({
            trader: publicKey,
            profile: profilePda,
            baseMint: status.baseMint,
            vaultToken: status.vaultToken,
            traderToken,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .transaction();
        const sig = await sendTransaction!(tx, connection);
        succeed(`$${amountUsdc.toFixed(2)} profit withdrawn. Signature: ${sig.slice(0, 8)}…`, sig, false);
        return true;
      } catch (err) {
        return fail(`Withdrawal failed: ${errorMessage(err)}`);
      }
    },
    [anchorWallet, connection, publicKey, sendTransaction, progress, succeed, fail, statusOrFail],
  );

  return {
    txState,
    resetTx,
    onChainState,
    chainError,
    loadingChain,
    fetchOnChainState,
    initializeProfile,
    initializeInvestor,
    deposit,
    requestWithdraw,
    processWithdraw,
    recordTrade,
    withdrawProfit,
  };
}
