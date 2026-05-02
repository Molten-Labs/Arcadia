# Kiln / Arcadia Protocol

A full-stack monorepo for a "first-loss" managed trading vault protocol on the Solana blockchain. Traders ("managers") prove their performance using their own junior capital before accepting senior capital from investors.

## Architecture

Monorepo managed with pnpm workspaces:

- `/app` — React + Vite frontend (Arcadia Protocol UI)
- `/Kiln_program` — On-chain Solana program (Rust, Pinocchio framework)
- `/clients` — TypeScript SDK generated from the program IDL (Codama/Shank)
- `/server-rs` — Rust indexer/API backend (Axum, SQLx, Helius webhooks)
- `/docs`, `/context` — Documentation and build plans

## Tech Stack

### Frontend (`/app`)
- **Framework:** React 18 + Vite 5
- **Styling:** Tailwind CSS + Shadcn/UI + Framer Motion
- **Data Fetching:** TanStack Query (React Query)
- **Solana:** @solana/web3.js v1, @solana/wallet-adapter, Jupiter SDK for swaps
- **Routing:** React Router DOM v6

### Backend (`/server-rs`)
- **Language:** Rust
- **Web Framework:** Axum
- **Database:** PostgreSQL with SQLx
- **Indexing:** Helius Webhooks

### On-Chain Program (`/Kiln_program`)
- **Language:** Rust
- **Framework:** Pinocchio (lightweight Solana framework)
- **IDL Generation:** Shank

## Development

### Frontend
```bash
cd app && node node_modules/vite/bin/vite.js --config vite.config.js
```
Runs on port 5000.

**Note:** Uses `vite.config.js` (JavaScript) instead of `vite.config.ts` to avoid esbuild subprocess spawning issues in the Replit environment.

### Backend (Indexer)
```bash
cargo run --manifest-path server-rs/Cargo.toml
```
Runs on port 8080 (configurable via `PORT` env var).

### Code Generation
```bash
pnpm codegen:shank   # Generate IDL from Rust program
pnpm codegen:codama  # Generate TypeScript SDK from IDL
```

## Environment Variables

Copy `.env.example` to `.env` and fill in:
- `VITE_RPC_URL` — Solana RPC endpoint (defaults to devnet)
- `VITE_SOLANA_CLUSTER` — `devnet` or `mainnet-beta`
- `VITE_KILN_API_URL` — Backend API URL (default: `http://localhost:8080`)
- `HELIUS_API_KEY` — Helius API key for indexing webhooks
- `DATABASE_URL` — PostgreSQL connection string
- `PORT` — Backend listen port (default: `8080`)

## Workflow

- **Start application** — `cd app && node node_modules/vite/bin/vite.js --config vite.config.js` (port 5000, webview)

## Deployment

Configured as a **static** deployment:
- **Build:** `cd app && node node_modules/vite/bin/vite.js build --config vite.config.js`
- **Public directory:** `app/dist`

## Key Notes

- The vite config is `vite.config.js` (not `.ts`) to avoid TypeScript transpilation needing esbuild to spawn a subprocess — which hits process limits in the Replit container.
- The `lovable-tagger` plugin is excluded from `vite.config.js` to keep config loading lightweight.
- Frontend runs on port 5000 with `host: "0.0.0.0"` and `allowedHosts: true` for Replit proxy compatibility.
