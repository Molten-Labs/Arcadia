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
    return config;
  },
};

export default nextConfig;
