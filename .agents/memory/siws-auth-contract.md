---
name: SIWS auth contract
description: Canonical SIWS message format, payload encoding, and how Next.js mock vs Rust backend split works for Arcadia auth.
---

## Canonical SIWS message (must match Rust `siws_message()` in auth.rs)
```
Arcadia wants you to sign in with your Solana account:
{pubkey}

Nonce: {nonce}
```
The frontend builds this exact string, signs its bytes, and sends the signature.

## Verify payload shape (`VerifyReq` in Rust auth.rs)
```json
{ "pubkey": "base58...", "signature": "base58...", "nonce": "base58..." }
```
- Signature must be base58 encoded (use `bs58.encode(sigBytes)`)
- Nonce comes from the challenge endpoint response `{ nonce: string }`
- Do NOT send the full message text — send only the nonce

## Challenge response shape
```json
{ "nonce": "base58nonce" }
```
Rust also stores nonce TTL in Redis. The Next.js mock challenge route just returns a random nonce without Redis.

## Token response
```json
{ "token": "jwt..." }
```
JWT claims: `{ sub: pubkey, iat, exp }`

## Next.js mock vs Rust backend
- Frontend calls `/api/v1/auth/challenge` and `/api/v1/auth/verify` (Next.js routes)
- Next.js verify route (`app/app/api/v1/auth/verify/route.ts`) is a dev mock — accepts the correct shape but does not cryptographically verify the Ed25519 signature; issues an HMAC-signed mock token
- Real Rust backend (`server-rs/crates/api/src/auth.rs`) does full Ed25519 verification + nonce consumption from Redis
- When `BACKEND_URL` is set, proxy the auth calls to Rust; otherwise use Next.js mock

## Wallet-switch session integrity
- On wallet change, `use-auth.ts` compares `publicKey.toBase58()` against `localStorage.getItem("arcadia_wallet")`
- If they differ, clear both `arcadia_jwt` and `arcadia_wallet` from localStorage immediately
- `apiFetch` reads token from localStorage — stale credentials must not survive wallet disconnect

**Why:** Code review caught that the original implementation only cleared in-memory state, leaving the localStorage token pointing to the old wallet.
