import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "";

export async function POST(req: Request) {
  const body = await req.text();

  if (BACKEND_URL) {
    const upstream = await fetch(`${BACKEND_URL}/v1/waitlist/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  }

  // Dev mode (no backend): pretend the Privy token proves the email.
  const parsed = JSON.parse(body) as { email?: string; privy_token?: string };
  if (!parsed.email || !parsed.privy_token) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Missing email or token" } }, { status: 400 });
  }

  return NextResponse.json({
    ok: true,
    email: parsed.email,
    email_verified: true,
    position: 1,
    referral_count: 0,
    tier: "Arcadian",
    fee_discount_pct: 0,
    benefits: ["Wave-1 onboarding priority"],
  });
}