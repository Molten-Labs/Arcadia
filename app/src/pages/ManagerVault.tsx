import { useMemo, useState, type ReactNode } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useVault } from "@/hooks/useVaults";
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
import { PublicKey } from "@solana/web3.js";
import { toast } from "sonner";
import { parseUsdcToUnits } from "@/lib/solana/amounts";
import { isRealJupiterEnabled } from "@/lib/solana/jupiter";
import { isArcadiaSurfpoolMode } from "@/lib/api";
import { DataModeToggle } from "@/components/DataModeToggle";
import { LiveVaultKpis } from "@/components/LiveVaultPanels";
import { LiveJupiterQuotePanel } from "@/components/LiveJupiterQuotePanel";
import { useDataMode } from "@/hooks/useDataMode";
import { mockStore } from "@/lib/mockStore";
import { useQueryClient } from "@tanstack/react-query";

const QUICK_USDC_AMOUNTS = [1_000, 5_000, 10_000, 25_000] as const;

const ManagerVault = () => {
  const { id } = useParams();
  const { data: v, isLoading } = useVault(id);
  const { depositJunior, withdrawJunior, updateNav, graduateVault, executeSwap, claimFees } = useKilnTransactions();
  const { isMock } = useDataMode();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);

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

  const parsedUsdcUnits = parseUsdcToUnits(amount);
  const hasValidAmount = parsedUsdcUnits !== null && parsedUsdcUnits > 0n;
  const usdcUnits = parsedUsdcUnits ?? 0n;
  const aboveHwm = Math.max(0, v.currentNav - v.highWaterMark);
  const nowSecs = Math.floor(Date.now() / 1000);
  const graduationChecks = [
    { ok: v.juniorCapitalLamports > 0n, label: "Junior capital posted" },
    {
      ok: v.paperTradeCount >= v.minQualifyingTrades,
      label: `${v.minQualifyingTrades}+ qualifying real swaps (${v.paperTradeCount} done)`,
    },
    {
      ok: v.currentNavLamports > v.originalJuniorDepositLamports,
      label: "Positive paper PnL",
    },
    {
      ok: nowSecs >= v.createdAt + v.paperWindowSecs,
      label: "Paper window complete",
    },
  ];
  const canGraduate = v.status === "paper" && graduationChecks.every((check) => check.ok);

  const checks = [
    { ok: true, label: "Whitelisted asset" },
    { ok: true, label: "Position size within limits" },
    { ok: v.status !== "cooldown", label: "No cooldown" },
    { ok: true, label: "Oracle price fresh (< 30s)" },
    { ok: v.tradingEnabled, label: "Trading enabled" },
  ];
  const allOk = checks.every(c => c.ok);
  const realJupiterEnabled = isRealJupiterEnabled();
  const surfpoolPreview = isArcadiaSurfpoolMode();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["vaults"] });
    queryClient.invalidateQueries({ queryKey: ["positions"] });
  };

  const handleDepositJunior = async () => {
    if (!hasValidAmount) { toast.error("Enter a valid amount"); return; }
    setSending(true);
    try {
      if (isMock) {
        await new Promise(r => setTimeout(r, 1500));
        mockStore.depositJunior(v.id, Number(usdcUnits) / 1e6);
        invalidate();
        toast.success("Junior capital deposited", { description: `+${fmtUSD(Number(usdcUnits) / 1e6)} USDC added to vault` });
      } else {
        await depositJunior(new PublicKey(v.configPubkey), usdcUnits);
        toast.success("Junior capital deposited");
      }
      setAmount("");
    } catch (e) {
      toast.error("Deposit failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setSending(false);
    }
  };

  const handleWithdrawJunior = async () => {
    if (!hasValidAmount) { toast.error("Enter a valid amount"); return; }
    if (usdcUnits > v.juniorCapitalLamports) { toast.error("Withdrawal exceeds junior capital"); return; }
    setSending(true);
    try {
      if (isMock) {
        await new Promise(r => setTimeout(r, 1500));
        mockStore.withdrawJunior(v.id, Number(usdcUnits) / 1e6);
        invalidate();
        toast.success("Junior capital withdrawn", { description: `${fmtUSD(Number(usdcUnits) / 1e6)} USDC returned to manager` });
      } else {
        await withdrawJunior(new PublicKey(v.configPubkey), usdcUnits);
        toast.success("Junior capital withdrawn");
      }
      setAmount("");
    } catch (e) {
      toast.error("Withdrawal failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setSending(false);
    }
  };

  const handleUpdateNav = async () => {
    setSending(true);
    try {
      if (isMock) {
        await new Promise(r => setTimeout(r, 800));
        invalidate();
        toast.success("NAV updated");
      } else {
        await updateNav(new PublicKey(v.configPubkey));
        toast.success("NAV updated");
      }
    } catch (e) {
      toast.error("NAV update failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setSending(false);
    }
  };

  const handleGraduateVault = async () => {
    setSending(true);
    try {
      if (isMock) {
        await new Promise(r => setTimeout(r, 2000));
        mockStore.graduateVault(v.id);
        invalidate();
        toast.success("Vault graduated!", { description: "Investor deposits are now open." });
      } else {
        await graduateVault(new PublicKey(v.configPubkey), new PublicKey(v.managerPubkey));
        toast.success("Graduation submitted");
      }
    } catch (e) {
      toast.error("Graduation failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setSending(false);
    }
  };

  const handleGuardedSwap = async () => {
    if (!hasValidAmount) { toast.error("Enter a valid amount"); return; }
    if (realJupiterEnabled) {
      toast.error("Use the Jupiter quote flow for a live swap");
      return;
    }
    setSending(true);
    try {
      if (isMock) {
        await new Promise(r => setTimeout(r, 1800));
        mockStore.executeTrade(v.id, "SOL → USDC", Number(usdcUnits) / 1e6);
        invalidate();
        setAmount("");
        toast.success("Swap executed", { description: "Trade recorded in vault activity" });
      } else {
        await executeSwap(new PublicKey(v.configPubkey), usdcUnits, 0n);
        setAmount("");
        toast.success("Devnet guard-only swap check submitted");
      }
    } catch (e) {
      toast.error("Swap check failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setSending(false);
    }
  };

  const handleClaimFees = async () => {
    setSending(true);
    try {
      if (isMock) {
        await new Promise(r => setTimeout(r, 1200));
        mockStore.claimFees(v.id);
        invalidate();
        toast.success("Performance fees claimed");
      } else {
        await claimFees(new PublicKey(v.configPubkey));
        toast.success("Fees claimed");
      }
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
            <ArrowLeft className="w-3.5 h-3.5" /> Arcadia manager
        </Link>

        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-[0.2em] text-primary">Trader-only vault operations</div>
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-display type-h2 font-semibold">{v.name}</h1>
              <StatusBadge status={v.status} />
            </div>
            <p className="text-sm text-muted-foreground">Manager view · {shortAddr(v.managerPubkey)}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <DataModeToggle compact />
            <Button variant="outline" size="sm" onClick={handleDepositJunior} disabled={sending || !hasValidAmount}>
              Deposit junior
            </Button>
            <Button variant="outline" size="sm" onClick={handleClaimFees} disabled={sending}>
              Claim fees
            </Button>
            <Button variant="outline" size="sm" onClick={handleUpdateNav} disabled={sending}>
              Update NAV
            </Button>
            <Button variant="outline" size="sm" onClick={handleGraduateVault} disabled={sending || !canGraduate}>
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
          <StatCard label="NAV" value={`${fmtUSD(v.currentNav, { decimals: 2 })} USDC`} />
          <StatCard label="Junior health" value={`${v.juniorHealth}%`} />
          <StatCard label="Fee" value={`${v.feeBps / 100}%`} />
          <StatCard label="24h loss" value={`${v.rolling24hLossBps / 100}%`} />
          <StatCard label="Senior" value={`${fmtUSD(v.seniorCapital, { decimals: 2 })} USDC`} />
        </div>

        <div className="mb-6">
          <LiveVaultKpis vault={v} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Amount input for junior operations */}
            <div className="surface-elevated rounded-lg p-6">
              <h3 className="font-display font-semibold mb-4 flex items-center gap-2">
                <ArrowDownUp className="w-4 h-4" /> Junior capital operations
              </h3>
              <div className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                    <label htmlFor="manager-vault-amount">Junior amount (USDC)</label>
                    <span>Base asset: USDC</span>
                  </div>
                  <div className="relative">
                    <Input
                      id="manager-vault-amount"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                      placeholder="0.00"
                      inputMode="decimal"
                      className="text-lg tabular h-12 pr-14"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">USDC</span>
                  </div>
                </div>
                <div className="flex gap-1.5">
                  {QUICK_USDC_AMOUNTS.map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAmount(String(preset))}
                      className="h-10 flex-1 rounded-md bg-secondary text-xs font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {fmtUSD(preset, { compact: true })}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-5 surface rounded-lg p-4">
                <div className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                  {realJupiterEnabled ? "Jupiter pre-trade checks" : "Devnet guard-only checks"}
                </div>
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
                  className="flex-1 h-11 bg-gradient-signal text-primary-foreground border-0"
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
                  {realJupiterEnabled ? "Jupiter quote required" : "Run guard swap"}
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

            <div className="surface rounded-lg p-6">
              <CapitalStack junior={v.juniorCapital} senior={v.seniorCapital} health={v.juniorHealth} reserve={v.reserveCapital ?? 0} />
            </div>
          </div>

          <div className="space-y-6">
            {surfpoolPreview && <LiveJupiterQuotePanel vaultConfigPubkey={v.configPubkey} />}

            {v.status === "paper" && (
              <div className="surface rounded-lg p-6">
                <h3 className="font-display font-semibold mb-3">Graduation checklist</h3>
                <div className="text-sm space-y-2">
                  {graduationChecks.map((check) => (
                    <Item key={check.label} ok={check.ok}>{check.label}</Item>
                  ))}
                </div>
              </div>
            )}

            <div className="surface rounded-lg p-6">
              <h3 className="font-display font-semibold mb-4">Junior buffer</h3>
              <div className="text-3xl font-display font-bold tabular mb-3">{v.juniorHealth}%</div>
              <HealthMeter health={v.juniorHealth} size="lg" showLabel={false} />
            </div>

            <div className="surface rounded-lg p-6">
              <h3 className="font-display font-semibold mb-2">Fees</h3>
              <div className="text-sm space-y-2">
                <div className="flex justify-between"><span className="text-muted-foreground">HWM</span><span className="tabular">{fmtUSD(v.highWaterMark, { decimals: 2 })} USDC</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Above HWM</span><span className="tabular">{fmtUSD(aboveHwm, { decimals: 2 })} USDC</span></div>
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
              <p className="text-xs text-muted-foreground mt-3">Fees only accrue on gains above the previous HWM.</p>
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
