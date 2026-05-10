# Arcadia
<img width="1024" height="572" alt="image" src="https://github.com/user-attachments/assets/a9b2b319-3f83-4198-9181-05cd2529f284" />

**Proof-of-Performance Capital Protocol on Solana.**

Arcadia lets traders raise capital through verified on-chain performance and execute strategies privately, while investors get automatic protection and clean exits — all enforced by code, no trust required.

---

## What it does

Traders deposit their own capital first. They trade publicly on-chain for 30 days in paper mode, building a verifiable track record before any investor can deposit. When the vault graduates, investors join the senior tranche. When trades lose money, the trader's junior capital absorbs losses first. Investor capital is protected until the junior buffer is fully wiped.

The protocol enforces five guarantees at the program level — no operator override:

- **First-loss waterfall** — junior capital absorbs all losses before investors feel anything
- **20% liquid reserve floor** — the vault guard rejects any swap that would leave less than 20% of NAV in liquid stablecoin, so investors can always exit
- **Dynamic position limits** — max trade size shrinks automatically as junior health falls (10% → 6% → 3% → 1% → disabled)
- **Pro-rata withdrawal** — investors receive their proportional share of every token in the vault instantly, with no trader involvement
- **High-water mark fees** — performance fees (up to 20%) only accrue on gains above the previous HWM, never during drawdowns

---

## Repository structure

```
Arcadia_program/          # On-chain program
  program/src/
    instructions/         # 10 program instructions
    states/               # Zero-copy account structs (bytemuck, Pod)
  kiln-tests/             # LiteSVM integration tests
app/                      # Frontend (Vite + React + TypeScript + Tailwind)
  src/pages/              # Route pages
  src/hooks/              # Data fetching
  src/lib/                # Wallet, Solana helpers, formatting
server-rs/                # Axum indexer + Helius webhook handler
clients/                  # Generated TypeScript SDK (Shank + Codama)
```

---

## Program instructions

| # | Instruction | Who calls it |
|---|---|---|
| 0 | `init_manager` | Trader — one-time profile creation |
| 1 | `create_vault` | Trader — opens a vault in paper mode |
| 2 | `deposit_junior` | Trader — posts first-loss capital |
| 3 | `update_nav` | Anyone — recomputes NAV from oracle prices |
| 4 | `graduate_vault` | Anyone — promotes a vault that meets all requirements |
| 5 | `deposit_senior` | Investor — deposits into a graduated vault |
| 6 | `withdraw_senior` | Investor — pro-rata withdrawal of vault assets |
| 7 | `withdraw_junior` | Trader — reclaims junior capital (respects ratio floor) |
| 8 | `claim_fees` | Trader — claims performance fees above HWM |
| 9 | `execute_swap` | Trader — vault-guarded Jupiter CPI swap |

---

## Vault guard

Every `execute_swap` runs ten checks before the swap executes. Any failure rejects the transaction:

1. Vault is not frozen
2. Vault has graduated from paper mode
3. Trading is enabled (junior health above threshold)
4. Position size is within the dynamic limit
5. Input and output mints are different
6. Output token is on the vault whitelist
7. Trade cooldown has expired
8. Slippage: actual output ≥ minimum out
9. Oracle price is fresh and within confidence bounds (Pyth, max 30s staleness, max 1.5% confidence)
10. Post-swap stablecoin balance ≥ 20% of total NAV

---

## Account model

```
ManagerProfile    PDA: ["manager", manager_pubkey]
VaultConfig       PDA: ["vault-config", manager_pubkey, vault_index]
VaultState        PDA: ["vault-state", vault_config_pubkey]
InvestorPosition  PDA: ["investor-position", investor_pubkey, vault_config_pubkey]
Treasury          PDA: ["vault-treasury", vault_config_pubkey]
```

No share token mints. Investor ownership is tracked in `InvestorPosition` and derived at withdrawal time:

```
investor_pct = investor.senior_shares / vault.senior_shares_outstanding
```

---

## Graduation requirements

A vault graduates automatically when all three conditions are met:

- Junior capital is still positive
- Current NAV exceeds the original junior deposit (positive paper PnL)
- Minimum qualifying trades have been completed
- The 30-day paper window has elapsed

---

## Environment variables

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
