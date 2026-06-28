import { TrendingUp, TrendingDown } from "lucide-react";

const items = [
  { sym: "SOL", price: "184.20", chg: "+2.41%", up: true },
  { sym: "BTC", price: "67,230", chg: "+0.82%", up: true },
  { sym: "ETH", price: "3,340.18", chg: "-0.34%", up: false },
  { sym: "JUP", price: "0.972", chg: "+5.12%", up: true },
  { sym: "JTO", price: "3.18", chg: "-1.05%", up: false },
  { sym: "PYTH", price: "0.412", chg: "+1.88%", up: true },
  { sym: "WIF", price: "2.81", chg: "+8.40%", up: true },
  { sym: "BONK", price: "0.0000241", chg: "-2.10%", up: false },
  { sym: "RAY", price: "2.04", chg: "+0.61%", up: true },
  { sym: "ORCA", price: "3.92", chg: "+1.22%", up: true },
];

const Row = () => (
  <div className="flex items-center gap-8 px-4 shrink-0">
    {items.map((i) => (
      <div key={i.sym} className="flex items-center gap-2 text-xs font-mono whitespace-nowrap">
        <span className="text-muted-foreground font-semibold">{i.sym}</span>
        <span className="tabular text-foreground">${i.price}</span>
        <span className={`tabular flex items-center gap-0.5 ${i.up ? "text-success" : "text-destructive"}`}>
          {i.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {i.chg}
        </span>
      </div>
    ))}
  </div>
);

/** Live-feel marquee ticker. Pure CSS animation, infinite loop. */
export const PriceTicker = () => {
  return (
    <div className="relative overflow-hidden border-y border-border bg-background-secondary/60 backdrop-blur-sm py-2.5">
      <div className="absolute left-0 top-0 bottom-0 w-20 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
      <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />
      <div className="flex animate-ticker">
        <Row />
        <Row />
      </div>
    </div>
  );
};
