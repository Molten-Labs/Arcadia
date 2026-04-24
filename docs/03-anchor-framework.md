# Anchor Framework — Latest State (April 2026)

## Version History Since the Build Plan

| Version | Date | Status |
|---------|------|--------|
| 0.30.1 | Mid 2024 | **Build plan references this — outdated** |
| 0.31.0 | March 2025 | Breaking changes |
| 0.32.0 | October 2025 | Breaking changes |
| 0.32.1 | October 2025 | Patch (race condition fix) |
| **1.0.0** | **April 2, 2026** | **Stable major release — 6 days old** |

## Recommendation for the Hackathon

**Use Anchor 0.32.1** for the Rust program and `@coral-xyz/anchor@0.32.1` for the TypeScript client. Reasons:
- Battle-tested, all tutorials/docs align with it
- 1.0.0 is 6 days old — may have rough edges, missing crates.io publication
- The upgrade path from 0.32.1 to 1.0.0 is smooth (0.32 was the "pre-1.0 stabilization" release)
- IDL format is the same in both versions

If you want bleeding edge, use 1.0.0 for: no Solana CLI dependency, `Migration<From, To>` type, LiteSVM/Surfpool testing.

---

## Installation

```bash
# Install AVM (Anchor Version Manager)
cargo install avm --git https://github.com/solana-foundation/anchor --locked

# Install and use 0.32.1 (recommended)
avm install 0.32.1
avm use 0.32.1

# Verify
anchor --version
```

**Requirements:**
- Rust 1.89.0+ (required since 0.32.0)
- Solana/Agave CLI 2.1.0+ (for 0.32.x; not needed for 1.0.0)

---

## Key Changes Since 0.30.1

### v0.31.0 — Breaking
- `init` constraint runs in closures (fixes stack overflow with multiple `init`)
- Auto IDL conversion (no more manual `anchor idl convert`)
- **Must remove separate `solana-program` dependency** — use `anchor_lang::solana_program` instead

### v0.32.0 — Breaking
- Verifiable builds use `solana-verify` (not Docker image)
- **IDL auto-uploaded on deploy** — use `anchor deploy --no-idl` to skip
- Rust 1.89.0+ required for IDL building

### v1.0.0 — Major
- No Solana CLI dependency
- LiteSVM + Surfpool as default testing
- `@anchor-lang/core` new npm package name (replaces `@coral-xyz/anchor`)
- `Migration<From, To>` account type for schema upgrades
- Duplicate mutable accounts rejected by default
- `avm self-update`

---

## IDL Format (Changed in 0.30+)

The IDL now includes:
- **`discriminator`** field on all instructions, accounts, events (byte array)
- **`address`** field on instruction accounts for constant pubkeys
- **`metadata.address`** — program's public key
- **`metadata.spec`** — IDL spec version

```json
{
  "name": "userProfile",
  "discriminator": [246, 28, 6, 87, 251, 45, 50, 42]
}
```

`anchor build` generates both:
- `target/idl/taptribe.json` — IDL file
- `target/types/taptribe.ts` — TypeScript types

---

## TypeScript Client

### Package
```json
{
  "@coral-xyz/anchor": "^0.32.1",
  "@solana/web3.js": "^1.98.0"
}
```

**Note:** `@anchor-lang/core@1.0.0` also exists on npm (the 1.0 rename), but `@coral-xyz/anchor@0.32.1` is more battle-tested. Both depend on `@solana/web3.js` v1.

**Critical:** Only compatible with `@solana/web3.js` v1. NOT compatible with `@solana/kit`.

### Loading IDL in React Native
```typescript
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import idl from './idl/taptribe.json';
import type { Taptribe } from './types/taptribe';

const program = new Program<Taptribe>(idl as any, provider);

// Call instruction
await program.methods
  .createProfile("Deepesh", "avatar_url", "Building TapTribe", '["twitter:@deep"]')
  .accounts({
    profile: profilePda,
    owner: wallet.publicKey,
    systemProgram: SystemProgram.programId,
  })
  .rpc();
```

---

## PDA Best Practices (2026)

```rust
#[derive(Accounts)]
pub struct CreateProfile<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,
    #[account(
        init,
        payer = authority,
        space = 8 + Profile::INIT_SPACE,
        seeds = [b"profile", authority.key().as_ref()],
        bump,
    )]
    pub profile: Account<'info, Profile>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Profile {
    pub authority: Pubkey,     // 32 bytes
    #[max_len(32)]
    pub display_name: String,  // 4 + 32 bytes
    #[max_len(200)]
    pub avatar_uri: String,    // 4 + 200 bytes
    #[max_len(140)]
    pub bio: String,           // 4 + 140 bytes
    pub tap_count: u32,        // 4 bytes
    pub created_at: i64,       // 8 bytes
    pub bump: u8,              // 1 byte
}
```

Key patterns:
- **Always store the bump** in the account
- **Use `#[derive(InitSpace)]`** with `#[max_len(N)]` for dynamic types
- The `8 +` prefix accounts for the 8-byte discriminator
- **Do NOT add `solana-program`** as a separate dependency — use `anchor_lang::solana_program`

---

## Testing (Updated)

### Traditional (still works for 0.32.x)
```bash
anchor test  # spins up solana-test-validator, runs TS tests
```

### New in 1.0.0
**LiteSVM** — in-process Solana VM, extremely fast Rust tests:
```rust
use anchor_litesvm::LiteSVM;
```

**Surfpool** — drop-in replacement for `solana-test-validator`:
```bash
surfpool start
```
Fetches mainnet accounts just-in-time, supports time travel testing.

### For the Hackathon
Use traditional `anchor test` with TypeScript integration tests (aligns with React Native development). Consider LiteSVM for fast Rust-level unit tests.

---

## Common Gotchas

1. **Duplicate mutable accounts rejected by default** (1.0) — use `#[account(mut, dup)]` to explicitly allow
2. **`solana-program` conflict** — do NOT add as separate dep, use `anchor_lang::solana_program`
3. **IDL auto-upload on deploy** (0.32+) — use `--no-idl` to skip
4. **Rust 1.89.0+** required since 0.32.0
5. **Agave rename** — some Solana binaries renamed to Agave in 0.31+
6. **crates.io lag** — if 1.0.0 isn't on crates.io yet, use git tag:
   ```toml
   anchor-lang = { git = "https://github.com/solana-foundation/anchor", tag = "v1.0.0" }
   ```

---

## Sources
- [Anchor v1.0.0 Announcement](https://x.com/solana_devs/status/2039837963840803283)
- [Anchor Documentation](https://www.anchor-lang.com/docs)
- [v0.31.0 Release Notes](https://www.anchor-lang.com/docs/updates/release-notes/0-31-0)
- [v0.32.0 Release Notes](https://www.anchor-lang.com/docs/updates/release-notes/0-32-0)
- [Anchor IDL Docs](https://www.anchor-lang.com/docs/basics/idl)
- [Anchor Account Constraints](https://www.anchor-lang.com/docs/references/account-constraints)
- [LiteSVM Testing](https://www.anchor-lang.com/docs/testing/litesvm)
- [Surfpool Docs](https://docs.surfpool.run/)
- [@coral-xyz/anchor on npm](https://www.npmjs.com/package/@coral-xyz/anchor)
