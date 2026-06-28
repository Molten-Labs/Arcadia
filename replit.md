# Arcadia Protocol

A full-stack Solana monorepo for Arcadia's proof-of-performance capital protocol.

## Repository Layout

```
/app                        — React + Vite frontend
/mobile                     — Expo + React Native mobile app
/arcadia_vault              — Anchor 1.0.2 Solana program scaffold
  Anchor.toml               — devnet provider config
  programs/arcadia_vault    — placeholder program crate
  programs/arcadia_vault/tests
                             — LiteSVM Rust scaffold tests
/clients                    — TypeScript SDK package; generated from the Anchor IDL
/server-rs                  — Rust indexer + API backend
/docs                       — protocol documentation
/context                    — build plans and design context
```

## Tech Stack

| Layer | Technology |
|-------|------------|
| Web Frontend | React, Vite, TypeScript, Tailwind CSS |
| Mobile App | Expo, React Native, Expo Router |
| Solana Program | Anchor 1.0.2, Rust, LiteSVM scaffold tests |
| Backend | Rust, Axum, PostgreSQL, Helius webhooks |
| SDK | Codama-generated TypeScript client from the Anchor IDL |

## Quick Start

### Frontend

```bash
bash setup.sh
bash dev.sh
```

The app runs on port 5000.

### Backend

```bash
cargo run --manifest-path server-rs/Cargo.toml
```

## On-Chain Program

The active program workspace is `arcadia_vault/`. Phase 1 includes only scaffold code and a smoke-test instruction path; no Arcadia vault handlers have been implemented yet.

```bash
cd arcadia_vault
anchor keys list
anchor build
anchor test --skip-local-validator
```

From the repo root:

```bash
pnpm program:keys
pnpm program:build
pnpm program:test
```

## Code Generation

Build the Anchor program first so the IDL exists at `arcadia_vault/target/idl/arcadia_vault.json`, then generate the TypeScript SDK:

```bash
pnpm program:build
pnpm --dir clients generate
```

## Program Spec

The canonical on-chain program spec is [docs/arcadia-vault-program-spec.md](/Users/deepeshsinghrathore/Projects/Arcadia/docs/arcadia-vault-program-spec.md). The original HTML source remains at `spec-solana-program.html`.

## Deployment

Static frontend deployment:

- **Build:** `npm run build:app`
- **Output directory:** `app/dist`
