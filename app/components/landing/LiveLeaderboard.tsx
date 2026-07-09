"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "@/lib/utils";
import { formatUSD, type TraderListItem } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Reveal } from "@/components/acid";
import { Container, Kicker, SectionHeading } from "./bits";
import { ORB_GRADIENT } from "./LogoMark";
import { LINKS, TIER_DOT, tierKey } from "./data";

const COLUMNS = ["#", "Trader", "Score", "Tier", "30d Return", "Vault Size", "Action"] as const;

function AvatarCell({ handle }: { handle: string }) {
  return (
    <span
      aria-hidden
      className="grid h-7 w-7 place-items-center rounded-lg font-display text-[0.72rem] font-extrabold text-void"
      style={{ background: ORB_GRADIENT }}
    >
      {handle.slice(0, 1).toUpperCase()}
    </span>
  );
}

/**
 * Live leaderboard. Fetches the shared /traders feed (backend proxy with a mock
 * fallback), shows the top six by score, and links each row into the app. Query
 * shape + routes preserved from the legacy landing.
 */
export function LiveLeaderboard() {
  const { data, isLoading } = useQuery<TraderListItem[]>({
    queryKey: ["traders"],
    queryFn: () => apiFetch<TraderListItem[]>("/traders"),
  });

  const topTraders = [...(data ?? [])].sort((a, b) => b.score - a.score).slice(0, 6);

  return (
    <section
      id="leaderboard"
      aria-label="Live leaderboard"
      className="border-y border-white/10 bg-onyx py-[clamp(5rem,12vw,10rem)]"
    >
      <Container>
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Kicker>Live Leaderboard</Kicker>
              <SectionHeading className="mt-4">The proven, ranked.</SectionHeading>
            </div>
            <Link
              href={LINKS.leaderboard}
              className="inline-flex items-center gap-1.5 font-mono text-[0.72rem] tracking-[0.12em] text-acid uppercase transition-colors hover:text-ink"
            >
              View full leaderboard <ArrowUpRight className="size-3.5" aria-hidden />
            </Link>
          </div>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-[clamp(2rem,4vw,3rem)] overflow-hidden rounded-[20px] border border-acid/20 bg-void/70">
            <Table className="min-w-[720px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {COLUMNS.map((col) => (
                    <TableHead
                      key={col}
                      className={col === "#" || col === "Trader" || col === "Tier" ? "" : "text-right"}
                    >
                      {col}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading || topTraders.length === 0
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={`sk-${i}`} className="hover:bg-transparent">
                        {COLUMNS.map((col) => (
                          <TableCell key={col}>
                            <Skeleton className="h-3.5 w-full" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  : topTraders.map((trader, idx) => {
                      const key = tierKey(trader.tier);
                      const positive = trader.return_30d >= 0;
                      return (
                        <TableRow key={trader.handle} className="group">
                          <TableCell className="text-faint tabular-nums transition-colors group-hover:text-acid motion-reduce:transition-none">
                            {String(idx + 1).padStart(2, "0")}
                          </TableCell>
                          <TableCell>
                            <Link
                              href={`/t/${trader.handle}`}
                              className="inline-flex items-center gap-2.5 text-ink transition-colors hover:text-acid"
                            >
                              <AvatarCell handle={trader.handle} />@{trader.handle}
                            </Link>
                          </TableCell>
                          <TableCell className="text-right font-bold text-acid tabular-nums">
                            {trader.score}
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-2">
                              <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${TIER_DOT[key]}`} />
                              <Badge variant={key}>{trader.tier}</Badge>
                            </span>
                          </TableCell>
                          <TableCell className={`text-right font-bold tabular-nums ${positive ? "text-success" : "text-danger"}`}>
                            {positive ? "+" : ""}
                            {trader.return_30d.toFixed(1)}%
                          </TableCell>
                          <TableCell className="text-right text-muted tabular-nums">
                            {formatUSD(trader.aum, 0)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Link
                              href={`/vault/${trader.handle}`}
                              aria-label={`View vault for @${trader.handle}`}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-acid/20 px-3 py-1.5 font-mono text-[0.72rem] tracking-[0.08em] text-acid uppercase transition-colors hover:bg-acid hover:text-void"
                            >
                              View vault <ArrowUpRight className="size-3.5" aria-hidden />
                            </Link>
                          </TableCell>
                        </TableRow>
                      );
                    })}
              </TableBody>
            </Table>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
