import { NextResponse } from "next/server";
import { MOCK_TRADERS } from "@/lib/mock-data";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ profile: string }> },
) {
  const { profile } = await params;
  const result = await proxyToBackend(`/v1/vaults/${profile}/trades`);
  if (result?.ok) return NextResponse.json(result.data);

  const trader = MOCK_TRADERS.find((t) => t.profile === profile);
  if (!trader) {
    return NextResponse.json([], { status: 200 });
  }
  return NextResponse.json(trader.trades.slice(0, 50));
}
