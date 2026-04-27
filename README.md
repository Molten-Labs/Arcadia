# Kiln — Managed Vaults (Monorepo)

Kiln is a full-stack prototype for "first-loss" managed trading vaults on Solana:
managers prove performance with their own capital (junior) in paper mode before
accepting investor capital (senior). This repo contains:

- on-chain program (Rust, Pinocchio / wincode / bytemuck)
- generated TypeScript client SDK (Codama) from Shank IDL
- frontend (Vite + React + TypeScript + Tailwind)
- indexer backend scaffold (Rust + Axum) with Postgres persistence
- utility scripts and codegen tooling


---

## Environment & secrets

Create a `.env` from the included example:
```bash
cp .env.example .env
```

Important envs:
- `VITE_RPC_URL` — RPC URL used by the frontend. Do NOT commit a private RPC key into source control.
- `HELIUS_API_KEY` — (optional) Helius API key used by the indexer when interacting with Helius endpoints or webhook verification.
- `DATABASE_URL` — Postgres connection string for the indexer, e.g. `postgres://user:pass@localhost:5432/kiln`
- `PORT` — port for the indexer (default: 8080)

Security note: do not commit keys or secrets. Use a secrets manager or CI secret variables for production.

---

## Build & test the on‑chain program (notes)

The program uses Pinocchio, `wincode`, `bytemuck` and Shank. Building and testing can require specific toolchain versions for Solana and some crates.

Typical steps (local dev):
```bash
# ensure Rust toolchain and SBF toolchain if you target SBF
# build native for unit tests
cd Kiln_program
cargo build

# run unit tests (may require additional features or a specific toolchain)
cargo test --features test-default

# build SBF (deployable)
# cargo build-sbf
# (requires Solana sBPF toolchain and correct environment)
```

If you run into crate version conflicts (Solana/Pinocchio combos), align dependency versions in `Cargo.toml` or use the recommended toolchain noted in the repo context docs.

---

## Frontend — run & dev

From repo root:
```bash
# install workspace dependencies
pnpm install

# run frontend dev server
pnpm --dir app dev
```

Open: http://localhost:5173

Notes:
- The app will prefer an injected browser wallet (window.solana) for signing transactions. If Phantom is installed and connected the Create Vault and Manager flows will be able to sign and submit transactions.
- The frontend uses the generated SDK (imported from `clients/src/generated`) and helper functions in `app/lib/kiln.ts` and `app/lib/sol.ts`.
- To point to your preferred RPC, set `VITE_RPC_URL` in `.env` (do NOT commit secrets).

---

## Indexer (Axum) & Postgres

A canonical Axum API/indexer is under `server-rs/`. It exposes:
- `GET /health` — database/API/indexer status
- `POST /webhook` — ingest Helius webhook JSON, persist raw payloads, and materialize product rows
- `GET /vaults` and `GET /vaults/:configAddress` — materialized vault reads
- `GET /vaults/:configAddress/nav-history` — NAV chart points
- `GET /vaults/:configAddress/trades` — public delayed trade history
- `GET /managers`, `GET /managers/:address`, and `GET /positions/:wallet` — manager and investor reads

Run the indexer:
1. Ensure Postgres is running and `DATABASE_URL` env var is set.
2. From repo root:
   ```bash
   cd server-rs
   # run (development)
   DATABASE_URL=postgres://postgres:postgres@localhost:5432/kiln cargo run --release
   ```
3. To receive Helius webhooks, expose the server endpoint and register it in Helius. Set `HELIUS_WEBHOOK_SECRET` to require signed/secret-bearing webhook requests.

DB note:
- `server-rs` runs SQLx migrations from `server-rs/migrations/` at startup. Supabase can be used as the hosted Postgres target.
- The old `server/` Fastify app is a compatibility shim only; use `pnpm dev:server` or `cargo run --manifest-path server-rs/Cargo.toml`.

---

## Dev workflow (quick commands)

Regenerate IDL + SDK:
```
pnpm -w codegen:shank
pnpm --dir clients run generate
```

Frontend:
```
pnpm --dir app dev
```

Indexer:
```
cd server-rs
DATABASE_URL=postgres://postgres:postgres@localhost:5432/kiln cargo run
```

Program:
```
cd Kiln_program
cargo build
cargo test --features test-default
# SBF: cargo build-sbf (requires Solana SBF toolchain)
```

Clean & reinstall workspace:
```
pnpm -w install
```

---

## Short investor pitch (one-paragraph)
Kiln is a protocol for managed trading vaults that changes incentives: traders must risk their own capital first in an on-chain, auditable paper-mode trial; investors only join once the trader proves performance. Losses are absorbed by "junior" capital first, protecting investors and aligning manager incentives. The system enforces graduation, dynamic position limits, and instant-exit protections — all enforced by on-chain logic and indexed events for transparency and discoverability.
