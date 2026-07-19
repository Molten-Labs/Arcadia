import { NextResponse } from "next/server";
import { MOCK_PRICES } from "@/lib/mock-data";
import { proxyToBackend, shouldUseMockFallback } from "@/lib/backend-proxy";

export async function GET() {
  const result = await proxyToBackend("/v1/prices");
  if (result.kind === "ok" && result.ok) {
    // Backend returns a map keyed by symbol (or {} when no prices yet);
    // pass it through to clients that can handle either shape.
    return NextResponse.json(result.data);
  }
  if (shouldUseMockFallback(result)) {
    const now = Math.floor(Date.now() / 1000);
    const prices = MOCK_PRICES.map((p) => ({
      ...p,
      price: p.price * (1 + (Math.random() - 0.5) * 0.001),
      ts: now,
    }));
    return NextResponse.json(prices);
  }
  // backend configured but returned an error — return empty price map
  return NextResponse.json({}, { status: result.kind === "error" ? result.status : 502 });
}