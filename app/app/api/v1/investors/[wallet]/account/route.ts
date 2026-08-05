import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await params;
  const authHeader = req.headers.get("authorization");
  const result = await proxyToBackend(`/v1/investors/${wallet}/account`, {
    authHeader,
  });
  if (result.kind === "ok" && result.ok) {
    return NextResponse.json(result.data, { status: result.status });
  }
  return NextResponse.json(
    { error: "Backend unavailable", details: result.kind === "error" ? result.message : undefined },
    { status: result.kind === "error" ? result.status : 503 },
  );
}