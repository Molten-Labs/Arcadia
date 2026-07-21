import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "";

export async function POST(req: Request) {
  const body = await req.text();

  if (BACKEND_URL) {
    const upstream = await fetch(`${BACKEND_URL}/v1/waitlist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  }

  const parsed = JSON.parse(body) as { email?: string };
  if (!parsed.email || !parsed.email.includes("@")) {
    return NextResponse.json({ error: { code: "BAD_REQUEST", message: "Invalid email" } }, { status: 400 });
  }

  const token = crypto.randomUUID();
  const code = crypto.randomUUID().slice(0, 8).toUpperCase();

  return NextResponse.json({
    ok: true,
    message: "Check your email to verify your address.",
    email: parsed.email,
    dev_token: token,
    referral_code: code,
  });
}
