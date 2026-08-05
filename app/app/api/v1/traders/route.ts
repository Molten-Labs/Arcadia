import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";
import { transformTraderList } from "@/lib/backend-transform";

export async function GET() {
  const result = await proxyToBackend("/v1/traders");
  if (result.kind === "ok" && result.ok) {
    const transformed = transformTraderList(
      Array.isArray(result.data) ? result.data : [],
    );
    return NextResponse.json(transformed);
  }
  return NextResponse.json(
    { error: "Backend unavailable", details: result.kind === "error" ? result.message : undefined },
    { status: result.kind === "error" ? result.status : 503 },
  );
}