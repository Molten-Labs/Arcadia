# Pinocchio Framework Over Anchor

We chose Pinocchio (raw Solana program) over Anchor for the Arcadia on-chain program.

## Context

Anchor is the dominant Solana program framework. The deciding factor was compute unit (CU) efficiency for a program executing guard checks, oracle validations, and math operations per instruction.

## Decision

Use Rust + Pinocchio with `bytemuck` for zero-copy account layouts and `wincode` for instruction serialization. No Anchor-style account wrappers.

## Reasoning

Arcadia's `execute_swap`, `update_nav`, and `claim_fees` are compute-heavy. Anchor's account deserialization overhead adds measurable CU cost. Pinocchio's manual validation + `bytemuck` zero-copy reads save enough CU to fit complex operations within Solana's compute budget.

## Consequences

- All accounts are fixed-size `#[repr(C)]` structs with explicit discriminators
- No realloc — account sizes are static
- Shank for IDL generation (replaces Anchor's built-in IDL)
- LiteSVM for integration testing

## Rejected Alternatives

**Anchor for MVP, migrate to Pinocchio later**: A full rewrite disguised as a migration. Starting with Pinocchio avoids a throwaway implementation.

**Anchor with `#[account(zero_copy)]`**: Gets some CU savings but retains Anchor's entrypoint and dispatch overhead.
