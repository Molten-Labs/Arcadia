import { NextResponse } from "next/server";
import { MOCK_LEADERBOARD } from "@/lib/mock-data";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET() {
  const result = await proxyToBackend("/v1/leaderboard");
  if (result?.ok) return NextResponse.json(result.data);
  return NextResponse.json(MOCK_LEADERBOARD);
}
