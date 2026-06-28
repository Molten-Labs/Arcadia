import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: true,
    hmr: { overlay: false },
  },

  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "inline",
      devOptions: { enabled: false },
      manifest: {
        name: "Arcadia Protocol",
        short_name: "Arcadia",
        description: "Proof-gated Solana vaults — back traders by proof, not promises.",
        theme_color: "#0C0C0E",
        background_color: "#0C0C0E",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          { src: "/arcadia-logo.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" },
          { src: "/favicon.ico", sizes: "48x48", type: "image/x-icon" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2,woff}"],
        navigateFallback: "/index.html",
        disableDevLogs: true,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(api\.devnet|api\.mainnet-beta)\.solana\.com\//,
            handler: "StaleWhileRevalidate",
            options: { cacheName: "solana-rpc", expiration: { maxEntries: 30, maxAgeSeconds: 30 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      buffer: path.resolve(__dirname, "node_modules/buffer/index.js"),
    },
    dedupe: [
      "react", "react-dom",
      "react/jsx-runtime", "react/jsx-dev-runtime",
      "@tanstack/react-query",
    ],
  },

  define: {
    "process.env": "{}",
    "process.env.NODE_ENV": JSON.stringify(mode),
    "process.browser": "true",
    global: "globalThis",
  },

  optimizeDeps: {
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
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) return "vendor-react";

          if (
            id.includes("node_modules/react-router") ||
            id.includes("node_modules/@remix-run/")
          ) return "vendor-router";

          if (
            id.includes("node_modules/@solana/web3.js") ||
            id.includes("node_modules/@solana/wallet-adapter-base") ||
            id.includes("node_modules/@solana/wallet-adapter-react/") ||
            id.includes("node_modules/bs58") ||
            id.includes("node_modules/buffer") ||
            id.includes("node_modules/safe-buffer") ||
            id.includes("node_modules/base-x") ||
            id.includes("node_modules/bn.js") ||
            id.includes("node_modules/borsh") ||
            id.includes("node_modules/@solana/buffer-layout") ||
            id.includes("node_modules/rpc-websockets") ||
            id.includes("node_modules/@noble/") ||
            id.includes("node_modules/superstruct")
          ) return "vendor-misc";

          if (
            id.includes("node_modules/@solana/wallet-adapter-react-ui") ||
            id.includes("node_modules/@solana/wallet-adapter-wallets") ||
            id.includes("node_modules/@phantom/") ||
            id.includes("node_modules/@solflare-wallet/")
          ) return "vendor-wallet-ui";

          if (
            id.includes("node_modules/@walletconnect/") ||
            id.includes("node_modules/@reown/") ||
            id.includes("node_modules/@web3modal/") ||
            id.includes("node_modules/@toruslabs/")
          ) return "vendor-walletconnect";

          if (id.includes("node_modules/@radix-ui/")) return "vendor-radix";
          if (id.includes("node_modules/framer-motion")) return "vendor-motion";
          if (id.includes("node_modules/lucide-react")) return "vendor-icons";
          if (id.includes("node_modules/@tanstack/")) return "vendor-query";

          if (
            id.includes("node_modules/recharts") ||
            id.includes("node_modules/recharts-scale") ||
            id.includes("node_modules/d3-") ||
            id.includes("node_modules/victory-vendor")
          ) return "vendor-charts";

          if (
            id.includes("node_modules/sonner") ||
            id.includes("node_modules/vaul") ||
            id.includes("node_modules/cmdk") ||
            id.includes("node_modules/embla-carousel")
          ) return "vendor-ui-utils";

          if (id.includes("node_modules/")) return "vendor-misc";
        },
      },
    },
  },
}));
