import "./polyfills";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);

// Service worker is registered automatically by vite-plugin-pwa via the
// injected script tag in index.html (injectRegister: 'auto').
// No manual virtual:pwa-register import needed here.
