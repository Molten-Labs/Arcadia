"use client";

import { Activity, X } from "lucide-react";

import { MicroLabel } from "@/components/pages/trader/trader-ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatUSD } from "@/lib/types";
import type { OpenPosition, PriceData } from "@/lib/types";
import { fmtPx } from "./PaperTradeMarketBar";

/**
 * Simulated open-positions table. uPnL is recomputed upstream from the polled
 * price feed; this panel only renders it. Presentational (no data hooks).
 */
export function PaperTradePositions({
  positions,
  prices,
  closingId,
  onClose,
}: {
  positions: OpenPosition[];
  prices?: PriceData[];
  closingId: string | null;
  onClose: (id: string) => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-panel">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <MicroLabel>Open positions ({positions.length})</MicroLabel>
        <Badge variant="secondary">Paper trading</Badge>
      </div>

      {positions.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-14">
          <Activity size={20} className="text-faint opacity-50" />
          <p className="text-xs text-faint">No open positions</p>
          <p className="text-[0.7rem] text-faint/70">
            Simulated fills only. Open a position to see live uPnL.
          </p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Market</TableHead>
              <TableHead>Side</TableHead>
              <TableHead className="text-right">Size</TableHead>
              <TableHead className="text-right">Lev</TableHead>
              <TableHead className="text-right">Entry</TableHead>
              <TableHead className="text-right">Mark</TableHead>
              <TableHead className="text-right">uPnL</TableHead>
              <TableHead className="text-right">Close</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map((pos) => {
              const isLong = pos.direction === "long";
              const upnl = pos.upnl ?? 0;
              const up = upnl >= 0;
              const mark = prices?.find((p) => p.market === pos.market)?.price;
              const closing = closingId === pos.id;
              return (
                <TableRow key={pos.id} className="group">
                  <TableCell className="font-semibold text-ink">{pos.market}</TableCell>
                  <TableCell>
                    <Badge variant={isLong ? "success" : "danger"}>
                      {isLong ? "▲ Long" : "▼ Short"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted transition-colors group-hover:text-ink motion-reduce:transition-none">
                    {formatUSD(pos.size_usd, 0)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-acid">
                    {pos.leverage}x
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted transition-colors group-hover:text-ink motion-reduce:transition-none">
                    {fmtPx(pos.market, pos.entry_px)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-ink">
                    {mark != null ? fmtPx(pos.market, mark) : "-"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold tabular-nums ${
                      up ? "text-success" : "text-danger"
                    }`}
                  >
                    {up ? "+" : ""}
                    {formatUSD(upnl, 0)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => onClose(pos.id)}
                      disabled={closing}
                      aria-label={`Close ${pos.direction} ${pos.market} position`}
                    >
                      <X />
                      {closing ? "Closing..." : "Close"}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
