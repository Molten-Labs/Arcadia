import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";
import { transformLeaderboard } from "@/lib/backend-transform";

export async function GET() {
  const result = await proxyToBackend("/v1/leaderboard");
  if (result.kind === "ok" && result.ok) {
    const transformed = transformLeaderboard(result.data);
    return NextResponse.json(transformed);
  }
  return NextResponse.json(
    { error: "Backend unavailable", details: result.kind === "error" ? result.message : undefined },
    { status: result.kind === "error" ? result.status : 503 },
  );
}