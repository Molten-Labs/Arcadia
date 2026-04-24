# Expo + React Native — Latest State (April 2026)

## Expo SDK 55

Released as the current stable SDK. Ships with:
- **React Native 0.83**
- **React 19.2**
- **Expo Router v7** (file-based routing, included by default)
- **Node 20+ required** (Node 18 is EOL)

### Breaking Changes from the Build Plan

| Build Plan Assumed | Actual (April 2026) |
|---|---|
| `npx create-expo-app taptribe --template blank-typescript` | `npx create-expo-app@latest --template default@sdk-55` |
| `npx expo build:android` | **Dead since Jan 2023.** Use `eas build --platform android` |
| React Navigation for routing | Expo Router is now the default |
| App code in `src/screens/` manually | Use `app/` directory (file-based routing via Expo Router) |
| `newArchEnabled` toggle in app.json | **Removed.** New Architecture is mandatory |
| `react-native-get-random-values` | Still works, or use `expo-crypto` (SDK 49+) |

---

## Project Structure with Expo Router

```
app/
  _layout.tsx              # Root layout
  (tabs)/
    _layout.tsx            # Tab bar configuration (Home, Tap, Badges, Profile)
    index.tsx              # Home screen
    tap.tsx                # Tap screen (NFC exchange)
    badges.tsx             # Badge gallery
    profile.tsx            # Profile screen
  create-profile.tsx       # Onboarding
  connection/[id].tsx      # Connection detail
  event/[id].tsx           # Event detail
```

Files in `app/` automatically become routes. Layout files (`_layout.tsx`) define navigation structure. (A `src/app/` directory also works if you prefer the `src` convention.)

### Tab Layout Example

```typescript
// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: ({ color }) => <Ionicons name="home" size={24} color={color} /> }} />
      <Tabs.Screen name="tap" options={{ title: 'Tap', tabBarIcon: ({ color }) => <Ionicons name="radio" size={24} color={color} /> }} />
      <Tabs.Screen name="badges" options={{ title: 'Badges', tabBarIcon: ({ color }) => <Ionicons name="ribbon" size={24} color={color} /> }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile', tabBarIcon: ({ color }) => <Ionicons name="person" size={24} color={color} /> }} />
    </Tabs>
  );
}
```

---

## EAS Build (Replaces `expo build`)

### Setup
```bash
npm install -g eas-cli
eas login
eas build:configure   # creates eas.json
```

### eas.json
```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": {
        "gradleCommand": ":app:assembleDebug"
      }
    },
    "preview": {
      "distribution": "internal",
      "android": {
        "buildType": "apk"
      }
    },
    "production": {}
  }
}
```

### Build Commands
```bash
eas build --platform android --profile development     # dev build
eas build --platform android --profile preview          # APK for testing
eas build --platform android --profile production       # AAB for stores
eas build --platform android --profile preview --local  # local build (free, no cloud)
```

The `--local` flag builds on your machine — useful for hackathons (unlimited free builds).

---

## Development Builds (Required for NFC, MWA)

Expo Go does NOT support native modules. You need a development build:

```bash
npx expo install expo-dev-client
npx expo prebuild                  # generates android/ directory
npx expo run:android               # builds and runs on device
```

Rebuild only when native code changes. JS changes use fast refresh.

---

## React Native New Architecture

**Mandatory in SDK 55.** No opt-out. This is a non-issue for new projects — all major libraries support it:
- React Navigation 7.2+
- Reanimated 3.5.1+
- Gesture Handler 2.16.2+
- All Expo SDK 52+ packages

Performance: ~43% faster cold starts, ~39% faster rendering, ~26% lower memory.

---

## Android-Specific

### Android 15/16
- **Edge-to-edge enforced** — Expo SDK 55 handles this by default
- NFC APIs unchanged — `android.permission.NFC` still works
- No NFC permission changes

### Polyfills for Solana
```typescript
// Must be FIRST imports in your entry file
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
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

---

## Recommended: Use Solana Mobile Expo Template

Instead of a blank Expo project, use the pre-configured Solana Mobile template:

```bash
yarn create expo-app --template @solana-mobile/solana-mobile-expo-template
```

This pre-installs: `@solana/web3.js`, MWA packages, `@solana/spl-token`, polyfills, and includes reusable hooks and UI components.

**Important:** Use `yarn`, not `npm`/`pnpm` — Solana Mobile docs note issues with other package managers.

---

## Sources
- [Expo SDK 55 Changelog](https://expo.dev/changelog/sdk-55)
- [EAS Build Introduction](https://docs.expo.dev/build/introduction/)
- [Expo Router Introduction](https://docs.expo.dev/router/introduction/)
- [Development Builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Solana Mobile Expo Setup](https://docs.solanamobile.com/react-native/expo)
- [Solana Mobile Expo Template](https://docs.solanamobile.com/react-native/expo-dapp-template)
