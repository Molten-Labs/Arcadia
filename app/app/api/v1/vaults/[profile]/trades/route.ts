import { NextResponse } from "next/server";
import { MOCK_TRADERS } from "@/lib/mock-data";
import { proxyToBackend, shouldUseMockFallback } from "@/lib/backend-proxy";
import { transformVaultTrades } from "@/lib/backend-transform";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ profile: string }> },
) {
  const { profile } = await params;
  const result = await proxyToBackend(`/v1/vaults/${profile}/trades`);
  if (result.kind === "ok" && result.ok) {
    const transformed = transformVaultTrades(
      Array.isArray(result.data) ? result.data : [],
      profile,
    );
    return NextResponse.json(transformed);
  }
  if (shouldUseMockFallback(result)) {
    const trader = MOCK_TRADERS.find((t) => t.profile === profile);
    if (!trader) {
      return NextResponse.json([], { status: 200 });
    }
    return NextResponse.json(trader.trades.slice(0, 50));
  }
  return NextResponse.json([], { status: 200 });
}