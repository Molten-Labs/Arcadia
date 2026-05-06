import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    hmr: { overlay: false },
  },

  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Force browser-compatible polyfills — prevents "externalized for browser" crash
      buffer: path.resolve(__dirname, "node_modules/buffer/index.js"),
    },
    dedupe: [
      "react", "react-dom",
      "react/jsx-runtime", "react/jsx-dev-runtime",
      "@tanstack/react-query",
    ],
  },

  define: {
    "process.env": JSON.stringify({}),
    "process.env.NODE_ENV": JSON.stringify(mode),
    global: "globalThis",
  },

  optimizeDeps: {
    // Force Vite to pre-bundle these so they're never externalized
    include: ["buffer", "@solana/web3.js", "bs58"],
    esbuildOptions: {
      define: { global: "globalThis" },
      target: "esnext",
    },
  },

  build: {
    target: "esnext",
    minify: "esbuild",
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // ── Tier 1: Critical path (loads first, must be tiny) ──────────────
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) return "vendor-react";

          if (
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/@remix-run/")
          ) return "vendor-router";

          // ── Tier 2: Solana core (web3 + wallet standard) ─────────────────
          if (
            id.includes("node_modules/@solana/web3.js") ||
            id.includes("node_modules/@solana/wallet-adapter-base") ||
            id.includes("node_modules/@solana/wallet-adapter-react") ||
            id.includes("node_modules/bs58") ||
            id.includes("node_modules/buffer") ||
            id.includes("node_modules/bn.js") ||
            id.includes("node_modules/borsh") ||
            id.includes("node_modules/@noble/") ||
            id.includes("node_modules/superstruct")
          ) return "vendor-solana";

          // ── Tier 3: Wallet UI + specific adapters ─────────────────────────
          if (
            id.includes("node_modules/@solana/wallet-adapter-react-ui") ||
            id.includes("node_modules/@solana/wallet-adapter-wallets") ||
            id.includes("node_modules/@phantom/") ||
            id.includes("node_modules/@solflare-wallet/")
          ) return "vendor-wallet-ui";

          // ── Tier 4: WalletConnect / AppKit (heavy, only on modal open) ───
          if (
            id.includes("node_modules/@walletconnect/") ||
            id.includes("node_modules/@reown/") ||
            id.includes("node_modules/web3modal") ||
            id.includes("node_modules/@web3modal/") ||
            id.includes("node_modules/@toruslabs/")
          ) return "vendor-walletconnect";

          // ── Tier 5: UI framework ──────────────────────────────────────────
          if (id.includes("node_modules/@radix-ui/")) return "vendor-radix";
          if (id.includes("node_modules/framer-motion")) return "vendor-motion";
          if (id.includes("node_modules/lucide-react")) return "vendor-icons";
          if (id.includes("node_modules/@tanstack/")) return "vendor-query";

          // ── Tier 6: Everything else in node_modules ───────────────────────
          if (id.includes("node_modules/")) return "vendor-misc";
        },
      },
    },
  },
}));
