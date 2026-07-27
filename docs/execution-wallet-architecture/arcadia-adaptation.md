# Arcadia Execution Wallet Adaptation

## Source: Gildore Arena

Pattern copied from `convex/flashtrade.ts:ensureExecutionWalletRecord`, `convex/flashtradeStore.ts`, `convex/schema.ts`, and `lib/server/execution-wallet-crypto.ts`.

---

## Idempotent Execution Wallet (same Privy user → same wallet)

```
fn ensureExecutionWalletRecord(privyUserId, solanaWalletAddress?, evmWalletAddress?):

  1. query DB for existing wallet by privyUserId

  2. if exists:
       patch linked wallet metadata (solanaWalletAddress, evmWalletAddress)
       return existing.executionWalletAddress  ← idempotent

  3. if not exists:
       seed = crypto.getRandomValues(32)
       signer = Keypair.fromSeed(seed)                    → Solana address
       encrypted = AES-256-GCM(seed, masterPassword)
       store: { privyUserId, executionWalletAddress, encryptedPrivateKey, encryptionSalt, ... }
       return new.executionWalletAddress
```

**Key property:** One execution wallet per Privy user, forever. Reused across all their trades. If they connect a new wallet, metadata is patched — wallet address stays the same.

---

## Schema (for Arcadia's DB — use SQL or equivalent)

```sql
execution_wallets (
  id                  UUID PRIMARY KEY,
  privy_user_id       TEXT NOT NULL UNIQUE,        -- one wallet per user
  execution_wallet    TEXT NOT NULL,                -- Solana address
  encrypted_seed      TEXT NOT NULL,                -- AES-256-GCM payload
  encryption_salt     TEXT NOT NULL,
  -- metadata
  solana_wallet       TEXT,                         -- last known linked wallet
  evm_wallet          TEXT,
  created_at          TIMESTAMPTZ NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL,
  last_used_at        TIMESTAMPTZ
);

executions (
  id                  UUID PRIMARY KEY,
  privy_user_id       TEXT NOT NULL,
  vault_profile       TEXT NOT NULL,                -- Arcadia profile PDA
  market              TEXT NOT NULL,
  direction           TEXT NOT NULL,                -- long / short
  amount_usd          NUMERIC NOT NULL,             -- exact amount transferred from vault
  leverage            REAL NOT NULL,
  entry_price         NUMERIC,
  stop_loss           NUMERIC,
  take_profit         NUMERIC,
  -- lifecycle
  status              TEXT NOT NULL DEFAULT 'pending_funding',
  -- pending_funding → funding_confirmed → open → close_submitted → closed
  venue               TEXT NOT NULL,                -- "drift" | "phoenix" | "flashtrade"
  venue_position_key  TEXT,
  -- signatures
  vault_transfer_sig  TEXT,                         -- vault → execution wallet transfer
  venue_open_sig      TEXT,
  venue_close_sig     TEXT,
  vault_sweep_sig     TEXT,                         -- execution wallet → vault sweep
  -- pnl
  returned_amount     NUMERIC,
  realized_pnl        NUMERIC,
  failure_reason      TEXT,
  created_at          TIMESTAMPTZ NOT NULL,
  updated_at          TIMESTAMPTZ NOT NULL
);

CREATE UNIQUE INDEX idx_execution_wallets_privy ON execution_wallets(privy_user_id);
CREATE INDEX idx_executions_privy ON executions(privy_user_id);
CREATE INDEX idx_executions_status ON executions(status);
```

---

## Arcadia Trade Flow — FlashTrade v2 Integration

### FlashTrade v2 Funds Lifecycle

FlashTrade v2 has a four-stage funds model. Every wallet must go through this before it can trade:

```
deposit  →  delegate  →  trade  →  withdraw
```

1. **Deposit ledger** — a per-owner PDA tracking balances available as collateral. Funds must land here before any trade.
2. **Basket** — one account per wallet holding every position and order.
3. **Delegate** — one-time step enabling trading on the basket.
4. **Withdraw** — pull collateral back from the ledger to the wallet's ATA.

The one-shot `deposit` endpoint bundles everything (init ledger, init basket, fund ledger) into one transaction.

### Comparison: Gildore vs. Arcadia

| Step | Gildore (3 TXs) | Arcadia (2 TXs for open) |
|---|---|---|
| Vault → execution wallet | `consume_ticker` (TX 1) | `fund_execution` (TX 1a, atomic bundle) |
| Execution wallet → FlashTrade ledger | `depositToFlashTradeLedger` (TX 2) | `flash.deposit` (TX 1b, same atomic TX) |
| Open position | `openFlashTradePosition` (TX 3) | `flash.open_position` (TX 2) |

**Gildore risk:** TX 1 succeeds (vault drained), TX 2 fails → funds stuck in execution wallet with no position. Requires manual recovery.

**Arcadia improvement:** vault transfer + FlashTrade deposit in one atomic TX. Either both succeed or neither happens.

### Open — Two TXs, First is Atomic

```
TX 1 (Atomic Bundle):
  ix 1: vault.fund_execution(profile, vault_token, executionWalletAta, amountUsd)
         signs: vault PDA (invoke_signed via broadcaster + admin seeds)
         moves: vault_token ATA → execution wallet ATA

  ix 2: flash.deposit(executionWalletAta, flashLedger, amountUsd)
         signs: execution wallet keypair (decrypted server-side)
         moves: execution wallet ATA → FlashTrade deposit ledger

The execution wallet co-signs BOTH instructions. If flash.deposit fails,
fund_execution reverts too. All or nothing.
```

**Why not combine vault + flash.deposit + flash.open in one TX?**
FlashTrade `open-position` requires funds to already be in the deposit ledger. `deposit` and `open-position` are two separate API calls (the `deposit` endpoint returns a transaction, then `open-position` returns a separate transaction). They can't be pipelined into one TX because the ledger balance must be confirmed on-chain before the open can use it.

```
TX 2 (separate, after TX 1 confirms):
  flash.open_position(ledger → position, market, leverage, sl, tp)
  signs: execution wallet keypair
  API: POST /transaction-builder/open-position
```

**Signer assembly (TX 1):**
- Vault PDA signs ix 1 via `invoke_signed`
- Execution wallet keypair signs both ix 1 and ix 2
- Broadcaster pays fees and co-signs

### Close — Two TXs (same as Gildore)

```
TX 1: flash.close_position(position → ledger)
       signs: execution wallet keypair
       API: POST /transaction-builder/close-position
       effect: position closed, funds return to deposit ledger

TX 2: vault.sweep_funds(executionWalletAta, vault_token, returnedAmount)
       signs: execution wallet keypair + broadcaster
       effect: execution wallet ATA → vault_token ATA
```

**Note on withdraw step:** After close, funds are in FlashTrade's deposit ledger. They need to be withdrawn to the execution wallet ATA first (`POST /transaction-builder/withdraw`), then swept to vault. Alternatively, `close-position` with `withdrawTokenSymbol` can return funds directly to the execution wallet ATA.

### Token Flow Summary

```
Deposit (user signs on client):
  user wallet ────────────────────────────► vault_token ATA

Open TX 1 (server, atomic):
  vault_token ATA ──fund_execution──► execution wallet ATA
  execution wallet ATA ──flash.deposit──► FlashTrade ledger

Open TX 2 (server):
  FlashTrade ledger ──flash.open_position──► position

Close TX 1 (server):
  position ──flash.close_position──► FlashTrade ledger ──withdraw──► execution wallet ATA

Close TX 2 (server):
  execution wallet ATA ──sweep──► vault_token ATA
```

### Transfer Logic

```
fn buildAtomicFundingTransaction(profile, executionWalletAta, amountUsd):
  // ix 1: vault fund_execution
  ix1 = vault.fund_execution {
    profile: profile,
    vault_token: vault_token_ata,
    execution_wallet_ata: executionWalletAta,
    amount: amountUsd,
  }
  // vault PDA signs via invoke_signed

  // ix 2: FlashTrade deposit (from execution wallet ATA → flash ledger)
  ix2 = buildFlashDepositIx(executionWalletAta, amountUsd)
  // execution wallet keypair signs

  tx = new VersionedTransaction([ix1, ix2])
  tx.sign([broadcasterSigner])
  tx.partialSignWithPda(vaultPdaSeeds)
  tx.sign([executionWalletSigner])

  return sendAndConfirm(tx)


fn openFlashTradePosition(executionWalletSigner, market, amount, leverage, sl, tp):
  // POST /transaction-builder/open-position → returns base64 tx
  // decode, sign with executionWalletSigner, submit
  tx = flashApi.openPosition(market, amount, leverage, sl, tp)
  tx.sign([executionWalletSigner])
  return sendAndConfirm(tx)


fn closeFlashTradePosition(executionWalletSigner, market, side):
  tx = flashApi.closePosition(market, side, closeAll: true)
  tx.sign([executionWalletSigner])
  return sendAndConfirm(tx)


fn sweepExecutionWalletToVault(executionWalletAta, vaultTokenAta, returnedAmount):
  executionWalletSigner = decryptSeed(encrypted_seed, encryption_salt)
  tx = spl_transfer(executionWalletAta, vaultTokenAta, returnedAmount)
  tx.sign([executionWalletSigner, BROADCASTER_SIGNER])
  return sendAndConfirm(tx)
```

### FlashTrade v2 API Endpoints

| Action | Endpoint |
|---|---|
| Fund ledger (one-shot setup + deposit) | `POST /transaction-builder/deposit` |
| Delegate basket (one-time) | `POST /transaction-builder/delegate-basket` |
| Open position | `POST /transaction-builder/open-position` |
| Close position | `POST /transaction-builder/close-position` |
| Add collateral | `POST /transaction-builder/add-collateral` |
| Remove collateral | `POST /transaction-builder/remove-collateral` |
| Read positions | `GET /owner/{wallet}` |
| Withdraw from ledger | `POST /transaction-builder/withdraw` |

**Withdraw flow:** After close, funds are in the deposit ledger. Call `withdraw` to move them back to the execution wallet ATA. If `custodySettlementRequired: true` in the response, call `custody-settlement` first, then retry withdraw.

### Supported Markets (Virtual Pool — USDC collateral)

| Symbol | Pool | Collateral | Leverage |
|---|---|---|---|
| XAU/USD | Virtual.1 / FLP.2 | USDC | 3-5x |
| XAG/USD | Virtual.1 / FLP.2 | USDC | 3-5x |
| EUR/USD | Virtual.1 / FLP.2 | USDC | 5x |
| GBP/USD | Virtual.1 / FLP.2 | USDC | 5x |
| USD/JPY | FLP.2 | USDC | 5x |

All virtual markets use USDC as collateral for both long and short positions. The protocol auto-converts if needed.

**Why this fits Arcadia:**
- Arcadia already has `TraderProfile.trader_shares` — the trader's own capital at stake
- The trade amount is bounded by their own shares + capacity cap (already enforced by `deposit`)
- No pre-authorized ticker cap needed — amount is passed per-trade
- Simpler mental model: "I trade X, I get back Y"

---

## Crypto (unchanged from gildore)

```typescript
// encrypt
fn encryptExecutionWalletSecret(seed: Uint8Array):
  masterSecret = decryptMasterSecret()       // from AGENT_WALLET_MASTER_PASSWORD
  salt = crypto.randomBytes(16)
  key = pbkdf2(masterSecret, salt, 100000, 32, "sha256")
  iv = crypto.randomBytes(12)
  cipher = aes-256-gcm(key, iv)
  payload = iv ++ ciphertext ++ authTag
  return { encryptedPrivateKey: base64(payload), encryptionSalt: base64(salt) }

// decrypt
fn decryptExecutionWalletSecret(encryptedPrivateKey, encryptionSalt):
  masterSecret = decryptMasterSecret()
  key = pbkdf2(masterSecret, base64decode(salt), 100000, 32, "sha256")
  payload = base64decode(encryptedPrivateKey)
  iv, ciphertext, authTag = split(payload, 12, len-16)
  return aes-256-gcm-decrypt(key, iv, ciphertext, authTag)
```

Env vars needed: `AGENT_WALLET_MASTER_PASSWORD`, `AGENT_WALLET_MASTER_ENCRYPTED`, `AGENT_WALLET_MASTER_SALT`.

---

## Vault Instructions Needed

Arcadia currently has: `initialize_platform`, `initialize_profile`, `set_capacity`, `initialize_investor`, `deposit`, `request_withdraw`, `process_withdraw`, `record_trade`, `settle`, `trader_withdraw_profit`.

**New instructions required for execution wallet flow:**

| Instruction | Signers | Effect |
|---|---|---|
| `transfer_to_execution` | **broadcaster + admin** | vault_token ATA → execution wallet ATA, deducts from trader's NAV |
| `sweep_from_execution` | **broadcaster + execution_wallet** | execution wallet ATA → vault_token ATA, credits trader's NAV |

No ticker/register_ticker needed. The amount is passed as an arg per-trade, bounded by existing capacity/leverage checks in `record_trade`.

---

## Server Keys (unchanged from gildore)

| Env | Purpose |
|---|---|
| `BROADCASTER_WALLET` | Pays tx fees, signs vault transfers, signs sweeps |
| `ADMIN_WALLET` | Multi-sig for vault → execution wallet transfers |
| `AGENT_WALLET_MASTER_PASSWORD` | PBKDF2 password for execution seed encryption |
| `AGENT_WALLET_MASTER_ENCRYPTED` | Encrypted master seed (base64) |
| `AGENT_WALLET_MASTER_SALT` | PBKDF2 salt (base64) |

---

## Trade Lifecycle State Machine (Atomic Open)

```
       ┌────────────────────────┐
       │  open_submitted        │  ← one TX, two instructions
       │  (atomic vault + DEX)  │
       └────────┬───────────────┘
                │
        ┌───────┴───────┐
        ▼               ▼
    open             failed
        │
        │  (close: two TXs)
        ▼
    close_submitted
        │
        ▼
    closed
        │
        │  (sweep: one TX)
        ▼
    swept
```

- `open_submitted`: atomic TX sent (vault fund + DEX open in one TX)
- `open`: position confirmed open on-chain
- `close_submitted`: DEX close TX sent
- `closed`: position closed, tokens in execution wallet ATA
- `swept`: execution wallet → vault sweep confirmed
- `failed`: any step failed, record carries `failure_reason`

No `pending_funding` / `funding_confirmed` — those intermediate states vanish because vault transfer and DEX open happen atomically.
