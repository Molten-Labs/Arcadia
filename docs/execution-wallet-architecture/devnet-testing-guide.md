# Devnet Testing Setup Guide

## How to Set the Test to Devnet for Testing

### 1. Solana RPC Configuration

The system reads the Solana RPC endpoint from these environment variables (in order of priority):

```bash
# For execution wallet & general Solana operations
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# For FlashTrade operations specifically
FLASH_V2_SOLANA_RPC=https://api.devnet.solana.com
```

**Default fallback**: If not set, it defaults to `https://api.devnet.solana.com` (already devnet!)

---

### 2. FlashTrade Cluster Configuration

Set the FlashTrade cluster explicitly to `devnet`:

```bash
# Explicitly set FlashTrade to devnet
FLASH_V2_CLUSTER=devnet
```

**How it's determined** (from `lib/flashtrade/v2.ts` lines 91-102):
- If `FLASH_V2_CLUSTER` env var is set to `"devnet"` or `"mainnet-beta"`, it uses that
- Otherwise, it checks the RPC URL — if it contains `"devnet"`, cluster = `"devnet"`
- Default fallback: `"https://api.devnet.solana.com"` → `devnet`

---

### 3. FlashTrade Additional Endpoints

```bash
# FlashTrade API (optional, has defaults)
FLASHTRADE_API_URL=https://flashapi.trade

# FlashTrade ER RPC (optional, has defaults for devnet)
FLASH_V2_ER_RPC=https://devnet-as.magicblock.app
```

---

### 4. Execution Wallet Configuration

Set up the broadcaster wallet (used to create execution wallet ATAs):

```bash
# Required: This wallet pays for ATA creation and transaction fees
BROADCASTER_WALLET=<your-keypair-secret-or-base58>
```

Can be:
- A JSON array of bytes: `[1,2,3,...,64 bytes...]`
- A Base58-encoded keypair string

---

### 5. Complete `.env.local` for Devnet Testing

```bash
# Solana RPC (devnet)
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# FlashTrade cluster (devnet)
FLASH_V2_CLUSTER=devnet
FLASH_V2_SOLANA_RPC=https://api.devnet.solana.com
FLASH_V2_ER_RPC=https://devnet-as.magicblock.app
FLASHTRADE_API_URL=https://flashapi.trade

# Broadcaster wallet (pays for ATA creation)
BROADCASTER_WALLET=<your-keypair-bytes-or-base58>
```

---

### 6. Supported Devnet Markets

From the code (`lib/flashtrade/v2.ts` lines 22-28):

```typescript
const DEVNET_POOL_NAMES = [
  "devnet.1",
  "devnet.2",
  "devnet.3",
  "devnet.4",
  "devnet.5",
];
```

**Supported app markets** (lines 42-47):
- `XAU/USD` (Gold)
- `XAG/USD` (Silver)
- `EUR/USD`
- `GBP/USD`

---

### 7. Testing Flow

Once configured for devnet, the test button will:

1. **Show only when**:
   - Active ecosystem is **Solana**
   - Connected to **devnet RPC**
   - Selected market is **FlashTrade-supported** (XAU/USD, XAG/USD, EUR/USD, GBP/USD)

2. **Execute the devnet test**:
   - Ensure execution wallet exists
   - Verify vault/ticker state
   - Consume ticker → execution wallet USDC ATA
   - Build & submit FlashTrade position
   - Store execution record with `isManualTest: true`
   - Attempt to fetch resulting position

3. **Return debug output**:
   - Execution wallet address
   - ATA address
   - Consumed amount
   - Consume signature
   - Venue signature
   - Position key (if found)

---

### 8. Runtime Check

From `lib/ecosystem.ts` and execution-wallet code, the system automatically detects:
- Which RPC it's connected to
- If it contains `"devnet"` → use devnet pools
- Otherwise → mainnet pools

**No code changes needed** — just set the env vars and the system auto-detects devnet! ✅
