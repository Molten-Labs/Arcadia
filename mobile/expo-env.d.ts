declare const process: {
  env: Record<string, string | undefined>;
};

declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_ARCADIA_PROGRAM_ID?: string;
    EXPO_PUBLIC_KILN_API_URL?: string;
    EXPO_PUBLIC_RPC_URL?: string;
    EXPO_PUBLIC_SOLANA_CLUSTER?: 'devnet' | 'mainnet-beta';
    EXPO_PUBLIC_USDC_MINT?: string;
    EXPO_PUBLIC_PYTH_SOL_USD_ACCOUNT?: string;
    EXPO_PUBLIC_PYTH_USDC_USD_ACCOUNT?: string;
    EXPO_PUBLIC_JUPITER_API_URL?: string;
  }
}
