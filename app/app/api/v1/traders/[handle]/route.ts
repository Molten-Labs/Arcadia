import { NextResponse } from "next/server";
import { getTraderByHandle } from "@/lib/mock-data";
import { proxyToBackend, shouldUseMockFallback } from "@/lib/backend-proxy";
import { transformTraderProfile } from "@/lib/backend-transform";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const result = await proxyToBackend(`/v1/traders/${handle}`);
  if (result.kind === "ok" && result.ok) {
    const transformed = transformTraderProfile(
      result.data,
      handle,
      getTraderByHandle(handle) ?? undefined,
    );
    return NextResponse.json(transformed);
  }
  if (shouldUseMockFallback(result)) {
    const trader = getTraderByHandle(handle);
    if (!trader) {
      return NextResponse.json({ error: "Trader not found" }, { status: 404 });
    }
    return NextResponse.json(trader);
  }
  // backend configured but errored — surface real state
  return NextResponse.json(
    { error: "Backend unavailable", details: result.kind === "error" ? result.message : undefined },
    { status: result.kind === "error" ? result.status : 502 },
  );
}