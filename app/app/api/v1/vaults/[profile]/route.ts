import { NextResponse } from "next/server";
import { getVaultByProfile } from "@/lib/mock-data";

export function GET(
  _req: Request,
  { params }: { params: Promise<{ profile: string }> },
) {
  return params.then(({ profile }) => {
    const vault = getVaultByProfile(profile);
    if (!vault) {
      return NextResponse.json({ error: "Vault not found" }, { status: 404 });
    }
    return NextResponse.json(vault);
  });
}
