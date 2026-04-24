import { useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { getVault, getTrader } from "@/lib/mockData";
import { StatusBadge } from "@/components/StatusBadge";
import { TierBadge } from "@/components/TierBadge";
import { CapitalStack } from "@/components/CapitalStack";
import { HealthMeter } from "@/components/HealthMeter";
import { NavChart } from "@/components/NavChart";
import { StatCard } from "@/components/StatCard";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { fmtUSD, fmtPct, fmtRelative, fmtDateTime, fmtDate } from "@/lib/format";
import { CandlestickChart } from "@/components/CandlestickChart";
import { OrderBook } from "@/components/OrderBook";
import { ArrowLeft, Info, Bell, Zap } from "lucide-react";
import { useWallet } from "@/lib/wallet";
import { investorPositions } from "@/lib/mockData";
import { toast } from "sonner";
import { TxModal } from "@/components/TxModal";

const VaultDetail = () => {
  const { id } = useParams();
  const vault = id ? getVault(id) : undefined;
  const trader = vault ? getTrader(vault.traderWallet) : undefined;
  const { connected, role } = useWallet();
  const position = investorPositions.find(p => p.vaultId === id);
  const [amount, setAmount] = useState("");
  const [range, setRange] = useState<"24H" | "7D" | "30D" | "ALL">("30D");
  const [tx, setTx] = useState<{ open: boolean; kind: "deposit" | "withdraw" }>({ open: false, kind: "deposit" });

  if (!vault) return <Navigate to="/vaults" replace />;

  const filteredHistory = (() => {
    const days = range === "24H" ? 1 : range === "7D" ? 7 : range === "30D" ? 30 : vault.navHistory.length;
    return vault.navHistory.slice(-days - 1);
  })();

  const isPositive = vault.return30d >= 0;

  return (
    <Layout>
      <div className="container py-8">
        <Link to="/vaults" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> All vaults
        </Link>

        {/* Hero */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3 mb-2">
              <h1 className="font-display font-bold text-3xl md:text-4xl">{vault.name}</h1>
              <StatusBadge status={vault.status} />
              {vault.instantExit && (
                <span className="inline-flex items-center gap-1.5 text-xs text-primary bg-primary/10 border border-primary/30 px-2.5 py-1 rounded-full">
                  <Zap className="w-3 h-3" /> Instant exit
                </span>
              )}
            </div>
            {trader && (
              <div className="flex items-center gap-3">
                <Link to={`/trader/${trader.wallet}`} className="text-sm text-muted-foreground hover:text-foreground">
                  by <span className="text-foreground font-medium">{trader.name}</span>
                </Link>
                <TierBadge tier={trader.tier} />
              </div>
            )}
            <p className="text-muted-foreground mt-3 max-w-2xl">{vault.description}</p>
          </div>
          {trader && (
            <Button asChild variant="outline">
              <Link to={`/trader/${trader.wallet}`}>View trader profile</Link>
            </Button>
          )}
        </div>

        {/* Status banners */}
        {vault.status === "frozen" && (
          <Banner variant="danger" title="Vault frozen — trading disabled" >
            Risk controls activated. Investors can withdraw available liquidity.
          </Banner>
        )}
        {vault.status === "cooldown" && vault.cooldownEndsAt && (
          <Banner variant="warning" title="Cooldown active">
            Trading paused until {fmtDateTime(vault.cooldownEndsAt)}. Junior buffer recovering.
          </Banner>
        )}
        {vault.status === "paper" && (
          <Banner variant="info" title="Paper mode">
            Day {vault.paperDaysElapsed} of {vault.paperDaysRequired}. Investor deposits open after graduation.
          </Banner>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 my-6">
          <StatCard label="TVL" value={`$${fmtUSD(vault.tvl, { compact: true })}`} hint={`$${fmtUSD(vault.tvl)} USDC`} />
          <StatCard label="Junior" value={`$${fmtUSD(vault.juniorCapital, { compact: true })}`} hint={`${Math.round((vault.juniorCapital / vault.tvl) * 100)}% of TVL`} />
          <StatCard label="Senior" value={`$${fmtUSD(vault.seniorCapital, { compact: true })}`} hint="protected" />
          <StatCard label="30d return" value={fmtPct(vault.return30d)} className={isPositive ? "" : ""} />
          <StatCard label="Max position" value={`${vault.maxPositionPct}%`} hint="of NAV" />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Capital stack */}
            <div className="surface rounded-2xl p-6">
              <CapitalStack junior={vault.juniorCapital} senior={vault.seniorCapital} health={vault.juniorHealth} />
            </div>

            {/* Live trading view */}
            <div className="surface rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="font-display font-semibold">Live trading view</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">SOL/USDC · primary trading pair</p>
                </div>
                <div className="flex gap-1 text-[11px]">
                  {["1H", "4H", "1D", "1W"].map((t, i) => (
                    <button key={t} className={`px-2 py-1 rounded ${i === 2 ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div className="grid lg:grid-cols-[1fr_240px] gap-4">
                <CandlestickChart count={56} height={260} />
                <OrderBook />
              </div>
            </div>

            {/* NAV chart */}
            <div className="surface rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold">NAV history</h3>
                <Tabs value={range} onValueChange={(v) => setRange(v as any)}>
                  <TabsList className="h-8">
                    {["24H", "7D", "30D", "ALL"].map(r => (
                      <TabsTrigger key={r} value={r} className="text-xs px-3">{r}</TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
              </div>
              <NavChart data={filteredHistory} showLayers />
              <div className="flex flex-wrap gap-4 mt-4 text-xs">
                <Legend color="hsl(var(--primary))" label="NAV" />
                <Legend color="hsl(var(--primary-glow))" label="Junior" dashed />
                <Legend color="hsl(var(--info))" label="Senior" dashed />
              </div>
            </div>


            {/* Risk & rules */}
            <div className="surface rounded-2xl p-6">
              <h3 className="font-display font-semibold mb-4">Risk & rules</h3>
              <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Row label="Paper mode" value={vault.status === "paper" ? `In progress` : "Completed"} />
                <Row label="Required junior ratio" value="20% min" />
                <Row label="Current junior ratio" value={`${Math.round((vault.juniorCapital / vault.tvl) * 100)}%`} />
                <Row label="Max single trade" value={`${vault.maxPositionPct}% of NAV`} />
                <Row label="Cooldown trigger" value="Junior < 50%" />
                <Row label="Allowed assets" value={vault.allowedAssets.join(", ")} />
                <Row label="Fee model" value={vault.feeModel} />
                <Row label="Investor cooldown" value="24h standard · instant if junior < 20%" />
              </dl>
            </div>

            {/* Trade history */}
            <div className="surface rounded-2xl p-6">
              <h3 className="font-display font-semibold mb-4">Recent trades</h3>
              {vault.trades.length === 0 ? (
                <p className="text-sm text-muted-foreground">No recent trades.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-muted-foreground uppercase tracking-wider">
                      <tr className="border-b border-border">
                        <th className="text-left py-2 font-medium">Time</th>
                        <th className="text-left py-2 font-medium">Pair</th>
                        <th className="text-left py-2 font-medium">Side</th>
                        <th className="text-right py-2 font-medium">Amount</th>
                        <th className="text-right py-2 font-medium">Price</th>
                        <th className="text-right py-2 font-medium">Junior impact</th>
                      </tr>
                    </thead>
                    <tbody className="font-mono text-xs">
                      {vault.trades.map(t => (
                        <tr key={t.id} className="border-b border-border/50">
                          <td className="py-3">{fmtRelative(t.time)}</td>
                          <td>{t.pair}</td>
                          <td className={t.direction === "buy" ? "text-success" : "text-destructive"}>{t.direction.toUpperCase()}</td>
                          <td className="text-right">{t.amount.toLocaleString()}</td>
                          <td className="text-right">${t.price.toLocaleString()}</td>
                          <td className={`text-right ${t.juniorImpact >= 0 ? "text-success" : "text-destructive"}`}>{fmtPct(t.juniorImpact, 2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Activity feed */}
            <div className="surface rounded-2xl p-6">
              <h3 className="font-display font-semibold mb-4">Activity</h3>
              {vault.activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">No activity yet.</p>
              ) : (
                <div className="space-y-3">
                  {vault.activity.map(a => (
                    <div key={a.id} className="flex items-start gap-3 text-sm">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                      <div className="flex-1">
                        <div>{a.message}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{fmtDateTime(a.time)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right column — sticky */}
          <div className="space-y-6 lg:sticky lg:top-24 self-start">
            {/* Health card */}
            <div className="surface rounded-2xl p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold">Junior health</h3>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-3.5 h-3.5 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Health = remaining junior capital / original junior. Below 50% triggers cooldown. Below 20% unlocks instant investor exits.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="text-4xl font-display font-bold tabular mb-3">{vault.juniorHealth}%</div>
              <HealthMeter health={vault.juniorHealth} size="lg" showLabel={false} />
              <div className="grid grid-cols-3 gap-2 mt-4 text-[10px] text-muted-foreground">
                <div><div className="w-full h-0.5 bg-status-frozen mb-1" />Critical &lt;20%</div>
                <div><div className="w-full h-0.5 bg-status-cooldown mb-1" />Caution &lt;50%</div>
                <div><div className="w-full h-0.5 bg-status-active mb-1" />Healthy</div>
              </div>
            </div>

            {/* Deposit / Withdraw */}
            <div className="surface-elevated rounded-2xl p-6">
              {position ? (
                <>
                  <h3 className="font-display font-semibold mb-4">Your position</h3>
                  <div className="space-y-3 text-sm mb-5">
                    <Row label="Deposited" value={`$${fmtUSD(position.deposited)}`} />
                    <Row label="Current value" value={`$${fmtUSD(position.currentValue)}`} />
                    <Row label="PnL" value={<span className="text-success">+${fmtUSD(position.currentValue - position.deposited)} ({fmtPct(((position.currentValue - position.deposited) / position.deposited) * 100)})</span>} />
                    <Row label="Deposit date" value={fmtDate(position.depositedAt)} />
                  </div>
                  <Button onClick={() => setTx({ open: true, kind: "withdraw" })} variant="outline" className="w-full">Withdraw</Button>
                  <Button onClick={() => setTx({ open: true, kind: "deposit" })} className="w-full mt-2 bg-gradient-ember text-white border-0">Deposit more</Button>
                </>
              ) : (
                <>
                  <h3 className="font-display font-semibold mb-1">Deposit</h3>
                  <p className="text-xs text-muted-foreground mb-4">USDC · 24h withdrawal cooldown</p>
                  {vault.status === "paper" ? (
                    <Banner variant="info" title="Deposits open after graduation">
                      This vault is still in paper mode.
                    </Banner>
                  ) : vault.status === "frozen" ? (
                    <Banner variant="danger" title="Deposits closed">
                      Vault is frozen. Existing investors may withdraw.
                    </Banner>
                  ) : (
                    <>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                            <span>Amount</span><span>Balance: $12,400</span>
                          </div>
                          <div className="relative">
                            <Input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="pr-16 text-lg tabular h-12" />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">USDC</span>
                          </div>
                        </div>
                        <div className="flex gap-1.5">
                          {["25%", "50%", "75%", "MAX"].map(p => (
                            <button key={p} onClick={() => setAmount(p === "MAX" ? "12400" : String(12400 * (parseInt(p) / 100)))} className="flex-1 text-xs py-1.5 rounded-md bg-secondary hover:bg-accent">{p}</button>
                          ))}
                        </div>
                        <div className="text-xs space-y-1.5 pt-2 border-t border-border">
                          <div className="flex justify-between"><span className="text-muted-foreground">Estimated shares</span><span className="tabular">{amount ? (parseFloat(amount) / 1.05).toFixed(2) : "0.00"}</span></div>
                          <div className="flex justify-between"><span className="text-muted-foreground">Withdrawal cooldown</span><span>24 hours</span></div>
                        </div>
                        {vault.juniorHealth < 30 && (
                          <Banner variant="warning" title="Low junior buffer">
                            Junior health is below 30%. Consider waiting for recovery.
                          </Banner>
                        )}
                      </div>
                      <Button
                        onClick={() => {
                          if (!connected) return toast.error("Connect a wallet first");
                          setTx({ open: true, kind: "deposit" });
                        }}
                        className="w-full mt-4 bg-gradient-ember text-white border-0 h-11"
                      >
                        Deposit USDC
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>

            {/* Alerts */}
            {connected && role === "investor" && (
              <div className="surface rounded-2xl p-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-display font-semibold flex items-center gap-2"><Bell className="w-4 h-4" /> Alerts</h3>
                </div>
                <div className="space-y-2 text-sm">
                  {[
                    "Junior health drops below threshold",
                    "Vault enters cooldown",
                    "Vault frozen",
                    "Performance fee claimed",
                  ].map(a => (
                    <label key={a} className="flex items-start gap-2 text-xs cursor-pointer">
                      <input type="checkbox" defaultChecked className="mt-0.5 accent-primary" />
                      <span className="text-foreground/80">{a}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <TxModal open={tx.open} onOpenChange={(o) => setTx({ ...tx, open: o })} kind={tx.kind} />
    </Layout>
  );
};

const Legend = ({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) => (
  <div className="flex items-center gap-1.5">
    <div className="w-3 h-0.5" style={{ background: color, borderTop: dashed ? `2px dashed ${color}` : undefined }} />
    <span className="text-muted-foreground">{label}</span>
  </div>
);

const Row = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="font-medium text-right">{value}</dd>
  </div>
);

export default VaultDetail;
