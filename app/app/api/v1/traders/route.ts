import { NextResponse } from "next/server";
import { MOCK_TRADERS_LIST } from "@/lib/mock-data";

export function GET() {
  return NextResponse.json(MOCK_TRADERS_LIST);
}
