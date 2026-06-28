# Arcadia Protocol
<img width="1983" height="793" alt="banner" src="https://github.com/user-attachments/assets/03bb0814-4144-431b-a2bf-64e0a6349e1e" />

**Proof-of-Performance Capital Protocol on Solana.**

Arcadia lets traders build verified onchain performance and gives investors a clean, program-enforced way to allocate capital to proven traders.

---

## Repository Structure

```
arcadia_vault/             # Anchor 1.0.2 Solana program scaffold
  Anchor.toml              # Devnet provider config
  programs/arcadia_vault/  # Placeholder Anchor program; Arcadia logic comes next
  programs/arcadia_vault/tests/
                            # LiteSVM Rust scaffold tests
docs/
  arcadia-vault-program-spec.md
                            # Canonical Markdown program spec converted from HTML
app/                       # Frontend (Vite + React + TypeScript + Tailwind)
mobile/                    # Expo + React Native app
server-rs/                 # Axum indexer/API backend
clients/                   # Placeholder TypeScript SDK package; generated from Anchor IDL later
```

---

## Program Status

The active on-chain workspace is now `arcadia_vault/`.

Phase 1 only resets the workspace to Anchor and preserves the program spec. It does **not** implement the Arcadia vault instructions yet. The intended program behavior, accounts, events, math, and test matrix live in [docs/arcadia-vault-program-spec.md](/Users/deepeshsinghrathore/Projects/Arcadia/docs/arcadia-vault-program-spec.md).

---

## Quick Start

### Frontend

```bash
bash setup.sh
bash dev.sh
```

The web app runs on port 5000.

### Backend

```bash
cargo run --manifest-path server-rs/Cargo.toml
```

### Anchor Program

Use Anchor `1.0.2` for this workspace.

```bash
cd arcadia_vault
anchor keys list
anchor build
anchor test --skip-local-validator
```

Root helper scripts are also available:

```bash
pnpm program:keys
pnpm program:build
pnpm program:test
```

---

## Code Generation

Anchor emits the IDL at `arcadia_vault/target/idl/arcadia_vault.json` after `anchor build`.

```bash
pnpm program:build
pnpm --dir clients generate
```

The generated SDK is written under `clients/src/generated/` and currently reflects the Anchor smoke-test IDL.

---

## Environment Variables

```bash
# Frontend
VITE_RPC_URL=https://api.devnet.solana.com
VITE_KILN_API_BASE_URL=http://localhost:8080

# Indexer
DATABASE_URL=postgres://user:pass@localhost:5432/arcadia
HELIUS_API_KEY=your_helius_key
HELIUS_WEBHOOK_SECRET=your_webhook_secret
PORT=8080

# Mainnet only
JUPITER_API_KEY=your_jupiter_key
```
