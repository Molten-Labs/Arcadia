// ── Polyfills — must be first, before any Solana import ────────────────────
import { Buffer } from "buffer";
if (typeof (globalThis as any).Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}
if (typeof (window as any).Buffer === "undefined") {
  (window as any).Buffer = Buffer;
}
if (typeof (globalThis as any).global === "undefined") {
  (globalThis as any).global = globalThis;
}

// ── App ─────────────────────────────────────────────────────────────────────
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Service worker is registered automatically by vite-plugin-pwa via the
// injected script tag in index.html (injectRegister: 'auto').
// No manual virtual:pwa-register import needed here.
