# Solana Mobile Mastery — Full Learning Material

**Source:** https://learn.blueshift.gg/en/paths/solana-mobile-mastery
**Scope:** 5 courses, 34 lessons, ~18 hours
**Level:** Intermediate (Level 2)

This is a condensed reference built from every lesson in the path. Use it as a lookup while building — each section has the key explanations, code snippets, and gotchas.

---

## Table of Contents

1. [Module 1 — Mobile dApp Fundamentals](#module-1--mobile-dapp-fundamentals)
2. [Module 2 — MWA Protocol Deep Dive](#module-2--mwa-protocol-deep-dive)
3. [Module 3 — Embedded Wallets](#module-3--embedded-wallets)
4. [Module 4 — Solana Mobile Client](#module-4--solana-mobile-client)
5. [Module 5 — dApp Store Publishing](#module-5--dapp-store-publishing)
6. [TapTribe build order](#taptribe-build-order)

---

# Module 1 — Mobile dApp Fundamentals

## 1.1 Introduction to Mobile Wallet Adapter

MWA is **not** a mobile port of wallet-adapter. It's a different architecture: your app communicates with wallet apps through secure, ephemeral sessions — because mobile OSes isolate apps from each other (no shared JS context like a browser).

**Key advantages:** native UX, keys never leave the wallet, one implementation works with Phantom, Solflare, Backpack.

**Session model:**
```
Open Session → Authorize → Sign → Close Session
(repeat for each interaction)
```
No stale connections, battery-friendly, explicit user intent per session.

**The transact() function** is the entire SDK surface:
```typescript
import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

await transact(async (wallet: Web3MobileWallet) => {
  const { accounts } = await wallet.authorize({
    identity: APP_IDENTITY,
    chain: 'solana:devnet',
  });
  // request signatures, send transactions, etc.
}); // session closes when callback returns
```

Flow: app generates ephemeral keypair → builds association URI → OS launches wallet → wallet starts local WebSocket server → app connects → encrypted handshake → your callback runs → session terminates.

**Silent re-authorization via auth tokens:**
```typescript
const cachedToken = await AsyncStorage.getItem('auth_token');
await transact(async (wallet) => {
  const result = await wallet.authorize({
    identity: APP_IDENTITY,
    chain: 'solana:devnet',
    auth_token: cachedToken, // no prompt if still valid
  });
});
```

**signAndSendTransactions vs signTransactions:**
- `signAndSendTransactions` (recommended) — wallet signs AND broadcasts, handles RPC selection and retry logic.
- `signTransactions` — returns signed tx for simulation, custom submission, or multi-party signing.

---

## 1.2 Protocol Architecture Deep Dive

**Connection flow:** dApp = client, wallet = server. WebSocket over localhost on a random port (49152-65535). Wallet only starts its server when explicitly asked.

**Association steps:**
1. Generate ephemeral P-256 EC keypair (distinct from Solana's Ed25519) → base64url association token.
2. Build URI:
```
solana-wallet:/v1/associate/local?association=<token>&port=<port>&v=2
```
3. Opening URI triggers Android Intent → wallet picker if multiple installed.
4. Wallet parses URI, starts WebSocket server on that port, listens for one connection, times out after 10s.
5. dApp connects to `ws://localhost:<port>/solana-wallet`.

**Session establishment (ECDH handshake):**
```
dApp                                    Wallet
  │─────── HELLO_REQ (Qd, sig) ─────>  │
  │ <─────── HELLO_RSP (Qw) ─────────  │
  │       Both compute shared secret   │
  │ <═══ Encrypted JSON-RPC (AES-GCM)═>│
```

HELLO_REQ = `Qd || Signature(Qd, association_private_key)`. Wallet verifies signature with association public key from URI — prevents MITM.

Key derivation: `hkdf(ikm=shared_secret, salt=associationPublicKey, length=16)` → AES-128 key.

**Encrypted message format:**
```
+─────────────────────────────────────────+
| Seq(4B) | IV(12B) | Ciphertext | Tag(16B)|
+─────────────────────────────────────────+
```
Sequence number is AAD — replayed messages fail decryption.

**JSON-RPC methods:**
- Non-privileged: `authorize`, `deauthorize`, `get_capabilities`
- Privileged (need auth): `sign_and_send_transactions`, `sign_transactions`, `sign_messages`, `clone_authorization`

**Session lifecycle gotcha:** if callback throws, session still closes. Don't retry inside the callback; retry the whole `transact()`.

```typescript
// CORRECT retry
for (let attempt = 0; attempt < 3; attempt++) {
  try {
    await transact(async (wallet) => {
      await wallet.authorize(/* ... */);
      await wallet.signAndSendTransactions(/* ... */);
    });
    break;
  } catch (e) {
    if (e.code === 4001) throw e; // user cancelled — don't retry
  }
}
```

---

## 1.3 React Native Environment Setup

Most common error: `crypto.getRandomValues is not a function`. Fix is polyfill order.

**Scaffold (recommended):**
```bash
npm create solana-dapp@latest
# select "Solana Mobile"
```

**From scratch:**
```bash
npx create-expo-app SolanaMobileApp --template blank-typescript
cd SolanaMobileApp
npm install @solana-mobile/mobile-wallet-adapter-protocol-web3js \
            @solana-mobile/mobile-wallet-adapter-protocol \
            @solana/web3.js \
            react-native-get-random-values \
            @craftzdog/react-native-buffer \
            react-native-quick-base64 \
            @react-native-async-storage/async-storage
npx expo install react-native-safe-area-context
```

**Polyfill file — `src/polyfills.ts`:**
```typescript
import 'react-native-get-random-values';
import { Buffer } from '@craftzdog/react-native-buffer';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer as unknown as typeof global.Buffer;
}
```

**Load first — `index.ts`:**
```typescript
import './src/polyfills'; // MUST be first
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
```

**Verification utility — `src/utils/verifySetup.ts`:**
```typescript
import { Keypair } from '@solana/web3.js';

export function verifyPolyfills(): boolean {
  try {
    const randomBytes = new Uint8Array(32);
    crypto.getRandomValues(randomBytes);
    const keypair = Keypair.generate();
    console.log('✓ Keypair:', keypair.publicKey.toBase58());
    Buffer.from('test', 'utf-8');
    new TextEncoder().encode('test');
    return true;
  } catch (error) {
    console.error('Polyfill verification failed:', error);
    return false;
  }
}
```

**Development build (Expo Go won't work with MWA):**
```bash
npx expo install expo-dev-client
npx expo run:android
```

**Project structure:**
```
src/
├── polyfills.ts
├── App.tsx
├── providers/
│   ├── AuthorizationProvider.tsx
│   └── ConnectionProvider.tsx
├── hooks/
├── screens/
├── utils/
│   ├── verifySetup.ts
│   └── constants.ts
└── components/
```

**App identity — `src/utils/constants.ts`:**
```typescript
export const APP_IDENTITY = {
  name: 'My Solana dApp',
  uri: 'https://mydapp.com',
  icon: 'favicon.ico',
};
export const RPC_ENDPOINT = 'https://api.devnet.solana.com';
export const CLUSTER = 'solana:devnet' as const;
```

**iOS warning:** MWA doesn't work on iOS. Uses Android Intents and localhost WebSockets. iOS support is planned. For cross-platform now → embedded wallets.

---

## 1.4 Wallet Connection

**Minimal connect flow:**
```typescript
import { transact, Web3MobileWallet } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';
import { PublicKey } from '@solana/web3.js';
import { toByteArray } from 'react-native-quick-base64';

async function connectWallet(): Promise<PublicKey> {
  return await transact(async (wallet: Web3MobileWallet) => {
    const authResult = await wallet.authorize({
      identity: APP_IDENTITY,
      chain: 'solana:devnet',
    });
    const firstAccount = authResult.accounts[0];
    return new PublicKey(toByteArray(firstAccount.address));
  });
}
```

**Critical:** `accounts[0].address` is **base64**, not base58. Use `toByteArray()` → `new PublicKey()`. For display, use `display_address` (base58).

**Cache with fallback:**
```typescript
async function connectWithCachedToken(): Promise<PublicKey | null> {
  const cachedToken = await AsyncStorage.getItem('mwa_auth_token');
  return await transact(async (wallet) => {
    try {
      const authResult = await wallet.authorize({
        identity: APP_IDENTITY,
        chain: 'solana:devnet',
        auth_token: cachedToken ?? undefined,
      });
      await AsyncStorage.setItem('mwa_auth_token', authResult.auth_token);
      return new PublicKey(toByteArray(authResult.accounts[0].address));
    } catch (error: any) {
      if (error.code === -32000 && cachedToken) {
        await AsyncStorage.removeItem('mwa_auth_token');
        const freshResult = await wallet.authorize({
          identity: APP_IDENTITY,
          chain: 'solana:devnet',
        });
        await AsyncStorage.setItem('mwa_auth_token', freshResult.auth_token);
        return new PublicKey(toByteArray(freshResult.accounts[0].address));
      }
      throw error;
    }
  });
}
```

**Capabilities query** (non-privileged, no auth needed):
```typescript
const capabilities = await wallet.getCapabilities();
// capabilities.max_transactions_per_request
// capabilities.max_messages_per_request
// capabilities.supported_transaction_versions
```

**Deauthorize:**
```typescript
async function disconnect(): Promise<void> {
  const authToken = await AsyncStorage.getItem('mwa_auth_token');
  if (!authToken) return;
  await transact(async (wallet) => {
    await wallet.deauthorize({ auth_token: authToken });
  });
  await AsyncStorage.removeItem('mwa_auth_token');
}
```

**Timeouts:** association 30s, request 10s. Handle with clear alerts.

---

## 1.5 Transaction Signing

**Build versioned transaction:**
```typescript
import {
  Connection, PublicKey, SystemProgram,
  TransactionMessage, VersionedTransaction,
} from '@solana/web3.js';

async function buildTransferTransaction(
  fromPubkey: PublicKey,
  toPubkey: PublicKey,
  lamports: number
): Promise<VersionedTransaction> {
  const { blockhash } = await connection.getLatestBlockhash();
  const messageV0 = new TransactionMessage({
    payerKey: fromPubkey,
    recentBlockhash: blockhash,
    instructions: [SystemProgram.transfer({ fromPubkey, toPubkey, lamports })],
  }).compileToV0Message();
  return new VersionedTransaction(messageV0);
}
```

**Sign and send:**
```typescript
const signatures = await wallet.signAndSendTransactions({
  transactions: [transaction],
  options: {
    commitment: 'confirmed',
    skipPreflight: false,
    maxRetries: 3,
    waitForCommitmentToSendNextTransaction: true,
  },
});
```

**Sign only (for simulation / custom submission):**
```typescript
const signedTxs = await wallet.signTransactions({ transactions: [tx] });
await connection.sendTransaction(signedTxs[0]);
```

**Blockhash gotcha:** blockhashes expire in ~2 minutes. Fetch **inside** `transact()`, **right before** building the tx:
```typescript
await transact(async (wallet) => {
  const authResult = await wallet.authorize({...});
  const { blockhash } = await connection.getLatestBlockhash(); // fresh
  const tx = new VersionedTransaction(
    new TransactionMessage({
      payerKey: fromPubkey,
      recentBlockhash: blockhash,
      instructions: [/* ... */],
    }).compileToV0Message()
  );
  await wallet.signAndSendTransactions({ transactions: [tx] });
});
```

**Complete example with full error handling:**
```typescript
export async function transferSol(
  recipientAddress: string,
  amountInSol: number
): Promise<string | null> {
  try {
    return await transact(async (wallet: Web3MobileWallet) => {
      const authResult = await wallet.authorize({
        identity: APP_IDENTITY,
        chain: 'solana:devnet',
      });
      const fromPubkey = new PublicKey(toByteArray(authResult.accounts[0].address));
      const toPubkey = new PublicKey(recipientAddress);
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      const messageV0 = new TransactionMessage({
        payerKey: fromPubkey,
        recentBlockhash: blockhash,
        instructions: [SystemProgram.transfer({
          fromPubkey, toPubkey,
          lamports: amountInSol * LAMPORTS_PER_SOL,
        })],
      }).compileToV0Message();
      const transaction = new VersionedTransaction(messageV0);
      const [signature] = await wallet.signAndSendTransactions({
        transactions: [transaction],
      });
      const confirmation = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight }, 'confirmed'
      );
      if (confirmation.value.err) throw new Error('Transaction failed on-chain');
      return signature;
    });
  } catch (error: any) {
    if (error.code === 4001) Alert.alert('Cancelled', 'Transaction was cancelled.');
    else if (error.code === -32603) Alert.alert('Failed', 'Simulation failed. Check balance.');
    else Alert.alert('Error', error.message);
    return null;
  }
}
```

---

## 1.6 Message Signing (SIWS)

**Basic:**
```typescript
const messageBytes = new TextEncoder().encode(message);
const signatures = await wallet.signMessages({
  addresses: [authResult.accounts[0].address],
  payloads: [messageBytes],
});
// signatures[0] = Uint8Array (64 bytes)
```

**Verify with tweetnacl:**
```typescript
import { sign } from 'tweetnacl';
const isValid = sign.detached.verify(messageBytes, signature, publicKey.toBytes());
```

**Sign In With Solana (MWA 2.0 native):**
```typescript
const authResult = await wallet.authorize({
  identity: APP_IDENTITY,
  chain: 'solana:mainnet',
  sign_in_payload: {
    domain: 'mydapp.com',
    statement: 'Sign in to My dApp',
    uri: 'https://mydapp.com',
    version: '1',
    nonce: serverGeneratedNonce,
    issuedAt: new Date().toISOString(),
  },
});
if (authResult.sign_in_result) {
  const { address, signature, signedMessage } = authResult.sign_in_result;
  // POST to backend for verification
}
```

**Backend verify (Node):**
```typescript
import { verifySignIn } from '@solana/wallet-standard-util';
// Verify nonce matches issued one, then verifySignIn(input, output)
```

**Nonce generation (backend):**
```typescript
import crypto from 'crypto';
export function generateSecureNonce(): string {
  return crypto.randomBytes(32).toString('base64url');
}
// Store nonce with 5-min TTL before sending to client
```

**Security musts:** always use server-generated nonces, domain binding, clear message text, timestamp validation.

---

## 1.7 AuthorizationProvider Pattern

Central React Context for wallet state. Eliminates scattered `AsyncStorage.getItem('auth_token')` calls.

**Type defs:**
```typescript
export interface Account {
  address: Base64EncodedAddress;
  label?: string;
  publicKey: PublicKey;
}
export interface Authorization {
  accounts: Account[];
  authToken: string;
  selectedAccount: Account;
}
export interface AuthorizationContextValue {
  accounts: Account[] | null;
  selectedAccount: Account | null;
  authorizeSession: (wallet: AuthorizeAPI) => Promise<Account>;
  deauthorizeSession: (wallet: DeauthorizeAPI) => Promise<void>;
  onChangeAccount: (account: Account) => void;
}
```

**Provider (abridged — full file in lesson):**
```typescript
function convertAccount(mwaAccount: MWAAccount): Account {
  return {
    address: mwaAccount.address,
    label: mwaAccount.label,
    publicKey: new PublicKey(toByteArray(mwaAccount.address)),
  };
}

export function AuthorizationProvider({ children }: { children: ReactNode }) {
  const [authorization, setAuthorization] = useState<Authorization | null>(null);

  const authorizeSession = useCallback(async (wallet: AuthorizeAPI): Promise<Account> => {
    const cachedToken = await AsyncStorage.getItem(AUTH_TOKEN_KEY);
    const result = await wallet.authorize({
      identity: APP_IDENTITY,
      chain: CLUSTER,
      auth_token: cachedToken ?? undefined,
    });
    const accounts = result.accounts.map(convertAccount);
    const selectedAccount = accounts[0];
    const newAuth = { accounts, authToken: result.auth_token, selectedAccount };
    await AsyncStorage.setItem(AUTH_TOKEN_KEY, result.auth_token);
    setAuthorization(newAuth);
    return selectedAccount;
  }, []);

  const deauthorizeSession = useCallback(async (wallet: DeauthorizeAPI) => {
    if (!authorization?.authToken) return;
    await wallet.deauthorize({ auth_token: authorization.authToken });
    await AsyncStorage.removeItem(AUTH_TOKEN_KEY);
    setAuthorization(null);
  }, [authorization?.authToken]);

  // ... onChangeAccount, context value, provider wrapping
}

export function useAuthorization(): AuthorizationContextValue {
  return useContext(AuthorizationContext);
}
```

**Transaction hook pattern:**
```typescript
export function useSendSol() {
  const { authorizeSession } = useAuthorization();
  const { connection } = useConnection();
  return useCallback(async (recipient: PublicKey, amountSol: number): Promise<string> => {
    return await transact(async (wallet) => {
      const account = await authorizeSession(wallet);
      const { blockhash } = await connection.getLatestBlockhash();
      const transaction = new VersionedTransaction(
        new TransactionMessage({
          payerKey: account.publicKey,
          recentBlockhash: blockhash,
          instructions: [SystemProgram.transfer({
            fromPubkey: account.publicKey,
            toPubkey: recipient,
            lamports: amountSol * LAMPORTS_PER_SOL,
          })],
        }).compileToV0Message()
      );
      const [signature] = await wallet.signAndSendTransactions({ transactions: [transaction] });
      return signature;
    });
  }, [authorizeSession, connection]);
}
```

**MWA 2.0 note:** `reauthorize()` is deprecated. Use `authorize()` with `auth_token`.

---

## 1.8 Error Handling

**Two error types:**
- `SolanaMobileWalletAdapterError` — protocol-level (session, transport)
- `SolanaMobileWalletAdapterProtocolError` — wallet response (auth denied, sign declined)

**Protocol error codes:**
| Code | Constant | Meaning |
|------|----------|---------|
| -32000 | ERROR_AUTHORIZATION_FAILED | User cancelled auth |
| -32002 | ERROR_NOT_SIGNED | User declined to sign |
| -32003 | ERROR_NOT_SUBMITTED | Broadcast failed |
| -32005 | ERROR_TOO_MANY_PAYLOADS | Batch too large |
| -32010 | ERROR_ATTEST_ORIGIN_ANDROID | Attestation failed |

**Error handler utility:**
```typescript
export function handleMWAError(error: unknown): MWAErrorResult {
  if (error instanceof SolanaMobileWalletAdapterProtocolError) {
    const isUserCancellation =
      error.code === 'ERROR_AUTHORIZATION_FAILED' ||
      error.code === 'ERROR_NOT_SIGNED';
    return {
      userMessage: ERROR_MESSAGES[error.code] ?? error.message,
      shouldRetry: !isUserCancellation,
      isUserCancellation,
      originalError: error,
    };
  }
  if (error instanceof SolanaMobileWalletAdapterError) {
    if (error.message.includes('Found no installed wallet')) {
      return {
        userMessage: 'No Solana wallet found. Please install a wallet app.',
        shouldRetry: false, isUserCancellation: false, originalError: error,
      };
    }
    if (error.message.includes('timeout')) {
      return {
        userMessage: 'Wallet connection timed out. Please try again.',
        shouldRetry: true, isUserCancellation: false, originalError: error,
      };
    }
  }
  // ...
}
```

**Retry with exponential backoff:**
```typescript
export async function withRetry<T>(
  operation: () => Promise<T>,
  shouldRetry: (error: unknown) => boolean,
  options: { maxAttempts: number; baseDelayMs: number; maxDelayMs: number } = DEFAULT_OPTIONS
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= options.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error) || attempt === options.maxAttempts) throw error;
      const delay = Math.min(
        options.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 1000,
        options.maxDelayMs
      );
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}
```

**No wallet fallback:**
```typescript
const WALLET_STORE_URLS = {
  phantom: {
    ios: 'https://apps.apple.com/app/phantom-solana-wallet/id1598432977',
    android: 'https://play.google.com/store/apps/details?id=app.phantom',
  },
  solflare: {
    ios: 'https://apps.apple.com/app/solflare/id1580902717',
    android: 'https://play.google.com/store/apps/details?id=com.solflare.mobile',
  },
};
```

**Simulate before signing** — catches failures before opening the wallet:
```typescript
async function sendWithSimulation(transaction: VersionedTransaction) {
  const simulation = await connection.simulateTransaction(transaction, { commitment: 'confirmed' });
  if (simulation.value.err) throw new Error(`Would fail: ${JSON.stringify(simulation.value.err)}`);
  return await transact(async (wallet) => {
    await authorizeSession(wallet);
    const [signature] = await wallet.signAndSendTransactions({ transactions: [transaction] });
    return signature;
  });
}
```

**Session recovery on stale token:**
```typescript
async function robustTransact<T>(callback) {
  return await transact(async (wallet) => {
    try {
      return await callback(wallet);
    } catch (error) {
      if (error.code === 'ERROR_AUTHORIZATION_FAILED') {
        await AsyncStorage.removeItem('mwa_auth_token');
        await wallet.authorize({ identity: APP_IDENTITY, chain: 'solana:devnet' });
        return await callback(wallet);
      }
      throw error;
    }
  });
}
```

---

## 1.9 On-Device Testing

**Requirements:** Android 8.0+, USB cable, Phantom/Solflare installed, dev mode + USB debugging, devnet SOL.

```bash
adb devices
# List of devices attached
# XXXXXXX    device
```

**Run:**
```bash
npx expo run:android
# or
npx react-native run-android
```

**Test screen template** (from lesson): wallet connect, auth log, balance check, self-transfer, message sign + verify.

**Common issues:**
- "Found no installed wallet" — install Phantom/Solflare
- "Session timeout" — wallet backgrounded too long, OS killed it
- "Authorization failed" immediately — stale token, clear and retry
- App crashes on transact() — polyfills missing, run `npx react-native start --reset-cache`
- Transaction fails silently — check cluster (devnet?), simulate first, check SOL balance

**Logs:** `adb logcat *:S ReactNative:V ReactNativeJS:V`

**Release build test:**
```bash
cd android
./gradlew assembleRelease
adb install app/build/outputs/apk/release/app-release.apk
```

**Pre-launch checklist:** Phantom connect, Solflare connect, tx signing, msg signing, error messages user-friendly, "no wallet" case, cancellation UX, auth caching works, release build works.

---

## 1.10 Course Conclusion

Capstone: token sender app combining AuthorizationProvider + balance display + SOL transfer + status handling. Project structure in `src/providers/`, `src/hooks/`, `src/screens/`, `src/components/`, `src/utils/mwaErrorHandler.ts`.

Competencies covered: protocol fundamentals, env setup, wallet connection, tx signing, msg signing, state mgmt, error handling, device testing.

---

# Module 2 — MWA Protocol Deep Dive

## 2.1 Architecture

**Three layers:**
```
+─────────────────────────────────+
|   RPC Layer (authorize, sign...)|
+─────────────────────────────────+
|   Session Layer (ECDH, AES-GCM) |
+─────────────────────────────────+
|   Transport Layer (WebSocket)   |
+─────────────────────────────────+
```

dApp always initiates, wallet always responds. Association token = base64url-encoded P-256 public key, ephemeral per session. Encryption enforced even over localhost (rooted devices + malware threat model, uniform code path with reflector).

**MWA vs alternatives:**
| | Browser ext | WalletConnect | MWA |
|--|--|--|--|
| Context | Shared JS | Separate | Separate |
| Transport | Memory | Remote relay | Local WS / relay |
| Session | Long-lived | Long-lived | **Ephemeral** |
| Encryption | Optional | Yes | Yes |

## 2.2 Transport Layer

WebSocket requirements: full-duplex, message-oriented, reliable+ordered, app-to-app on same device.

**Subprotocol negotiation:**
- `com.solana.mobilewalletadapter.v1` (binary, preferred)
- `com.solana.mobilewalletadapter.v1.base64` (text fallback)

**SDK state machine:**
```typescript
type State =
  | { __type: 'connecting' }
  | { __type: 'connected'; ws: WebSocket }
  | { __type: 'hello_req_sent'; ws: WebSocket }
  | { __type: 'hello_rsp_received'; associationPublicKey; ecdhPrivateKey; sessionKeyPair; sequenceNumber; ws }
  | { __type: 'connected_and_authorized'; /* ... */ }
  | { __type: 'disconnected' }
  | { __type: 'error'; message: string };
```

**Port selection** (dApp picks):
```typescript
const port = 49152 + Math.floor(Math.random() * 16383);
```

**Transport debugging:**
- Connection refused → wallet didn't start server (launch too slow, unsupported, port conflict)
- Connection reset → wallet crashed / force-closed
- WebSocket timeout → wallet frozen / network issue on reflector
- Invalid subprotocol → version mismatch

## 2.3 Association

**URI format:**
```
solana-wallet:/v1/associate/<scenario>?<params>
```

**Local:** `solana-wallet:/v1/associate/local?association=<token>&port=<port>`
**Remote:** `solana-wallet:/v1/associate/remote?association=<token>&id=<id>&reflector=<host>`

**P-256 keypair generation:**
```typescript
const associationKeypair = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true, ['sign', 'verify']
);
const publicKeyBuffer = await crypto.subtle.exportKey('raw', associationKeypair.publicKey);
const associationToken = base64urlEncode(new Uint8Array(publicKeyBuffer));
// 65 bytes raw → ~87 chars base64url
```

**Android registration:**
```xml
<intent-filter>
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="solana-wallet" />
</intent-filter>
```

**Common errors:** "No app found to handle intent", "Connection refused after Intent", "Invalid association token", "Timeout waiting for connection".

## 2.4 ECDH Session Establishment

Two keypairs used by dApp:
| Keypair | Purpose | Algorithm |
|---|---|---|
| Association | Auth HELLO_REQ | ECDSA |
| Session | Key exchange | ECDH |

**HELLO_REQ structure:** `Qd(65 bytes) || Sa(64 bytes ECDSA raw, r||s)` = 129 bytes total.

**HELLO_RSP:** `Qw(65 bytes) || session_props(JSON)`.

**Session key derivation:**
```typescript
const sharedSecret = await crypto.subtle.deriveBits(
  { name: 'ECDH', public: walletPublicKey },
  ecdhPrivateKey, 256
);
const salt = await crypto.subtle.exportKey('raw', associationPublicKey);
const hkdfKey = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveBits']);
const sessionKeyBits = await crypto.subtle.deriveBits(
  { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(salt), info: new Uint8Array(0) },
  hkdfKey, 128
);
```

**Why P-256 not secp256k1?** Hardware support on Android + iOS secure enclaves, Web Crypto built-in, NIST-standardized.

**Typical timing:** ~10-20ms local, +50-200ms remote.

## 2.5 Encrypted Messages (AES-GCM)

```
+─────────────────────────────────────+
| Seq(4B) | IV(12B) | Cipher | Tag(16B)|
+─────────────────────────────────────+
```

Sequence number = AAD (authenticated but not encrypted). Tampering → decryption fails. Both sides start sequence at **1**.

**Encrypt:**
```typescript
async function encryptJsonRpcMessage(
  jsonRpcMessage: object,
  sharedSecret: CryptoKey,
  sequenceNumber: number
): Promise<Uint8Array> {
  const plaintext = new TextEncoder().encode(JSON.stringify(jsonRpcMessage));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, tagLength: 128 },
    sharedSecret, plaintext
  );
  const seqNumBuffer = new ArrayBuffer(4);
  new DataView(seqNumBuffer).setUint32(0, sequenceNumber);
  return new Uint8Array([
    ...new Uint8Array(seqNumBuffer),
    ...iv,
    ...new Uint8Array(ciphertext),
  ]);
}
```

**Size limits:** reflector = 4096 bytes. Stay under 3KB for compatibility.

**Common mistakes:** IV reuse (catastrophic), wrong seq increment order, little-endian seq, wrong tag length (must be 128 bits).

## 2.6 JSON-RPC Methods

**Categories:**
- Non-privileged: `authorize`, `deauthorize`, `get_capabilities`
- Privileged: `sign_and_send_transactions`, `sign_messages`, `clone_authorization`

### authorize
```json
{
  "jsonrpc": "2.0", "id": "1", "method": "authorize",
  "params": {
    "identity": { "uri": "https://myapp.com", "icon": "favicon.ico", "name": "My dApp" },
    "cluster": "mainnet-beta",
    "auth_token": "previous_token",
    "features": ["sign_and_send_transactions:2", "sign_messages"],
    "addresses": ["base64_encoded_addresses"]
  }
}
```

Response includes `accounts[]` (with `address` base64, `display_address` base58, `chains`, `features`), `auth_token`, `wallet_uri_base`, optional `sign_in_result`.

### sign_and_send_transactions
```json
{
  "jsonrpc": "2.0", "id": "4", "method": "sign_and_send_transactions",
  "params": {
    "payloads": ["base64_tx_1", "base64_tx_2"],
    "options": {
      "min_context_slot": 150000000,
      "commitment": "confirmed",
      "skip_preflight": false,
      "max_retries": 3
    }
  }
}
```

Response: `{ signatures: ["base64_sig", ...] }`

### sign_messages
```json
{
  "jsonrpc": "2.0", "id": "5", "method": "sign_messages",
  "params": {
    "payloads": ["base64_message"],
    "addresses": ["base64_pubkey"]
  }
}
```

### Error codes
| Code | Name | Meaning |
|------|------|---------|
| -1 | ERROR_AUTHORIZATION_FAILED | User declined or token invalid |
| -2 | ERROR_INVALID_PAYLOADS | Malformed tx/msg |
| -3 | ERROR_NOT_SIGNED | User declined to sign |
| -4 | ERROR_NOT_SUBMITTED | Broadcast failed |
| -6 | ERROR_TOO_MANY_PAYLOADS | Exceeds wallet limit |
| -7 | ERROR_CHAIN_NOT_SUPPORTED | Chain unsupported |
| -100 | ERROR_ATTEST_ORIGIN_ANDROID | Attestation required/failed |

## 2.7 Identity Verification

**Digital Asset Links (DAL)** for Android native apps. Host at `https://yourdomain.com/.well-known/assetlinks.json`:
```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.yourcompany.yourapp",
    "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
  }
}]
```

**Get fingerprint:**
```bash
keytool -list -v -keystore my-release-key.keystore -alias my-key-alias
```
For Play Store apps use Google Play Console → App Signing.

**Multiple fingerprints (debug/release/Play):**
```json
"sha256_cert_fingerprints": ["DEBUG_FP", "RELEASE_FP", "GOOGLE_PLAY_FP"]
```

**Requirements for the file:** HTTPS, `application/json` Content-Type, no redirects, no auth.

**Wallet UI:** verified dApps get checkmark + domain; unverified get warning banner.

## 2.8 Reflector Protocol & Debugging

Reflector is untrusted relay for remote (laptop dApp ↔ phone wallet). Sees only ciphertext. Timeouts: 30s half-open, 90s session, 4096 bytes max message.

**Remote URI in QR:**
```
solana-wallet:/v1/associate/remote
  ?association=BASE64URL_PUBLIC_KEY
  &id=BASE64URL_REFLECTOR_ID
  &reflector=reflect.myapp.com
```

Official reflector: `wss://reflect.solanamobile.com`

**Debug layers (bottom-up):** Transport → Session → RPC → Application.

**Transport debug:**
```bash
adb shell netstat -tlnp | grep <port>
curl -v https://reflect.solanamobile.com
```

**Session debug** — log HELLO_REQ structure, verify P-256 keys start with `0x04`, manually verify signature.

**Metrics to track in prod:** connection success rate, session establishment time, auth rate, error code distribution.

---

# Module 3 — Embedded Wallets

## 3.1 Introduction

**Problem MWA doesn't solve:** 80% of mainstream users drop off at "write down your 24-word seed phrase." Embedded wallets = keys managed behind FaceID / email / social login. iOS bonus: they work (unlike MWA).

**Four approaches:**

### 1. MPC (Multi-Party Computation) — key split 2-of-2+
```
+──────────────+        +──────────────+
| User device  |        | Provider HSM |
|   Share A    |        |    Share B   |
+──────────────+        +──────────────+
         \                   /
          +─── Threshold ────+
                Signing
```
No single party holds the complete key. Providers: **Privy, Dynamic, Para, Web3Auth**.

```typescript
// Privy example
const { wallets } = useEmbeddedSolanaWallet();
const provider = await wallets[0].getProvider();
await provider.request({
  method: 'signAndSendTransaction',
  params: { transaction }
});
```

### 2. TEE/HSM — key in secure enclave
Single-location key, trust provider's hardware isolation. Providers: **Phantom Connect, Magic Link, Turnkey**.

### 3. Passkey-Native — key in device secure enclave
Private key never leaves hardware. Solana's secp256r1 precompile verifies signatures on-chain. Provider in signing path = **none**. Provider: **LazorKit**.

```typescript
// LazorKit
const { signAndSendTransaction } = useWallet();
await signAndSendTransaction(
  { instructions, transactionOptions: { feeToken: USDC_ADDRESS } },
  { redirectUrl: 'myapp://callback' }
);
```

### 4. Modular Signers — smart wallet with multiple auth methods
```
Smart Wallet
├── Primary: Passkey (phone)
├── Backup: Email
└── Admin: API Key
```
Provider: **Crossmint**.

### Provider comparison
| Provider | Architecture | Auth | Key Property |
|----------|-------------|------|--------------|
| Privy | MPC 2-of-2 | Email, phone, social, passkey, MWA | Hybrid embedded + external |
| Dynamic | MPC TSS-FROST | Email, social, passkey | Native Ed25519, key export |
| Turnkey | HSM | Bring your own auth | Max dev control |
| LazorKit | Passkey smart wallet | Passkey only | No provider in signing |
| Para | MPC distributed | Email, social, passkey | Multi-chain |
| Crossmint | Modular signers | Passkey + others | Flexible, cross-chain |
| Phantom Connect | TEE/HSM OAuth | Google, Apple | Native Phantom UX |
| Magic | TEE (Fortanix SGX) | Magic link | Passwordless |
| Web3Auth | MPC (Torus) | Many social | Most customizable |

## 3.2 MPC Cryptography

Shamir's Secret Sharing foundation: split secret into n shares, t reconstruct. MPC goes further → compute on shared secrets without ever reconstructing.

**Threshold signing (2-of-2):** Both parties produce partial signatures, combine into valid signature indistinguishable from single-signer.

**Not multi-sig:** single signature output, standard tx size/fees, privacy (MPC invisible on-chain), no program support needed.

**FROST (Flexible Round-Optimized Schnorr Threshold)** enables EdDSA threshold sigs → native Ed25519 output, validators can't tell it's MPC.

**DKG (Distributed Key Generation):** critical — if one party generates the key and distributes, that party knows the whole key. DKG creates keys collaboratively so no one sees the complete key.

**What MPC protects:** single-point compromise, insider threats, key extraction, backup theft.
**What it doesn't:** compromised device (attackers can request sig on malicious tx), social engineering, provider collusion, protocol bugs.

## 3.3 Passkeys & WebAuthn

Private key never leaves device secure hardware (iOS Secure Enclave / Android TEE). FaceID/Touch ID/PIN gates access. **Origin binding** at hardware level → passkey for myapp.com cannot be used on evil-myapp.com.

**Solana secp256r1 support:** SIMD-0075 added native precompile.
```
Program: Secp256r1SigVerify1111111111111111111111111
```
Precompile verification: ~750 CU. Smart contract verification: 150,000+ CU. **200x cheaper** on-chain.

**Smart wallet PDA derived from passkey pubkey:**
```typescript
const [smartWalletPDA] = PublicKey.findProgramAddressSync(
  [Buffer.from("smart_wallet"), passkeyPublicKey],
  walletProgramId
);
```

**Signature flow:**
1. Build tx → hash into challenge
2. Device FaceID prompt
3. Secure enclave signs with secp256r1
4. Include signature + precompile verify instruction
5. Program CPI executes on PDA's behalf

**WebAuthn structures:**
- Authenticator data: `rpIdHash(32) || flags(1) || signCount(4) || extensions`
- Client data JSON: `{ type: "webauthn.get", challenge, origin, crossOrigin }`
- Signs: `authenticatorData || SHA256(clientDataJSON)`

**UX comparison — onboarding flow:**
- Traditional: 7 steps (download, create, seed phrase, confirm, return, connect, approve)
- Passkey: **3 steps** (tap Create, FaceID, done)

## 3.4 Smart Wallet Architectures

From keypair-controlled → program-controlled accounts. Wallet is a PDA, authorization is configurable program logic.

**Auth models:**
- Single passkey
- Multi-passkey (any of N)
- Threshold (e.g., <$100 single, >$100 2-of-3)
- Guardian recovery (passkey OR guardian + 7-day timelock)
- Session keys (full access OR limited scoped to programs, expires 24h)

**Account abstraction — gas sponsorship:**
```
User(passkey) → Paymaster(pays SOL) → SmartWallet(executes)
```

**Alternative fee tokens:** user agrees to pay 0.01 USDC → paymaster verifies USDC payment → paymaster pays SOL, receives USDC.

**Batched ops:** one passkey verification → multiple instructions (swap, stake, update profile).

**LazorKit account state:**
```
SmartWalletAccount {
  passkey_pubkey: [u8; 33],
  wallet_bump: u8,
  created_at: i64,
}
```

**Crossmint modular approach:** primary/backup/automated signers attached to same smart wallet, cross-chain identity.

**Defense in depth:** Hardware (enclave) → Origin binding → On-chain verify → Policy enforcement (spending limits, whitelists, timelocks).

**State attacks to prevent:** replay (nonce/blockhash), state desync, upgrade front-running.

## 3.5 Choosing an Implementation

**Decision axes:**
- User sophistication: crypto-native vs mainstream vs enterprise
- Signing frequency: rare (monthly sub) vs frequent (games, social) vs continuous (bots)
- Recovery requirements: small balance vs critical vs regulated

**Matrix:**
| Dimension | MPC | TEE/HSM | Passkey | Modular |
|-----------|-----|---------|---------|---------|
| Trust | Distributed | Provider | Device only | Flexible |
| Provider dep | Signing | Always | None in signing | Varies |
| Key export | Sometimes | Provider-managed | Never | Varies |

**When NOT to use embedded:** crypto-native prefer existing wallets, read-heavy app, max decentralization, no budget for per-user fees.

**Red flags evaluating providers:** no public audits, vague crypto descriptions, "military-grade encryption" marketing, missing incident response, SPOFs in key management.

**Implementation strategy:** abstract wallet interface so you can swap providers, store wallet ID not just address, budget time for real device testing (emulators lack enclaves).

---

# Module 4 — Solana Mobile Client

## 4.1 Introduction

Builds on MWA. Core constraints shaping every lesson:
- Network reliability → graceful partial completions, offline states
- Battery → WebSockets/webhooks/caching over polling
- Screen real estate → thoughtful tx presentation
- User expectations → optimistic updates, clear loading states

## 4.2 RPC Fundamentals

```typescript
import { Connection, clusterApiUrl } from "@solana/web3.js";

const connection = new Connection(
  "https://your-provider.com/rpc",
  {
    commitment: "confirmed",
    confirmTransactionInitialTimeout: 60000,
  }
);
```

**Commitment levels:**
- `processed` — fast, reversible
- `confirmed` — 66%+ validators, **recommended**
- `finalized` — slower, irreversible

**Batch reads** (single RPC round trip):
```typescript
const balances = await connection.getMultipleAccountsInfo([addr1, addr2, addr3]);
```

**Account cache pattern:**
```typescript
const accountCache = new Map<string, { data: AccountInfo<Buffer> | null; timestamp: number }>();
const CACHE_TTL = 5000;

async function getCachedAccountInfo(connection: Connection, pubkey: PublicKey) {
  const key = pubkey.toBase58();
  const cached = accountCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
  const data = await connection.getAccountInfo(pubkey);
  accountCache.set(key, { data, timestamp: Date.now() });
  return data;
}
```

**WebSocket subscription with cleanup:**
```typescript
function useAccountBalance(publicKey: PublicKey | null) {
  const [balance, setBalance] = useState<number | null>(null);
  const connection = useConnection();
  useEffect(() => {
    if (!publicKey) return;
    connection.getBalance(publicKey).then(setBalance);
    const subId = connection.onAccountChange(
      publicKey,
      (info) => setBalance(info.lamports),
      "confirmed"
    );
    return () => connection.removeAccountChangeListener(subId);
  }, [publicKey, connection]);
  return balance;
}
```

**Mobile WS challenges:** iOS/Android kill WS when app backgrounds → need reconnection logic; long-running subs drain battery.

**Provider table:**
| Provider | Strength | Mobile fit |
|----------|----------|------------|
| Helius | Fast, DAS API, webhooks | Best for NFTs |
| QuickNode | Global infra | Latency-distributed |
| Triton | High throughput | Volume-heavy |
| Alchemy | Multi-chain | EVM crossover |

Store endpoint in env: `SOLANA_RPC_URL` via `react-native-config`.

## 4.3 SPL Token Operations

Mint account (properties) + Token account (balance) + Metadata account (name/symbol/image). User needs ATA (Associated Token Account) to hold tokens.

**Balance:**
```typescript
async function getTokenBalance(connection, walletAddress, mintAddress): Promise<number> {
  const ata = await getAssociatedTokenAddress(mintAddress, walletAddress);
  try {
    const accountInfo = await connection.getTokenAccountBalance(ata);
    return parseFloat(accountInfo.value.uiAmountString || "0");
  } catch { return 0; }
}
const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
```

**Portfolio:**
```typescript
const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
  walletAddress, { programId: TOKEN_PROGRAM_ID }
);
return tokenAccounts.value.map((account) => {
  const info = account.account.data.parsed.info;
  return {
    mint: info.mint,
    balance: info.tokenAmount.uiAmount,
    decimals: info.tokenAmount.decimals,
    address: account.pubkey.toBase58(),
  };
});
```

**Transfer with ATA creation if needed:**
```typescript
async function transferToken(connection, fromWallet, toWallet, mintAddress, amount, decimals) {
  const fromAta = await getAssociatedTokenAddress(mintAddress, fromWallet);
  const toAta = await getAssociatedTokenAddress(mintAddress, toWallet);
  const toAtaInfo = await connection.getAccountInfo(toAta);
  const instructions = [];
  if (!toAtaInfo) {
    instructions.push(createAssociatedTokenAccountInstruction(fromWallet, toAta, toWallet, mintAddress));
  }
  const rawAmount = Math.floor(amount * Math.pow(10, decimals));
  instructions.push(createTransferInstruction(fromAta, toAta, fromWallet, rawAmount));
  // build tx, sign with MWA, send...
}
```

**Cost awareness:** ATA creation = ~0.00203928 SOL rent exemption.

**Token-2022 detection:**
```typescript
async function getTokenProgram(connection, mintAddress) {
  const mintInfo = await connection.getAccountInfo(mintAddress);
  return mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : TOKEN_PROGRAM_ID;
}
```

**Decimal parsing:**
```typescript
function parseTokenAmount(input: string, decimals: number): bigint | null {
  const cleaned = input.replace(/[^\d.]/g, "");
  const parts = cleaned.split(".");
  if (parts.length > 2) return null;
  const wholePart = parts[0] || "0";
  const decimalPart = (parts[1] || "").padEnd(decimals, "0").slice(0, decimals);
  try { return BigInt(wholePart + decimalPart); } catch { return null; }
}
```

## 4.4 NFT Operations (DAS API)

NFT = token with supply=1, decimals=0, no mint authority. Use Helius/QuickNode/Triton DAS endpoint.

**Fetch by owner:**
```typescript
async function fetchWalletNfts(dasEndpoint: string, walletAddress: string) {
  const response = await fetch(dasEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: "my-app",
      method: "getAssetsByOwner",
      params: {
        ownerAddress: walletAddress,
        page: 1, limit: 50,
        displayOptions: { showFungible: false, showNativeBalance: false },
      },
    }),
  });
  const data = await response.json();
  return data.result.items;
}
```

**Image URI normalization (IPFS/Arweave gateways):**
```typescript
const fixedUri = useMemo(() => {
  if (!uri) return null;
  if (uri.startsWith("ipfs://")) return uri.replace("ipfs://", "https://ipfs.io/ipfs/");
  if (uri.startsWith("ar://")) return uri.replace("ar://", "https://arweave.net/");
  return uri;
}, [uri]);
```

**NFT transfer = token transfer with amount=1.**

**Compressed NFTs (cNFTs):** check `nft.compression?.compressed === true`. Transfers need Merkle proof from DAS `getAssetProof`.

**Marketplace APIs:** Tensor (`x-tensor-api-key` header), Magic Eden (`api-mainnet.magiceden.dev/v2/collections/{sym}/stats`). Or just `Linking.openURL()` to marketplace pages.

**Metaplex Core:**
```typescript
import { fetchAsset, transfer as mplTransfer } from "@metaplex-foundation/mpl-core";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
const umi = createUmi(rpcEndpoint);
const asset = await fetchAsset(umi, assetAddress);
```

## 4.5 Solana Blinks & Actions

Actions = HTTP endpoints returning ready-to-sign transactions. **No SDK dependencies.** GET for metadata, POST for transaction.

**GET response shape:**
```typescript
// { title, description, icon, label, links: { actions: [{ label, href, parameters }] } }
```

**POST example:**
```typescript
const txResponse = await fetch("https://jupiter.dial.to/api/v0/swap/SOL-USDC?amount=1", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ account: userWalletAddress })
});
const { transaction } = await txResponse.json(); // base64 string
```

**Execute flow:**
```typescript
async function executeAction(actionUrl: string, userAddress: string, connection: Connection) {
  const response = await fetch(actionUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ account: userAddress })
  });
  const { transaction: txBase64 } = await response.json();
  const txBuffer = Buffer.from(txBase64, "base64");
  const transaction = VersionedTransaction.deserialize(txBuffer);

  const signedTx = await transact(async (wallet) => {
    await wallet.authorize({ cluster: "mainnet-beta", identity: { name: "My Blink App" } });
    const [signed] = await wallet.signTransactions({ transactions: [transaction] });
    return signed;
  });
  return await connection.sendTransaction(signedTx);
}
```

**Popular endpoints:**
- SPL transfer: `https://solana.dial.to/api/actions/transfer?toWallet=...&token=...&amount=...`
- Jupiter swap: `https://jupiter.dial.to/api/v0/swap/SOL-USDC?amount=1&slippageBps=50`
- Kamino deposit: `https://kamino.dial.to/api/v0/lend/{reserve}/deposit?amount=100`
- Lulo: `https://blink.lulo.fi/actions?amount=100&symbol=USDC`

**Action chaining:** response can include `links.next` (`inline` or `post`) for multi-step flows.

**Dialect SDK:**
```bash
yarn add @dialectlabs/blinks-react-native
```
```typescript
import { Blink, useAction } from "@dialectlabs/blinks-react-native";
const { action, isLoading } = useAction({ url });
return <Blink action={action} websiteText={new URL(url).hostname} adapter={myBlinkAdapter} />;
```

**Security:** only accept from trusted domains, check Dialect registry (`api.dial.to/v1/blink?apiUrl=...`), simulate before signing.

**Host your own actions:** need CORS headers, `.well-known/actions.json` rules file:
```json
{ "rules": [{ "pathPattern": "/api/actions/**", "apiPath": "/api/actions/**" }] }
```

## 4.6 Custom Program Interaction

**Instruction anatomy:**
```typescript
const instruction = new TransactionInstruction({
  programId: new PublicKey("YourProgramAddress..."),
  keys: [
    { pubkey: userWallet, isSigner: true, isWritable: true },
    { pubkey: dataAccount, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
  ],
  data: Buffer.from([/* instruction data */])
});
```

**PDAs:**
```typescript
const [pda, bump] = PublicKey.findProgramAddressSync(
  [Buffer.from("user-profile"), userWallet.toBuffer()],
  programId
);
```

**Anchor for mobile** — use `.instruction()` not `.rpc()`:
```typescript
const ix = await program.methods
  .yourMethod(arg1, arg2)
  .accounts({ user: userWallet })
  .instruction();

const tx = new VersionedTransaction(
  new TransactionMessage({
    payerKey: userWallet,
    recentBlockhash: blockhash,
    instructions: [ix],
  }).compileToV0Message()
);
// sign with MWA
```

**Anchor discriminators** (8-byte prefix):
```typescript
import { sha256 } from "@noble/hashes/sha256";
function getAnchorDiscriminator(instructionName: string): Buffer {
  const hash = sha256(`global:${instructionName}`);
  return Buffer.from(hash.slice(0, 8));
}
const fullData = Buffer.concat([
  getAnchorDiscriminator("initialize"),
  borsh.serialize(argsSchema, args)
]);
```

**Borsh serialization:**
```typescript
import * as borsh from "borsh";
class MyInstruction {
  instruction: number;
  amount: bigint;
  constructor(fields) { Object.assign(this, fields); }
}
const schema = new Map([[MyInstruction, {
  kind: "struct",
  fields: [["instruction", "u8"], ["amount", "u64"]]
}]]);
const data = borsh.serialize(schema, new MyInstruction({ instruction: 0, amount: 1_000_000_000n }));
```

**Multi-instruction tx with extra signer (Keypair):**
```typescript
const newAccount = Keypair.generate();
const tx = new VersionedTransaction(message);
tx.sign([newAccount]); // sign additional signers BEFORE wallet
// then wallet.signTransactions...
```

**Address Lookup Tables (ALTs)** for compressed instructions:
```typescript
const lookupTableAccount = await connection.getAddressLookupTable(lookupTableAddress).then(res => res.value);
const message = new TransactionMessage({
  payerKey: userWallet,
  recentBlockhash: blockhash,
  instructions,
}).compileToV0Message([lookupTableAccount]);
```

**Simulate first:**
```typescript
const simulation = await connection.simulateTransaction(transaction, {
  sigVerify: false, commitment: "confirmed",
});
if (simulation.value.err) {
  console.error("Simulation logs:", simulation.value.logs);
  throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
}
```

---

# Module 5 — dApp Store Publishing

## 5.1 Distribution Overview

Three channels:
1. **Google Play** — ~3B Android devices, 30% fee on digital goods (crypto exempt), policy restrictions.
2. **Apple App Store** — iOS only, stricter than Google, wallet apps need org enrollment, no sideloading (limited EU only).
3. **Solana dApp Store** — Android-only alternative, no anti-crypto bias, NFT registry, smaller reach.

**Why stores restrict crypto:** payments bypass platform fees, token economies don't fit monetization, self-custody removes platform dependency narrative.

**Decision tree:**
- iOS needed → Apple, org enrollment
- Android-only crypto-native → dApp Store viable
- Max Android reach → publish to both Play + dApp Store
- Hybrid → embedded wallets (Privy) to present as "authentication" not blockchain

## 5.2 Solana dApp Store

**NFT-based registry:** your app's entry is an NFT on Solana. You own it.

```
Publisher NFT (identity)
    └── App NFT (application)
            └── Release NFT (each version w/ APK)
```

**Setup (portal recommended):** publish.solanamobile.com → KYC/KYB → connect wallet (~0.2 SOL) → storage provider (ArDrive).

**CLI setup:**
```bash
# Node 18-21 required
mkdir my-app-publishing && cd my-app-publishing
npm init -y
npm install --save-dev @solana-mobile/dapp-store-cli
npx dapp-store init
```

**Keystore:**
```bash
keytool -genkey -v -keystore my-release-key.keystore -alias my-key-alias \
  -keyalg RSA -keysize 2048 -validity 10000
```

**Gradle signing** (`android/app/build.gradle`):
```gradle
signingConfigs {
    release {
        storeFile file("my-release-key.keystore")
        storePassword System.getenv("KEYSTORE_PASSWORD") ?: ""
        keyAlias "my-key-alias"
        keyPassword System.getenv("KEY_PASSWORD") ?: ""
    }
}
buildTypes {
    release {
        signingConfig signingConfigs.release
        minifyEnabled true
        proguardFiles getDefaultProguardFile('proguard-android-optimize.txt'), 'proguard-rules.pro'
    }
}
```

**Build:**
```bash
cd android
export KEYSTORE_PASSWORD="..."
export KEY_PASSWORD="..."
./gradlew assembleRelease
# Output: android/app/build/outputs/apk/release/app-release.apk
```

**Requirements:** target SDK API 33+, release signed, arm64-v8a.

**Assets:** App icon 512×512 PNG, banner 1200×600, 4+ screenshots 1080×1080.

**Publish:**
```bash
npx dapp-store validate -k /path/to/keypair.json -b /path/to/android/build/tools
npx dapp-store create publisher -k /path/to/keypair.json
npx dapp-store create app -k /path/to/keypair.json -u https://api.mainnet-beta.solana.com
npx dapp-store create release -k /path/to/keypair.json -b /path/to/android/build/tools -u https://api.mainnet-beta.solana.com
npx dapp-store publish submit -k /path/to/keypair.json -u https://api.mainnet-beta.solana.com \
  --requestor-is-authorized --complies-with-solana-dapp-store-policies
```

**Updates:** increment `versionCode` in `build.gradle`.

**Review:** manual, 2-5 business days. Allows direct crypto payments, token rewards, NFT trading, DeFi (unlike traditional stores).

## 5.3 Apple & Google Play Review Strategies

### Apple — Section 3.1.5

**Wallet apps:** individual dev accounts ($99/yr) **cannot** publish wallets. Need **org enrollment** (D-U-N-S number, 2-4 weeks).

**NFTs:** display OK, purchase OK with crypto, **unlocking app features requires IAP (30% fee)**.

**Test account options for reviewers:**
1. **Demo mode** — simulate blockchain responses:
```typescript
const isDemoMode = process.env.DEMO_MODE === 'true';
const executeTransaction = async (tx: Transaction) => {
  if (isDemoMode) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { signature: 'DEMO_' + Math.random().toString(36).substring(7), success: true };
  }
  return await connection.sendTransaction(tx, [wallet]);
};
```
2. **Privy test accounts** — email `test-XXXX@privy.io`, OTP `XXXXXX`.
3. **Pre-funded test wallet** — risks reviewer conflicts / key compromise.

### Google Play

Financial Features declaration: App Content → Financial Features → declare cryptocurrency → list services/jurisdictions → licensing info.

More permissive on NFTs: buying/selling with crypto allowed, NFTs unlocking features allowed if users can also earn/access.

### Rejection reasons & fixes

| Rejection | Fix |
|-----------|-----|
| "Insufficient information" | Over-explain in App Review Notes |
| "Requires additional resources" | Demo mode or test accounts |
| "3.1.5 - Cryptocurrencies" | Re-enroll as organization |
| "Doesn't function as advertised" | Testnet mode or funded creds |
| "Financial services concerns" | Soften metadata language |

### Metadata strategy

**Trigger words to avoid:** Trade/Trading, Exchange, Investment/Invest, Earn (in yield context), Banking, Financial services.

**Safer alternatives:** Manage your digital assets, Send and receive crypto, View your portfolio, Access decentralized applications, Connect to Web3.

**Category:** Utilities often lower scrutiny than Finance for wallets/tools.

## 5.4 Mobile Security

**Reverse engineering is trivial:**
```bash
adb shell pm path com.yourcompany.yourapp
adb pull /data/app/.../base.apk
jadx -d output/ yourapp.apk
unzip -p yourapp.apk classes.dex | strings | grep -i "api\|key\|secret\|token"
```

ProGuard/R8 renames symbols but **leaves strings intact**. **Don't put server secrets in client code.**

**Cannot protect:** static API keys, hardcoded URLs, static config, OAuth client IDs.
**Can protect:** user auth tokens, private keys (with hardware backing), session data.

**Secure storage — iOS Keychain / Android Keystore** via `expo-secure-store`:
```typescript
import * as SecureStore from 'expo-secure-store';
await SecureStore.setItemAsync('authToken', token, {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY
});
const token = await SecureStore.getItemAsync('authToken');
```

**NEVER store secrets in:** `AsyncStorage` (not encrypted), global state (memory-dumpable).

**Encrypt private keys with user PIN-derived keys:**
```typescript
const encryptPrivateKey = async (privateKey, userPin) => {
  const salt = await Crypto.getRandomBytesAsync(16);
  const derivedKey = await deriveKey(userPin, salt);
  const encrypted = await encrypt(privateKey, derivedKey);
  await SecureStore.setItemAsync('encryptedPrivateKey',
    JSON.stringify({ encrypted, salt: Array.from(salt) }),
    { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }
  );
};
```

**Or use embedded wallet provider** (Privy etc.) and offload key mgmt entirely.

**API patterns:**
1. **Backend proxy** — user token to your backend → backend calls third-party APIs with real key.
2. **Short-lived tokens** — backend issues scoped tokens expiring in minutes.
3. **Request signing** — HMAC requests with timestamp to prevent replay.

**Network config** (`android/app/src/main/res/xml/network_security_config.xml`):
```xml
<network-security-config>
    <base-config cleartextTrafficPermitted="false">
        <trust-anchors><certificates src="system" /></trust-anchors>
    </base-config>
</network-security-config>
```

**Certificate pinning** (react-native-ssl-pinning) for critical endpoints — caution: cert expiry requires app update.

**Jailbreak/root detection:**
```typescript
import JailMonkey from 'jail-monkey';
if (JailMonkey.isJailBroken() || JailMonkey.isOnExternalStorage()) {
  // Warn (don't block — power users are legit)
}
```

**Screenshot prevention for sensitive screens:**
```typescript
import RNPreventScreenshot from 'react-native-prevent-screenshot';
useEffect(() => {
  if (isFocused && Platform.OS === 'android') RNPreventScreenshot.enabled(true);
  return () => RNPreventScreenshot.enabled(false);
}, [isFocused]);
```

**Security checklist:** no hardcoded keys, backend proxy, short-lived tokens, SecureStore, HTTPS only, cert pin critical endpoints, hardware-backed key encryption, ProGuard on release, debug logging off in prod, jailbreak warn, screenshot prevention on seed screens.

## 5.5 Production Operations

**Crash reporting (Sentry):**
```typescript
import * as Sentry from '@sentry/react-native';
Sentry.init({
  dsn: 'https://your-dsn@sentry.io/project',
  tracesSampleRate: 0.2,
  environment: __DEV__ ? 'development' : 'production',
});
Sentry.setUser({ id: userId });
```

**Transaction monitoring:**
```typescript
const executeTransaction = async (tx: Transaction, type: string) => {
  const startTime = Date.now();
  try {
    const signature = await connection.sendTransaction(tx, [wallet]);
    await connection.confirmTransaction(signature);
    analytics.track('transaction_success', { type, duration: Date.now() - startTime, signature });
    return signature;
  } catch (error) {
    analytics.track('transaction_failure', { type, duration: Date.now() - startTime, error: error.message });
    Sentry.captureException(error, { tags: { transaction_type: type } });
    throw error;
  }
};
```

**Metrics to track:** crash-free rate (target 99.5%+), tx success rate, tx latency, wallet connection success, API error rate, session duration.

**Alert thresholds:** crash >1% last hour, tx failures >10%, API errors >5%, zero tx for 30 min with steady expected usage.

**Multi-RPC fallback:**
```typescript
const RPC_ENDPOINTS = [
  'https://your-primary.rpc.com',
  'https://your-backup.rpc.com',
  'https://api.mainnet-beta.solana.com',
];
let currentEndpointIndex = 0;
const getConnection = () => new Connection(RPC_ENDPOINTS[currentEndpointIndex], 'confirmed');
const rotateEndpoint = () => {
  currentEndpointIndex = (currentEndpointIndex + 1) % RPC_ENDPOINTS.length;
};
const executeWithRetry = async (operation, maxRetries = 3) => {
  let lastError;
  for (let i = 0; i < maxRetries; i++) {
    try { return await operation(getConnection()); }
    catch (error) {
      lastError = error;
      if (error.message.includes('429') || error.message.includes('timeout')) rotateEndpoint();
    }
  }
  throw lastError;
};
```

**WebSocket health check:**
```typescript
setInterval(async () => {
  try { await connection.getSlot(); }
  catch { cleanup(); connect(); }
}, 30000);
```

**Force update mechanism:**
```typescript
const checkForceUpdate = async () => {
  const config = await (await fetch('https://api.yourapp.com/app-config')).json();
  const currentVersion = DeviceInfo.getVersion();
  if (compareVersions(currentVersion, config.minimumVersion) < 0) {
    Alert.alert('Update Required', 'Please update...', [
      { text: 'Update', onPress: () => Linking.openURL(config.storeUrl) }
    ], { cancelable: false });
    return false;
  }
  return true;
};
```

**Feature flags** for gradual rollout without app update (CodePush for JS-only OTA — caution re: store policies).

**Legal essentials:**
- ToS: self-custody disclaimer, no financial advice, geo restrictions, acceptable use
- Privacy policy: wallet addresses, tx history, device info, third parties, GDPR
- Geographic blocks: trading → money transmitter licenses, fiat ramps → payment processor, potential securities classification

**Maintenance cadence:**
- Weekly: crash reports, tx rates, RPC health, support tickets
- Monthly: dependency updates, analytics review, OS compatibility, store policy updates
- Quarterly: vulnerability audits, credential rotation, DR test, docs update
- Yearly: cert renewals, architecture review, security audits, roadmap

---

# TapTribe build order

Straight path using this material:

1. **Module 1 (all lessons)** — MWA fundamentals, get wallet connect + signing working.
2. **Module 4.2 + 4.3** — RPC setup, SPL token ops (for whatever on-chain identity/points live in TapTribe).
3. **Module 3.1 + 3.3** — Passkey-native embedded wallets. This is the one that removes seed phrases and makes NFC onboarding viable.
4. **Module 4.6** — Custom program interaction for your NFC→on-chain handshake logic.
5. **Module 5.4 + 5.2** — Security hardening + Solana dApp Store submission for hackathon delivery.

**Reference-only** (dive in when something breaks): Module 2 (MWA internals), Module 4.4 (NFTs — only if TapTribe uses them for profiles), Module 4.5 (Blinks — if you want shareable social actions), Module 5.3 (Apple/Google — post-hackathon).
