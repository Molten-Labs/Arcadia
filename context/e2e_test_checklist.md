# Kiln End-to-End Test Checklist

This checklist verifies the SOL-only MVP described in `context/arc_v2.md`.

## Program

- [x] Run `cargo fmt --check`.
- [x] Run `git diff --check`.
- [x] Build a fresh SBF artifact with `cargo build-sbf --sbf-out-dir /tmp/kiln-sbf-audit -- --target-dir /tmp/kiln-sbf-target`.
- [x] Run LiteSVM tests against the fresh artifact with `KILN_SBF_PATH=/tmp/kiln-sbf-audit/Kiln_program.so cargo test`.
- [x] Verify `execute_swap` no-op calls do not increment `paper_trade_count`.
- [x] Verify `update_nav` recomputes NAV from native treasury lamports and accepts a non-manager caller.
- [x] Verify `graduate_vault` remains bound to the vault/profile/config relationship without requiring manager caller authority.
- [x] Verify stale SBF protection fails tests when the loaded artifact is older than key source files.

## Frontend

- [x] Run `pnpm --dir app test`.
- [x] Run transaction-builder integration tests for all exported transaction hooks.
- [x] Verify frontend instruction discriminators match the program entrypoint.
- [x] Verify serialized instruction args match the Pinocchio/wincode layouts.
- [x] Verify account order, signer flags, and writable flags for manager, investor, NAV, graduation, fee, and swap flows.
- [x] Verify withdrawal screens convert SOL-denominated user input into program share-burn amounts before submitting withdraw instructions.
- [x] Verify Trade UI does not claim live Jupiter/Pyth routing on the SOL-only MVP branch.
- [x] Run `pnpm --dir app lint`.
- [x] Run `pnpm --dir app build`.

## Backend And Indexer

- [x] Retire the Node server; `dev:server` and `build:server` target `server-rs`.
- [x] Remove the legacy TypeScript backend so `server-rs` is the only backend.
- [x] Add SQLx migrations for raw webhook events and materialized product tables.
- [x] Verify `/health`, `/vaults`, `/vaults/:configAddress`, `/vaults/:configAddress/nav-history`, `/vaults/:configAddress/trades`, `/managers`, `/managers/:address`, and `/positions/:wallet` have concrete `server-rs` handlers.
- [x] Add fixture tests for webhook materialization and delayed public trade visibility.
- [x] Run `cargo test --manifest-path server-rs/Cargo.toml`.
- [x] Run `pnpm --dir clients build`.
- [x] Run `pnpm --dir clients test -- --run`.
- [ ] Add live Helius replay against devnet once the deployed webhook URL is configured.
- [ ] Add browser E2E against a local backend plus devnet/local validator once wallet automation is available.
- [ ] Regenerate the generated TypeScript client/IDL for instructions `5..9`; the app currently uses manual builders for the full ABI.

## Deferred Jupiter/Pyth Scope

- [x] Verify `execute_swap` rejects nonzero `minimum_amount_out`.
- [x] Verify `execute_swap` does not increment `paper_trade_count` while Jupiter CPI is absent.
- [x] Verify frontend labels the current trade surface as demo/deferred rather than live Jupiter execution.
- [ ] Add Jupiter CPI route validation, balance-delta validation, and qualifying-trade counting when Jupiter integration lands.

## Known Warnings

- `cargo build-sbf` warns that the package has both `cdylib` and `rlib` crate types, which disables LTO.
- `cargo build-sbf` warns that the crate name `Kiln_program` is not snake case.
- `cargo build-sbf` post-processing reports unresolved syscall names; the fresh LiteSVM run still executed the built artifact successfully.
- Frontend lint currently reports 18 pre-existing warnings and 0 errors.
- Vite build reports browser externalization and chunk-size warnings from dependencies.
- `server-rs` test may report a future-incompatibility warning from `sqlx-postgres v0.7.4`.
- The SOL-only MVP still does not have real Jupiter CPI, Pyth pricing, deployed Helius replay, manager-private trade auth, or successful real-trading graduation.
