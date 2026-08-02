import { Connection } from "@solana/web3.js";

export const HELIUS_RPC =
  process.env.NEXT_PUBLIC_HELIUS_RPC ?? "https://api.devnet.solana.com";

let _connection: Connection | null = null;

export function getConnection(): Connection {
  if (!_connection) {
    _connection = new Connection(HELIUS_RPC, "confirmed");
  }
  return _connection;
}
