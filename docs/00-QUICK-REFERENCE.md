# TapTribe Quick Reference — April 2026

> Cheat sheet of exact versions, commands, and packages. Refer to individual docs for details.

---

## Verified Package Versions

| Package | Version | Notes |
|---------|---------|-------|
| **Expo SDK** | 55 | React Native 0.83, React 19.2 |
| **Node.js** | 20+ required | Node 18 is EOL |
| **Anchor (Rust)** | 0.32.1 (safe) or 1.0.0 (bleeding edge) | 1.0.0 released Apr 2, 2026 |
| **@coral-xyz/anchor** | 0.32.1 | TS client (use this, not @anchor-lang/core yet) |
| **@solana/web3.js** | ^1.98.0 | v1 only — Anchor TS is NOT compatible with v2/kit |
| **@solana-mobile/mobile-wallet-adapter-protocol** | 2.2.7 | Core MWA |
| **@solana-mobile/mobile-wallet-adapter-protocol-web3js** | 2.2.7 | web3.js v1 wrapper |
| **react-native-nfc-manager** | 3.17.2 | NFC reading |
| **react-native-hce** | 0.3.0 | NFC HCE broadcasting (Android) |
| **@metaplex-foundation/mpl-bubblegum** | 5.0.2 | Bubblegum V2 — cNFT minting |
| **@metaplex-foundation/umi-bundle-defaults** | 1.5.1 | Umi SDK |
| **expo-camera** | SDK 55 built-in | QR code fallback scanning |
| **react-native-qrcode-svg** | latest | QR code generation |
| **Rust** | 1.89.0+ | Required by Anchor 0.32+ |

---

## Key Commands

```bash
# Create project (Expo SDK 55)
npx create-expo-app@latest --template default@sdk-55

# OR use Solana Mobile template (recommended)
yarn create expo-app --template @solana-mobile/solana-mobile-expo-template

# Install dev client for native modules
npx expo install expo-dev-client

# Prebuild native code (required after adding native deps)
npx expo prebuild

# Run on Android device
npx expo run:android

# Build APK via EAS (replaced deprecated `expo build:android`)
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview        # APK for testing
eas build --platform android --profile development     # dev build
eas build --platform android --profile production      # release AAB
eas build --platform android --profile preview --local # build locally (free)

# Anchor
avm install 0.32.1 && avm use 0.32.1
anchor init taptribe
anchor build
anchor keys list
anchor deploy --provider.cluster devnet
anchor test

# Solana CLI
solana airdrop 2 --url devnet
solana balance --url devnet
```

---

## Critical "Do NOT" List

| Do NOT | Do Instead |
|--------|-----------|
| Use `@solana/web3.js` v2 or `@solana/kit` (now at 6.7.0) | Use `@solana/web3.js` ^1.98.0 (Anchor requires v1) |
| Use `npx expo build:android` | Use `eas build --platform android` |
| Use Helius `mintCompressedNft` RPC | Use Bubblegum V2 `mintV2` via Umi SDK |
| Use Android Beam for phone-to-phone NFC | Use HCE (`react-native-hce`) + reader (`react-native-nfc-manager`) |
| Use `expo-barcode-scanner` | Use `expo-camera` with `barcodeScannerSettings` |
| Use React Navigation directly | Use Expo Router (built on React Navigation) |
| Use Expo Go for development | Use development builds (`expo-dev-client`) |
| Add `solana-program` as separate Rust dep | Use `anchor_lang::solana_program` re-export |
| Target Node 18 | Require Node 20+ |

---

## Helius API

```
Devnet:  https://devnet.helius-rpc.com/?api-key=YOUR_KEY
Mainnet: https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

Free tier: 1M credits/month, 10 req/s RPC, 2 req/s DAS
Sign up:  https://helius.dev
```

---

## Key Addresses

| Item | Address |
|------|---------|
| Genesis Token Mint | `GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te` |
| SGT Mint Authority | `GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4` |
| Token Program (Genesis) | Token-2022 (`TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb`) |

---

## Hackathon Deadlines

| Date | Event |
|------|-------|
| Apr 6, 2026 | Frontier starts |
| May 11, 2026 | Submission deadline |
| Prize pool | $250K cash + $250K/team accelerator investment |
| No tracks | All projects compete in one pool (no Mobile Award) |
