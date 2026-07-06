import { NextResponse } from "next/server";
import { MOCK_LEADERBOARD, MOCK_TRADERS } from "@/lib/mock-data";
import { proxyToBackend } from "@/lib/backend-proxy";
import { transformLeaderboard } from "@/lib/backend-transform";

const HANDLE_MAP = Object.fromEntries(
  MOCK_TRADERS.map((t) => [t.handle, t])
);

export async function GET() {
  const result = await proxyToBackend("/v1/leaderboard");
  if (result?.ok) {
    const transformed = transformLeaderboard(result.data, HANDLE_MAP);
    return NextResponse.json(transformed);
  }
  return NextResponse.json(MOCK_LEADERBOARD);
}
