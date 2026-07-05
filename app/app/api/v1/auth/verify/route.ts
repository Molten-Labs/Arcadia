/**
 * POST /api/v1/auth/verify — proxy to Rust backend or dev mock.
 *
 * With BACKEND_URL set, this proxies to the Rust API which does real
 * ed25519 + nonce verification against Redis.
 * Without BACKEND_URL, it returns a mock JWT-shaped token.
 */
import { NextResponse } from "next/server";
import { createHmac } from "crypto";

const BACKEND_URL = process.env.BACKEND_URL ?? "";
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

  // Proxy to Rust backend when configured
  if (BACKEND_URL) {
    try {
      const upstream = await fetch(`${BACKEND_URL}/v1/auth/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status });
    } catch {
      // fall through to mock
    }
  }

  // Build a deterministic, pubkey-scoped mock JWT-shaped token.
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
