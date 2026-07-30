# Execution Wallet Architecture

## Problem

Wire a vault program to trade on **any** Solana DEX protocol (Drift, Phoenix, FlashTrade, Zeta, etc.) without CPI coupling.

## Solution

**Execution wallet** — an ephemeral keypair that bridges vault custody to protocol SDKs. The vault only manages deposit/withdraw; the execution wallet signs SDK transactions directly as a normal user wallet.

---

## Complete Trade Cycle

### Phase 1: Create Execution Wallet

**File:** `convex/flashtrade.ts:ensureExecutionWalletRecord`

```
seed = crypto.getRandomValues(32)     → 32 random bytes
signer = Keypair.fromSeed(seed)       → Solana keypair
encrypted = AES-256-GCM(seed, masterPassword)
store in Convex DB: { encryptedPrivateKey, encryptionSalt, executionWalletAddress }
```

**Key properties:**
- Deterministic from seed (same privyUserId + agent = same wallet)
- Encrypted at rest (AES-256-GCM) — never leaves server-side
- Created once per user+agent pair, reused across trades

### Phase 2: Deposit (User signs)

```
convex/agentVault.ts → prepareFundAgentVault
  ↓
lib/solana/ref-protocol-vault.ts:deposit (discriminator 3)
  ↓
User wallet → vault PDA user_state_vault_ATA
```

- User signs a vault program `deposit` instruction
- Tokens move from user's wallet to the vault's user_state token account
- Vault tracks `user_state.amount`

### Phase 3: Authorize (User signs)

```
convex/agentVault.ts → prepareRegisterTicker
  ↓
lib/solana/ref-protocol-vault.ts:register_ticker (discriminator 4)
  ↓
Vault sets: ticker.amountToSpend = X
```

- User sets the maximum the execution wallet can trade
- Safety limit: server cannot withdraw more than this

### Phase 4: Open Trade (Server orchestrates)

**Full orchestration in** `convex/flashtrade.ts:openFlashTradeExecution`

```
Step A — Load context:
  resolveExecutionContext(ctx, privyUserId, agentName)
  ↓
  {
    wallet: { executionWalletAddress, encryptedPrivateKey, encryptionSalt },
    activeExecution: { status, direction, marketSymbol, ... },
    agent: { name },
    setup: { direction, entryPrice, stopPrice }
  }

Step B — Resolve market:
  resolveFlashTradeMarket({ appMarketSymbol, direction })
  ↓
  { poolConfig, targetSymbol, collateralSymbol, market, side }

Step C — Compute risk:
  computeRiskModel({ direction, entryPrice, stopLoss })
  ↓
  { leverage, takeProfit }

Step D — Read vault:
  fetchUserVaultSnapshot(rpc, walletAddress, agentName)
  ↓
  { vaultBalance, ticker: { amountToSpend, isInPosition } }

Step E — Compute spend:
  principalBaseUnits = min(vaultBalance, amountToSpend, hardCap)

Step F — Decrypt execution wallet:
  seed = decryptExecutionWalletSecret(encryptedPrivateKey, encryptionSalt)
  signer = Keypair.fromSeed(seed)
  flashClient = createFlashTradeExecutionClient(seed)

Step G — Ensure execution wallet has ATA + gas:
  ensureExecutionWalletFundingAta(signer.address)   ← broadcaster pays
  assertExecutionWalletHasGas(signer.address, 200_000 lamports)

Step H — Setup FlashTrade accounts:
  ensureFlashTradeSetup(flashClient, resolvedMarket)
  ↓
  { depositLedgerSignature, basketSignature, tradeVaultSignature, delegateSignature }

Step I — Withdraw from vault (SERVER MULTI-SIG):
  executeServerConsumeTicker(walletAddress, agentName, executionWalletAta)
  ↓
  vault ATA → execution wallet ATA
  ticker.isInPosition = true
  Requires: broadcaster + admin signatures (two env keys)

Step J — Deposit to FlashTrade:
  depositToFlashTradeLedger(flashClient, resolvedMarket, amount)
  ↓
  execution wallet → FlashTrade ledger

Step K — Open position via SDK:
  openFlashTradePositionV2(flashClient, resolvedMarket, amount, leverage, slippage)
  ↓
  FlashPerpetualsClient.openPosition(target, collateral, side, poolConfig, price, ...)
  ↓
  sendAndConfirmErTransaction(instructions, [executionWalletSigner])

Step L — Record:
  Position is open. execution wallet controls it.
```

**File:** `lib/flashtrade/v2.ts:createFlashTradeExecutionClient`

```typescript
function createFlashTradeExecutionClient(seedBytes: Uint8Array) {
  const keypair = Keypair.fromSeed(seedBytes);
  const provider = new AnchorProvider(connection, new Wallet(keypair), ...);
  const client = new FlashPerpetualsClient(provider, ...);
  return { cluster, keypair, client };
}
```

The execution wallet's keypair is passed directly to the SDK. The SDK treats it as a normal user signing transactions. **No CPI, no vault program calls.**

### Phase 5: Close Trade (Server orchestrates)

```
Step A — Load context (same as open)

Step B — Resolve market, decrypt seed

Step C — Read current position:
  readFlashTradePositionSnapshot(flashClient, resolvedMarket)
  ↓
  { sizeUsdUi, pnlWithFeeUsdUi, leverageUi, liquidationPriceUi, ... }

Step D — Close via SDK:
  closeFlashTradePositionV2(flashClient, resolvedMarket)
  ↓
  FlashPerpetualsClient.closePosition(target, collateral, side, poolConfig, price)
  ↓
  sendAndConfirmErTransaction(instructions, [executionWalletSigner])

Step E — Mark vault ticker closed (SERVER):
  executeServerUpdateTickerCloseTrade(walletAddress, agentName)
  ↓
  ticker.isInPosition = false
  Requires: broadcaster only (no admin)

Step F — Tokens are back in execution wallet ATA
```

**After close:** tokens sit in the execution wallet's ATA. They can be:

- Swept back to vault (re-usable for next trade)
- Withdrawn to user wallet (via vault `user_withdrawal`)

---

## Vault Program Interface

Program address: `2Xefp1aBUabU12QNDPxpj3ieU7MjZzcS6uD7x4e9qye9`

| Instruction | Discriminator | Signers | Effect |
|-------------|:------------:|---------|--------|
| `deposit` | 3 | user + payer | User → vault ATA |
| `register_ticker` | 4 | user + payer | Sets `amountToSpend` |
| `consume_ticker` | 5 | **broadcaster + admin** | Vault ATA → execution wallet ATA, sets `isInPosition = true` |
| `user_withdrawal` | 6 | user + payer | Vault ATA → user wallet |
| `update_ticker_close_trade` | 7 | **broadcaster** | Sets `isInPosition = false` |

**Key security:** `consume_ticker` requires **two server keypairs** (`BROADCASTER_WALLET` + `ADMIN_WALLET`). No single server key can drain.

### Account Layout

```
GlobalState (discriminator 2):
  feeDestination: Address  (32 bytes)
  feeBps: u16              (2 bytes)
  maxFee: u64              (8 bytes)
  bump: u8                 (1 byte)
  admin: Address[]         (variable)

UserState (discriminator 1):
  userAddress: Address     (32 bytes)
  agentId: Address         (32 bytes)
  tickerId: Address        (32 bytes)
  isInitialized: bool      (1 byte)
  modifiedTime: u64        (8 bytes)
  createdTime: u64         (8 bytes)
  amount: u64              (8 bytes)
  bump: u8                 (1 byte)

Ticker (discriminator 5):
  amountToSpend: u64       (8 bytes) — max authorized trade amount
  isInPosition: bool       (1 byte) — trade in progress flag
```

### PDA Derivation

```typescript
// Global state
PDA(["global_state"], programId)

// Agent
agentId = SHA256(programAddress ++ agentName)
PDA(["agent", agentId], programId)

// User state
PDA(["user_state", userAddress, mint, agentAddress], programId)

// Ticker
PDA(["ticker", agentId, userAddress], programId)
```

---

## Key Server Keys

| Env Variable | Purpose | Required For |
|-------------|---------|-------------|
| `BROADCASTER_WALLET` | Pays all tx fees, signs vault txs | All vault operations |
| `ADMIN_WALLET` | Multi-sig for withdrawals | `consume_ticker` |
| `AGENT_WALLET_MASTER_PASSWORD` | AES key derivation password | Execution wallet crypto |
| `AGENT_WALLET_MASTER_ENCRYPTED` | Encrypted master seed | Execution wallet crypto |
| `AGENT_WALLET_MASTER_SALT` | PBKDF2 salt | Execution wallet crypto |

---

## How to Add Any Protocol SDK

### No vault changes needed.

1. Write a module like `lib/flashtrade/v2.ts`:

```typescript
export function createSomeProtocolClient(seedBytes: Uint8Array) {
  const keypair = Keypair.fromSeed(seedBytes);
  // init SDK with keypair as wallet
}

export async function openPosition(client, params) {
  // call SDK.open(client.keypair, params)
}

export async function closePosition(client) {
  // call SDK.close(client.keypair)
}
```

2. In the orchestration (like `convex/flashtrade.ts`), call the new module functions between `consume_ticker` and `update_ticker_close_trade`.

**That's it.** The vault program doesn't know or care what SDK you use.

---

## File Reference

| File | Lines | Purpose |
|------|-------|---------|
| `lib/solana/ref-protocol-vault.ts` | 922 | Vault PDA client: PDAs, account decoding, tx preparation |
| `lib/solana/execution-wallet.ts` | 392 | Execution wallet: seed→keypair, ATA creation, gas check, venue tx signing |
| `lib/solana/server-ref-protocol-vault.ts` | 977 | Server vault ops: fund, ticker, withdraw, consume, close, sweep |
| `lib/solana/token-wallet.ts` | 240 | Token transfers from execution wallet |
| `lib/server/execution-wallet-crypto.ts` | 88 | AES-256-GCM seed encryption/decryption |
| `convex/agentVault.ts` | 218 | Convex vault action wrappers |
| `convex/flashtrade.ts` | 1061 | **Full trade orchestration** — the most important file |
| `convex/flashtradeStore.ts` | — | Convex queries/mutations for execution wallet records |
| `convex/schema.ts` | — | Convex table definitions |
| `lib/flashtrade/v2.ts` | 666 | FlashTrade SDK integration (the example) |
| `lib/base64.ts` | — | Base64 encode/decode utility |

The most important file to study is **`convex/flashtrade.ts`** — it shows the complete lifecycle from execution wallet creation through position open/close, including error handling, status transitions, and multi-ecosystem (Solana + Celo) bridging via Squid router.

---

## Rust Conversion Plan

When porting to `server-rs/`:

| TS File | Rust Target | Key Structs/Traits |
|---------|-------------|-------------------|
| `ref-protocol-vault.ts` | `crates/vault-client/` | `VaultClient`, `UserState`, `TickerState` |
| `execution-wallet.ts` | `crates/execution-wallet/` | `ExecutionWallet`, `Keypair` from `solana_sdk` |
| `server-ref-protocol-vault.ts` | `crates/execution-wallet/` | `consume_ticker`, `close_trade` signing logic |
| `token-wallet.ts` | `crates/execution-wallet/` | SPL token transfer instructions |
| `execution-wallet-crypto.ts` | `crates/crypto/` | AES-256-GCM with PBKDF2 |
| `flashtrade/v2.ts` | `crates/trading/` | SDK-agnostic `TradeExecutor` trait |
| `convex/flashtrade.ts` | `crates/api/` or `crates/trading/` | State machine orchestration |
