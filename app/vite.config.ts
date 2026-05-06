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
}));
