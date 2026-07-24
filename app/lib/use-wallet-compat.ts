"use client";

/**
 * Compatibility layer wrapping Privy hooks into the same interface as
 * @solana/wallet-adapter-react's useWallet(), useConnection(), useAnchorWallet().
 */

import { useMemo } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useWallets, useSignMessage } from "@privy-io/react-auth/solana";
import { Connection, PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_HELIUS_RPC ?? "https://api.devnet.solana.com";

let _connection: Connection | null = null;
function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(RPC_ENDPOINT, "confirmed");
  }
  return _connection;
}

export interface AnchorWallet {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(tx: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]>;
}

export interface WalletCompat {
  publicKey: PublicKey | null;
  connected: boolean;
  signMessage: ((message: Uint8Array) => Promise<Uint8Array>) | undefined;
  signTransaction: (<T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>) | undefined;
  sendTransaction:
    | ((tx: Transaction | VersionedTransaction, connection?: Connection, options?: { signers?: { publicKey: PublicKey; secretKey: Uint8Array }[] }) => Promise<string>)
    | undefined;
  disconnect: (() => Promise<void>) | undefined;
  wallet: { adapter: { name: string } } | null;
  select: undefined;
}

export function useWalletCompat(): WalletCompat {
  const { authenticated, ready, logout } = usePrivy();
  const { wallets } = useWallets();
  const { signMessage: privySignMessage } = useSignMessage();

  const solWallet = wallets[0] ?? null;
  const address = solWallet?.address ?? null;
  const publicKey = useMemo(
    () => (address ? new PublicKey(address) : null),
    [address],
  );
  const connected = ready && authenticated && wallets.length > 0;

  const signMessage = useMemo(() => {
    if (!solWallet || !privySignMessage) return undefined;
    return async (message: Uint8Array): Promise<Uint8Array> => {
      const result = await privySignMessage({ message, wallet: solWallet });
      return result.signature;
    };
  }, [solWallet, privySignMessage]);

  const signTransaction = useMemo(() => {
    if (!solWallet) return undefined;
    const fn = async <T extends Transaction | VersionedTransaction>(tx: T): Promise<T> => {
      const txBytes = tx.serialize();
      const buf = Buffer.from(txBytes);
      const result = await solWallet.signTransaction({ transaction: buf });
      const signed = Buffer.from(result.signedTransaction);
      const isVersioned = "version" in tx;
      return (isVersioned
        ? VersionedTransaction.deserialize(signed)
        : Transaction.from(signed)) as T;
    };
    return fn;
  }, [solWallet]);

  const sendTransaction = useMemo(() => {
    if (!solWallet) return undefined;
    return async (
      tx: Transaction | VersionedTransaction,
      connection?: Connection,
      _options?: { signers?: { publicKey: PublicKey; secretKey: Uint8Array }[] },
    ): Promise<string> => {
      const conn = connection ?? getConnection();
      const txBytes = Buffer.from(tx.serialize());
      const result = await solWallet.signAndSendTransaction({
        transaction: txBytes,
        chain: "solana:devnet",
      });
      const sig = typeof result.signature === "string"
        ? result.signature
        : Buffer.from(result.signature).toString("hex");
      await conn.confirmTransaction(sig, "confirmed");
      return sig;
    };
  }, [solWallet]);

  const disconnect = useMemo(
    () => async () => { await logout(); },
    [logout],
  );

  return {
    publicKey,
    connected,
    signMessage,
    signTransaction,
    sendTransaction,
    disconnect,
    wallet: solWallet ? { adapter: { name: "Privy" } } : null,
    select: undefined,
  };
}

export function useConnectionCompat() {
  return { connection: getConnection() };
}

export function useAnchorWalletCompat() {
  const { publicKey, signTransaction } = useWalletCompat();

  return useMemo(() => {
    if (!publicKey || !signTransaction) return null;
    return {
      publicKey,
      signTransaction,
      signAllTransactions: async <T extends Transaction | VersionedTransaction>(txs: T[]): Promise<T[]> => {
        return Promise.all(txs.map((tx) => signTransaction(tx)));
      },
    };
  }, [publicKey, signTransaction]);
}
