# Arcadia

A decentralized investment protocol on Solana that turns on-chain trading history into a verifiable **Arcadia Score** (0–1000). Skilled traders earn capital from investors through non-custodial smart-contract vaults.

> **Tagline:** *Where Performance Earns Capital.*

## Architecture

```
app/               Next.js 16 frontend (React 19, TypeScript, Tailwind v4)
server-rs/         Rust backend — Axum HTTP API + background workers
arcadia_vault/     Anchor smart contract — on-chain vault logic
```

### Smart Contract (`arcadia_vault/`)
- **Program ID (devnet):** `FPoAMRkM3kXfuvFn1iC2cM8B554KfnaPjibjLH31CHtd`
- Manages platform config, trader profiles, investor accounts, positions
- Instructions: deposit, withdraw, record trade, settle, fund execution wallet

### Backend (`server-rs/`)
Nine Rust crates in a Cargo workspace:
| Crate | Purpose |
|-------|---------|
| `arcadia-core` | Core types, trader classification |
| `arcadia-db` | PostgreSQL queries + migrations |
| `arcadia-decode` | Anchor event decoding (Borsh) |
| `arcadia-scoring` | TWR, metrics, score engine, capacity |
| `arcadia-chain` | Solana chain interaction (on-chain signing) |
| `arcadia-prices` | Price feed (Pyth → Redis) |
| `arcadia-api` | Axum HTTP API, auth, routes |
| `arcadia-executor` | Execution wallet lifecycle, FlashTrade |
| `arcadia-workers` | Background workers (ingest, score, price, executor) |

### Frontend (`app/`)
Next.js 16 with App Router, Tailwind v4, shadcn/ui, Acid Graphic design system.
- Authenticated routes: dashboard, terminal, trade, traders, leaderboard, vault, portfolio, analytics, settings
- Landing page, onboarding flow, waitlist
- Sign-In With Solana (SIWS) via Privy

## Getting Started

### Prerequisites
- Node.js 20+
- Rust 1.89
- Solana CLI
- Anchor CLI

### Quick Start

```bash
# Install frontend dependencies
npm --prefix app install

# Start frontend dev server
npm --prefix app run dev

# Start backend (in-memory mode, no Postgres needed)
ARCADIA_STORE=memory ARCADIA_DEMO_MODE=true cargo run --manifest-path server-rs/Cargo.toml
```

### Environment Variables

Copy `.env.example` to `.env.local` for the frontend and `server-rs/.env.example` to `server-rs/.env` for the backend. Key variables:

| Variable | Description |
|----------|-------------|
| `VITE_RPC_URL` | Solana RPC endpoint |
| `HELIUS_API_KEY` | Helius API key (optional) |
| `DATABASE_URL` | Postgres connection string (only for persistent mode) |
| `JWT_SECRET` | Session signing secret (must be set in production) |
| `ARCADIA_STORE` | `memory` or `postgres` |

## Testing

```bash
# Frontend tests (Vitest)
npm --prefix app run test

# Rust backend tests
cargo test --manifest-path server-rs/Cargo.toml --workspace

# Anchor program tests
cd arcadia_vault && anchor test
```

## Deployment

- **Frontend:** Vercel (build via `npm --prefix app run build`)
- **Backend:** Docker (see `Dockerfile`) or Railway (see `railway.json`)
- **Program:** `bash deploy-program.sh` (builds + deploys Anchor program)

## Security

- Never commit `.env` files or secrets to git
- Rotate any leaked API keys immediately
- Set `JWT_SECRET` to a strong random value in production
- All smart contract operations are non-custodial

## License

MIT
