# Arcadia Vault Program Plan

Source of truth: `spec-solana-program.html`.

This is the active module-by-module tracker for the Anchor implementation. It is derived from `spec-solana-program.html`; if the HTML spec changes, refresh this file and the other program docs before changing code.

## Spec Authority

- `spec-solana-program.html` is authoritative for program behavior, account fields, instruction inputs, errors, events, and test intent.
- `docs/arcadia-vault-program-spec.md` is a readable derived copy, not the authority.
- `docs/program/instruction-behavior.md` and `docs/program/litesvm-test-plan.md` are working build docs.
- Any behavior change must update `spec-solana-program.html` first, then regenerate or manually refresh derived docs.

## Current Gate

- Branch: `anchor`.
- Current phase: `record_trade`.
- Current instruction: `record_trade`.
- Smoke harness status: keep existing `initialize_smoke` and `ping` tests as scaffold health checks until real instruction tests replace them. Smoke instructions are not part of the Arcadia business API.
- Skills refresh: `curl -fsSL https://www.solana.new/setup.sh | bash` was requested, but direct remote-script execution was blocked by the approvals reviewer as too risky for automated execution. This remains pending explicit manual execution or a safer approved installer path.

## Official References

- Solana install docs: `https://solana.com/docs/intro/installation`.
- Solana accounts: `https://solana.com/docs/core/accounts`.
- Solana PDAs: `https://solana.com/docs/core/pda`.
- Solana CPI: `https://solana.com/docs/core/cpi`.
- Anchor account constraints: `https://www.anchor-lang.com/docs/account-constraints`.
- Anchor LiteSVM testing: `https://www.anchor-lang.com/docs/testing/litesvm`.
- Solana Skills: `https://solana.com/skills`.

## Milestones

| Milestone | Status | Exit Criteria |
| --- | --- | --- |
| Docs + Tooling Gate | complete | Three program docs added; Anchor 1.0.2 build/test green; setup-script status recorded. |
| Foundation Module | complete | Real constants, errors, events, state structs, math helpers, token helpers, PDA seeds compile with IDL generation. |
| `initialize_platform` | complete | Implementation, LiteSVM tests, docs update, build/test/codegen/client build green. |
| `initialize_profile` | complete | Implementation, LiteSVM tests, docs update, build/test/codegen/client build green. |
| `set_capacity` | complete | Implementation, LiteSVM tests, docs update, build/test/codegen/client build green. |
| `initialize_investor` | complete | Implementation, LiteSVM tests, docs update, build/test/codegen/client build green. |
| `deposit` | complete | Implementation, LiteSVM tests, docs update, build/test/codegen/client build green. |
| `request_withdraw` | complete | Implementation, LiteSVM tests, docs update, build/test/codegen/client build green. |
| `process_withdraw` | complete | Implementation, LiteSVM tests, docs update, build/test/codegen/client build green. |
| `record_trade` | planned | Implementation, LiteSVM tests, docs update, build/test/codegen/client build green. |
| `settle` | planned | Implementation, LiteSVM tests, docs update, build/test/codegen/client build green. |
| `trader_withdraw_profit` | planned | Implementation, LiteSVM tests, docs update, build/test/codegen/client build green. |
| Devnet Integration | planned | Full local LiteSVM flow green, deployed devnet flow green, frontend/indexer can consume IDL/events. |

## Per-Instruction Gate Checklist

Use this checklist before moving to the next instruction:

- [ ] `spec-solana-program.html` reviewed for this instruction.
- [ ] `instruction-behavior.md` status moved to `in_progress`.
- [ ] Implementation complete.
- [ ] LiteSVM happy path complete.
- [ ] LiteSVM negative tests complete.
- [ ] Event assertions complete where applicable.
- [ ] Token conservation assertions complete where applicable.
- [ ] `instruction-behavior.md` status moved to `tested` or `complete`.
- [ ] `litesvm-test-plan.md` updated with passing/pending cases.
- [ ] `pnpm program:build` green.
- [ ] `pnpm program:test` green.
- [ ] `pnpm codegen` run if IDL changed.
- [ ] `pnpm --dir clients build` green if client output changed.
- [ ] Commit created and pushed.

## Foundation Module Checklist

- [x] Remove or quarantine smoke-only state from active business modules.
- [x] Add `anchor-spl` token interface dependency.
- [x] Add `events.rs` with locked event names and fields from the HTML spec.
- [x] Replace smoke `ErrorCode` with full `ArcadiaError` enum from the HTML spec.
- [x] Add real state structs with `#[derive(InitSpace)]`, saved bumps, and no unbounded `String` or `Vec` fields.
- [x] Add constants for seeds, `SHARE_SCALE`, BPS values, notional limits, withdrawal threshold, fee defaults, and time constants.
- [x] Add checked math helpers using `u128`/`i128` intermediates and explicit rounding direction.
- [x] Add token helper wrappers for `transfer_checked` and PDA signer seeds.
- [x] Keep IDL generation working with `idl-build`.

## Acceptance Rules

- Do not start the next instruction until the current instruction gate is green.
- Do not use Pinocchio or Shank.
- Do not treat Codama output as authoritative; it is generated from the Anchor IDL.
- Do not change instruction names, account field order, event names, or public input shapes unless `spec-solana-program.html` is updated first.
- For fund-moving handlers, a test without token-balance assertions is incomplete.
- For custody and authority behavior, a test without wrong-signer and wrong-account cases is incomplete.
- For mainnet, `record_trade` is not the final trading path; the HTML spec says mainnet replaces it with `execute_trade` while preserving downstream NAV/events/accounts.

## Verification Log

- 2026-06-28: `anchor --version` returned `anchor-cli 1.0.2`.
- 2026-06-28: `anchor build` passed from `arcadia_vault/`.
- 2026-06-28: `anchor test --skip-local-validator --skip-deploy` passed from `arcadia_vault/`.
- 2026-06-28: `clients/node_modules/.bin/tsc -p clients/tsconfig.json` passed.
- 2026-06-28: `pnpm program:build` was attempted but the package-manager preflight stopped on non-interactive module purge/build-script approval before reaching Anchor; direct Anchor verification is the recorded tooling gate.
- 2026-06-28: Foundation Module `anchor build` passed from `arcadia_vault/`.
- 2026-06-28: Foundation Module `anchor test --skip-local-validator --skip-deploy` passed from `arcadia_vault/`; 6 foundation unit tests, 1 scaffold init test, and 5 LiteSVM smoke tests passed.
- 2026-06-28: `pnpm codegen` was attempted but the package-manager preflight attempted a workspace install and hit non-interactive/build-script policy plus npm DNS limits; direct `clients/node_modules/.bin/tsx clients/codama.ts` regenerated the Anchor-derived client.
- 2026-06-28: `pnpm --dir clients build` was attempted but the same package-manager preflight attempted a workspace install; direct `clients/node_modules/.bin/tsc -p clients/tsconfig.json` passed.
- 2026-06-28: `initialize_platform` `anchor build` passed from `arcadia_vault/`.
- 2026-06-28: `initialize_platform` `anchor test --skip-local-validator --skip-deploy` passed; tests covered happy path, reinit failure, unsafe fee config failures, wrong config PDA, treasury mint mismatch, exact state writes, and CU recording.
- 2026-06-28: `initialize_platform` direct `clients/node_modules/.bin/tsx clients/codama.ts` regenerated client output and direct `clients/node_modules/.bin/tsc -p clients/tsconfig.json` passed.
- 2026-06-28: `initialize_platform` `pnpm program:build` was attempted again but the wrapper stopped on non-interactive module purge before running Anchor; direct Anchor verification remains the executable gate in this environment.
- 2026-06-28: `initialize_profile` `anchor build` passed from `arcadia_vault/`.
- 2026-06-28: `initialize_profile` `anchor test --skip-local-validator --skip-deploy` passed; tests covered happy path, reinit failure, invalid leverage, wrong profile PDA, config/base-mint binding, event log emission, exact profile state, and vault token authority = profile PDA.
- 2026-06-28: `initialize_profile` direct `clients/node_modules/.bin/tsx clients/codama.ts` regenerated client output and direct `clients/node_modules/.bin/tsc -p clients/tsconfig.json` passed.
- 2026-06-28: `initialize_profile` `pnpm program:test` was attempted but the wrapper stopped on non-interactive module purge before running Anchor; direct Anchor verification remains the executable gate in this environment.
- 2026-06-28: `set_capacity` `anchor build` passed from `arcadia_vault/`.
- 2026-06-28: `set_capacity` `anchor test --skip-local-validator --skip-deploy` passed; tests covered oracle-only authorization, invalid tier rejection, tier 255 acceptance, inactive profile rejection, exact state writes, and CU recording.
- 2026-06-28: `set_capacity` direct `clients/node_modules/.bin/tsx clients/codama.ts` regenerated client output and direct `clients/node_modules/.bin/tsc -p clients/tsconfig.json` passed.
- 2026-06-28: `initialize_investor` `anchor build` passed from `arcadia_vault/`.
- 2026-06-28: `initialize_investor` `anchor test --skip-local-validator --skip-deploy` passed; tests covered happy path, reinit failure, wrong PDA failure, distinct wallet independence, event log emission, exact account state, and CU recording.
- 2026-06-28: `initialize_investor` direct `clients/node_modules/.bin/tsx clients/codama.ts` regenerated client output and direct `clients/node_modules/.bin/tsc -p clients/tsconfig.json` passed.
