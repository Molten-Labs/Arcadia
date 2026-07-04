import { NextResponse } from "next/server";
import { getTraderByHandle } from "@/lib/mock-data";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const result = await proxyToBackend(`/v1/traders/${handle}`);
  if (result) return NextResponse.json(result.data, { status: result.status });

  const trader = getTraderByHandle(handle);
  if (!trader) {
    return NextResponse.json({ error: "Trader not found" }, { status: 404 });
  }
  return NextResponse.json(trader);
}
