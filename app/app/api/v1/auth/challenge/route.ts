import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function POST() {
  const nonce = randomBytes(16).toString("hex");
  const expires_at = Math.floor(Date.now() / 1000) + 300;
  return NextResponse.json({ nonce, expires_at });
}
