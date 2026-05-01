import { useMemo } from "react";

interface Row { price: number; size: number; total: number; }

const generate = (mid: number, side: "bid" | "ask", n: number): Row[] => {
  const rows: Row[] = [];
  let total = 0;
  for (let i = 0; i < n; i++) {
    const offset = (i + 1) * 0.18 * (side === "bid" ? -1 : 1);
    const price = +(mid + offset).toFixed(2);
    const size = +(Math.random() * 14 + 1).toFixed(2);
    total += size;
    rows.push({ price, size, total });
  }
  return rows;
};

export const OrderBook = ({ mid = 184.2 }: { mid?: number }) => {
  const bids = useMemo(() => generate(mid, "bid", 8), [mid]);
  const asks = useMemo(() => generate(mid, "ask", 8).reverse(), [mid]);
  const maxTotal = Math.max(...bids.map(b => b.total), ...asks.map(a => a.total));

  return (
    <div className="surface rounded-lg p-4 font-mono text-xs">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-display font-semibold text-sm">Order book</h3>
        <span className="text-xs text-muted-foreground uppercase tracking-wider">SOL/USDC</span>
      </div>
      <div className="grid grid-cols-3 text-xs text-muted-foreground uppercase tracking-wider pb-1.5 border-b border-border">
        <div>Price</div>
        <div className="text-right">Size</div>
        <div className="text-right">Total</div>
      </div>
      {/* Asks (top, reversed so highest is at top) */}
      <div className="py-1">
        {asks.map((r, i) => (
          <Row key={`a-${i}`} row={r} maxTotal={maxTotal} side="ask" />
        ))}
      </div>
      {/* Mid price */}
      <div className="text-center py-2 border-y border-border tabular">
        <span className="text-success text-base font-semibold">${mid.toFixed(2)}</span>
        <span className="text-xs text-muted-foreground ml-2">↑ 0.42%</span>
      </div>
      {/* Bids */}
      <div className="py-1">
        {bids.map((r, i) => (
          <Row key={`b-${i}`} row={r} maxTotal={maxTotal} side="bid" />
        ))}
      </div>
    </div>
  );
};

const Row = ({ row, maxTotal, side }: { row: Row; maxTotal: number; side: "bid" | "ask" }) => (
  <div className="grid grid-cols-3 py-0.5 relative">
    <div
      aria-hidden
      className={`absolute inset-y-0 right-0 ${side === "bid" ? "bg-success/10" : "bg-destructive/10"}`}
      style={{ width: `${(row.total / maxTotal) * 100}%` }}
    />
    <div className={`relative ${side === "bid" ? "text-success" : "text-destructive"}`}>{row.price.toFixed(2)}</div>
    <div className="relative text-right">{row.size.toFixed(2)}</div>
    <div className="relative text-right text-muted-foreground">{row.total.toFixed(2)}</div>
  </div>
);
