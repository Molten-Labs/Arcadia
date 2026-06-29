/**
 * POST /api/v1/auth/verify — dev mock for SIWS verification.
 *
 * Accepts the same shape as the Rust backend (pubkey, signature, nonce)
 * and returns a signed-looking token tied to the pubkey.
 * In production the request goes directly to the Rust API which does
 * real ed25519 + nonce verification.
 *
 * This mock does NOT cryptographically verify the signature — it is
 * intentionally a dev-only shortcut so the frontend can exercise the
 * full auth flow without running the Rust backend.
 */
import { NextResponse } from "next/server";
import { createHmac, randomBytes } from "crypto";

const DEV_SECRET = process.env.SESSION_SECRET ?? "arcadia-dev-secret";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({})) as {
    pubkey?: string;
    signature?: string;
    nonce?: string;
  };

  if (!body.pubkey || !body.signature || !body.nonce) {
    return NextResponse.json(
      { error: "Missing pubkey, signature, or nonce" },
      { status: 400 },
    );
  }

  // Build a deterministic, pubkey-scoped mock JWT-shaped token.
  // Format: <header>.<payload>.<sig>  (base64url encoded, not real JWT)
  const header  = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const now     = Math.floor(Date.now() / 1000);
  const payload = Buffer.from(
    JSON.stringify({ sub: body.pubkey, iat: now, exp: now + 86400 }),
  ).toString("base64url");
  const sig = createHmac("sha256", DEV_SECRET)
    .update(`${header}.${payload}`)
    .digest("base64url");

  const token = `${header}.${payload}.${sig}`;

  return NextResponse.json({ token, wallet: body.pubkey, expires_at: now + 86400 });
}
