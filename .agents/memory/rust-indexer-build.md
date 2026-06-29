---
name: Rust indexer build constraints
description: Known compile-time constraints for the server-rs Cargo workspace in the Replit environment.
---

## Rules

1. **No `sqlx::query!` macros** — Replit has no live Postgres at compile time, so the compile-time query-checking macros fail. Use `sqlx::query_as::<_, T>(sql).bind(…)` instead. SQLX offline mode (`.sqlx/` cache) is an alternative but requires running `cargo sqlx prepare` with a DB first.

2. **sqlx must use `runtime-tokio-rustls`** — `runtime-tokio-native-tls` pulls `openssl-sys` which requires system OpenSSL headers. Replit does not have them. Switching to `runtime-tokio-rustls` avoids the dependency entirely.

3. **No `solana-sdk` / `yellowstone-grpc-*` in workspace `[workspace.dependencies]`** — These conflict on `zeroize` / `ed25519-dalek` versions with `jsonwebtoken` (which needs `ed25519-dalek v2`). Leave them out of the workspace root. Add them individually to chain/workers Cargo.toml only when the user explicitly enables live Solana features.

4. **`axum::serve` lives in the API crate** — The bin crate does not list `axum` as a direct dep. Re-export `axum::serve` from `arcadia-api::serve` so `main.rs` can call it without needing its own axum dep.

**Why:** Replit's NixOS container has limited system libraries and no live database during `cargo check`. Pure-Rust TLS and runtime SQL avoid both constraints. Solana deps require careful version pinning that changes between releases and conflicts with JWT deps.

**How to apply:** When adding new DB queries, always use `query_as::<_, T>()` + `.bind()` pattern. When adding Solana features, add deps only to the relevant crate's `Cargo.toml`, not the workspace root.
