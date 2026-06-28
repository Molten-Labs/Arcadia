import { Buffer } from "buffer";

const globalScope = globalThis as typeof globalThis & {
  Buffer?: typeof Buffer;
  global?: typeof globalThis;
  process?: { env: Record<string, string | undefined>; browser?: boolean };
};

globalScope.Buffer = Buffer;
globalScope.global = globalThis;
globalScope.process = globalScope.process ?? { env: {}, browser: true };
globalScope.process.env = globalScope.process.env ?? {};
globalScope.process.browser = true;

if (typeof window !== "undefined") {
  const windowScope = window as Window & {
    Buffer?: typeof Buffer;
    global?: typeof globalThis;
    process?: typeof globalScope.process;
  };

  windowScope.Buffer = Buffer;
  windowScope.global = globalThis;
  windowScope.process = globalScope.process;
}
