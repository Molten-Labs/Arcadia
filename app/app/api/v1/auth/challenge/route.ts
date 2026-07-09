/**
 * POST /api/v1/auth/challenge — proxy to the Rust backend, or dev mock.
 *
 * With BACKEND_URL set this proxies upstream (nonce lives in Redis there);
 * an upstream outage is a 502, never a silent mock fallback. Without
 * BACKEND_URL it mints an HMAC-signed, expiring nonce that only this
 * server's /verify will accept.
 */
import { NextResponse } from "next/server";
import { mintNonce } from "@/lib/server/dev-auth";

const BACKEND_URL = process.env.BACKEND_URL ?? "";

export async function POST() {
  if (BACKEND_URL) {
    try {
      const upstream = await fetch(`${BACKEND_URL}/v1/auth/challenge`, { method: "POST" });
      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status });
    } catch {
      return NextResponse.json({ error: "Auth backend unreachable" }, { status: 502 });
    }
  }

  return NextResponse.json(mintNonce());
}
