import { NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? "";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  if (BACKEND_URL) {
    const upstream = await fetch(`${BACKEND_URL}/v1/waitlist/position?token=${token}`, {
      headers: { "Content-Type": "application/json" },
    });
    const data = await upstream.json();
    return NextResponse.json(data, { status: upstream.status });
  }

  return NextResponse.json({ position: 42 });
}
