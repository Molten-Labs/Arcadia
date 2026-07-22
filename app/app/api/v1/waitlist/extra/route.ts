import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "";

export async function POST(req: Request) {
  const body = await req.json();

  if (BACKEND_URL) {
    const upstream = await fetch(`${BACKEND_URL}/v1/waitlist/extra`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  }

  return NextResponse.json({ ok: true });
}
