import { useEffect, useMemo, useState, type ReactNode } from "react";
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

const QUICK_AMOUNTS = [25, 50, 75, 100] as const;

const ManagerVault = () => {
  const { id } = useParams();
  const [from, setFrom] = useState("USDC");
  const [to, setTo] = useState("SOL");
  const [amount, setAmount] = useState("");
  const [tx, setTx] = useState<{ open: boolean; kind: string }>({ open: false, kind: "swap" });
  const [validationError, setValidationError] = useState("");
  const v = id ? getVault(id) : undefined;
  const trader = v ? getTrader(v.traderWallet) : undefined;
  const allowedAssets = useMemo(() => v?.allowedAssets ?? [], [v]);

  const checks = [
    { ok: true, label: "Whitelisted asset" },
    { ok: true, label: "Position size within limits" },
    { ok: v?.status !== "cooldown", label: "No cooldown" },
    { ok: true, label: "Oracle price fresh (< 30s)" },
    { ok: v?.status !== "frozen", label: "Trading enabled" },
  ];

  const fromOptions = useMemo(() => {
    const options = allowedAssets.filter((asset) => asset !== to);
    return options.length > 0 ? options : allowedAssets;
  }, [to, allowedAssets]);

  const toOptions = useMemo(() => {
    const options = allowedAssets.filter((asset) => asset !== from);
    return options.length > 0 ? options : allowedAssets;
  }, [from, allowedAssets]);

  useEffect(() => {
    if (fromOptions.length > 0 && !fromOptions.includes(from)) {
      setFrom(fromOptions[0]);
    }
  }, [from, fromOptions]);

  useEffect(() => {
    if (toOptions.length > 0 && !toOptions.includes(to)) {
      setTo(toOptions[0]);
    }
  }, [to, toOptions]);

  const parsedAmount = Number(amount);
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const estimate = hasValidAmount ? (parsedAmount / 184).toFixed(4) : "0.0000";
  const allOk = checks.every(c => c.ok);
  const canExecuteTrade = allOk && hasValidAmount;

  useEffect(() => {
    if (!amount.trim()) {
      setValidationError("");
      return;
    }

    if (!hasValidAmount) {
      setValidationError("Enter a valid trade size greater than 0.");
      return;
    }

    if (!allOk) {
      setValidationError("Resolve pre-trade checks before executing.");
      return;
    }

    setValidationError("");
  }, [amount, hasValidAmount, allOk]);

  const submitTrade = () => {
    if (!hasValidAmount) {
      setValidationError("Enter a valid trade size greater than 0.");
      return;
    }
    if (!allOk) {
      setValidationError("Resolve pre-trade checks before executing.");
      return;
    }
    setValidationError("");
    setTx({ open: true, kind: "swap" });
  };

  if (!v) return <Navigate to="/manager" replace />;

  return (
    <Layout>
      <div className="container py-8">
        <Link
          to="/manager"
          className="inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 mb-6"
        >
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
                    <Input
                      value={amount}
                      onChange={(event) => setAmount(event.target.value.replace(/[^\d.]/g, ""))}
                      placeholder="0.00"
                      inputMode="decimal"
                      aria-label={`Trade size in ${from}`}
                      className="text-lg tabular border-0 bg-transparent px-0 focus-visible:ring-0"
                    />
                    <select
                      value={from}
                      onChange={(event) => setFrom(event.target.value)}
                      className="h-10 rounded-lg bg-secondary px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-label="Sell asset"
                    >
                      {fromOptions.map((asset) => <option key={asset}>{asset}</option>)}
                    </select>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Balance: 240,000 USDC</div>
                </div>
                <div className="flex justify-center -my-2 relative z-10">
                  <button
                    type="button"
                    onClick={() => {
                      setFrom(to);
                      setTo(from);
                    }}
                    aria-label="Swap trade assets"
                    className="h-10 w-10 rounded-full bg-secondary border-4 border-background flex items-center justify-center hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    <ArrowDownUp className="w-4 h-4" />
                  </button>
                </div>
                <div className="surface rounded-xl p-4">
                  <div className="text-xs text-muted-foreground mb-2">To (estimated)</div>
                  <div className="flex gap-2">
                    <div className="text-lg tabular flex-1">{estimate}</div>
                    <select
                      value={to}
                      onChange={(event) => setTo(event.target.value)}
                      className="h-10 rounded-lg bg-secondary px-3 text-sm font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-label="Buy asset"
                    >
                      {toOptions.map((asset) => <option key={asset}>{asset}</option>)}
                    </select>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">Pyth ref: $184.20 · slippage 0.3%</div>
                </div>
              </div>

              <div className="flex gap-1.5 mt-4">
                {QUICK_AMOUNTS.map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    onClick={() => {
                      const baseAmount = Number(v.maxPositionPct * 1000);
                      setAmount(((baseAmount * percent) / 100).toFixed(2));
                    }}
                    className="h-10 flex-1 rounded-md bg-secondary text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  >
                    {percent}%
                  </button>
                ))}
              </div>

              {validationError && (
                <div className="mt-4 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
                  {validationError}
                </div>
              )}

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

              <Button onClick={submitTrade} className="w-full mt-4 h-11 bg-gradient-ember text-white border-0" disabled={!canExecuteTrade}>
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

const Item = ({
  ok,
  children,
}: {
  ok: boolean;
  children: ReactNode;
}) => (
  <div className="flex items-center gap-2">
    {ok ? <Check className="w-4 h-4 text-success" /> : <div className="w-4 h-4 rounded-full border-2 border-muted" />}
    <span className={ok ? "" : "text-muted-foreground"}>{children}</span>
  </div>
);

export default ManagerVault;
