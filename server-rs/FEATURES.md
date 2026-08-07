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
- `arcadia-workers/ingest_grpc`: subscribes to Yellowstone gRPC stream
  (transactions filtered by program id + slots at CONFIRMED), buffers
  per-slot, and flushes in ascending order once a slot reaches
  CONFIRMED. Reconnects with exponential backoff and resumes from the
  last persisted slot watermark.

**To enable:**
1. Build with `--features grpc`:
   ```sh
   cargo run -p arcadia-server --features grpc
   ```
2. Set env vars: `YELLOWSTONE_ENDPOINT`, `YELLOWSTONE_TOKEN`.
3. The poll loop (`ingest.rs`) is disabled; the gRPC worker is the
   sole ingest path when this feature is on.

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
