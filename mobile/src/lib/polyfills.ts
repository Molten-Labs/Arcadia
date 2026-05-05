import { Buffer } from 'buffer';

// react-native-get-random-values patches crypto.getRandomValues on native.
// On web, browsers already provide window.crypto.getRandomValues natively.
const isWeb = typeof document !== 'undefined';
if (!isWeb) {
  require('react-native-get-random-values');
}

if (typeof global.Buffer === 'undefined') {
  (global as any).Buffer = Buffer;
}

if (typeof (global as any).process === 'undefined') {
  (global as any).process = { env: {} };
}
