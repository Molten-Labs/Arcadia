import { NextResponse } from "next/server";
import { randomBytes } from "crypto";

export async function POST(req: Request) {
  const { pubkey } = await req.json().catch(() => ({}));
  if (!pubkey) {
    return NextResponse.json({ error: "Missing pubkey" }, { status: 400 });
  }
  const token = randomBytes(32).toString("hex");
  const expires_at = Math.floor(Date.now() / 1000) + 86400;
  return NextResponse.json({ token, wallet: pubkey, expires_at });
}
