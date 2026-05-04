# Arcadia

**A Proof-of-Performance Capital Protocol on Solana.**

Traders prove themselves with their own money before touching investor capital — and lose first when trades go wrong. No trust required. Code enforces it.

---

## How it works

Every vault starts in **paper mode**: the trader deposits their own capital (junior) and trades publicly on-chain for 30 days. Only after demonstrating positive performance does the vault open to investor deposits (senior). When trades lose money, the junior buffer absorbs losses first. Investor capital is protected until the junior is fully wiped.

Key protocol properties enforced at the program level:

- **First-loss waterfall** — trader junior capital absorbs all losses before investors feel anything
- **20% liquid reserve floor** — vault guard rejects any swap that would leave less than 20% of NAV in liquid stablecoin, ensuring investors can always withdraw
- **Dynamic position limits** — max trade size shrinks as junior health falls (10% → 6% → 3% → 1% → disabled)
- **Pro-rata withdrawal** — investors receive their proportional share of every token in the vault instantly, without waiting for the trader to unwind positions
- **High-water mark fees** — manager performance fees (up to 20%) only accrue on gains above the previous HWM

---

## Repository structure

```
Arcadia_program/       # On-chain program (Pinocchio, Shank, bytemuck)
  program/src/         # Program source
    instructions/      # All 10 instructions
    states/            # Account structs (zero-copy, Pod)
  kiln-tests/          # LiteSVM integration tests
app/                   # Frontend (Vite + React + TypeScript + Tailwind)
  src/pages/           # Route pages
  src/hooks/           # Data fetching hooks
  src/lib/             # Wallet, formatting, Solana helpers
server-rs/             # Axum indexer + Helius webhook handler
clients/               # Generated TypeScript client SDK (Codama/Shank)
```

---

## Quickstart

### Prerequisites

- [Rust](https://rustup.rs/) stable + the Solana SBF toolchain
- [Node.js](https://nodejs.org/) 18+ and [pnpm](https://pnpm.io/)
- [Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) configured for devnet

### 1. Clone

```bash
git clone https://github.com/your-org/arcadia.git
cd arcadia
```

### 2. Build and test the on-chain program

```bash
cd Arcadia_program

# Unit tests (no SBF toolchain required)
cargo test --features test-default -p Arcadia_program

# Integration tests (requires a built .so)
cargo build-sbf
cargo test -p kiln-tests
```

### 3. Deploy to devnet

```bash
cd Arcadia_program
solana config set --url devnet
cargo build-sbf
solana program deploy target/deploy/Kiln_program.so
```

### 4. Run the frontend

```bash
# From repo root
cp .env.example .env
# Set VITE_RPC_URL to your devnet RPC endpoint

pnpm install
pnpm --dir app dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Usage

### Create a vault (trader)

```typescript
import { useKilnTransactions } from "@/hooks/useTransactions";

const { initManager, createVault, depositJunior } = useKilnTransactions();

// 1. Initialize your manager profile (once per wallet)
await initManager();

// 2. Create a vault in paper mode
await createVault({
  name: "Alpha Vault I",
  feeBps: 2000,           // 20% performance fee
  maxSlippageBps: 200,    // 2% max slippage per swap
  paperWindowSecs: 2592000, // 30 days
});

// 3. Deposit your first-loss junior capital
await depositJunior(vaultConfigPda, 5_000_000n); // 5 USDC (6 decimals)
```

### Deposit as an investor (after vault graduation)

```typescript
const { depositSenior } = useKilnTransactions();

await depositSenior(vaultConfigPda, 10_000_000n); // 10 USDC
```

### Withdraw at any time

```typescript
const { withdrawSenior } = useKilnTransactions();

// Withdraws your pro-rata share of every token in the vault
await withdrawSenior(vaultConfigPda, amountUsdcUnits);
```

---

## Program instructions

| # | Instruction | Who calls it |
|---|---|---|
| 0 | `init_manager` | Trader — one-time profile creation |
| 1 | `create_vault` | Trader — creates a vault in paper mode |
| 2 | `deposit_junior` | Trader — posts first-loss capital |
| 3 | `update_nav` | Anyone — recomputes NAV from oracle prices |
| 4 | `graduate_vault` | Anyone — promotes a paper vault if requirements met |
| 5 | `deposit_senior` | Investor — deposits into a graduated vault |
| 6 | `withdraw_senior` | Investor — pro-rata withdrawal of vault assets |
| 7 | `withdraw_junior` | Trader — reclaims junior capital (respects ratio floor) |
| 8 | `claim_fees` | Trader — claims performance fees above HWM |
| 9 | `execute_swap` | Trader — vault-guarded Jupiter CPI swap |

---

## Vault guard checks

Every `execute_swap` runs 10 checks before execution:

1. Vault not frozen
2. Vault graduated (paper mode complete)
3. Trading enabled (junior health > threshold)
4. Position size within dynamic limit
5. Input ≠ output mint
6. Output token on whitelist
7. Trade cooldown not active
8. Slippage: actual out ≥ minimum out
9. Oracle price fresh and confidence within bounds (Pyth, max 30s staleness)
10. Post-swap AUDD balance ≥ 20% of total NAV

---

## Account model

```
ManagerProfile    PDA: ["manager", manager_pubkey]
VaultConfig       PDA: ["vault-config", manager_pubkey, vault_index]
VaultState        PDA: ["vault-state", vault_config_pubkey]
InvestorPosition  PDA: ["investor-position", investor_pubkey, vault_config_pubkey]
Treasury          PDA: ["vault-treasury", vault_config_pubkey]
```

Investor positions are tracked in `InvestorPosition` only — no share token mints. Ownership percentage is derived at withdrawal time:

```
investor_pct = investor.senior_shares / vault.senior_shares_outstanding
```

---

## Environment variables

```bash
# Frontend
VITE_RPC_URL=https://api.devnet.solana.com
VITE_KILN_API_BASE_URL=http://localhost:8080

# Indexer (server-rs)
DATABASE_URL=postgres://user:pass@localhost:5432/arcadia
HELIUS_API_KEY=your_helius_key
HELIUS_WEBHOOK_SECRET=your_webhook_secret
PORT=8080

# Optional (mainnet only)
JUPITER_API_KEY=your_jupiter_key
```

> **Never commit secrets.** Use environment variables or a secrets manager.

---

## Running the indexer

The Axum-based indexer handles Helius webhooks, materializes vault state into Postgres, and proxies Jupiter routes.

```bash
cd server-rs
DATABASE_URL=postgres://postgres:postgres@localhost:5432/arcadia cargo run --release
```

Endpoints:

| Route | Description |
|---|---|
| `GET /health` | API and database status |
| `POST /webhook` | Helius webhook ingestion |
| `GET /vaults` | All materialized vaults |
| `GET /vaults/{address}` | Single vault detail |
| `GET /vaults/address/nav-history` | NAV chart data |
| `GET /managers/address` | Manager profile |
| `GET /positions/wallet` | Investor positions |
| `GET /jupiter/quote` | Guarded Jupiter quote proxy |
| `POST /jupiter/swap-instructions` | Swap instruction builder |

---

## Tech stack

| Layer | Technology |
|---|---|
| On-chain program | Rust, [Pinocchio](https://github.com/febo/pinocchio), Shank IDL, bytemuck zero-copy |
| Oracle | Pyth (max 30s staleness, 1.5% confidence bound) |
| Swap routing | Jupiter CPI (spot, devnet guard-only MVP) |
| Testing | LiteSVM, Rust unit tests |
| Frontend | Vite, React, TypeScript, Tailwind CSS |
| Indexer | Rust, Axum, SQLx, Postgres |
| Webhooks | Helius |

---

## Development workflow

```bash
# Regenerate IDL and TypeScript client
pnpm -w codegen:shank
pnpm --dir clients run generate

# Run frontend dev server
pnpm --dir app dev

# Run indexer
cd server-rs && cargo run

# Run all program tests
cd Arcadia_program && cargo test --features test-default -p Kiln_program

# Build SBF program
cd Arcadia_program && cargo build-sbf
```

---

## Contributing

1. Fork the repository and create a feature branch.
2. Run tests before opening a pull request: `cargo test --features test-default -p Kiln_program`
3. Keep program changes covered by LiteSVM integration tests in `kiln-tests/`.
4. For frontend changes, run `pnpm --dir app build` to verify no type errors.

---

## License

MIT
