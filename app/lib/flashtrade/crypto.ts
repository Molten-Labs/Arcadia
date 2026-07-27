import crypto from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const PBKDF2_ITERATIONS = 600_000;
const PBKDF2_DIGEST = "sha512";

function getMasterKey(): Buffer {
  const secret = process.env.AGENT_WALLET_MASTER_PASSWORD;
  if (!secret) {
    throw new Error("AGENT_WALLET_MASTER_PASSWORD is not set");
  }
  return crypto.scryptSync(secret, "arcadia-execution-wallet-v1", KEY_LENGTH);
}

export function encryptExecutionWalletSecret(secret: Uint8Array): {
  encryptedPrivateKey: string;
  encryptionSalt: string;
} {
  const masterKey = getMasterKey();
  const salt = crypto.randomBytes(32);
  const key = crypto.pbkdf2Sync(
    masterKey,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    PBKDF2_DIGEST,
  );
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(secret)),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  const payload = Buffer.concat([iv, tag, encrypted]);
  return {
    encryptedPrivateKey: payload.toString("base64"),
    encryptionSalt: salt.toString("base64"),
  };
}

export function decryptExecutionWalletSecret(args: {
  encryptedPrivateKey: string;
  encryptionSalt: string;
}): Uint8Array {
  const masterKey = getMasterKey();
  const salt = Buffer.from(args.encryptionSalt, "base64");
  const key = crypto.pbkdf2Sync(
    masterKey,
    salt,
    PBKDF2_ITERATIONS,
    KEY_LENGTH,
    PBKDF2_DIGEST,
  );
  const payload = Buffer.from(args.encryptedPrivateKey, "base64");
  const iv = payload.subarray(0, IV_LENGTH);
  const tag = payload.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const data = payload.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
}
