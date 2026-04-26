import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "WMzhPepsS5n1mhZGvYa2RF6gfUJLa5CKwpqFYsqw6RB"
);

export const MANAGER_PROFILE_SEED = Buffer.from("manager");
export const VAULT_CONFIG_SEED = Buffer.from("vault-config");
export const VAULT_STATE_SEED = Buffer.from("vault-state");
export const TREASURY_SEED = Buffer.from("vault-treasury");
export const INVESTOR_POSITION_SEED = Buffer.from("investor-position");

export const RPC_URL =
  import.meta.env.VITE_RPC_URL || "https://api.devnet.solana.com";

export const EXPLORER_BASE =
  import.meta.env.VITE_EXPLORER_BASE_URL || "https://explorer.solana.com";
