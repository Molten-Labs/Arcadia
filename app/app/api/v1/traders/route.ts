import { NextResponse } from "next/server";
import { MOCK_TRADERS_LIST, MOCK_TRADERS } from "@/lib/mock-data";
import { proxyToBackend, shouldUseMockFallback } from "@/lib/backend-proxy";
import { transformTraderList } from "@/lib/backend-transform";

const HANDLE_MAP = Object.fromEntries(
  MOCK_TRADERS.map((t) => [t.handle, t])
);

export async function GET() {
  const result = await proxyToBackend("/v1/traders");
  if (result.kind === "ok" && result.ok) {
    const transformed = transformTraderList(
      Array.isArray(result.data) ? result.data : [],
     HANDLE_MAP,
    );
    return NextResponse.json(transformed);
  }
  if (shouldUseMockFallback(result)) {
    return NextResponse.json(MOCK_TRADERS_LIST);
  }
  // backend configured but returned an error — surface real (empty) state
  return NextResponse.json(
    { error: "Backend unavailable", details: result.kind === "error" ? result.message : undefined },
    { status: result.kind === "error" ? result.status : 502 },
  );
}