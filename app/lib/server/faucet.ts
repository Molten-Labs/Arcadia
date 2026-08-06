/**
 * Devnet USDC faucet backed by a funded reserve wallet (Option B).
 *
 * Flash's devnet pool only accepts the spl-token-faucet USDC mint
 * (Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr) as collateral. Its mint
 * authority is a PDA owned by the faucet program, so it cannot be minted by
 * us. Instead this faucet holds a large pre-funded balance in a reserve
 * keypair (FAUCET_KEYPAIR) and transfers a fixed amount to each tester on
 * request, plus a SOL airdrop so the execution wallet can pay fees.
 *
 * The reserve is seeded once via `scripts/fund-reserve.mjs`.
 */
import bs58 from "bs58";
import {
  Connection,
  Keypair,
  PublicKey,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  transfer,
} from "@solana/spl-token";

export const FAUCET_USDC_MINT = new PublicKey(
  "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr",
);

export const DEFAULT_CLAIM_USD = 1_000;
export const DEFAULT_CLAIM_SOL = 1;
/** Max number of claims per wallet (per rolling window). */
const MAX_CLAIMS_PER_WALLET = 3;
const CLAIM_WINDOW_MS = 60 * 60 * 1000;

function rpcUrl(): string {
  return (
    process.env.FAUCET_RPC_URL?.trim() ??
    process.env.NEXT_PUBLIC_HELIUS_RPC?.trim() ??
    "https://api.devnet.solana.com"
  );
}

function reserveKeypair(): Keypair {
  const raw = process.env.FAUCET_KEYPAIR?.trim();
  if (!raw) {
    throw new Error("FAUCET_KEYPAIR is not set; the devnet faucet is disabled.");
  }
  try {
    if (raw.startsWith("[")) {
      return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
    }
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch {
    throw new Error("FAUCET_KEYPAIR is not a valid base58 secret key.");
  }
}

function isDevnet(rpc: string): boolean {
  return rpc.includes("devnet") || rpc.includes("api.testnet");
}

/** In-memory per-wallet claim ledger. Resets on process restart. */
const claims = new Map<string, number[]>();

function pruneClaims(wallet: string, now: number) {
  const list = (claims.get(wallet) ?? []).filter((t) => now - t < CLAIM_WINDOW_MS);
  if (list.length === 0) claims.delete(wallet);
  else claims.set(wallet, list);
  return list;
}

export type FaucetResult =
  | {
      ok: true;
      wallet: string;
      usdcAmount: number;
      solAmount: number;
      reserveBalanceUsd: number;
      solSignature: string | null;
      usdcSignature: string;
    }
  | { ok: false; reason: string };

export function faucetEnabled(): boolean {
  return Boolean(process.env.FAUCET_KEYPAIR?.trim());
}

export function parseTargetAddress(address: string): PublicKey | null {
  try {
    const pubkey = new PublicKey(address);
    if (bs58.decode(address).length !== 32) return null;
    return pubkey;
  } catch {
    return null;
  }
}

export async function claimFaucet(
  address: string,
  usdcAmount = DEFAULT_CLAIM_USD,
  solAmount = DEFAULT_CLAIM_SOL,
): Promise<FaucetResult> {
  const target = parseTargetAddress(address);
  if (!target) {
    return { ok: false, reason: "Invalid Solana address." };
  }

  const rpc = rpcUrl();
  if (!isDevnet(rpc)) {
    return { ok: false, reason: "Faucet is only available on devnet." };
  }

  const now = Date.now();
  const recent = pruneClaims(address, now);
  if (recent.length >= MAX_CLAIMS_PER_WALLET) {
    return {
      ok: false,
      reason: `Rate limited: ${MAX_CLAIMS_PER_WALLET} claims per hour per wallet.`,
    };
  }

  const connection = new Connection(rpc, "confirmed");
  const reserve = reserveKeypair();

  try {
    // The reserve pays for the tester's ATA creation, so it needs SOL.
    const reserveLamports = await connection.getBalance(reserve.publicKey);
    if (reserveLamports < 5_000_000) {
      return {
        ok: false,
        reason: "Faucet reserve is out of SOL. Run scripts/fund-reserve.mjs.",
      };
    }

    // Airdrop SOL to the tester so their execution wallet can pay fees.
    let solSignature: string | null = null;
    if (solAmount > 0) {
      try {
        solSignature = await connection.requestAirdrop(
          target,
          Math.round(solAmount * 1e9),
        );
        if (solSignature) {
          await connection.confirmTransaction(solSignature, "confirmed");
        }
      } catch {
        // Airdrop may be rate-limited by the RPC; execution can still proceed
        // if the wallet already holds SOL. Surface success only for the USDC.
      }
    }

    // Ensure the reserve holds the USDC (seeded by fund-reserve.mjs).
    const sourceInfo = await getOrCreateAssociatedTokenAccount(
      connection,
      reserve,
      FAUCET_USDC_MINT,
      reserve.publicKey,
    );
    const reserveBalance = await connection.getTokenAccountBalance(sourceInfo.address);
    const reserveBalanceUsd = Number(reserveBalance.value.uiAmount ?? 0);

    const destInfo = await getOrCreateAssociatedTokenAccount(
      connection,
      reserve,
      FAUCET_USDC_MINT,
      target,
    );

    const amountRaw = Math.round(usdcAmount * 1e6);

    const usdcSignature = await transfer(
      connection,
      reserve,
      sourceInfo.address,
      destInfo.address,
      reserve.publicKey,
      amountRaw,
    );
    await connection.confirmTransaction(usdcSignature, "confirmed");

    claims.set(address, [...recent, now]);

    return {
      ok: true,
      wallet: target.toBase58(),
      usdcAmount,
      solAmount,
      reserveBalanceUsd,
      solSignature,
      usdcSignature,
    };
  } catch (err) {
    return {
      ok: false,
      reason:
        err instanceof Error
          ? `Faucet transfer failed: ${err.message.slice(0, 200)}`
          : "Faucet transfer failed.",
    };
  }
}
