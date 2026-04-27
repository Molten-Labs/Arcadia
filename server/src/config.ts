export const PROGRAM_ID = "WMzhPepsS5n1mhZGvYa2RF6gfUJLa5CKwpqFYsqw6RB";
export const RPC_URL =
  process.env.KILN_RPC_URL ?? process.env.VITE_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
export const SERVER_PORT = Number(process.env.KILN_SERVER_PORT ?? 8787);
export const INDEX_INTERVAL_MS = Number(process.env.KILN_INDEX_INTERVAL_MS ?? 15_000);
export const DB_PATH = process.env.KILN_DB_PATH ?? "server/data/kiln.db";
export const JUPITER_API_KEY = process.env.JUPITER_API_KEY ?? "";
export const JUPITER_SWAP_BASE_URL =
  process.env.JUPITER_SWAP_BASE_URL ?? "https://api.jup.ag/swap/v1";
export const SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
