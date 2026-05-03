# Kiln / Arcadia Protocol

A full-stack monorepo for a "first-loss" managed trading vault protocol on Solana. Traders ("managers") prove their performance using their own junior capital before accepting senior capital from investors.

## Repository Layout

```
/app            — React 18 + Vite 5 frontend (Arcadia Protocol UI)
/Kiln_program   — On-chain Solana program (Rust, Pinocchio framework)
/clients        — TypeScript SDK auto-generated from program IDL (Codama/Shank)
/server-rs      — Rust indexer + API backend (Axum, SQLx, Helius webhooks)
/docs           — Protocol documentation
/context        — Build plans and design context
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite 5, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |
| Data | TanStack Query (React Query), React Router DOM v6 |
| Solana | @solana/web3.js v1, @solana/wallet-adapter (Phantom, Solflare) |
| Backend | Rust, Axum, SQLx, PostgreSQL, Helius webhooks |
| On-chain | Rust, Pinocchio, Shank IDL |
| SDK | Codama-generated TypeScript client |

---

## Quick Start (Replit / AI Agents)

### 1. Install frontend dependencies (first time only)

```bash
bash setup.sh
# or: cd app && npm install --legacy-peer-deps
```

### 2. Start the frontend dev server

```bash
bash dev.sh
# or: npm run dev
```

The app runs on **port 5000**. The `dev.sh` script auto-installs `node_modules` if missing, so it is safe to run cold.

### 3. (Optional) Start the backend indexer

```bash
cargo run --manifest-path server-rs/Cargo.toml
# Listens on PORT env var, default 8080
```

---

## Workflow (Replit Run button)

The **"Start application"** workflow runs:

```bash
bash dev.sh
```

This handles auto-install + Vite startup in a single step.

---

## NPM Scripts (root)

| Command | What it does |
|---------|-------------|
| `npm run dev` | Auto-install check + start Vite on port 5000 |
| `npm run setup` | Install all frontend deps (`app/node_modules`) |
| `npm run dev:app` | Start Vite directly (assumes `node_modules` present) |
| `npm run build:app` | Production build → `app/dist/` |
| `npm run dev:server` | Start Rust indexer/API |
| `npm run build:server` | Build Rust indexer |

---

## Environment Variables

Copy `.env.example` to `.env` in the project root and fill in:

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_RPC_URL` | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `VITE_SOLANA_CLUSTER` | `devnet` | `devnet` or `mainnet-beta` |
| `VITE_KILN_API_URL` | `http://localhost:8080` | Backend API base URL |
| `HELIUS_API_KEY` | — | Helius API key (indexer) |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/kiln` | PostgreSQL DSN |
| `PORT` | `8080` | Backend listen port |

---

## Dependency Notes

- **Frontend packages live in `app/node_modules`** (not the repo root). Always `cd app` or use the scripts above.
- The `package-lock.json` inside `app/` is the canonical lock file for frontend deps — use `npm install` inside `app/`.
- `vite.config.ts` is the active Vite config. `vite.config.js` is kept as a fallback.
- `lovable-tagger` is a dev-only plugin used in `vite.config.ts`; it's excluded from `vite.config.js`.

---

## Code Generation (SDK)

```bash
npm run codegen:shank   # Re-generate IDL from Rust source
npm run codegen:codama  # Re-generate TypeScript SDK from IDL
```

---

## Deployment

Static deployment via Replit:
- **Build:** `npm run build:app`
- **Output directory:** `app/dist`
