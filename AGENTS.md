# Arcadia

Solana protocol that scores on-chain trading history into an Arcadia Score (0–1000) and routes investor capital to skilled traders via non-custodial vaults.

## Working principles

- Grow the system in layers. Start from the smallest version that works end to end, and add each new capability on top of a product that already works. Never trade a working product for unfinished complexity.
- Lean on the dependencies already in the project before writing your own implementation or adding packages. Do not assume a library lacks a capability without checking its documentation and types.
- Do not preserve backward compatibility. Choose the simplest implementation that fully meets the current requirements. Prefer established, well-maintained libraries over custom implementations.
- Make architectural decisions for the long term. Do not accept a stopgap that only works for now and is meant to be replaced later.

## Before implementing

Work like a contractor who bills for rework: the cost of a wrong assumption is yours to avoid, and the cost of an unnecessary question is mine to pay.

### 1. Investigate before you ask
Read the relevant code, tests, configs, and dependency manifests first. Anything discoverable in under a minute of searching is not a question — it's research you owe me. Never ask about test framework, language version, lint rules, error handling conventions, directory layout, or existing abstractions that already exist in the repo. If the codebase contradicts itself, that's worth raising.

### 2. Then produce this, and stop

**Goal.** One paragraph restating what I asked for in your own words, including the acceptance criteria you'll hold yourself to. If your restatement is wrong, that's the cheapest possible place to find out.

**Blocking questions (0-3).** Only ask when a wrong answer means throwing work away, not adjusting it. Each question gets your recommended default so I can reply "yes to all" — never ask an open question where a proposed answer would do. If nothing is genuinely blocking, say so and list zero.

**Assumptions.** Numbered, specific, falsifiable. "Inputs are under 10k rows and fit in memory" is an assumption. "The code should be maintainable" is not. Cover whichever of these the task actually touches:
  - Data: shape, volume, trust level, encoding, what a malformed input looks like
  - Failure: what should happen on timeout, partial write, or downstream 500 — retry, fail loud, or degrade
  - Boundaries: who calls this, what's public API vs. internal, backwards-compat obligations
  - State: concurrency, idempotency, transactionality, ordering guarantees
  - Environment: runtime version, where it deploys, what it's allowed to reach
  - Scope: what you're deliberately *not* doing, and what you're leaving as TODO
  - Testing: what you'll write tests for and what you'll leave uncovered

**Plan.** Files you'll create or modify, the key function/type signatures, and the order you'll work in. Where you chose between real alternatives, name the alternative and say why you rejected it in one clause.

Then wait. Do not begin implementing.

### 3. Proportionality
This ceremony scales with blast radius. A typo fix, a rename, or a change under ~20 lines with one obvious correct form: just do it. A new module, a schema change, anything touching auth, money, migrations, or deletion: full treatment, and be more suspicious than usual of your own assumptions.

### 4. After I approve
Implement the plan as approved. If you discover mid-implementation that an assumption was wrong or the plan doesn't survive contact with the code, stop and tell me — don't quietly improvise a different design and don't press on with an approach you now believe is wrong.

## Layout

- `app/` — Next.js 16 (App Router, React 19, TS, Tailwind v4, shadcn/ui, motion). Entry: `app/app/layout.tsx`. Brand source of truth: `BRAND.md`.
- `server-rs/` — Rust backend: Cargo workspace (9 `arcadia-*` crates) + `bin/arcadia-server` (Axum HTTP API + background workers). Schema: `server-rs/crates/db/migrations/`.
- `arcadia_vault/` — Anchor smart contract (own, separate Cargo workspace).

## Rust gotchas

- **All cargo commands must use `--manifest-path server-rs/Cargo.toml`.** Plain `cargo ...` from repo root fails with "multiple workspace roots found" (root `Cargo.toml` and `server-rs/Cargo.toml` both declare workspaces). `arcadia_vault/` is a third, independent workspace handled by Anchor.
- The server binary **panics at startup unless `DATABASE_URL` and `JWT_SECRET` are set**; it also needs Postgres (migrations auto-apply via `sqlx::migrate!()` — no `query!` macros, so compilation doesn't need a DB) and Redis. The README's `ARCADIA_STORE=memory ARCADIA_DEMO_MODE=true` demo mode is **stale — that code does not exist**.
- `solana`/`grpc`/`full` features are **disabled by default**: `arcadia-chain` signing and Yellowstone gRPC ingest run as stubs. Enabling them means editing crate `Cargo.toml`s by hand — see `server-rs/FEATURES.md`. `solana-sdk` / `yellowstone-grpc` are deliberately absent from workspace deps (ed25519-dalek v2 conflict with SIWS; pin `=1.18.26` if you add them).
- Commands: `cargo test --manifest-path server-rs/Cargo.toml --workspace`, `cargo run --manifest-path server-rs/Cargo.toml -p arcadia-server`. Toolchain pinned to 1.89.0 via `rust-toolchain.toml`.

## Frontend

- Package manager is **npm** (`npm --prefix app run dev|build|typecheck|lint|test`). The pnpm references in `dev.sh`/`.env.example` are stale Replit leftovers. Node 20+.
- CI order: `npm run typecheck` → `lint` → `test` (Vitest) → `build`. Tests are minimal — only `app/lib/utils.test.ts` and `app/components/ui/button.test.tsx`.
- Next.js API routes (`app/app/api/v1/*`) proxy to the Rust backend when `BACKEND_URL` is set; without it they serve mock data (`app/lib/mock-data.ts`). A configured-but-failing backend returns errors, never mock.
- **Program ID and IDL are hardcoded, hand-generated** in `app/lib/arcadia-idl.ts` and `app/lib/arcadia-sdk.ts`. They are NOT regenerated from `anchor build`; update both manually if the program changes.

## Anchor program

- Anchor 1.0.2, `anchor-lang = "=1.0.2"`, devnet only. Program ID: `FPoAMRkM3kXfuvFn1iC2cM8B554KfnaPjibjLH31CHtd` (also hardcoded in frontend, above).
- `anchor test` (from `arcadia_vault/`) runs **Rust unit tests** via `[scripts] test = cargo test` (`programs/arcadia_vault/src/smoke.rs`); there are no TypeScript integration tests.
- Deploy: `bash deploy-program.sh` (builds, verifies ID, deploys, publishes IDL).

## Backend wiring

- `bin/arcadia-server` supervises workers (ingest, score, price, executor, withdraw) plus the Axum API on `$PORT` (8080 default). `server-rs/crates/api/src/routes.rs` is the API surface; frontend `transform*` helpers in `app/lib/backend-transform.ts` map Rust DTOs to UI types.
- There is also `server-rs/execution-worker/`, a standalone Node/Express service for execution-wallet/FlashTrade flows, run with `tsx` and resolving modules against `app/node_modules`.
