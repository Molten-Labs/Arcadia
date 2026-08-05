import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";
import { transformTraderProfile } from "@/lib/backend-transform";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ handle: string }> },
) {
  const { handle } = await params;
  const authHeader = req.headers.get("authorization");
  const result = await proxyToBackend(`/v1/traders/${handle}`, { authHeader });
  if (result.kind === "ok" && result.ok) {
    const transformed = transformTraderProfile(result.data, handle);
    return NextResponse.json(transformed);
  }
  return NextResponse.json(
    { error: "Backend unavailable", details: result.kind === "error" ? result.message : undefined },
    { status: result.kind === "error" ? result.status : 503 },
  );
}