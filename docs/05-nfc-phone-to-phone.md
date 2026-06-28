# NFC Phone-to-Phone Exchange — Implementation Guide (April 2026)

## The Problem

Android Beam (the old peer-to-peer NFC protocol) was deprecated in Android 10 and **fully removed in Android 14**. There is no built-in way to exchange data between two phones via NFC on modern Android.

## The Solution: Host Card Emulation (HCE)

One phone emulates an NFC tag (via HCE), the other phone reads it. Then they swap roles.

### Libraries Needed

| Library | Version | Role |
|---------|---------|------|
| `react-native-nfc-manager` | 3.17.2 | NFC **reading** (Phone B reads Phone A's data) |
| `react-native-hce` | 0.3.0 | NFC **broadcasting** via HCE (Phone A emulates a tag) |
| `expo-camera` | SDK 55 built-in | QR code scanning fallback |
| `react-native-qrcode-svg` | latest | QR code generation fallback |
| `react-native-svg` | latest | Peer dep of qrcode-svg |

```bash
npm install react-native-nfc-manager react-native-hce react-native-qrcode-svg react-native-svg
```

---

## How HCE Exchange Works

```
Phone A: HCE broadcasts pubkey as NDEF text → Phone B: NFC reader reads it
                                    ↓
Phone A detects "read" event → Roles swap
                                    ↓
Phone B: HCE broadcasts pubkey → Phone A: NFC reader reads it
                                    ↓
Both phones have each other's pubkey → Create Connection PDAs on-chain
```

**Simultaneous exchange is NOT possible.** One side must be the "tag" and the other the "reader." The sequential swap happens fast enough to feel near-instant.

---

## Code: Phone A — Broadcast via HCE

```typescript
import { HCESession, NFCTagType4, NFCTagType4NDEFContentType } from 'react-native-hce';

async function startBroadcast(myPubkey: string): Promise<HCESession> {
  const tag = new NFCTagType4({
    type: NFCTagType4NDEFContentType.Text,
    content: myPubkey,  // e.g. "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"
    writable: false,
  });

  const session = await HCESession.getInstance();
  session.setApplication(tag);
  await session.setEnabled(true);

  return session;
}

// Listen for when the other phone reads the tag
function onTagRead(session: HCESession, callback: () => void) {
  session.on(HCESession.Events.HCE_STATE_READ, callback);
}

// Stop broadcasting
async function stopBroadcast(session: HCESession) {
  await session.setEnabled(false);
}
```

---

## Code: Phone B — Read via NFC Manager

```typescript
import NfcManager, { NfcTech, Ndef } from 'react-native-nfc-manager';

async function initNfc() {
  await NfcManager.start();
}

async function readPubkey(): Promise<string | null> {
  try {
    await NfcManager.requestTechnology(NfcTech.Ndef);
    const tag = await NfcManager.getTag();

    if (tag?.ndefMessage && tag.ndefMessage.length > 0) {
      const record = tag.ndefMessage[0];
      const text = Ndef.text.decodePayload(
        new Uint8Array(record.payload)
      );
      return text; // the wallet pubkey string
    }
    return null;
  } catch (ex) {
    console.warn('NFC read failed:', ex);
    return null;
  } finally {
    NfcManager.cancelTechnologyRequest();
  }
}
```

---

## Full Tap Flow (Orchestrating Both Phones)

```typescript
// useNfcExchange.ts
import { useState, useCallback } from 'react';

type ExchangeState = 'idle' | 'broadcasting' | 'reading' | 'swapping' | 'complete' | 'error';

export function useNfcExchange(myPubkey: string) {
  const [state, setState] = useState<ExchangeState>('idle');
  const [otherPubkey, setOtherPubkey] = useState<string | null>(null);

  const startExchange = useCallback(async () => {
    try {
      // Phase 1: Broadcast my pubkey via HCE + simultaneously listen for reads
      setState('broadcasting');
      const session = await startBroadcast(myPubkey);

      // Also try to read the other phone's broadcast
      setState('reading');
      const received = await readPubkey();

      if (received) {
        setOtherPubkey(received);
        setState('complete');
        await stopBroadcast(session);
        return received;
      }

      // Phase 2: If we detected our tag was read, swap to reader mode
      setState('swapping');
      await stopBroadcast(session);
      const receivedAfterSwap = await readPubkey();

      if (receivedAfterSwap) {
        setOtherPubkey(receivedAfterSwap);
        setState('complete');
        return receivedAfterSwap;
      }

      setState('error');
      return null;
    } catch (err) {
      setState('error');
      return null;
    }
  }, [myPubkey]);

  return { state, otherPubkey, startExchange };
}
```

---

## Expo Configuration

### app.json / app.config.js
```json
{
  "expo": {
    "plugins": [
      ["react-native-nfc-manager", {
        "nfcPermission": "TapTribe needs NFC to exchange contact info",
        "selectIdentifiers": ["A0000002471001"],
        "systemCodes": ["8008"]
      }]
    ]
  }
}
```

The `react-native-nfc-manager` config plugin automatically:
- Adds `android.permission.NFC` to AndroidManifest.xml
- Adds `<uses-feature android:name="android.hardware.nfc" />` 
- Sets minimum Android SDK to 31

### react-native-hce (Manual Config Needed)

`react-native-hce` does NOT have a built-in Expo config plugin. After `npx expo prebuild`, verify that `android/app/src/main/AndroidManifest.xml` contains the HCE service declaration:

```xml
<service
    android:name="com.appidea.rnhce.services.CardService"
    android:exported="true"
    android:permission="android.permission.BIND_NFC_SERVICE">
    <intent-filter>
        <action android:name="android.nfc.cardemulation.action.HOST_APDU_SERVICE" />
    </intent-filter>
    <meta-data
        android:name="android.nfc.cardemulation.host_apdu_service"
        android:resource="@xml/apduservice" />
</service>
```

If missing, you'll need to add it manually or write a small Expo config plugin.

### NFC Feature: Set required="false"

Since you have a QR fallback, allow the app to install on non-NFC devices:
```xml
<uses-feature android:name="android.hardware.nfc" android:required="false" />
```

---

## QR Code Fallback (Essential)

### Why It's Required
- iOS **cannot** run HCE (Apple locks it down)
- Some Android phones lack NFC
- NFC can be flaky in crowded environments

### QR Scanner (expo-camera)
```typescript
import { CameraView, useCameraPermissions } from 'expo-camera';

function QRScanner({ onScan }: { onScan: (pubkey: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();

  if (!permission?.granted) {
    return <Button title="Grant Camera" onPress={requestPermission} />;
  }

  return (
    <CameraView
      style={{ flex: 1 }}
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={({ data }) => onScan(data)}
    />
  );
}
```

### QR Generator (react-native-qrcode-svg)
```typescript
import QRCode from 'react-native-qrcode-svg';

<QRCode value={walletPubkey} size={200} />
```

**Do NOT use `expo-barcode-scanner`** — it was deprecated and removed from SDK 51+.

---

## Detection Flow

```typescript
async function getExchangeMethod(): Promise<'nfc' | 'qr'> {
  const isSupported = await NfcManager.isSupported();
  const isEnabled = isSupported ? await NfcManager.isEnabled() : false;
  return isEnabled ? 'nfc' : 'qr';
}

// In TapScreen:
// if (method === 'nfc') → show "Ready to Tap" button
// if (method === 'qr') → show QR code + camera scanner
```

---

## Cross-Platform Reality

| Scenario | Works? | Notes |
|----------|--------|-------|
| Android ↔ Android | Full | HCE broadcast + NFC read, swap roles |
| Android → iPhone read | Partial | iPhone can READ Android's HCE tag, but can't broadcast back |
| iPhone ↔ iPhone | No NFC | QR only |

---

## Android Permissions

- `NFC` is a **normal permission** — granted at install, no runtime prompt
- `CAMERA` requires runtime permission (for QR fallback)
- No additional permissions needed for HCE

---

## Sources
- [react-native-nfc-manager](https://github.com/revtel/react-native-nfc-manager)
- [react-native-hce](https://github.com/appidea/react-native-hce)
- [Android HCE Overview](https://developer.android.com/develop/connectivity/nfc/hce)
- [Android NFC Docs](https://developer.android.com/develop/connectivity/nfc)
- [Expo Camera Docs](https://docs.expo.dev/versions/latest/sdk/camera/)
