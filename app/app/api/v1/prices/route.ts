import { NextResponse } from "next/server";
import { MOCK_PRICES } from "@/lib/mock-data";

export function GET() {
  const now = Math.floor(Date.now() / 1000);
  const prices = MOCK_PRICES.map((p) => ({
    ...p,
    price: p.price * (1 + (Math.random() - 0.5) * 0.001),
    ts: now,
  }));
  return NextResponse.json(prices);
}
