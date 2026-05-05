import { PublicKey } from '@solana/web3.js';

export const PROGRAM_ID = new PublicKey('WMzhPepsS5n1mhZGvYa2RF6gfUJLa5CKwpqFYsqw6RB');

export const MANAGER_PROFILE_SEED = Buffer.from('manager');
export const VAULT_CONFIG_SEED = Buffer.from('vault-config');
export const VAULT_STATE_SEED = Buffer.from('vault-state');
export const TREASURY_SEED = Buffer.from('vault-treasury');
export const INVESTOR_POSITION_SEED = Buffer.from('investor-position');

export const SOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
export const USDC_MINT = new PublicKey('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
export const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');

export const DEVNET_USDC_MINT = new PublicKey('4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

export const RPC_URL = process.env.EXPO_PUBLIC_RPC_URL ?? 'https://api.devnet.solana.com';
export const CLUSTER = (RPC_URL.includes('mainnet') ? 'mainnet-beta' : 'devnet') as 'devnet' | 'mainnet-beta';

export const APP_IDENTITY = {
  name: 'Arcadia Protocol',
  uri: 'https://arcadia.protocol',
  icon: '/icon.png',
} as const;

export const EXPLORER_BASE = 'https://explorer.solana.com';
