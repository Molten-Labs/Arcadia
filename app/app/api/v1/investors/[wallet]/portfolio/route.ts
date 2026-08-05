import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";
import { transformPortfolio } from "@/lib/backend-transform";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ wallet: string }> },
) {
  const { wallet } = await params;
  const authHeader = req.headers.get("authorization");
  const result = await proxyToBackend(`/v1/investors/${wallet}/portfolio`, {
    authHeader,
  });
  if (result.kind === "ok" && result.ok) {
    const transformed = transformPortfolio(
      Array.isArray(result.data) ? result.data : [],
    );
    return NextResponse.json(transformed);
  }
  return NextResponse.json(
    { error: "Backend unavailable", details: result.kind === "error" ? result.message : undefined },
    { status: result.kind === "error" ? result.status : 503 },
  );
}