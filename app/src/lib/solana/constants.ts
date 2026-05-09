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
export const PRIVATE_INTENT_SESSION_SEED = Buffer.from("private-intent-session");
export const MAGICBLOCK_PERMISSION_SEED = Buffer.from("permission:");
export const MAGICBLOCK_DELEGATION_BUFFER_SEED = Buffer.from("buffer");
export const MAGICBLOCK_DELEGATION_RECORD_SEED = Buffer.from("delegation");
export const MAGICBLOCK_DELEGATION_METADATA_SEED = Buffer.from("delegation-metadata");

export const MAGICBLOCK_DELEGATION_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_MAGICBLOCK_DELEGATION_PROGRAM_ID ||
    "DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh",
);
export const MAGICBLOCK_PERMISSION_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_MAGICBLOCK_PERMISSION_PROGRAM_ID ||
    "ACLseoPoyC3cBqoUtkbjZ4aDrkurZW86v19pXz2XQnp1",
);
export const MAGICBLOCK_MAGIC_PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_MAGICBLOCK_MAGIC_PROGRAM_ID ||
    "Magic11111111111111111111111111111111111111",
);
export const MAGICBLOCK_MAGIC_CONTEXT_ID = new PublicKey(
  import.meta.env.VITE_MAGICBLOCK_MAGIC_CONTEXT_ID ||
    "MagicContext1111111111111111111111111111111",
);
export const MAGICBLOCK_DEVNET_TEE_VALIDATOR = new PublicKey(
  import.meta.env.VITE_MAGICBLOCK_ER_VALIDATOR ||
    "MTEWGuqxUpYZGFJQcp8tLN7x5v9BSeoFHYWQQ3n3xzo",
);
export const MAGICBLOCK_DEVNET_US_VALIDATOR = MAGICBLOCK_DEVNET_TEE_VALIDATOR;

export const RPC_URL =
  import.meta.env.VITE_RPC_URL || "https://api.devnet.solana.com";

export const MAGICBLOCK_ER_RPC_URL =
  import.meta.env.VITE_MAGICBLOCK_ER_RPC_URL || "https://devnet-router.magicblock.app";
export const MAGICBLOCK_TEE_RPC_URL =
  import.meta.env.VITE_MAGICBLOCK_TEE_RPC_URL || "https://devnet-tee.magicblock.app";
export const MAGICBLOCK_TEE_AUTH_TOKEN =
  import.meta.env.VITE_MAGICBLOCK_TEE_AUTH_TOKEN || "";
export const MAGICBLOCK_LOCAL_ER =
  String(import.meta.env.VITE_MAGICBLOCK_LOCAL_ER || "").toLowerCase() === "true" ||
  isLocalRpcUrl(MAGICBLOCK_ER_RPC_URL) ||
  isLocalRpcUrl(MAGICBLOCK_TEE_RPC_URL);

export const SOLANA_CLUSTER =
  import.meta.env.VITE_SOLANA_CLUSTER || (RPC_URL.includes("mainnet") ? "mainnet-beta" : "devnet");

export const ARCADIA_EXECUTION_ENV =
  String(import.meta.env.VITE_ARCADIA_EXECUTION_ENV || SOLANA_CLUSTER).toLowerCase();

export const IS_LOCAL_SOLANA_RPC = isLocalRpcUrl(RPC_URL);
export const ARCADIA_LOCAL_CHAIN_MODE =
  String(import.meta.env.VITE_ARCADIA_LOCAL_CHAIN_MODE || "").toLowerCase() === "true" ||
  (IS_LOCAL_SOLANA_RPC && ARCADIA_EXECUTION_ENV === "surfpool");
export const WALLET_NETWORK =
  IS_LOCAL_SOLANA_RPC || ARCADIA_EXECUTION_ENV === "surfpool"
    ? "surfpool"
    : SOLANA_CLUSTER === "mainnet-beta"
      ? "mainnet-beta"
      : "devnet";
export const RPC_DISPLAY_NAME =
  WALLET_NETWORK === "surfpool"
    ? "Local Surfpool"
    : WALLET_NETWORK === "mainnet-beta"
      ? "Mainnet"
      : "Devnet";
export const MAGICBLOCK_DISPLAY_NAME = MAGICBLOCK_LOCAL_ER ? "Local MagicBlock ER" : "MagicBlock PER";

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

function isLocalRpcUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(parsed.hostname);
  } catch {
    return false;
  }
}
