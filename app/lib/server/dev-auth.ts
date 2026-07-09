/**
 * Dev-mode SIWS verification — used ONLY when BACKEND_URL is unset.
 *
 * The Rust backend does the real thing (ed25519 + nonce in Redis). This
 * module gives the local mock the same security properties, statelessly:
 *
 * - Nonces are HMAC-signed with an expiry, so /verify only accepts nonces
 *   this server minted, unexpired, and unused (per-instance replay guard).
 * - The wallet signature is actually verified (ed25519 over the canonical
 *   SIWS message) before a session token is issued. No signature, no token.
 */
import {
  createHmac,
  createPublicKey,
  randomBytes,
  timingSafeEqual,
  verify as cryptoVerify,
} from "crypto";
import bs58 from "bs58";
import { buildSiwsMessage } from "../siws";

const DEV_SECRET = process.env.SESSION_SECRET ?? "arcadia-dev-secret";
const NONCE_TTL_S = 300;
const TOKEN_TTL_S = 86_400;

/* ── Nonce: `${exp}.${rand}.${mac}` (stateless, HMAC-bound) ─────────── */

function nonceMac(exp: string, rand: string): string {
  return createHmac("sha256", DEV_SECRET).update(`${exp}.${rand}`).digest("base64url");
}

export function mintNonce(): { nonce: string; expires_at: number } {
  const exp = Math.floor(Date.now() / 1000) + NONCE_TTL_S;
  const rand = randomBytes(16).toString("hex");
  return { nonce: `${exp}.${rand}.${nonceMac(String(exp), rand)}`, expires_at: exp };
}

/** Per-instance replay guard; entries expire with their nonce. */
const usedNonces = new Map<string, number>();

function pruneUsedNonces(now: number) {
  if (usedNonces.size < 512) return;
  for (const [nonce, exp] of usedNonces) {
    if (exp <= now) usedNonces.delete(nonce);
  }
}

export function consumeNonce(nonce: string): { ok: true } | { ok: false; reason: string } {
  const parts = nonce.split(".");
  if (parts.length !== 3) return { ok: false, reason: "Malformed nonce" };
  const [expStr, rand, mac] = parts;

  const expected = Buffer.from(nonceMac(expStr, rand));
  const provided = Buffer.from(mac);
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    return { ok: false, reason: "Invalid nonce" };
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp <= now) return { ok: false, reason: "Nonce expired" };

  if (usedNonces.has(nonce)) return { ok: false, reason: "Nonce already used" };
  pruneUsedNonces(now);
  usedNonces.set(nonce, exp);
  return { ok: true };
}

/* ── ed25519 signature check over the canonical SIWS message ────────── */

// DER prefix that wraps a raw 32-byte ed25519 public key as SPKI.
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

export function verifySiwsSignature(pubkey: string, signatureB58: string, nonce: string): boolean {
  let pubkeyBytes: Uint8Array;
  let sigBytes: Uint8Array;
  try {
    pubkeyBytes = bs58.decode(pubkey);
    sigBytes = bs58.decode(signatureB58);
  } catch {
    return false;
  }
  if (pubkeyBytes.length !== 32 || sigBytes.length !== 64) return false;

  const keyObject = createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(pubkeyBytes)]),
    format: "der",
    type: "spki",
  });
  const message = Buffer.from(buildSiwsMessage(pubkey, nonce), "utf8");
  return cryptoVerify(null, message, keyObject, Buffer.from(sigBytes));
}

/* ── Dev session token (HS256, JWT-shaped) ──────────────────────────── */

export function mintDevToken(pubkey: string): { token: string; expires_at: number } {
  const header = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now = Math.floor(Date.now() / 1000);
  const expires_at = now + TOKEN_TTL_S;
  const payload = Buffer.from(
    JSON.stringify({ sub: pubkey, iat: now, exp: expires_at }),
  ).toString("base64url");
  const sig = createHmac("sha256", DEV_SECRET).update(`${header}.${payload}`).digest("base64url");
  return { token: `${header}.${payload}.${sig}`, expires_at };
}
