# Solana Mobile Stack — Latest State (April 2026)

## Seeker Device Status

| Detail | Value |
|--------|-------|
| Launch | August 4, 2025 |
| Price | ~$450-600 depending on edition |
| Units activated | 1.2M+ (including Saga 2) |
| Availability | 50+ countries via solanamobile.com |
| Firmware | **SMS 2.0** (rolled out March 2026) |
| TEE | Trustonic Kinibi (GlobalPlatform-compliant) |

### SMS 2.0 Firmware (New as of March 2026)
- Redesigned mobile-first dApp Store with curated categories
- Integrated rewards tracking
- Decentralized identity (DID) integration
- TPIN (Trusted Platform Integrity Network) with Guardian architecture
- OEM expansion — SMS now available to third-party Android OEMs

### SKR Token (New — January 2026)
Coordination token for Seeker ecosystem. Distribution: 30% community airdrops, 10% treasury, 25% growth fund.

---

## Mobile Wallet Adapter (MWA)

### Packages

| Package | Version | Purpose |
|---------|---------|---------|
| `@solana-mobile/mobile-wallet-adapter-protocol` | 2.2.7 | Core — the `transact()` function |
| `@solana-mobile/mobile-wallet-adapter-protocol-web3js` | 2.2.7 | **Use this** — wrapper for web3.js v1 |
| `@solana-mobile/mobile-wallet-adapter-protocol-kit` | 0.2.1 | New — wrapper for @solana/kit (don't use yet) |

### Installation
```bash
npm install @solana-mobile/mobile-wallet-adapter-protocol \
            @solana-mobile/mobile-wallet-adapter-protocol-web3js \
            @solana/web3.js
```

### Core Pattern (Unchanged)
```typescript
import { transact } from '@solana-mobile/mobile-wallet-adapter-protocol-web3js';

const result = await transact(async (wallet) => {
  // 1. Authorize (first time only)
  const auth = await wallet.authorize({
    identity: {
      name: 'TapTribe',
      uri: 'https://taptribe.app',
      icon: 'favicon.ico',
    },
    chain: 'solana:devnet',
  });

  // 2. Re-authorize (subsequent sessions)
  // const auth = await wallet.reauthorize({ auth_token: savedToken });

  // 3. Sign and send transactions
  const signedTxs = await wallet.signTransactions({
    transactions: [serializedTransaction],
  });

  return { auth, signedTxs };
});
```

MWA works with Phantom, Solflare, and Seed Vault Wallet on Seeker. Your app never touches private keys.

---

## Seed Vault

**You do NOT integrate Seed Vault directly.** It's transparent to dApp developers.

- When a user has Seeker + Seed Vault Wallet, your `transact()` calls automatically route through the TEE
- Private keys are stored in the device's secure enclave
- Biometric authentication + "doubletap" confirmation UX
- Keys never leave the TEE

**For your pitch:** "Transactions are signed in Seeker's hardware Trusted Execution Environment — private keys never touch the app or the OS."

The `seed-vault-sdk` GitHub repo is for **wallet app developers**, not dApp developers.

---

## Genesis Token Detection

Genesis Token uses **Token-2022** (Token Extensions), NOT legacy SPL Token.

### Key Addresses
- **Token Mint:** `GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te`
- **Mint Authority:** `GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4`

### Detection Code
```typescript
import { TOKEN_2022_PROGRAM_ID } from '@solana/spl-token';

async function hasGenesisToken(walletAddress: string, heliusApiKey: string): Promise<boolean> {
  const response = await fetch(`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'getTokenAccountsByOwner',
      params: [
        walletAddress,
        { mint: 'GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te' },
        { encoding: 'jsonParsed', commitment: 'confirmed' }
      ]
    })
  });
  const data = await response.json();
  return data.result?.value?.length > 0;
}
```

### Properties
- One per device — can only be minted once per Seeker
- Minted into user's primary Seed Vault Wallet
- Transfers restricted — only between accounts within the same Seed Vault Wallet

### Anti-Sybil Pattern
1. Check wallet owns a Genesis Token
2. Track used token mint addresses server-side to prevent claiming rewards twice

---

## dApp Store Submission

### Two Paths

**Path A — Publisher Portal (web UI):**
Go to `publish.solanamobile.com` — point-and-click upload.

**Path B — CLI:**
```bash
npm install --save-dev @solana-mobile/dapp-store-cli  # v0.15.0
npx dapp-store init      # creates config.yaml
npx dapp-store --help
```

### Asset Requirements
- App icon: 512x512 px
- Banner: 1200x600 px
- Minimum 4 screenshots or videos
- APK file (local path or URL)
- Privacy policy URL

### Review
- 2-5 business days
- "Guardians" (Helius, Jito) verify and moderate submissions
- Your app registry is an NFT you own — permissionless listing

---

## NFC on Solana Mobile

**No Solana-specific NFC API.** Use standard Android NFC via `react-native-nfc-manager`.

NFC hardware is not Seeker-exclusive — works on any NFC-enabled Android phone. The Seeker advantage is Seed Vault + Genesis Token + dApp Store, not NFC.

See `05-nfc-phone-to-phone.md` for the full NFC implementation guide.

---

## Recommended Solana Mobile Expo Template

```bash
yarn create expo-app --template @solana-mobile/solana-mobile-expo-template
```

Pre-installs everything: web3.js, MWA, spl-token, polyfills, hooks, UI components. Use `yarn` (not npm).

---

## Sources
- [Solana Mobile Docs](https://docs.solanamobile.com)
- [MWA Docs](https://docs.solanamobile.com/react-native/mobile-wallet-adapter)
- [Expo dApp Template](https://docs.solanamobile.com/react-native/expo-dapp-template)
- [Seed Vault SDK](https://github.com/solana-mobile/seed-vault-sdk)
- [Genesis Token](https://docs.solanamobile.com/marketing/engaging-seeker-users)
- [dApp Store Intro](https://docs.solanamobile.com/dapp-store/intro)
- [dApp Store CLI](https://www.npmjs.com/package/@solana-mobile/dapp-store-cli)
- [SMS 2.0 — 1.2M devices](https://www.coinreporter.io/2026/03/solana-mobile-stack-2-0-hits-1-2-million-active-devices/)
