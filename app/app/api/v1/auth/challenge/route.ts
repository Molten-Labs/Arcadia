import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

const BACKEND_URL = process.env.BACKEND_URL ?? "";

export async function POST() {
  // Proxy to Rust backend when configured
  if (BACKEND_URL) {
    try {
      const upstream = await fetch(`${BACKEND_URL}/v1/auth/challenge`, { method: "POST" });
      const data = await upstream.json();
      return NextResponse.json(data, { status: upstream.status });
    } catch {
      // fall through to mock
    }
  }

  const nonce = randomBytes(16).toString("hex");
  const expires_at = Math.floor(Date.now() / 1000) + 300;
  return NextResponse.json({ nonce, expires_at });
}
