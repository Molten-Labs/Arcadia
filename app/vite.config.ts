import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

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
  ].filter(Boolean),

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Force browser-compatible polyfill — prevents "externalized for browser" crash
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
    include: ["buffer", "@solana/web3.js", "bs58"],
    esbuildOptions: {
      define: { global: "globalThis" },
      target: "esnext",
    },
  },
}));
