import { useMemo, useState, type ReactNode } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useVault } from "@/hooks/useVaults";
import { useBalance } from "@/hooks/useBalance";
import { useKilnTransactions } from "@/hooks/useTransactions";
import { StatusBadge } from "@/components/StatusBadge";
import { HealthMeter } from "@/components/HealthMeter";
import { CapitalStack } from "@/components/CapitalStack";
import { StatCard } from "@/components/StatCard";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fmtUSD } from "@/lib/format";
import { shortAddr } from "@/lib/wallet";
import { ArrowLeft, Check, ArrowDownUp, X, Loader2 } from "lucide-react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { toast } from "sonner";

const QUICK_AMOUNTS = [25, 50, 75, 100] as const;

const ManagerVault = () => {
  const { id } = useParams();
  const { data: v, isLoading } = useVault(id);
  const { data: balance } = useBalance();
  const { depositJunior, withdrawJunior, updateNav, graduateVault, executeSwap, claimFees } = useKilnTransactions();
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);

  const solBalance = balance ?? 0;

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-20 text-center text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading vault...
        </div>
      </Layout>
    );
  }

  if (!v) return <Navigate to="/manager" replace />;

  const parsedAmount = Number(amount);
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const lamports = hasValidAmount ? BigInt(Math.floor(parsedAmount * LAMPORTS_PER_SOL)) : 0n;
  const aboveHwm = Math.max(0, v.currentNav - v.highWaterMark);
  const juniorSharesToBurn =
    hasValidAmount && v.juniorCapital > 0 && v.juniorSharesOutstanding > 0
      ? (lamports * BigInt(v.juniorSharesOutstanding)) / BigInt(Math.floor(v.juniorCapital * LAMPORTS_PER_SOL))
      : 0n;

  const checks = [
    { ok: true, label: "Whitelisted asset" },
    { ok: true, label: "Position size within limits" },
    { ok: v.status !== "cooldown", label: "No cooldown" },
    { ok: true, label: "Oracle price fresh (< 30s)" },
    { ok: v.tradingEnabled, label: "Trading enabled" },
  ];
  const allOk = checks.every(c => c.ok);

  const handleDepositJunior = async () => {
    if (!hasValidAmount) { toast.error("Enter a valid amount"); return; }
    setSending(true);
    try {
      await depositJunior(new PublicKey(v.configPubkey), lamports);
      setAmount("");
      toast.success("Junior capital deposited");
    } catch (e) {
      toast.error("Deposit failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setSending(false);
    }
  };

  const handleWithdrawJunior = async () => {
    if (!hasValidAmount) { toast.error("Enter a valid amount"); return; }
    if (juniorSharesToBurn === 0n) { toast.error("Amount is too small for current share price"); return; }
    setSending(true);
    try {
      await withdrawJunior(new PublicKey(v.configPubkey), juniorSharesToBurn);
      setAmount("");
      toast.success("Junior capital withdrawn");
    } catch (e) {
      toast.error("Withdrawal failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setSending(false);
    }
  };

  const handleUpdateNav = async () => {
    setSending(true);
    try {
      await updateNav(new PublicKey(v.configPubkey));
      toast.success("NAV updated");
    } catch (e) {
      toast.error("NAV update failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setSending(false);
    }
  };

  const handleGraduateVault = async () => {
    setSending(true);
    try {
      await graduateVault(new PublicKey(v.configPubkey), new PublicKey(v.managerPubkey));
      toast.success("Graduation submitted");
    } catch (e) {
      toast.error("Graduation failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setSending(false);
    }
  };

  const handleGuardedSwap = async () => {
    if (!hasValidAmount) { toast.error("Enter a valid amount"); return; }
    setSending(true);
    try {
      await executeSwap(new PublicKey(v.configPubkey), lamports, 0n);
      setAmount("");
      toast.success("Guard-only swap check submitted");
    } catch (e) {
      toast.error("Swap check failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setSending(false);
    }
  };

  const handleClaimFees = async () => {
    setSending(true);
    try {
      await claimFees(new PublicKey(v.configPubkey));
      toast.success("Fees claimed");
    } catch (e) {
      toast.error("Claim failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <div className="container py-8">
        <Link
          to="/manager"
          className="inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Manager dashboard
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display font-bold text-3xl">{v.name}</h1>
              <StatusBadge status={v.status} />
            </div>
            <p className="text-sm text-muted-foreground">Manager view · {shortAddr(v.managerPubkey)}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={handleDepositJunior} disabled={sending || !hasValidAmount}>
              Deposit junior
            </Button>
            <Button variant="outline" size="sm" onClick={handleClaimFees} disabled={sending}>
              Claim fees
            </Button>
            <Button variant="outline" size="sm" onClick={handleUpdateNav} disabled={sending}>
              Update NAV
            </Button>
            <Button variant="outline" size="sm" onClick={handleGraduateVault} disabled={sending || v.status !== "paper"}>
              Graduate
            </Button>
            <Button variant="outline" size="sm" onClick={handleWithdrawJunior} disabled={sending || !hasValidAmount}>
              Withdraw junior
            </Button>
          </div>
        </div>

        {v.status === "paper" && (
          <Banner variant="info" title={`Paper mode — ${v.paperTradeCount}/${v.minQualifyingTrades} trades`}>
            Investor deposits open after graduation. Build a positive track record.
          </Banner>
        )}
        {v.status === "cooldown" && <Banner variant="warning" title="Cooldown active">Trading paused. Position limits will tighten on resume.</Banner>}

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 my-6">
          <StatCard label="NAV" value={`${fmtUSD(v.currentNav, { decimals: 2 })} SOL`} />
          <StatCard label="Junior health" value={`${v.juniorHealth}%`} />
          <StatCard label="Fee" value={`${v.feeBps / 100}%`} />
          <StatCard label="24h loss" value={`${v.rolling24hLossBps / 100}%`} />
          <StatCard label="Senior" value={`${fmtUSD(v.seniorCapital, { decimals: 2 })} SOL`} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Amount input for junior operations */}
            <div className="surface-elevated rounded-2xl p-6">
              <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
                <ArrowDownUp className="w-4 h-4" /> Junior capital operations
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <span>Amount (SOL)</span>
                    <span>Balance: {solBalance.toFixed(4)} SOL</span>
                  </div>
                  <div className="relative">
                    <Input
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                      placeholder="0.00"
                      inputMode="decimal"
                      className="text-lg tabular h-12 pr-14"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">SOL</span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {QUICK_AMOUNTS.map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setAmount(String(solBalance * pct / 100))}
                      className="h-10 flex-1 rounded-md bg-secondary text-xs font-medium hover:bg-accent"
                    >
                      {pct}%
                    </button>
                  ))}
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

              <div className="flex gap-2 mt-4">
                <Button
                  onClick={handleDepositJunior}
                  disabled={sending || !hasValidAmount}
                  className="flex-1 h-11 bg-gradient-ember text-white border-0"
                >
                  {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Deposit junior
                </Button>
                <Button
                  onClick={handleGuardedSwap}
                  disabled={sending || !hasValidAmount || !allOk}
                  variant="outline"
                  className="flex-1 h-11"
                >
                  Guard check
                </Button>
                <Button
                  onClick={handleWithdrawJunior}
                  disabled={sending || !hasValidAmount}
                  variant="outline"
                  className="flex-1 h-11"
                >
                  Withdraw junior
                </Button>
              </div>
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
                  <Item ok={v.paperTradeCount >= v.minQualifyingTrades}>{v.minQualifyingTrades}+ qualifying trades ({v.paperTradeCount} done)</Item>
                  <Item ok={v.currentNav > v.highWaterMark}>Positive PnL</Item>
                </div>
              </div>
            )}

            <div className="surface rounded-2xl p-6">
              <h3 className="font-display font-semibold mb-4">Junior buffer</h3>
              <div className="text-3xl font-display font-bold tabular mb-3">{v.juniorHealth}%</div>
              <HealthMeter health={v.juniorHealth} size="lg" showLabel={false} />
            </div>

            <div className="surface rounded-2xl p-6">
              <h3 className="font-display font-semibold mb-2">Fees</h3>
              <div className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">HWM</span><span className="tabular">{fmtUSD(v.highWaterMark, { decimals: 2 })} SOL</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Above HWM</span><span className="tabular">{fmtUSD(aboveHwm, { decimals: 2 })} SOL</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Fee rate</span><span className="tabular">{v.feeBps / 100}%</span></div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-4"
                disabled={sending || aboveHwm <= 0}
                onClick={handleClaimFees}
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Claim fees
              </Button>
              <p className="text-[11px] text-muted-foreground mt-3">Fees only accrue on gains above the previous HWM.</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

const Item = ({ ok, children }: { ok: boolean; children: ReactNode }) => (
  <div className="flex items-center gap-2">
    {ok ? <Check className="w-4 h-4 text-success" /> : <div className="w-4 h-4 rounded-full border-2 border-muted" />}
    <span className={ok ? "" : "text-muted-foreground"}>{children}</span>
  </div>
);

export default ManagerVault;
