import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const result = await proxyToBackend(`/v1/traders/${handle}/classification`);
  if (result.kind === "ok") {
    return NextResponse.json(result.data, { status: result.status });
  }
  return NextResponse.json({ error: "unavailable" }, { status: 503 });
}
