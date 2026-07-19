import { NextResponse } from "next/server";
import { proxyToBackend, shouldUseMockFallback } from "@/lib/backend-proxy";
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
  if (shouldUseMockFallback(result)) {
    return NextResponse.json([
      {
        profile: "ArcVlt1NovaXKJH3fZpJGJPmoLdWCqJrNnUjPrDDzEa",
        trader_handle: "nova",
        shares: 1200,
        value_usd: 7080,
        cost_basis_usd: 6000,
        pnl_usd: 1080,
        roi_pct: 18.0,
      },
      {
        profile: "ArcVlt2VegaYKJH3fZpJGJPmoLdWCqJrNnUjPrDDzEb",
        trader_handle: "vega",
        shares: 800,
        value_usd: 6460,
        cost_basis_usd: 6000,
        pnl_usd: 460,
        roi_pct: 7.67,
      },
    ]);
  }
  // backend configured but returned non-OK — return empty portfolio
  return NextResponse.json(
    [],
    { status: result.kind === "error" ? result.status : 502 },
  );
}