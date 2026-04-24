import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { fileURLToPath, URL } from "url";
import path from "path";

/**
 * Vite configuration for the Kiln app.
 *
 * - Adds path aliases for `@/*` to `src/*` so imports like `@/components/...` resolve correctly.
 * - Uses the fast React SWC plugin (already present in devDependencies).
 * - Basic dev server defaults.
 *
 * Usage:
 *  - Place this file at `Kiln/app/vite.config.ts`
 *  - Start dev server: `pnpm --dir app dev`
 */

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      // Root alias: '@/...' -> '<project>/app/src/...'
      { find: "@", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      // Helpful explicit aliases (optional but convenient)
      { find: "@/components", replacement: fileURLToPath(new URL("./src/components", import.meta.url)) },
      { find: "@/lib", replacement: fileURLToPath(new URL("./src/lib", import.meta.url)) },
      { find: "@/pages", replacement: fileURLToPath(new URL("./src/pages", import.meta.url)) },
    ],
  },
  server: {
    port: 5173,
    strictPort: false,
    // Use host if you want to expose on the network (development)
    // host: true,
  },
  preview: {
    port: 5173,
  },
  build: {
    sourcemap: true,
    // tweak as needed for production outputs
  },
  // Ensure imports that expect Node-like `process.env` don't crash during build
  define: {
    "process.env": {},
  },
});
