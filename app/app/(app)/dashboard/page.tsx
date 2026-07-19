"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useMe } from "@/lib/hooks";

/**
 * Dashboard was a mock-data page. Traders should use /manage for vault
 * management. This route redirects to /manage for traders, /portfolio for
 * investors.
 */
export default function DashboardRedirect() {
  const router = useRouter();
  const { data: me } = useMe();

  useEffect(() => {
    if (me?.role === "trader") {
      router.replace("/manage");
    } else if (me?.role === "investor") {
      router.replace("/portfolio");
    } else if (me !== undefined) {
      // not connected or no role resolved
      router.replace("/manage");
    }
  }, [me, router]);

  return null;
}
