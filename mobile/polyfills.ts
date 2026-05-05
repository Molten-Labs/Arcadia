import 'react-native-get-random-values';
import { Buffer } from 'buffer';

if (typeof global.Buffer === 'undefined') {
  global.Buffer = Buffer;
}

if (typeof (global as any).process === 'undefined') {
  (global as any).process = { env: {} };
}
