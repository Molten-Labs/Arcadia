export const PROGRAM_ID = "WMzhPepsS5n1mhZGvYa2RF6gfUJLa5CKwpqFYsqw6RB";
export const RPC_URL =
  process.env.KILN_RPC_URL ?? process.env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
export const SERVER_PORT = Number(process.env.KILN_SERVER_PORT ?? 8787);
export const INDEX_INTERVAL_MS = Number(process.env.KILN_INDEX_INTERVAL_MS ?? 15_000);
export const DB_PATH = process.env.KILN_DB_PATH ?? "server/data/kiln.db";
