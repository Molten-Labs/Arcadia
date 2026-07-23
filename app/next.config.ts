import type { NextConfig } from "next";

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

  serverExternalPackages: [
    "pino-pretty",
    "lokijs",
    "encoding",
    "@solana/kit",
    "@solana-program/memo",
    "@solana-program/system",
    "@solana-program/token",
    "@solana-program/token-2022",
    "@solana-program/compute-budget",
  ],
};

export default nextConfig;
