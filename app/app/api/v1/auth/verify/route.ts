/**
 * POST /api/v1/auth/verify — proxy to the Rust backend, or dev verification.
 *
 * With BACKEND_URL set this proxies upstream (real ed25519 + Redis nonce);
 * an upstream outage is a 502, never a silent mock fallback. Without
 * BACKEND_URL the dev path still verifies for real: HMAC-signed nonce
 * (unexpired, unused) + ed25519 signature over the canonical SIWS message.
 * A session token is only ever minted for a pubkey that proved key ownership.
 */
import { NextResponse } from "next/server";
import { consumeNonce, mintDevToken, verifySiwsSignature } from "@/lib/server/dev-auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
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
      return NextResponse.json({ error: "Auth backend unreachable" }, { status: 502 });
    }
  }

  const nonceCheck = consumeNonce(body.nonce);
  if (!nonceCheck.ok) {
    return NextResponse.json({ error: nonceCheck.reason }, { status: 401 });
  }

  if (!verifySiwsSignature(body.pubkey, body.signature, body.nonce)) {
    return NextResponse.json({ error: "Signature verification failed" }, { status: 401 });
  }

  const { token, expires_at } = mintDevToken(body.pubkey);
  return NextResponse.json({ token, wallet: body.pubkey, expires_at });
}
