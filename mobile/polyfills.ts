import { Buffer } from 'buffer';

// react-native-get-random-values patches crypto on native (iOS/Android).
// On web, browsers already have window.crypto.getRandomValues natively.
if (typeof document === 'undefined') {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('react-native-get-random-values');
}

if (typeof global.Buffer === 'undefined') {
  (global as any).Buffer = Buffer;
}

if (typeof (global as any).process === 'undefined') {
  (global as any).process = { env: {} };
}
