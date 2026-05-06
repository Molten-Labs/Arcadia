// Buffer polyfill must be first — @solana/web3.js depends on globalThis.Buffer
import { Buffer } from "buffer";
if (typeof globalThis.Buffer === "undefined") {
  (globalThis as any).Buffer = Buffer;
}
if (typeof (window as any).Buffer === "undefined") {
  (window as any).Buffer = Buffer;
}
if (typeof (globalThis as any).global === "undefined") {
  (globalThis as any).global = globalThis;
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const root = document.getElementById("root")!;
createRoot(root).render(<App />);
