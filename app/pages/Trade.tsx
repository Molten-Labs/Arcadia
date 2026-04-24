import { useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { CandlestickChart } from "@/components/CandlestickChart";
import { OrderBook } from "@/components/OrderBook";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ArrowDownUp, Check, Star, TrendingUp, TrendingDown, Zap, AlertTriangle } from "lucide-react";
import { fmtUSD } from "@/lib/format";
import { toast } from "sonner";
import { useWallet } from "@/lib/wallet";
import { Link } from "react-router-dom";

interface Market {
  pair: string;
  base: string;
  price: number;
  change24h: number;
  vol24h: number;
  high24h: number;
  low24h: number;
}

const MARKETS: Market[] = [
  { pair: "SOL/USDC", base: "SOL", price: 184.23, change24h: 2.4, vol24h: 124_500_000, high24h: 188.4, low24h: 178.2 },
  { pair: "BTC/USDC", base: "BTC", price: 67_812.10, change24h: 1.1, vol24h: 980_400_000, high24h: 68_200, low24h: 66_900 },
  { pair: "ETH/USDC", base: "ETH", price: 3_342.85, change24h: -0.8, vol24h: 412_800_000, high24h: 3_402, low24h: 3_298 },
  { pair: "JUP/USDC", base: "JUP", price: 0.86, change24h: 5.2, vol24h: 18_400_000, high24h: 0.91, low24h: 0.79 },
  { pair: "WIF/USDC", base: "WIF", price: 2.14, change24h: -3.4, vol24h: 32_100_000, high24h: 2.28, low24h: 2.04 },
  { pair: "BONK/USDC", base: "BONK", price: 0.000023, change24h: 8.1, vol24h: 14_200_000, high24h: 0.000025, low24h: 0.000020 },
];

const MOCK_POSITIONS = [
  { pair: "SOL/USDC", side: "long" as const, size: 1240, entry: 178.4, mark: 184.23, pnl: 7_223, pnlPct: 3.27 },
  { pair: "ETH/USDC", side: "short" as const, size: 18, entry: 3_380, mark: 3_342.85, pnl: 668, pnlPct: 1.10 },
];

const MOCK_OPEN_ORDERS = [
  { id: "o1", time: "14:22:11", pair: "SOL/USDC", side: "buy", type: "limit", size: 200, price: 180.0, filled: 0 },
  { id: "o2", time: "13:48:02", pair: "BTC/USDC", side: "sell", type: "limit", size: 0.4, price: 68_000, filled: 0.1 },
];

const MOCK_HISTORY = [
  { id: "h1", time: "Apr 22 · 14:22", pair: "SOL/USDC", side: "buy", size: 1200, price: 184.20, fee: 4.2 },
  { id: "h2", time: "Apr 22 · 09:11", pair: "ETH/USDC", side: "sell", size: 18, price: 3340, fee: 8.1 },
  { id: "h3", time: "Apr 21 · 16:48", pair: "SOL/USDC", side: "buy", size: 800, price: 178.6, fee: 2.9 },
];

const Trade = () => {
  const { connected, role } = useWallet();
  const [market, setMarket] = useState<Market>(MARKETS[0]);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [orderType, setOrderType] = useState<"market" | "limit">("limit");
  const [tab, setTab] = useState<"positions" | "orders" | "history">("positions");
  const [amount, setAmount] = useState("");
  const [price, setPrice] = useState("");
  const [pctSlider, setPctSlider] = useState(0);

  const usdcBalance = 28_450.32;
  const baseBalance = 12.4;

  const total = useMemo(() => {
    const a = parseFloat(amount) || 0;
    const p = orderType === "market" ? market.price : (parseFloat(price) || market.price);
    return a * p;
  }, [amount, price, orderType, market]);

  const handleSubmit = () => {
    if (!connected) {
      toast.error("Connect a wallet first");
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Enter an amount");
      return;
    }
    toast.success(`${side.toUpperCase()} ${orderType} order submitted`, {
      description: `${amount} ${market.base} @ ${orderType === "market" ? "market" : `$${price || market.price}`}`,
    });
    setAmount("");
    setPrice("");
    setPctSlider(0);
  };

  const applyPct = (pct: number) => {
    setPctSlider(pct);
    if (side === "buy") {
      const usd = (usdcBalance * pct) / 100;
      const p = orderType === "market" ? market.price : (parseFloat(price) || market.price);
      setAmount((usd / p).toFixed(market.base === "BONK" ? 0 : 4));
    } else {
      setAmount(((baseBalance * pct) / 100).toFixed(4));
    }
  };

  return (
    <Layout>
      {role === "investor" && connected && (
        <div className="border-b border-border bg-info/5">
          <div className="container py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-info">
              <AlertTriangle className="w-3.5 h-3.5" />
              You're in <strong>investor mode</strong>. Switch to trader to place orders, or browse vaults to deposit.
            </div>
            <Link to="/vaults" className="text-primary hover:underline">Browse vaults →</Link>
          </div>
        </div>
      )}

      {/* Top market strip */}
      <div className="border-b border-border bg-card/40 backdrop-blur sticky top-16 z-30">
        <div className="container py-3 flex items-center gap-6 overflow-x-auto">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-full bg-gradient-ember flex items-center justify-center text-white font-bold text-xs">
              {market.base.slice(0, 3)}
            </div>
            <div>
              <div className="font-display font-semibold text-sm">{market.pair}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Solana · Spot</div>
            </div>
          </div>
          <Stat label="Price" value={`$${market.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}`} highlight={market.change24h >= 0 ? "up" : "down"} />
          <Stat label="24h change" value={`${market.change24h >= 0 ? "+" : ""}${market.change24h.toFixed(2)}%`} highlight={market.change24h >= 0 ? "up" : "down"} />
          <Stat label="24h high" value={`$${market.high24h.toLocaleString()}`} />
          <Stat label="24h low" value={`$${market.low24h.toLocaleString()}`} />
          <Stat label="24h volume" value={`$${fmtUSD(market.vol24h, { compact: true })}`} />
        </div>
      </div>

      <div className="container py-4">
        <div className="grid grid-cols-12 gap-3">
          {/* Markets list */}
          <aside className="col-span-12 lg:col-span-2 surface rounded-xl p-3 max-h-[640px] overflow-auto">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-1 pb-2">Markets</div>
            <div className="space-y-0.5">
              {MARKETS.map(m => (
                <button
                  key={m.pair}
                  onClick={() => setMarket(m)}
                  className={cn(
                    "w-full grid grid-cols-[1fr_auto] gap-2 px-2 py-2 rounded-md text-left text-xs transition-colors",
                    m.pair === market.pair ? "bg-secondary" : "hover:bg-secondary/60"
                  )}
                >
                  <div>
                    <div className="font-medium flex items-center gap-1">
                      <Star className="w-3 h-3 text-muted-foreground" />
                      {m.pair}
                    </div>
                    <div className="text-[10px] text-muted-foreground tabular">${m.price.toLocaleString(undefined, { maximumFractionDigits: 6 })}</div>
                  </div>
                  <div className={cn("text-[11px] tabular self-center", m.change24h >= 0 ? "text-success" : "text-destructive")}>
                    {m.change24h >= 0 ? "+" : ""}{m.change24h.toFixed(1)}%
                  </div>
                </button>
              ))}
            </div>
          </aside>

          {/* Chart + bottom panels */}
          <main className="col-span-12 lg:col-span-7 space-y-3">
            <div className="surface rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-1">
                  {["1m", "5m", "15m", "1h", "4h", "1D"].map(tf => (
                    <button key={tf} className={cn("px-2.5 py-1 rounded-md text-[11px] font-medium", tf === "15m" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}>
                      {tf}
                    </button>
                  ))}
                </div>
                <div className="text-[11px] text-muted-foreground font-mono">
                  O <span className="text-foreground">181.40</span> · H <span className="text-foreground">186.20</span> · L <span className="text-foreground">179.10</span> · C <span className="text-success">184.23</span>
                </div>
              </div>
              <CandlestickChart count={64} height={380} />
            </div>

            {/* Bottom tabs: positions / orders / history */}
            <div className="surface rounded-xl">
              <div className="flex items-center border-b border-border px-3">
                {(["positions", "orders", "history"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      "px-4 py-3 text-xs font-medium uppercase tracking-wider transition-colors relative",
                      tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t}
                    {tab === t && <span className="absolute bottom-0 left-2 right-2 h-px bg-primary" />}
                  </button>
                ))}
              </div>
              <div className="p-3 overflow-auto">
                {tab === "positions" && (
                  <table className="w-full text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr><th className="text-left py-1.5">Pair</th><th className="text-left">Side</th><th className="text-right">Size</th><th className="text-right">Entry</th><th className="text-right">Mark</th><th className="text-right">PnL</th><th /></tr>
                    </thead>
                    <tbody className="font-mono">
                      {MOCK_POSITIONS.map(p => (
                        <tr key={p.pair} className="border-t border-border/50">
                          <td className="py-2.5 font-display">{p.pair}</td>
                          <td className={cn("font-semibold", p.side === "long" ? "text-success" : "text-destructive")}>{p.side.toUpperCase()}</td>
                          <td className="text-right">{p.size.toLocaleString()}</td>
                          <td className="text-right">${p.entry.toLocaleString()}</td>
                          <td className="text-right">${p.mark.toLocaleString()}</td>
                          <td className={cn("text-right", p.pnl >= 0 ? "text-success" : "text-destructive")}>
                            {p.pnl >= 0 ? "+" : ""}${p.pnl.toLocaleString()} <span className="text-[10px] opacity-70">({p.pnlPct >= 0 ? "+" : ""}{p.pnlPct.toFixed(2)}%)</span>
                          </td>
                          <td className="text-right">
                            <Button size="sm" variant="ghost" className="h-7 text-[11px]">Close</Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {tab === "orders" && (
                  <table className="w-full text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr><th className="text-left py-1.5">Time</th><th className="text-left">Pair</th><th className="text-left">Side</th><th className="text-left">Type</th><th className="text-right">Size</th><th className="text-right">Price</th><th className="text-right">Filled</th><th /></tr>
                    </thead>
                    <tbody className="font-mono">
                      {MOCK_OPEN_ORDERS.map(o => (
                        <tr key={o.id} className="border-t border-border/50">
                          <td className="py-2.5">{o.time}</td>
                          <td className="font-display">{o.pair}</td>
                          <td className={cn("uppercase font-semibold", o.side === "buy" ? "text-success" : "text-destructive")}>{o.side}</td>
                          <td className="capitalize">{o.type}</td>
                          <td className="text-right">{o.size}</td>
                          <td className="text-right">${o.price.toLocaleString()}</td>
                          <td className="text-right">{o.filled}</td>
                          <td className="text-right"><Button size="sm" variant="ghost" className="h-7 text-[11px] text-destructive">Cancel</Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
                {tab === "history" && (
                  <table className="w-full text-xs">
                    <thead className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      <tr><th className="text-left py-1.5">Time</th><th className="text-left">Pair</th><th className="text-left">Side</th><th className="text-right">Size</th><th className="text-right">Price</th><th className="text-right">Fee</th></tr>
                    </thead>
                    <tbody className="font-mono">
                      {MOCK_HISTORY.map(h => (
                        <tr key={h.id} className="border-t border-border/50">
                          <td className="py-2.5">{h.time}</td>
                          <td className="font-display">{h.pair}</td>
                          <td className={cn("uppercase font-semibold", h.side === "buy" ? "text-success" : "text-destructive")}>{h.side}</td>
                          <td className="text-right">{h.size}</td>
                          <td className="text-right">${h.price.toLocaleString()}</td>
                          <td className="text-right text-muted-foreground">${h.fee.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </main>

          {/* Right: order book + ticket */}
          <aside className="col-span-12 lg:col-span-3 space-y-3">
            <OrderBook mid={market.price < 1000 ? market.price : 184.23} />

            {/* Order ticket */}
            <div className="surface rounded-xl p-4">
              {/* Side toggle */}
              <div className="grid grid-cols-2 p-1 rounded-lg bg-secondary/60 mb-3">
                <button
                  onClick={() => setSide("buy")}
                  className={cn("py-2 rounded-md text-xs font-semibold uppercase transition-all", side === "buy" ? "bg-success text-white shadow-sm" : "text-muted-foreground")}
                >
                  <TrendingUp className="w-3.5 h-3.5 inline mr-1" /> Buy
                </button>
                <button
                  onClick={() => setSide("sell")}
                  className={cn("py-2 rounded-md text-xs font-semibold uppercase transition-all", side === "sell" ? "bg-destructive text-white shadow-sm" : "text-muted-foreground")}
                >
                  <TrendingDown className="w-3.5 h-3.5 inline mr-1" /> Sell
                </button>
              </div>

              {/* Type toggle */}
              <div className="flex items-center gap-1 mb-3">
                {(["limit", "market"] as const).map(t => (
                  <button
                    key={t}
                    onClick={() => setOrderType(t)}
                    className={cn("px-3 py-1.5 rounded-md text-[11px] font-medium uppercase tracking-wider", orderType === t ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Inputs */}
              <div className="space-y-2">
                {orderType === "limit" && (
                  <div>
                    <label className="text-[10px] uppercase tracking-wider text-muted-foreground">Price (USDC)</label>
                    <Input
                      value={price}
                      onChange={(e) => setPrice(e.target.value)}
                      placeholder={market.price.toString()}
                      className="font-mono text-right h-10"
                      inputMode="decimal"
                    />
                  </div>
                )}
                <div>
                  <label className="text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    Amount ({market.base})
                    <button
                      onClick={() => setSide(s => s === "buy" ? "sell" : "buy")}
                      className="text-muted-foreground hover:text-foreground"
                      title="Flip side"
                    >
                      <ArrowDownUp className="w-3 h-3" />
                    </button>
                  </label>
                  <Input
                    value={amount}
                    onChange={(e) => { setAmount(e.target.value); setPctSlider(0); }}
                    placeholder="0.00"
                    className="font-mono text-right h-10"
                    inputMode="decimal"
                  />
                </div>

                {/* % slider */}
                <div className="flex items-center gap-1 pt-1">
                  {[25, 50, 75, 100].map(p => (
                    <button
                      key={p}
                      onClick={() => applyPct(p)}
                      className={cn("flex-1 py-1.5 rounded-md text-[10px] font-medium border transition-colors",
                        pctSlider === p ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:text-foreground hover:border-border-strong"
                      )}
                    >
                      {p}%
                    </button>
                  ))}
                </div>

                {/* Total */}
                <div className="flex items-center justify-between text-xs pt-2 border-t border-border mt-2">
                  <span className="text-muted-foreground">Total</span>
                  <span className="font-mono">${total.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Available</span>
                  <span className="font-mono">{side === "buy" ? `${usdcBalance.toLocaleString()} USDC` : `${baseBalance} ${market.base}`}</span>
                </div>

                {/* Pre-trade checks */}
                <div className="space-y-1 pt-2 border-t border-border">
                  {[
                    "Oracle price fresh",
                    "Slippage within range",
                    "Mint whitelisted",
                    "Position size allowed",
                  ].map(c => (
                    <div key={c} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Check className="w-3 h-3 text-success" /> {c}
                    </div>
                  ))}
                </div>

                <Button
                  onClick={handleSubmit}
                  disabled={role === "investor" && connected}
                  className={cn(
                    "w-full h-11 mt-2 text-white border-0 font-semibold uppercase text-xs tracking-wider",
                    side === "buy" ? "bg-success hover:bg-success/90" : "bg-destructive hover:bg-destructive/90"
                  )}
                >
                  <Zap className="w-3.5 h-3.5 mr-1.5" />
                  {side === "buy" ? "Buy" : "Sell"} {market.base}
                </Button>

                <div className="text-[10px] text-muted-foreground text-center pt-1">
                  Trades route through Jupiter · Pyth oracle · Est. fee ~0.1%
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </Layout>
  );
};

const Stat = ({ label, value, highlight }: { label: string; value: string; highlight?: "up" | "down" }) => (
  <div className="shrink-0">
    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={cn("font-mono text-sm tabular", highlight === "up" && "text-success", highlight === "down" && "text-destructive")}>{value}</div>
  </div>
);

export default Trade;
