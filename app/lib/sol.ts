// Kiln/app/lib/sol.ts
// Solana connection & transaction helpers for the frontend.
//
// Purpose:
// - Provide a small, well-typed helper set to create a Connection, adapt a browser wallet
//   (Phantom / window.solana) into a minimal signer shape, build and send transactions,
//   and confirm them with a robust polling/commitment strategy.
//
// Notes:
// - This module uses `@solana/web3.js` for the on-chain Connection and Transaction primitives.
//   It is intentionally light-weight so it can be used with either a raw `window.solana` wallet
//   or a wallet adapter that exposes `signTransaction` and `signAllTransactions`.
// - The project's generated client expects some `TransactionSigner` shape; the helpers here
//   produce simple wrappers compatible with common wallet adapters.
// - RPC endpoint is taken from `import.meta.env.VITE_RPC_URL` if present, otherwise defaults
//   to Devnet. In production you should point this at your Helius or RPC provider endpoint.
//
// Example usage:
//
//   import { createConnection, makeWalletFromWindow, sendAndConfirmTx } from "@/lib/sol";
//
//   const conn = createConnection();
//   const wallet = await makeWalletFromWindow();
//   const tx = new Transaction();
//   tx.add(...instructions);
//   tx.feePayer = wallet.publicKey;
//   await sendAndConfirmTx(conn, wallet, tx);
//

import {
    Connection,
    Transaction,
    TransactionInstruction,
    PublicKey,
    Commitment,
    sendAndConfirmRawTransaction,
    LAMPORTS_PER_SOL,
} from "@solana/web3.js";

type MinimalWalletAdapter = {
    publicKey: PublicKey;
    signTransaction?: (tx: Transaction) => Promise<Transaction>;
    signAllTransactions?: (txs: Transaction[]) => Promise<Transaction[]>;
};

const DEFAULT_RPC = "https://api.devnet.solana.com";
const DEFAULT_COMMITMENT: Commitment = "confirmed";

/**
 * Return a Helius API key if set in the environment.
 *
 * Frontend: set VITE_HELIUS_API_KEY to expose to the client (only for dev/test).
 * Backend / server: set HELIUS_API_KEY in the server environment.
 */
export function getHeliusApiKey(): string | null {
    try {
        // Vite exposes client env vars as import.meta.env.VITE_*
        // Node-based runtime may use process.env. We try both safely.
        // @ts-ignore - import.meta may not exist in some runtimes
        const key =
            (import.meta &&
                import.meta.env &&
                import.meta.env.VITE_HELIUS_API_KEY) ||
            (typeof process !== "undefined" && process?.env?.HELIUS_API_KEY);
        return key && typeof key === "string" && key.length > 0 ? key : null;
    } catch {
        return null;
    }
}

/**
 * Get the RPC URL to use for connections. Looks up `import.meta.env.VITE_RPC_URL`.
 */
export function getRpcUrl(): string {
    try {
        // Vite-style environment variable
        // @ts-ignore
        const envUrl =
            (import.meta && import.meta.env && import.meta.env.VITE_RPC_URL) ||
            process?.env?.VITE_RPC_URL;
        if (envUrl && typeof envUrl === "string" && envUrl.length > 0)
            return envUrl;
    } catch {
        // ignore
    }
    return DEFAULT_RPC;
}

/**
 * Create a new Connection to the Solana cluster.
 * You can pass an explicit rpcUrl, otherwise the environment or default is used.
 */
export function createConnection(
    rpcUrl?: string,
    commitment: Commitment = DEFAULT_COMMITMENT,
): Connection {
    const url = rpcUrl ?? getRpcUrl();
    return new Connection(url, { commitment });
}

/**
 * Try to adapt `window.solana` (e.g. Phantom) into a MinimalWalletAdapter.
 * If no window wallet is present, returns null.
 */
export async function makeWalletFromWindow(): Promise<MinimalWalletAdapter | null> {
    // Access window in a safe way (SSR safe)
    // @ts-ignore
    const w = typeof window !== "undefined" ? (window as any) : undefined;
    if (!w || !w.solana) return null;

    const provider = w.solana;

    // If provider is not connected, try to connect silently (Phantom supports `connect({ onlyIfTrusted: true })`).
    try {
        // Some wallets expose `isConnected` and `connect`.
        if (!provider.isConnected && provider.connect) {
            // try connect only if trusted to avoid modal; fallback to no connect
            try {
                await provider.connect({ onlyIfTrusted: true });
            } catch {
                // ignore; user will open modal later
            }
        }
    } catch {
        // ignore
    }

    if (!provider.publicKey) {
        return null;
    }

    const adapter: MinimalWalletAdapter = {
        publicKey: new PublicKey(provider.publicKey.toString()),
        signTransaction: async (tx: Transaction) => {
            // Phantom / many adapters expect a Transaction with recent blockhash & feePayer set.
            // The adapter will sign and return the transaction.
            // Note: provider.signTransaction may mutate in-place; but we return the signed tx anyway.
            // @ts-ignore
            if (provider.signTransaction) {
                // Some providers expect `provider.signTransaction(tx)`, others `signTransaction(transaction)`.
                const signed = await provider.signTransaction(tx);
                return signed;
            }
            // If no signTransaction, throw.
            throw new Error("Wallet does not support signTransaction");
        },
        signAllTransactions: async (txs: Transaction[]) => {
            // @ts-ignore
            if (provider.signAllTransactions) {
                const signed = await provider.signAllTransactions(txs);
                return signed;
            }
            // Fallback: sign individually
            const out: Transaction[] = [];
            for (const tx of txs) {
                // If provider only supports signTransaction, call it repeatedly
                // @ts-ignore
                if (provider.signTransaction) {
                    const s = await provider.signTransaction(tx);
                    out.push(s);
                } else {
                    throw new Error(
                        "Wallet does not support signAllTransactions",
                    );
                }
            }
            return out;
        },
    };

    return adapter;
}

/**
 * Build a Transaction from instruction array. Accepts optional feePayer and recentBlockhash
 * (if not provided, the caller should `recentBlockhash` on the transaction before signing).
 */
export function buildTransaction(
    instructions: TransactionInstruction[],
    feePayer: PublicKey,
): Transaction {
    const tx = new Transaction();
    tx.feePayer = feePayer;
    for (const ix of instructions) tx.add(ix);
    return tx;
}

/**
 * Sign a transaction using the provided wallet adapter.
 * This function will not send the transaction; it returns the signed transaction ready to be serialized.
 */
export async function signTransactionWithWallet(
    connection: Connection,
    wallet: MinimalWalletAdapter,
    tx: Transaction,
): Promise<Transaction> {
    // Ensure tx has a recent blockhash set.
    if (!tx.recentBlockhash) {
        const { blockhash } = await connection.getRecentBlockhash();
        tx.recentBlockhash = blockhash;
    }

    // Ensure feePayer is set
    if (!tx.feePayer) {
        tx.feePayer = wallet.publicKey;
    }

    // Use wallet.signTransaction if available
    if (wallet.signTransaction) {
        return await wallet.signTransaction(tx);
    }

    throw new Error("Wallet adapter does not support signTransaction");
}

/**
 * Send a signed transaction (raw) and optionally wait for confirmation.
 * Returns the signature string once submitted. By default waits for "confirmed" finality.
 */
export async function sendSignedTransaction(
    connection: Connection,
    signedTx: Transaction,
    commitment: Commitment = DEFAULT_COMMITMENT,
    timeoutMs = 60_000,
): Promise<string> {
    const raw = signedTx.serialize();
    const signature = await connection.sendRawTransaction(raw);
    // Wait for confirmation
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        // eslint-disable-next-line no-await-in-loop
        const status = await connection.getSignatureStatuses([signature]);
        const s = status && status.value && status.value[0];
        if (s) {
            if (s.confirmations === null && s.err == null) {
                // finalized/confirmed depending on RPC - treat as confirmed
                return signature;
            }
            if (s.confirmations && s.confirmations > 0 && s.err == null) {
                return signature;
            }
            if (s.err) {
                throw new Error(
                    `Transaction ${signature} failed: ${JSON.stringify(s.err)}`,
                );
            }
        }
        // eslint-disable-next-line no-await-in-loop
        await sleep(500);
    }
    throw new Error(`Timed out awaiting confirmation for tx ${signature}`);
}

/**
 * Convenience: sign + send + confirm a transaction using the wallet adapter.
 * - Prepares recent blockhash if missing
 * - Signs with wallet.signTransaction
 * - Sends the tx and waits for confirmation
 */
export async function signAndSendTransaction(
    connection: Connection,
    wallet: MinimalWalletAdapter,
    tx: Transaction,
    commitment: Commitment = DEFAULT_COMMITMENT,
    timeoutMs = 60_000,
): Promise<string> {
    const signed = await signTransactionWithWallet(connection, wallet, tx);
    return await sendSignedTransaction(
        connection,
        signed,
        commitment,
        timeoutMs,
    );
}

/**
 * Convenience: assemble and send instructions in a single transaction (simple path).
 * If the wallet supports signAllTransactions and you provide multiple transactions,
 * you can extend this helper to use that API. For now, this builds one txn and sends it.
 */
export async function sendAndConfirmInstructions(
    connection: Connection,
    wallet: MinimalWalletAdapter,
    instructions: TransactionInstruction[],
    opts?: {
        feePayer?: PublicKey;
        commitment?: Commitment;
        timeoutMs?: number;
    },
): Promise<string> {
    const feePayer = opts?.feePayer ?? wallet.publicKey;
    const tx = buildTransaction(instructions, feePayer);
    return await signAndSendTransaction(
        connection,
        wallet,
        tx,
        opts?.commitment ?? DEFAULT_COMMITMENT,
        opts?.timeoutMs ?? 60_000,
    );
}

/* Utility sleep */
function sleep(ms: number) {
    return new Promise((res) => setTimeout(res, ms));
}

/* Small helper to airdrop devnet lamports (handy for local dev). Will throw if not on a cluster that supports airdrops. */
export async function requestAirdrop(
    connection: Connection,
    to: PublicKey,
    sol = 1,
) {
    const sig = await connection.requestAirdrop(
        to,
        Math.round(sol * LAMPORTS_PER_SOL),
    );
    await connection.confirmTransaction(sig);
    return sig;
}

/* Export types for external use */
export type { MinimalWalletAdapter };
export default {
    getRpcUrl,
    createConnection,
    makeWalletFromWindow,
    buildTransaction,
    signTransactionWithWallet,
    sendSignedTransaction,
    signAndSendTransaction,
    sendAndConfirmInstructions,
    requestAirdrop,
};
