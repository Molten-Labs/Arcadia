import { useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { getVault, getTrader } from "@/lib/mockData";
import { StatusBadge } from "@/components/StatusBadge";
import { HealthMeter } from "@/components/HealthMeter";
import { CapitalStack } from "@/components/CapitalStack";
import { StatCard } from "@/components/StatCard";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtUSD, fmtPct } from "@/lib/format";
import { ArrowLeft, Check, ArrowDownUp, X } from "lucide-react";
import { TxModal } from "@/components/TxModal";

const ManagerVault = () => {
  const { id } = useParams();
  const [from, setFrom] = useState("USDC");
  const [to, setTo] = useState("SOL");
  const [amount, setAmount] = useState("");
  const [tx, setTx] = useState<{ open: boolean; kind: string }>({ open: false, kind: "swap" });
  const v = id ? getVault(id) : undefined;
  if (!v) return <Navigate to="/manager" replace />;
  const trader = getTrader(v.traderWallet);

  const checks = [
    { ok: true, label: "Whitelisted asset" },
    { ok: true, label: "Position size within limits" },
    { ok: v.status !== "cooldown", label: "No cooldown" },
    { ok: true, label: "Oracle price fresh (< 30s)" },
    { ok: v.status !== "frozen", label: "Trading enabled" },
  ];
  const allOk = checks.every(c => c.ok);

  return (
    <Layout>
      <div className="container py-8">
        <Link to="/manager" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> Manager dashboard
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display font-bold text-3xl">{v.name}</h1>
              <StatusBadge status={v.status} />
            </div>
            <p className="text-sm text-muted-foreground">Manager view · {trader?.name}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setTx({ open: true, kind: "deposit junior" })}>Deposit junior</Button>
            <Button variant="outline" size="sm" onClick={() => setTx({ open: true, kind: "claim fees" })}>Claim fees (${fmtUSD(v.unclaimedFees, { compact: true })})</Button>
            <Button variant="outline" size="sm" onClick={() => setTx({ open: true, kind: "withdraw junior" })}>Withdraw junior</Button>
          </div>
        </div>

        {v.status === "paper" && (
          <Banner variant="info" title={`Paper mode — Day ${v.paperDaysElapsed}/${v.paperDaysRequired}`}>
            Investor deposits open after graduation. Build a positive track record.
          </Banner>
        )}
        {v.status === "cooldown" && <Banner variant="warning" title="Cooldown active">Trading paused. Position limits will tighten on resume.</Banner>}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 my-6">
          <StatCard label="NAV" value={`$${fmtUSD(v.tvl, { compact: true })}`} />
          <StatCard label="Junior health" value={`${v.juniorHealth}%`} />
          <StatCard label="Max trade" value={`${v.maxPositionPct}%`} hint="of NAV" />
          <StatCard label="30d PnL" value={fmtPct(v.return30d)} />
          <StatCard label="Senior" value={`$${fmtUSD(v.seniorCapital, { compact: true })}`} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Trade panel */}
            <div className="surface-elevated rounded-2xl p-6">
              <h3 className="font-display font-semibold mb-4 flex items-center gap-2"><ArrowDownUp className="w-4 h-4" /> Execute swap</h3>
              <div className="space-y-3">
                <div className="surface rounded-xl p-4">
                  <div className="text-xs text-muted-foreground mb-2">From</div>
                  <div className="flex gap-2">
                    <Input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="text-lg tabular border-0 bg-transparent px-0 focus-visible:ring-0" />
                    <select value={from} onChange={e => setFrom(e.target.value)} className="bg-secondary rounded-lg px-3 text-sm font-semibold">
                      {v.allowedAssets.map(a => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Balance: 240,000 USDC</div>
                </div>
                <div className="flex justify-center -my-2 relative z-10">
                  <button className="w-9 h-9 rounded-full bg-secondary border-4 border-background flex items-center justify-center hover:bg-accent">
                    <ArrowDownUp className="w-4 h-4" />
                  </button>
                </div>
                <div className="surface rounded-xl p-4">
                  <div className="text-xs text-muted-foreground mb-2">To (estimated)</div>
                  <div className="flex gap-2">
                    <div className="text-lg tabular flex-1">{amount ? (parseFloat(amount) / 184).toFixed(4) : "0.00"}</div>
                    <select value={to} onChange={e => setTo(e.target.value)} className="bg-secondary rounded-lg px-3 text-sm font-semibold">
                      {v.allowedAssets.filter(a => a !== from).map(a => <option key={a}>{a}</option>)}
                    </select>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Pyth ref: $184.20 · slippage 0.3%</div>
                </div>
              </div>

              <div className="mt-5 surface rounded-xl p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Pre-trade checks</div>
                <ul className="space-y-1.5 text-sm">
                  {checks.map(c => (
                    <li key={c.label} className="flex items-center gap-2">
                      {c.ok ? <Check className="w-4 h-4 text-success" /> : <X className="w-4 h-4 text-destructive" />}
                      <span className={c.ok ? "" : "text-destructive"}>{c.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button onClick={() => setTx({ open: true, kind: "swap" })} className="w-full mt-4 h-11 bg-gradient-ember text-white border-0" disabled={!allOk || !amount}>
                Execute swap
              </Button>
            </div>

            <div className="surface rounded-2xl p-6">
              <CapitalStack junior={v.juniorCapital} senior={v.seniorCapital} health={v.juniorHealth} />
            </div>
          </div>

          <div className="space-y-6">
            {v.status === "paper" && (
              <div className="surface rounded-2xl p-6">
                <h3 className="font-display font-semibold mb-3">Graduation checklist</h3>
                <div className="text-sm space-y-2">
                  <Item ok>Junior capital posted</Item>
                  <Item ok={(v.paperDaysElapsed || 0) >= 30}>30 days paper trading</Item>
                  <Item ok={v.return30d > 0}>Positive PnL</Item>
                  <Item ok={v.maxDrawdown > -10}>Drawdown {"<"} 10%</Item>
                </div>
              </div>
            )}

            <div className="surface rounded-2xl p-6">
              <h3 className="font-display font-semibold mb-4">Junior buffer</h3>
              <div className="text-3xl font-display font-bold tabular mb-3">{v.juniorHealth}%</div>
              <HealthMeter health={v.juniorHealth} size="lg" showLabel={false} />
              <Button variant="outline" size="sm" className="w-full mt-4" onClick={() => setTx({ open: true, kind: "add junior" })}>Add junior capital</Button>
            </div>

            <div className="surface rounded-2xl p-6">
              <h3 className="font-display font-semibold mb-2">Fees</h3>
              <div className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">HWM</span><span className="tabular">${fmtUSD(v.hwm)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Above HWM</span><span className="tabular">${fmtUSD(Math.max(0, v.tvl - v.hwm))}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Claimable</span><span className="tabular text-primary font-semibold">${fmtUSD(v.unclaimedFees)}</span></div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-3">Fees only accrue on gains above the previous HWM.</p>
            </div>
          </div>
        </div>
      </div>
      <TxModal open={tx.open} onOpenChange={(o) => setTx({ ...tx, open: o })} kind={tx.kind} />
    </Layout>
  );
};

const Item = ({ ok, children }: any) => (
  <div className="flex items-center gap-2">
    {ok ? <Check className="w-4 h-4 text-success" /> : <div className="w-4 h-4 rounded-full border-2 border-muted" />}
    <span className={ok ? "" : "text-muted-foreground"}>{children}</span>
  </div>
);

export default ManagerVault;
