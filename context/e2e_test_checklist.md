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
- [x] Run `pnpm --dir app lint`.
- [x] Run `pnpm --dir app build`.

## Known Warnings

- `cargo build-sbf` warns that the package has both `cdylib` and `rlib` crate types, which disables LTO.
- `cargo build-sbf` warns that the crate name `Kiln_program` is not snake case.
- `cargo build-sbf` post-processing reports unresolved syscall names; the fresh LiteSVM run still executed the built artifact successfully.
- Frontend lint currently reports 18 pre-existing warnings and 0 errors.
- Vite build reports browser externalization and chunk-size warnings from dependencies.
