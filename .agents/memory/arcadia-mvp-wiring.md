---
name: Arcadia MVP wiring
description: Full-stack wiring decisions for Anchor program + Rust Axum backend + Next.js frontend
---

## Architecture
- **Program ID**: `gTHauBMdJHs45tc8tjCKL7MejvBECQHgD184io3hx1C` (devnet — NOT yet deployed, program account 404)
- **Helius RPC**: `https://devnet.helius-rpc.com/?api-key=649881b9-dbd1-4a90-98bd-bd38240af548`
- **Ports**: Next.js → 5000, Rust Axum → 8080
- **DB**: Replit PostgreSQL via `DATABASE_URL` secret (already provisioned)

## Files created
- `app/lib/arcadia-idl.ts` — hand-written Anchor v1.0.2 IDL (anchor not installed; program not on-chain yet)
- `app/lib/arcadia-sdk.ts` — TypeScript SDK with PDA helpers + borsh decoders (uses `@solana/web3.js` only)
- `app/lib/backend-proxy.ts` — proxy utility used by all `/api/v1/*` routes

## Backend proxy pattern
All Next.js `/api/v1/*` routes use `proxyToBackend()` → proxy to Rust backend when `BACKEND_URL` is set → fall back to mock data on ECONNREFUSED or when `BACKEND_URL` is empty.

## Rust build
- **Why cargo 1.86 fails**: `jsonwebtoken` depends on `simple_asn1` which requires `time >= 0.3.47`; `time@0.3.47+` requires rustc 1.88+; nix cargo = 1.86.0.
- **Fix**: Install rustup 1.89.0 — `$HOME/.cargo/bin/cargo` (1.89.0). dev.sh sources `$HOME/.cargo/env`.
- **Build command**: `source $HOME/.cargo/env && cargo build --release --manifest-path server-rs/Cargo.toml`
- **Script**: `./build-backend.sh` (handles finding cargo, takes ~10 min first time)
- Once `target/release/server-rs` exists, `dev.sh` starts it automatically alongside Redis.

## DB
- Schema applied via `executeSql` (001_initial.sql)
- Mock seed data in: `trader_profile` (nova/vega/omega), `score_snapshot`, `ingest_cursor`
- Redis installed via `installSystemDependencies(["redis"])`; dev.sh starts `redis-server --daemonize yes`

## Environment vars set
- `BACKEND_URL=http://localhost:8080` (development only)
- `JWT_SECRET=arcadia-hackathon-jwt-secret-2026` (shared)
- `PROGRAM_ID=gTHauBMdJHs45tc8tjCKL7MejvBECQHgD184io3hx1C` (shared)
- `SOLANA_RPC_URL` and `NEXT_PUBLIC_HELIUS_RPC` pointing to Helius devnet (shared)
- Also written to `app/.env.local` and `server-rs/.env`

## Program deploy
- See `deploy-program.sh` for the full anchor build + deploy + IDL init workflow
- Requires Anchor CLI and funded devnet wallet

**Why:** The mock-data fallback keeps the frontend usable even when Rust backend or program aren't ready, which is essential for hackathon demos.
