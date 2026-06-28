import { PublicKey } from "@solana/web3.js";
import { Buffer } from "buffer";

export const PROGRAM_ID = new PublicKey(
  "49StrXrpxCyC5VkmhossJLWx5nTCvyeoVMbPNMv9WcdN"
);

export const MANAGER_PROFILE_SEED = Buffer.from("manager");
export const VAULT_CONFIG_SEED = Buffer.from("vault-config");
export const VAULT_STATE_SEED = Buffer.from("vault-state");
export const TREASURY_SEED = Buffer.from("vault-treasury");
export const INVESTOR_POSITION_SEED = Buffer.from("investor-position");

export const RPC_URL =
  import.meta.env.VITE_RPC_URL || "https://api.devnet.solana.com";

export const SOLANA_CLUSTER =
  import.meta.env.VITE_SOLANA_CLUSTER || (RPC_URL.includes("mainnet") ? "mainnet-beta" : "devnet");

export const ARCADIA_EXECUTION_ENV =
  String(import.meta.env.VITE_ARCADIA_EXECUTION_ENV || SOLANA_CLUSTER).toLowerCase();

export const KILN_API_BASE_URL =
  import.meta.env.VITE_KILN_API_BASE_URL ||
  import.meta.env.VITE_KILN_API_URL ||
  "http://localhost:8080";

export const SOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");
export const MAINNET_USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
export const ARCADIA_DEVNET_USDC_MINT = new PublicKey("DLkVtDD4zfFJzWgGRLqjzqkBhaBs5sVNzDeBCQ2hPgMz");
export const USDC_MINT = new PublicKey(
  import.meta.env.VITE_USDC_MINT ||
    (ARCADIA_EXECUTION_ENV === "surfpool" || SOLANA_CLUSTER === "mainnet-beta"
      ? MAINNET_USDC_MINT.toBase58()
      : ARCADIA_DEVNET_USDC_MINT.toBase58())
);
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
export const ORACLE_PRICE_SEED = Buffer.from("price-feed");

const env = import.meta.env as Record<string, string | undefined>;
const processEnv =
  typeof process !== "undefined"
    ? (process.env as Record<string, string | undefined>)
    : {};

export const PYTH_SOL_USD_ACCOUNT = (env.VITE_PYTH_SOL_USD_ACCOUNT || processEnv.VITE_PYTH_SOL_USD_ACCOUNT)
  ? new PublicKey(env.VITE_PYTH_SOL_USD_ACCOUNT || processEnv.VITE_PYTH_SOL_USD_ACCOUNT!)
  : null;

export const PYTH_USDC_USD_ACCOUNT = (env.VITE_PYTH_USDC_USD_ACCOUNT || processEnv.VITE_PYTH_USDC_USD_ACCOUNT)
  ? new PublicKey(env.VITE_PYTH_USDC_USD_ACCOUNT || processEnv.VITE_PYTH_USDC_USD_ACCOUNT!)
  : null;

export const EXPLORER_BASE =
  import.meta.env.VITE_EXPLORER_BASE_URL || "https://explorer.solana.com";
