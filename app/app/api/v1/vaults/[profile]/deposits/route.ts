import { NextResponse } from "next/server";
import { proxyToBackend } from "@/lib/backend-proxy";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ profile: string }> },
) {
  const { profile } = await params;
  const authHeader = req.headers.get("authorization");
  const body = await req.json().catch(() => ({}));

  const result = await proxyToBackend(`/v1/vaults/${profile}/deposits`, {
    method: "PATCH",
    authHeader,
    body: JSON.stringify(body),
  });
  if (result.kind === "ok") {
    return NextResponse.json(result.data, { status: result.status });
  }
  return NextResponse.json({ error: "Failed to update deposits" }, { status: 502 });
}
