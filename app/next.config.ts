import type { NextConfig } from "next";
import path from "path";

const devDomain = process.env.REPLIT_DEV_DOMAIN ?? "";

const nextConfig: NextConfig = {
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

  // Packages that must not be bundled for the browser — works in both
  // Turbopack (default in Next.js 16) and webpack mode.
  serverExternalPackages: ["pino-pretty", "lokijs", "encoding"],

  // Acknowledge Turbopack as the active bundler (Next.js 16 default).
  // Without this, Next.js errors when it finds a `webpack` config block
  // and no `turbopack` config. Node.js built-in stubs (fs, crypto, etc.)
  // are handled automatically by Turbopack for browser targets.
  turbopack: {},

  // ── Webpack — used only when explicitly running with --webpack flag ─────────
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      crypto: false,
      stream: false,
      path: false,
      os: false,
    };

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
