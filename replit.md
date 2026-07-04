# Arcadia

A decentralized investment protocol on Solana that turns on-chain trading history into a verifiable "Arcadia Score" (0–1000). Skilled traders earn capital from investors through non-custodial smart-contract vaults.

## Architecture

- **Frontend** (`app/`): Next.js 15 + React 19 + TypeScript. Runs on port 5000.
- **Backend** (`server-rs/`): Rust Axum API + Yellowstone gRPC indexer. Runs on port 8080.
- **Smart Contract** (`arcadia_vault/`): Anchor/Solana program (Program ID: `gTHauBMdJHs45tc8tjCKL7MejvBECQHgD184io3hx1C`).
- **Database**: PostgreSQL (optional — backend can run in `memory` mode).
- **Cache**: Redis (optional — gracefully skipped if not running).

## Running the App

The workflow runs `bash dev.sh`, which:
1. Installs frontend deps if needed.
2. Optionally starts Redis (graceful skip if unavailable).
3. Optionally starts the compiled Rust backend on port 8080.
4. Starts Next.js dev server on port 5000.

**Without a compiled backend**, the frontend automatically uses mock data — perfect for UI development.

To build the Rust backend (takes ~5 min first time):
```bash
bash build-backend.sh
```

## Environment Variables

Copy `.env.example` to `server-rs/.env` and fill in values. Key variables:
- `ARCADIA_STORE=memory` — use in-memory store (no Postgres needed)
- `ARCADIA_DEMO_MODE=true` — enable demo/seed data
- `BACKEND_URL` — set to `http://localhost:8080` when backend is running
- `DATABASE_URL` — Postgres connection string (only needed for persistent mode)
- `HELIUS_API_KEY` — Helius RPC key (optional, falls back to public devnet)

## Auth

Sign-In With Solana (SIWS): users connect a Phantom/Solflare wallet and sign a message. JWT stored in localStorage. No external auth provider used.

## User Preferences

- Frontend-first development: the app works fully with mock data without a running backend.
