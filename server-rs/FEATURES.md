# server-rs — Feature Flags & Extension Guide

## Default build (no flags)

Compiles and runs with:
- **Axum HTTP API** — all `/v1` endpoints
- **Score worker** — hourly TWR + metrics + score computation
- **Price worker** — Pyth price feed → Redis cache
- **Ingest worker** — stub loop (logs a warning; no gRPC)
- **Oracle** — stub (logs a warning; no on-chain signing)

```sh
cargo build -p arcadia-server
cargo run -p arcadia-server
```

## `--features solana` — Live Solana signing

Enables:
- `arcadia-chain`: real `set_capacity` + `record_trade` instruction building and signing
- Oracle worker: pushes computed capacity ceiling to devnet

**To enable:**
1. Open `server-rs/crates/chain/Cargo.toml` and add:
   ```toml
   [features]
   solana = ["dep:solana-sdk", "dep:solana-client"]

   [dependencies]
   solana-sdk    = { version = "=1.18.26", optional = true }
   solana-client = { version = "=1.18.26", optional = true }
   ```
   > **Note:** Pin to exact compatible versions. `solana-sdk 2.x` conflicts with `ed25519-dalek v2` (used by `jsonwebtoken`). Test with `cargo check --features solana` before running.
2. Uncomment the `solana_impl` module in `crates/chain/src/lib.rs`.
3. Set env vars: `ORACLE_KEYPAIR_PATH`, `SOLANA_RPC_URL`, `PROGRAM_ID`.

## `--features grpc` — Yellowstone gRPC ingest

Enables:
- `arcadia-workers/ingest`: subscribes to Yellowstone gRPC stream, decodes `TradeClosed`/`CapacityUpdated`/`DepositCompleted`/`WithdrawCompleted` events, upserts DB.

**To enable:**
1. Open `server-rs/crates/workers/Cargo.toml` and add:
   ```toml
   [features]
   grpc = ["dep:yellowstone-grpc-client", "dep:yellowstone-grpc-proto"]

   [dependencies]
   yellowstone-grpc-client = { version = "...", optional = true }
   yellowstone-grpc-proto  = { version = "...", optional = true }
   ```
   > Find a version of yellowstone compatible with your chosen `solana-sdk` version.
2. Uncomment the gRPC implementation block in `crates/workers/src/ingest.rs`.
3. Set env vars: `YELLOWSTONE_ENDPOINT`, `YELLOWSTONE_TOKEN`.

## `--features full` — Both

```sh
cargo run -p arcadia-server --features full
```

## Environment variables

See `.env.example` for a complete, commented reference.

## Database

Migrations run automatically on startup via `sqlx::migrate!()`.  
Schema: `server-rs/crates/db/migrations/001_initial.sql`

To set up a fresh database:
```sh
psql -c "CREATE DATABASE arcadia;"
export DATABASE_URL=postgres://user:pass@localhost/arcadia
cargo run -p arcadia-server   # migrations run on first boot
```
