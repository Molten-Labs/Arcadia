# Arcadia Full Execution Flow

## Phase 0 — Onboarding (happens once)

### 0a. User connects via Privy
```
user clicks "Sign in"
Privy modal → user authenticates → JWT issued
frontend stores JWT for API calls
```

### 0b. Idempotent execution wallet creation (server, on first connect)
```
POST /api/v1/ensure-wallet { privyUserId, solanaWallet? }

server:
  1. query DB for execution_wallets WHERE privy_user_id = ?
  2. if exists:
       patch linked wallet metadata
       return existing.executionWalletAddress
  3. if not exists:
       seed = crypto.randomBytes(32)
       signer = Keypair.fromSeed(seed)  → executionWalletAddress
       encrypted = AES-256-GCM(seed, AGENT_WALLET_MASTER_PASSWORD)
       store: { privyUserId, executionWalletAddress, encryptedPrivateKey, encryptionSalt }
       return new.executionWalletAddress
```

### 0c. Trader profile initialization (user signs once)
```
user signs vault.initialize_profile(max_leverage)
→ creates TraderProfile PDA on-chain with their max leverage
```

---

## Phase 1 — Deposit (user signs on client)

```
user sees "Deposit" UI, enters amount
user wallet → signs vault.deposit(amount)

on-chain:
  user wallet ──(transfer)──► vault vault_token ATA
  vault credits: profile.total_shares += shares_for_deposit(amount)
                 profile.trader_shares += shares_minted (if trader deposited)
```

**Investors** can also deposit into any trader's vault. Same flow, but they get `InvestorPosition` shares instead of `trader_shares`.

---

## Phase 2 — Open Trade (server, ONE atomic transaction)

### 2a. Trader requests trade
```
trader clicks "Open Long XAU/USD — 5 USDT — 10x"

frontend → POST /api/v1/trades/open {
  privyUserId,
  market: "XAU/USD",
  direction: "long",
  amountUsd: 5,
  leverage: 10,
  stopLoss: 2800.50,
  takeProfit: 2850.00,
}
```

### 2b. Server validates
```
server:
  1. load TraderProfile PDA from chain
     - assert profile.status == ACTIVE
     - assert profile.trader_shares >= amountUsd
     - assert amountUsd <= profile.capacity_cap_usd
     - assert leverage <= profile.max_leverage

  2. load execution wallet from DB by privyUserId
  3. decrypt seed: AES-256-GCM(encryptedPrivateKey, encryptionSalt)
     → executionWalletSigner = Keypair.fromSeed(seed)
```

### 2c. Build atomic transaction
```
server builds ONE VersionedTransaction:

  ix 1: vault.fund_execution(profile, vault_token, executionWalletAta, amountUsd)
         instruction built against the vault program
         vault PDA signs via invoke_signed (program seeds)
         data: { discriminator: 8, amount: 5_000000 }  // 5 USDC

  ix 2-? : DEX open position instructions
            built using the DEX SDK (Drift/Phoenix/FlashTrade)
            execution wallet passed as the signer
            data: market, side, amount, leverage, sl, tp, slippage...

signers:
  - vault PDA         (invoke_signed — no keypair needed)
  - execution wallet  (decrypted seed → Keypair)
  - BROADCASTER       (pays fees)

sendAndConfirm(tx)
```

### 2d. On-chain result
```
ALL or NOTHING:
  ✅ vault_token ATA ──fund_execution──► execution wallet ATA
  ✅ execution wallet ATA ──dex.open────► DEX protocol

If either fails → entire TX reverts → trader sees "failed" → no funds lost
```

### 2e. Record
```
server stores executions record:
  status: "open"
  vault_fund_sig: "..."
  venue_open_sig: "..."
  venue_position_key: "..."
```

---

## Phase 3 — Monitor Position (server)

```
server reads position state from DEX via SDK:
  - mark price
  - unrealized PnL
  - liquidation price
  - size, leverage

updates executions record:
  position_snapshot: { sizeUsd, pnl, leverage, liquidationPrice, ... }
```

No vault interaction needed during monitoring. The execution wallet holds the position.

---

## Phase 4 — Close Trade (server, two transactions)

### 4a. Close trigger
```
triggered by:
  - trader clicks "Close"
  - stop loss hit (detected by monitoring)
  - take profit hit (detected by monitoring)

POST /api/v1/trades/close { privyUserId, executionId }
```

### 4b. TX 1 — Close DEX position
```
server:
  1. decrypt execution wallet seed → Keypair
  2. build DEX close_position instruction
  3. sign with execution wallet + broadcaster
  4. sendAndConfirm

on-chain:
  DEX ──close_position──► execution wallet ATA (returned collateral + PnL)

server updates:
  execution status: "closed"
  returned_amount: <amount from DEX>
  realized_pnl: <returned - original>
```

### 4c. TX 2 — Sweep back to vault
```
server:
  1. build spl_transfer: execution wallet ATA → vault vault_token ATA
  2. sign with execution wallet + BROADCASTER
  3. sendAndConfirm

on-chain:
  execution wallet ATA ──sweep──► vault vault_token ATA

server updates:
  execution status: "swept"
  vault_sweep_sig: "..."
```

---

## Phase 5 — Record Trade & Settle (optional, on-chain proof)

```
server or user can call vault.record_trade(profile, market, direction, size, leverage,
                                            entryPx, exitPx, fees, wasLiquidated, openedAt, closedAt)
```

This is the on-chain proof of performance — it updates `TraderProfile` and emits `TradeClosed` event, which feeds into the scoring engine.

---

## Full State Machine

```
Onboard:
  ┌──────────────┐     ┌───────────────────┐
  │ Privy Auth   │────►│ Ensure Wallet     │  (idempotent, once per user)
  └──────────────┘     └───────────────────┘
                                │
                        ┌───────▼────────┐
                        │ Init Profile   │  (user signs once)
                        └────────────────┘

Deposit (on-chain):
  ┌──────────┐
  │ Deposit  │  user signs vault.deposit(amount)
  └────┬─────┘
       │
  ┌────▼──────┐
  │ vault ATA │  tokens sit in vault, tracked by TraderProfile
  └───────────┘

Open (one TX, server):
  ┌───────────────────┐
  │ open_submitted    │  atomic TX: vault.fund + dex.open
  └────────┬──────────┘
           │
     ┌─────▼─────┐
     │   open    │  position live on DEX
     └─────┬─────┘
           │
     ┌─────▼────────┐
     │  monitoring  │  server polls mark price, PnL
     └─────┬────────┘
           │
      ┌────▼──────┐
      │ close_    │  TX 1: dex.close → execution wallet ATA
      │ submitted │
      └────┬──────┘
           │
     ┌─────▼────┐
     │  closed  │  tokens in execution wallet ATA (returned amount known)
     └─────┬────┘
           │
     ┌─────▼─────┐
     │  swept    │  TX 2: execution wallet ATA → vault ATA
     └───────────┘

Settle (optional):
  ┌──────────────┐
  │ record_trade │  on-chain proof of PnL → scoring
  └──────────────┘
```

## Key Properties

| Property | How |
|---|---|
| **Open is atomic** | Vault fund + DEX open in one TX. All or nothing. |
| **No pre-authorized caps** | Amount is per-trade, bounded by trader_shares + capacity |
| **No CPI coupling** | Vault doesn't know about DEX. DEX doesn't know about vault. |
| **Execution wallet controls the position** | Server decrypts seed only during trade ops, never stores raw key |
| **Close is recoverable** | If close succeeds but sweep fails, funds sit in execution wallet ATA — sweep can be retried |
| **One wallet per user** | Same execution wallet for all trades. Deterministic from privyUserId. |
