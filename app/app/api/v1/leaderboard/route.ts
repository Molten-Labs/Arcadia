import { NextResponse } from "next/server";
import { MOCK_LEADERBOARD } from "@/lib/mock-data";

export function GET() {
  return NextResponse.json(MOCK_LEADERBOARD);
}
