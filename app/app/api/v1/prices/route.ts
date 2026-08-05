import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET() {
  const result = await proxyToBackend("/v1/prices");
  if (result.kind === "ok" && result.ok) {
    // Backend returns a map keyed by symbol (or {} when no prices yet);
    // pass it through to clients that can handle either shape.
    return NextResponse.json(result.data);
  }
  return NextResponse.json(
    { error: "Backend unavailable", details: result.kind === "error" ? result.message : undefined },
    { status: result.kind === "error" ? result.status : 503 },
  );
}