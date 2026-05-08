# Kiln / Arcadia Protocol

A full-stack monorepo for a "first-loss" managed trading vault protocol on Solana. Traders ("managers") prove their performance using their own junior capital before accepting senior capital from investors.

## Repository Layout

```
/app                        — React 18 + Vite 5 frontend (Arcadia Protocol UI)
  src/pages/                —   Index, Vaults, VaultDetail, Traders, TraderProfile, Portfolio,
                            —   Alerts, Settings, ManagerDashboard, ManagerVault, CreateVault,
                            —   Trade, Docs, FAQ, HowItWorks, NotFound (all 16 pages complete)
/mobile                     — Expo SDK 52 + Expo Router v4 mobile app (iOS & Android)
  app/                      —   File-based routes (Expo Router)
    (tabs)/                 —     Bottom tab screens: Vaults, Portfolio, Traders, Settings
    vault/[id].tsx          —     Vault detail (NAV chart, capital stack, deposit/withdraw)
    trader/[wallet].tsx     —     Trader profile
  polyfills.ts              —   Buffer / crypto shims (must be first import in _layout.tsx)
  src/
    lib/                    —     theme.ts, constants.ts, pdas.ts, mockData.ts, api.ts, format.ts, wallet.tsx (MWA)
    hooks/                  —     useVaults, usePositions, useManagers, useTransactions (on-chain), useBalance
    components/             —     VaultCard (sparkline), TxModal (3-step), NavSparkline, HealthMeter, CapitalStack, …
/Arcadia_program/           — Cargo workspace (on-chain program + tests)
  program/                  —   SBF program crate (NO litesvm / solana 3.x deps)
    src/                    —     Rust program source (Pinocchio, no_std)
    tests/unit_tests.rs     —     Unit tests (no litesvm, safe for SBF graph)
  kiln-tests/               —   Integration-test crate (litesvm / solana 3.x isolated here)
    tests/vault_flow.rs
    tests/update_and_graduate.rs
/clients                    — TypeScript SDK auto-generated from program IDL (Codama/Shank)
/server-rs                  — Rust indexer + API backend (Axum, SQLx, Helius webhooks)
/docs                       — Protocol documentation
/context                    — Build plans and design context
```

### Why two crates inside `Arcadia_program/`?

The Solana SBF toolchain runs Cargo 1.84 which rejects `edition2024`.  
`litesvm` + `solana 3.x` transitively pull in `toml_edit 0.25+` / `proc-macro-crate 3.x`, both of which require `edition2024`.  
Keeping those deps **only** in `kiln-tests/` ensures they never enter the SBF dependency graph.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Web Frontend | React 18, Vite 5, TypeScript, Tailwind CSS, shadcn/ui, Framer Motion |
| Mobile App | Expo SDK 52, Expo Router v4, React Native, TanStack Query |
| Mobile Wallet | Mobile Wallet Adapter (MWA) via `@solana-mobile/mobile-wallet-adapter-protocol-web3js`; graceful demo-wallet fallback |
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

This serves the **React/Vite web frontend** (Arcadia Protocol UI) on port 5000.  
The script auto-installs `app/node_modules` if missing, then launches Vite.

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
- `vite.config.ts` is the sole Vite config.
- `lovable-tagger` is a dev-only plugin used in `vite.config.ts`.

---

## Code Generation (SDK)

```bash
npm run codegen:shank   # Re-generate IDL from Rust source
npm run codegen:codama  # Re-generate TypeScript SDK from IDL
```

---

## On-Chain Program (Arcadia_program)

### Build the SBF program (deploys to Solana)

```bash
# Must be run from the program sub-crate — NOT the workspace root
cargo build-sbf --manifest-path Arcadia_program/program/Cargo.toml
# Output: Arcadia_program/target/deploy/Arcadia_program.so
```

### Run unit tests (pure logic, no SBF needed)

```bash
cargo test --manifest-path Arcadia_program/program/Cargo.toml \
  --features test-default
```

### Run litesvm integration tests (requires .so built first)

```bash
# 1. Build the SBF artifact
cargo build-sbf --manifest-path Arcadia_program/program/Cargo.toml

# 2. Run integration tests in the isolated test crate
cargo test --manifest-path Arcadia_program/kiln-tests/Cargo.toml

# Skip the freshness check if you know the .so is up-to-date:
KILN_SKIP_SBF_FRESHNESS_CHECK=1 cargo test --manifest-path Arcadia_program/kiln-tests/Cargo.toml

# Or point to a custom .so path:
KILN_SBF_PATH=/path/to/Arcadia_program.so cargo test --manifest-path Arcadia_program/kiln-tests/Cargo.toml
```

### Dependency isolation rules

| Dependency | Allowed in `program/` | Allowed in `kiln-tests/` |
|---|---|---|
| pinocchio, borsh, bytemuck, shank, wincode | ✅ | ✅ (dev-dep only) |
| litesvm, solana 3.x | ❌ NEVER | ✅ dev-dep only |
| toml_edit 0.25+, proc-macro-crate 3.x | ❌ NEVER | ✅ (transitive, isolated) |

---

## Deployment

Static deployment via Replit:
- **Build:** `npm run build:app`
- **Output directory:** `app/dist`
