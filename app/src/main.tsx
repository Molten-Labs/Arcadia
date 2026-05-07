// ── Polyfills — must be first, before any Solana import ────────────────────
import { Buffer } from "buffer";

const globalScope = globalThis as typeof globalThis & {
  Buffer?: typeof Buffer;
  global?: typeof globalThis;
};
const windowScope = window as Window & { Buffer?: typeof Buffer };

if (typeof globalScope.Buffer === "undefined") {
  globalScope.Buffer = Buffer;
}
if (typeof windowScope.Buffer === "undefined") {
  windowScope.Buffer = Buffer;
}
if (typeof globalScope.global === "undefined") {
  globalScope.global = globalThis;
}

// ── App ─────────────────────────────────────────────────────────────────────
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Service worker is registered automatically by vite-plugin-pwa via the
// injected script tag in index.html (injectRegister: 'auto').
// No manual virtual:pwa-register import needed here.
