# Solana JavaScript SDK — web3.js v1 vs Kit (April 2026)

## The Naming Situation

- **`@solana/web3.js` v1.x** — the class-based API. In maintenance mode (security patches only). Latest: 1.98.4.
- **`@solana/web3.js` v2.0** — the functional rewrite, released Dec 2024. **Superseded.**
- **`@solana/kit`** (v6.7.0) — current actively developed SDK. Renamed from web3.js v2. Repo moved to `github.com/anza-xyz/kit`.

## What TapTribe Should Use

**Use `@solana/web3.js` v1.x** — because the Anchor TypeScript client (`@coral-xyz/anchor`) is only compatible with web3.js v1. This is the critical constraint.

```json
{
  "@solana/web3.js": "^1.98.0",
  "@coral-xyz/anchor": "^0.32.1"
}
```

If you ever need kit compatibility alongside Anchor, there's a bridge package:
```json
{
  "@solana/web3-compat": "latest"
}
```

---

## v1 API (What You'll Use)

```typescript
import { Connection, PublicKey, Keypair, SystemProgram, Transaction, sendAndConfirmTransaction, LAMPORTS_PER_SOL } from '@solana/web3.js';

// Connect to devnet
const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

// Public keys
const pubkey = new PublicKey('So11111111111111111111111111111111111111112');

// Airdrop (devnet only)
const sig = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
await connection.confirmTransaction(sig);

// Transfer SOL
const tx = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: sender.publicKey,
    toPubkey: recipient,
    lamports: 1_000_000,
  })
);
await sendAndConfirmTransaction(connection, tx, [sender]);
```

---

## @solana/kit API (For Reference — The Future)

The new API is entirely functional (no classes) and tree-shakeable:

```typescript
import { createSolanaRpc, address, lamports, pipe,
  createTransactionMessage, setTransactionMessageFeePayer,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstruction,
  signTransactionMessageWithSigners,
  sendAndConfirmTransactionFactory } from '@solana/kit';
import { getTransferSolInstruction } from '@solana-program/system';

const rpc = createSolanaRpc('https://api.devnet.solana.com');
const addr = address('So111...');  // branded string, not a class

// Transaction building uses pipe()
const txMessage = pipe(
  createTransactionMessage({ version: 0 }),
  (msg) => setTransactionMessageFeePayer(signer.address, msg),
  (msg) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, msg),
  (msg) => appendTransactionMessageInstruction(instruction, msg),
);
```

**You don't need this for the hackathon.** But it's useful to understand where Solana is headed.

---

## React Native Polyfills

### Required (with web3.js v1)
```bash
npm install react-native-get-random-values buffer
```

### Entry File Setup
```typescript
// App.tsx or index.js — MUST be the first imports
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;

// Then your app code...
```

### Metro Config
```javascript
// metro.config.js
const { getDefaultConfig } = require('expo/metro-config');
const config = getDefaultConfig(__dirname);

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  crypto: require.resolve('react-native-get-random-values'),
};

module.exports = config;
```

### Probably NOT Needed Anymore
- `@craftzdog/react-native-buffer` — standard `buffer` package should suffice
- `react-native-url-polyfill` — modern RN handles URL natively

### Optional Performance Upgrade
- `react-native-quick-crypto` — native C/C++ JSI crypto implementation from Margelo. Much faster than JS polyfills. Can replace `react-native-get-random-values`.

---

## Key Translation Table

| web3.js v1 (use this) | @solana/kit (future) |
|---|---|
| `new Connection(url)` | `createSolanaRpc(url)` |
| `new PublicKey(str)` | `address(str)` |
| `Keypair.generate()` | `await generateKeyPairSigner()` |
| `SystemProgram.transfer()` | `getTransferSolInstruction()` |
| `sendAndConfirmTransaction()` | `sendAndConfirmTransactionFactory()` |
| Amounts as `number` | Amounts as `BigInt` (suffix `n`) |

---

## Sources
- [Anza: web3.js 2.0 Release](https://www.anza.xyz/blog/solana-web3-js-2-release)
- [@solana/kit on npm](https://www.npmjs.com/package/@solana/kit)
- [Anza Kit GitHub](https://github.com/anza-xyz/kit)
- [Triton: What Changed and Why](https://blog.triton.one/intro-to-the-new-solana-kit-formerly-web3-js-2/)
- [Helius: Building with web3.js 2.0](https://www.helius.dev/blog/how-to-start-building-with-the-solana-web3-js-2-0-sdk)
- [@solana/web3-compat Docs](https://solana.com/docs/frontend/web3-compat)
- [Solana Mobile Polyfill Guide](https://docs.solanamobile.com/react-native/polyfill-guides/polyfills)
