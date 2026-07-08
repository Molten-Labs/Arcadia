import type { NextConfig } from "next";
import path from "path";

const devDomain = process.env.REPLIT_DEV_DOMAIN ?? "";

const nextConfig: NextConfig = {
  // App owns its own lockfile; pin the tracing/workspace root to silence the
  // multi-lockfile root inference warning.
  outputFileTracingRoot: path.resolve(__dirname),
  allowedDevOrigins: [
    "*.replit.dev",
    "*.kirk.replit.dev",
    "*.replit.app",
    "*.repl.co",
    ...(devDomain ? [devDomain, `*.${devDomain}`] : []),
  ],
  images: {
    unoptimized: true,
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      crypto: false,
      stream: false,
      path: false,
      os: false,
    };
    config.externals.push("pino-pretty", "lokijs", "encoding");

    // Force a single instance of wallet-adapter packages so the React context
    // is shared across all components (pnpm can install multiple copies with
    // different peer-dep hashes, breaking the provider → consumer chain).
    const walletAdapterAlias = (pkg: string) => ({
      [pkg]: path.resolve(__dirname, `node_modules/${pkg}`),
    });
    config.resolve.alias = {
      ...config.resolve.alias,
      ...walletAdapterAlias("@solana/wallet-adapter-react"),
      ...walletAdapterAlias("@solana/wallet-adapter-base"),
      ...walletAdapterAlias("@solana/wallet-adapter-react-ui"),
    };

    return config;
  },
};

export default nextConfig;
