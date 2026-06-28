import { useState, type ReactNode } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useVault } from "@/hooks/useVaults";
import { useKilnTransactions } from "@/hooks/useTransactions";
import { usePositions } from "@/hooks/usePositions";
import { StatusBadge } from "@/components/StatusBadge";
import { CapitalStack } from "@/components/CapitalStack";
import { HealthMeter } from "@/components/HealthMeter";
import { StatCard } from "@/components/StatCard";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import { fmtUSD } from "@/lib/format";
import { ArrowLeft, Info, Bell, Zap, Loader2, ShieldCheck, Copy, ExternalLink } from "lucide-react";
import { useWallet, shortAddr } from "@/lib/wallet";
import { toast } from "sonner";
import { PublicKey } from "@solana/web3.js";
import { parseUsdcToUnits } from "@/lib/solana/amounts";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { LiveVaultKpis } from "@/components/LiveVaultPanels";
import { useDataMode } from "@/hooks/useDataMode";
import { mockStore } from "@/lib/mockStore";
import { useQueryClient } from "@tanstack/react-query";

const QUICK_USDC_AMOUNTS = [1_000, 5_000, 10_000, 25_000] as const;

const VaultDetail = () => {
  const { id } = useParams();
  const { data: vault, isLoading, error } = useVault(id);
  const { connected, role } = useWallet();
  const { data: positions } = usePositions();
  const { depositSenior, withdrawSenior } = useKilnTransactions();
  const { isMock } = useDataMode();
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState("");
  const [sending, setSending] = useState(false);
  const [activePanel, setActivePanel] = useState<"deposit" | "withdraw">("deposit");

  if (isLoading) {
    return (
      <Layout>
        <div className="container py-20 text-center text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading vault…
        </div>
      </Layout>
    );
  }

  if (!vault || error) return <Navigate to="/vaults" replace />;

  const parsedUsdcUnits = parseUsdcToUnits(amount);
  const hasValidAmount = parsedUsdcUnits !== null && parsedUsdcUnits > 0n;
  const usdcUnits = parsedUsdcUnits ?? 0n;
  const investorPosition = positions?.find(p => p.vaultConfigPubkey === vault.configPubkey);
  const withdrawableUsdc = investorPosition?.currentValueRaw ?? 0n;
  const juniorPct = vault.tvl > 0 ? Math.round((vault.juniorCapital / vault.tvl) * 100) : 0;

  const handleDeposit = async () => {
    if (!connected) { toast.error("Connect a wallet first"); return; }
    if (role !== "investor") { toast.error("Switch to investor mode to deposit"); return; }
    if (vault.status === "paper") { toast.error("Deposits open after graduation"); return; }
    if (vault.status === "frozen") { toast.error("Deposits are closed"); return; }
    if (!hasValidAmount) { toast.error("Enter a valid USDC amount"); return; }
    setSending(true);
    try {
      if (isMock) {
        await new Promise(r => setTimeout(r, 1500));
        mockStore.depositSenior(vault.id, Number(usdcUnits) / 1e6);
        queryClient.invalidateQueries({ queryKey: ["vaults"] });
        queryClient.invalidateQueries({ queryKey: ["positions"] });
        toast.success("Deposit confirmed", { description: `+${fmtUSD(Number(usdcUnits) / 1e6)} USDC deposited` });
      } else {
        await depositSenior(new PublicKey(vault.configPubkey), usdcUnits);
      }
      setAmount("");
    } catch (e) {
      toast.error("Deposit failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally { setSending(false); }
  };

  const handleWithdraw = async () => {
    if (!connected) { toast.error("Connect a wallet first"); return; }
    if (!hasValidAmount) { toast.error("Enter a valid USDC amount"); return; }
    if (!investorPosition || withdrawableUsdc === 0n) { toast.error("No senior position found"); return; }
    if (usdcUnits > withdrawableUsdc) { toast.error("Exceeds your current claim"); return; }
    setSending(true);
    try {
      if (isMock) {
        await new Promise(r => setTimeout(r, 1500));
        mockStore.withdrawSenior(vault.id, Number(usdcUnits) / 1e6);
        queryClient.invalidateQueries({ queryKey: ["vaults"] });
        queryClient.invalidateQueries({ queryKey: ["positions"] });
        toast.success("Withdrawal confirmed", { description: `${fmtUSD(Number(usdcUnits) / 1e6)} USDC returned` });
      } else {
        await withdrawSenior(new PublicKey(vault.configPubkey), usdcUnits);
      }
      setAmount("");
    } catch (e) {
      toast.error("Withdrawal failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally { setSending(false); }
  };

  return (
    <Layout>
      <div className="container py-8">
        {/* Back */}
        <Link
          to="/vaults"
          className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> All vaults
        </Link>

        {/* ── Page hero ───────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="surface-elevated rounded-[11px] p-6 md:p-7 mb-6 relative overflow-hidden"
        >
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/45 to-transparent" />

          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              {/* Label chip */}
              <span className="page-header-label mb-3">Senior capital vault</span>

              <div className="flex flex-wrap items-center gap-3 mt-3">
                <h1 className="font-display type-h1 font-semibold leading-tight">{vault.name}</h1>
                <StatusBadge status={vault.status} />
                {vault.instantExit && (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-primary bg-primary/10 border border-primary/30 px-2.5 py-1 rounded-full uppercase tracking-[0.12em]">
                    <Zap className="w-3 h-3" /> Instant exit
                  </span>
                )}
              </div>

              {/* Manager row */}
              <div className="flex items-center gap-2 mt-2.5">
                <span className="font-mono text-[11px] text-muted-foreground">Manager</span>
                <button
                  className="font-mono text-[11px] text-foreground/80 hover:text-primary transition-colors flex items-center gap-1"
                  onClick={() => { navigator.clipboard.writeText(vault.managerPubkey); toast.success("Copied"); }}
                >
                  {shortAddr(vault.managerPubkey)}
                  <Copy className="w-2.5 h-2.5 opacity-50" />
                </button>
                <Link
                  to={`/trader/${vault.managerPubkey}`}
                  className="font-mono text-[10px] text-primary/70 hover:text-primary transition-colors flex items-center gap-1"
                >
                  View profile <ExternalLink className="w-2.5 h-2.5" />
                </Link>
              </div>
            </div>

            {/* Right — quick health */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">Junior health</div>
                <div className={cn(
                  "font-display font-bold text-3xl tabular leading-none",
                  vault.juniorHealth >= 50 ? "text-success" : vault.juniorHealth >= 20 ? "text-warning" : "text-destructive"
                )}>
                  {vault.juniorHealth}%
                </div>
              </div>
              <div className="h-12 w-px bg-border/50" />
              <div className="text-right">
                <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">TVL</div>
                <div className="font-display font-bold text-3xl tabular leading-none">
                  {fmtUSD(vault.tvl, { compact: true })}
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ── Status banners ─────────────────────────── */}
        <div className="space-y-2 mb-6">
          {vault.status === "frozen" && (
            <Banner variant="danger" title="Vault frozen — trading disabled">
              Risk controls activated. Investors can withdraw available liquidity.
            </Banner>
          )}
          {vault.status === "cooldown" && (
            <Banner variant="warning" title="Cooldown active">
              Trading paused. Junior buffer recovering.
            </Banner>
          )}
          {vault.status === "paper" && (
            <Banner variant="info" title="Paper mode">
              {vault.paperTradeCount}/{vault.minQualifyingTrades} qualifying trades. Investor deposits open after graduation.
            </Banner>
          )}
        </div>

        {/* ── Stats row ─────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="TVL" value={`${fmtUSD(vault.tvl, { compact: true })} USDC`} />
          <StatCard label="Junior" value={`${fmtUSD(vault.juniorCapital, { compact: true })} USDC`} hint={`${juniorPct}% of TVL`} />
          <StatCard label="Senior" value={`${fmtUSD(vault.seniorCapital, { compact: true })} USDC`} hint="protected" />
          <StatCard label="NAV" value={`${fmtUSD(vault.currentNav, { compact: true })} USDC`} />
          <StatCard label="HWM" value={`${fmtUSD(vault.highWaterMark, { compact: true })} USDC`} />
        </div>

        <div className="mb-6">
          <LiveVaultKpis vault={vault} />
        </div>

        {/* ── Main grid ─────────────────────────────── */}
        <div className="grid lg:grid-cols-3 gap-6">

          {/* ── Left column ─────────────────────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Capital stack */}
            <div className="surface rounded-[11px] p-6">
              <CapitalStack junior={vault.juniorCapital} senior={vault.seniorCapital} health={vault.juniorHealth} reserve={vault.reserveCapital ?? 0} />
            </div>

            {/* Risk & rules */}
            <div className="surface rounded-[11px] p-6">
              <div className="flex items-center gap-2 mb-5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <h3 className="font-display font-semibold text-[15px]">Risk parameters</h3>
              </div>
              <dl className="grid sm:grid-cols-2 gap-x-8 gap-y-0">
                {[
                  { l: "Paper mode", v: vault.status === "paper" ? "In progress" : "Completed" },
                  { l: "Trading", v: vault.tradingEnabled ? "Enabled" : "Disabled" },
                  { l: "Junior ratio", v: `${juniorPct}%` },
                  { l: "Manager fee", v: `${vault.feeBps / 100}% above HWM` },
                  { l: "Reserve allocation", v: vault.reserveAllocationBps ? `${vault.reserveAllocationBps / 100}% of fees` : "—" },
                  { l: "Reserve pool", v: vault.reserveCapital ? `$${(vault.reserveCapital / 1000).toFixed(1)}k` : "—" },
                  { l: "Max slippage", v: `${vault.maxSlippageBps / 100}%` },
                  { l: "24h loss limit", v: `${vault.rolling24hLossBps / 100}%` },
                  { l: "7d loss limit", v: `${vault.rolling7dLossBps / 100}%` },
                  { l: "Investor cooldown", v: "24h · instant if junior < 20%" },
                ].map(row => (
                  <div key={row.l} className="flex justify-between items-center gap-4 border-b border-border/35 py-3 last:border-0">
                    <dt className="font-mono text-[11px] text-muted-foreground">{row.l}</dt>
                    <dd className="font-mono text-[12px] font-medium text-right">{row.v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {/* ── Right column — sticky ────────────────── */}
          <div className="space-y-5 lg:sticky lg:top-24 self-start">

            {/* Health card */}
            <div className="surface rounded-[11px] p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-[15px]">Junior health</h3>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:text-foreground transition-colors">
                        <Info className="w-3.5 h-3.5" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      Remaining junior capital ÷ original junior. Below 50% → cooldown. Below 20% → instant investor exits unlock.
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className={cn(
                "font-display font-bold tabular mb-3 leading-none",
                vault.juniorHealth >= 50 ? "text-success" : vault.juniorHealth >= 20 ? "text-warning" : "text-destructive",
                "text-5xl"
              )}>
                {vault.juniorHealth}%
              </div>

              <HealthMeter health={vault.juniorHealth} size="lg" showLabel={false} />

              <div className="grid grid-cols-3 gap-2 mt-4">
                {[
                  { label: "Critical", sub: "< 20%", color: "bg-destructive" },
                  { label: "Caution", sub: "< 50%", color: "bg-warning" },
                  { label: "Healthy", sub: "≥ 50%", color: "bg-success" },
                ].map(s => (
                  <div key={s.label}>
                    <div className={`w-full h-0.5 ${s.color} rounded-full mb-1.5`} />
                    <div className="font-mono text-[10px] text-muted-foreground">{s.label}</div>
                    <div className="font-mono text-[10px] text-muted-foreground/60">{s.sub}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Deposit / Withdraw */}
            <div className="surface-elevated rounded-[11px] overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

              {/* Tab switcher */}
              <div className="flex border-b border-border/50">
                {(["deposit", "withdraw"] as const).map(tab => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { setActivePanel(tab); setAmount(""); }}
                    className={cn(
                      "flex-1 py-3 font-display font-semibold text-[13px] capitalize transition-colors border-b-2",
                      activePanel === tab
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <div className="p-5">
                {vault.status === "paper" ? (
                  <Banner variant="info" title="Deposits open after graduation">
                    This vault is still building its on-chain track record.
                  </Banner>
                ) : vault.status === "frozen" ? (
                  <Banner variant="danger" title="Deposits closed">
                    Vault is frozen. Existing investors may withdraw.
                  </Banner>
                ) : (
                  <div className="space-y-3">
                    {/* Amount input */}
                    <div>
                      <div className="flex justify-between font-mono text-[10px] text-muted-foreground mb-1.5 uppercase tracking-[0.1em]">
                        <span>Amount</span>
                        {activePanel === "withdraw" && investorPosition && (
                          <button
                            className="text-primary hover:underline"
                            onClick={() => setAmount(String(Number(withdrawableUsdc) / 1e6))}
                          >
                            Max: {fmtUSD(Number(withdrawableUsdc) / 1e6, { compact: true })} USDC
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          aria-label="Amount"
                          value={amount}
                          onChange={e => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                          placeholder="0.00"
                          className="pr-16 text-lg tabular h-12 font-mono"
                          inputMode="decimal"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[12px] text-muted-foreground">USDC</span>
                      </div>
                    </div>

                    {/* Quick amounts */}
                    <div className="grid grid-cols-4 gap-1.5">
                      {QUICK_USDC_AMOUNTS.map(p => (
                        <button
                          key={p}
                          type="button"
                          onClick={() => setAmount(String(p))}
                          className={cn(
                            "h-8 text-[11px] font-mono rounded-md border transition-colors",
                            amount === String(p)
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-secondary hover:bg-accent text-muted-foreground"
                          )}
                        >
                          {fmtUSD(p, { compact: true })}
                        </button>
                      ))}
                    </div>

                    {vault.juniorHealth < 30 && activePanel === "deposit" && (
                      <Banner variant="warning" title="Low junior buffer">
                        Health below 30%. Consider waiting for recovery.
                      </Banner>
                    )}

                    <Button
                      onClick={activePanel === "deposit" ? handleDeposit : handleWithdraw}
                      disabled={sending || !hasValidAmount}
                      className={cn(
                        "w-full h-11 font-display font-semibold border-0",
                        activePanel === "deposit"
                          ? "bg-primary text-primary-foreground hover:bg-primary-glow shadow-signal"
                          : "bg-secondary text-foreground hover:bg-accent"
                      )}
                    >
                      {sending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
                      {activePanel === "deposit" ? "Deposit USDC" : "Withdraw USDC"}
                    </Button>

                    <p className="font-mono text-[10px] text-muted-foreground text-center leading-relaxed">
                      {activePanel === "deposit"
                        ? "Senior deposits — first loss always absorbed by trader junior capital"
                        : "24h cooldown · instant if junior health below 20%"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Alerts panel */}
            {connected && role === "investor" && (
              <div className="surface rounded-[11px] p-5">
                <h3 className="font-display font-semibold text-[14px] flex items-center gap-2 mb-4">
                  <Bell className="w-4 h-4 text-primary" /> Position alerts
                </h3>
                <div className="space-y-2.5">
                  {[
                    "Junior health drops below threshold",
                    "Vault enters cooldown",
                    "Vault frozen",
                    "Performance fee claimed",
                  ].map(a => (
                    <label key={a} className="flex items-start gap-2.5 cursor-pointer group">
                      <input type="checkbox" defaultChecked className="mt-0.5 accent-primary" />
                      <span className="font-mono text-[11px] text-foreground/75 group-hover:text-foreground transition-colors leading-relaxed">{a}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default VaultDetail;
