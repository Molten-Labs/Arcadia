# Build Plan Changes Required

> Summary of everything that needs updating in TAPTRIBE_BUILD_PLAN.md based on April 2026 research.

---

## Critical Changes (Will Break If Not Fixed)

### 1. Step 1: Expo Project Creation
**Old:** `npx create-expo-app taptribe --template blank-typescript`
**New:** `npx create-expo-app@latest --template default@sdk-55`
**Or better:** `yarn create expo-app --template @solana-mobile/solana-mobile-expo-template`
**Why:** SDK 55 is current. Solana Mobile template pre-configures polyfills and MWA.

### 2. Step 1: Node Version
**Old:** Node.js 18+
**New:** Node.js 20+ (18 is EOL)

### 3. Step 2: Polyfills
**Old:** `react-native-get-random-values`, `@craftzdog/react-native-buffer`, `react-native-url-polyfill`
**New:** `react-native-get-random-values` + `buffer` (standard npm package). The other two are likely not needed. The Solana Mobile template handles this automatically.

### 4. Step 4: Navigation
**Old:** React Navigation with `@react-navigation/native` + `@react-navigation/bottom-tabs`
**New:** Expo Router (file-based routing, built on React Navigation, included in SDK 55 by default)
**Impact:** Changes the entire app structure from manual screens to `app/` file-based routing.

### 5. Step 5: Anchor Version
**Old:** `avm install 0.30.1`
**New:** `avm install 0.32.1` (safe) or `avm install 1.0.0` (bleeding edge)
**Why:** 0.30.1 is 4 versions behind. IDL format changed. Rust 1.89.0+ now required.

### 6. Step 8: NFC Approach
**Old:** NDEF push / Android Beam approach
**New:** HCE via `react-native-hce` (broadcasting) + `react-native-nfc-manager` (reading)
**Why:** Android Beam was removed in Android 14. HCE is the only way for phone-to-phone NFC.
**New package:** `react-native-hce` (v0.3.0)

### 7. Step 10: Badge Minting
**Old:** Helius `mintCompressedNft` RPC call via simple `fetch()`
**New:** Bubblegum V2 + Umi SDK (`mintV2` from `@metaplex-foundation/mpl-bubblegum`)
**Why:** `mintCompressedNft` is officially deprecated.
**New step needed:** Create Merkle tree first (one-time setup before any mints).

### 8. Step 15: Build Command
**Old:** `npx expo build:android`
**New:** `eas build --platform android --profile preview`
**Why:** `expo build` was discontinued in January 2023. EAS Build is the replacement.

---

## Important Updates (Won't Break, But Should Fix)

### 9. Track Information
**Old:** "Tracks: Consumer Apps, Mobile Award"
**New:** Frontier has NO tracks. All projects compete in one pool.
**Impact:** Remove track references from the plan. Adjust strategy — no Mobile Award safety net.

### 10. Soulbound Badges (New Feature Opportunity)
Bubblegum V2 supports making cNFTs non-transferable. Add to Step 10:
- After minting badge, call `setNonTransferableV2()` to make it soulbound
- Strong pitch point: "Proof you actually met — can't be faked or transferred"

### 11. QR Code Fallback Package
**Old:** Not specified (just mentioned as "QR code fallback")
**New:** `expo-camera` (with `barcodeScannerSettings`) for scanning, `react-native-qrcode-svg` for display
**Do NOT use:** `expo-barcode-scanner` (deprecated, removed from SDK 51+)

### 12. Seeker Updates
**Old:** "Seeker at solanamobile.com, $450-500"
**New:** Seeker shipped Aug 2025, 1.2M+ activated, SMS 2.0 firmware. Genesis Token uses Token-2022 (not legacy SPL).

### 13. Anchor TypeScript Package
**Old:** Implicitly `@coral-xyz/anchor`
**New:** Still `@coral-xyz/anchor@0.32.1` (1.0.0 introduces `@anchor-lang/core` but it's too new)
**Critical:** Only compatible with `@solana/web3.js` v1. Do NOT upgrade to v2/kit.

### 14. Hackathon Prize Info
**Old:** Not detailed
**New:** Grand Champion $30K, 20 Standout Teams $10K each, accelerator $250K/team

---

## Updated Package Overview (app/ directory)

```json
{
  "dependencies": {
    "@coral-xyz/anchor": "^0.32.1",
    "@solana/web3.js": "^1.98.0",
    "@solana/spl-token": "^0.4.0",
    "@solana-mobile/mobile-wallet-adapter-protocol": "^2.2.7",
    "@solana-mobile/mobile-wallet-adapter-protocol-web3js": "^2.2.7",
    "@metaplex-foundation/umi-bundle-defaults": "latest",
    "@metaplex-foundation/mpl-bubblegum": "latest",
    "react-native-nfc-manager": "^3.17.2",
    "react-native-hce": "^0.3.0",
    "react-native-qrcode-svg": "latest",
    "react-native-svg": "latest",
    "react-native-get-random-values": "latest",
    "buffer": "latest",
    "expo-camera": "~(SDK 55 version)",
    "expo-dev-client": "~(SDK 55 version)"
  }
}
```

## Updated Project Structure

```
app/                             # Expo Router (file-based)
  _layout.tsx                        # Root layout
  (tabs)/
    _layout.tsx                      # Tab bar (Home, Tap, Badges, Profile)
    index.tsx                        # Home/Dashboard
    tap.tsx                          # NFC tap screen
    badges.tsx                       # Badge gallery
    profile.tsx                      # Profile view/edit
  create-profile.tsx                 # Onboarding
  connection/[id].tsx                # Connection detail
  event/[id].tsx                     # Event detail

src/hooks/
  useAnchorProgram.ts
  useNfcExchange.ts                  # NEW: HCE + NFC manager orchestration
  useProfile.ts
  useConnections.ts

src/services/
  solana.ts
  nfc.ts                             # Updated: HCE broadcast + NFC read
  badges.ts                          # Updated: Bubblegum V2 + Umi
  profiles.ts

src/context/
  AuthContext.tsx

src/types/
  index.ts

src/utils/
  constants.ts
  helpers.ts
```

---

## Updated Resources Section

### Replace/Add These Links

| Topic | Old Link | New/Updated Link |
|-------|---------|-----------------|
| Expo docs | create-a-project | docs.expo.dev (SDK 55) |
| EAS Build | N/A | docs.expo.dev/build/introduction |
| Expo Router | N/A | docs.expo.dev/router/introduction |
| Anchor | anchor-lang.com (0.30) | anchor-lang.com/docs (0.32.1+) |
| Bubblegum V2 | helius.dev mint API | developers.metaplex.com/smart-contracts/bubblegum-v2 |
| NFC HCE | N/A | github.com/appidea/react-native-hce |
| Solana Kit | solana-labs/solana-web3.js | github.com/anza-xyz/kit (for reference) |
| Surfpool | N/A | docs.surfpool.run |
