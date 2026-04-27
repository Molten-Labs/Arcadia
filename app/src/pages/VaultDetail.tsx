import { useState, type ReactNode } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useVault } from "@/hooks/useVaults";
import { useBalance } from "@/hooks/useBalance";
import { useKilnTransactions } from "@/hooks/useTransactions";
import { StatusBadge } from "@/components/StatusBadge";
import { CapitalStack } from "@/components/CapitalStack";
import { HealthMeter } from "@/components/HealthMeter";
import { StatCard } from "@/components/StatCard";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { fmtUSD } from "@/lib/format";
import { CandlestickChart } from "@/components/CandlestickChart";
import { OrderBook } from "@/components/OrderBook";
import { ArrowLeft, Info, Bell, Zap, Loader2 } from "lucide-react";
import { useWallet, shortAddr } from "@/lib/wallet";
import { toast } from "sonner";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

const LIVE_VIEW_RANGES = ["1H", "4H", "1D", "1W"] as const;
type LiveViewRange = (typeof LIVE_VIEW_RANGES)[number];

const VaultDetail = () => {
    const { id } = useParams();
    const { data: vault, isLoading, error } = useVault(id);
    const { connected, role } = useWallet();
    const { data: balance } = useBalance();
    const { depositSenior, withdrawSenior } = useKilnTransactions();
    const [amount, setAmount] = useState("");
    const [liveViewRange, setLiveViewRange] = useState<LiveViewRange>("1D");
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

    if (!vault || error) return <Navigate to="/vaults" replace />;

    const parsedAmount = Number(amount);
    const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
    const lamports = hasValidAmount ? BigInt(Math.floor(parsedAmount * LAMPORTS_PER_SOL)) : 0n;
    const seniorSharesToBurn =
        hasValidAmount && vault.seniorCapital > 0 && vault.seniorSharesOutstanding > 0
            ? (lamports * BigInt(vault.seniorSharesOutstanding)) / BigInt(Math.floor(vault.seniorCapital * LAMPORTS_PER_SOL))
            : 0n;

    const handleDeposit = async () => {
        if (!connected) { toast.error("Connect a wallet first"); return; }
        if (role !== "investor") { toast.error("Switch to investor mode to deposit"); return; }
        if (vault.status === "paper") { toast.error("Deposits open after graduation"); return; }
        if (vault.status === "frozen") { toast.error("Deposits are closed"); return; }
        if (!hasValidAmount) { toast.error("Enter a valid SOL amount"); return; }
        if (parsedAmount > solBalance) { toast.error("Insufficient SOL balance"); return; }

        setSending(true);
        try {
            await depositSenior(new PublicKey(vault.configPubkey), lamports);
            setAmount("");
        } catch (e) {
            toast.error("Deposit failed", { description: e instanceof Error ? e.message : "Unknown error" });
        } finally {
            setSending(false);
        }
    };

    const handleWithdraw = async () => {
        if (!connected) { toast.error("Connect a wallet first"); return; }
        if (!hasValidAmount) { toast.error("Enter a valid SOL amount"); return; }
        if (seniorSharesToBurn === 0n) { toast.error("Amount is too small for current share price"); return; }

        setSending(true);
        try {
            await withdrawSenior(new PublicKey(vault.configPubkey), seniorSharesToBurn);
            setAmount("");
        } catch (e) {
            toast.error("Withdrawal failed", { description: e instanceof Error ? e.message : "Unknown error" });
        } finally {
            setSending(false);
        }
    };

    const liveViewCount =
        liveViewRange === "1H" ? 20 : liveViewRange === "4H" ? 36 : liveViewRange === "1D" ? 56 : 84;

    const juniorPct = vault.tvl > 0 ? Math.round((vault.juniorCapital / vault.tvl) * 100) : 0;

    return (
        <Layout>
            <div className="container py-8">
                <Link
                    to="/vaults"
                    className="inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground mb-6"
                >
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
                        <div className="text-sm text-muted-foreground">
                            Manager: <span className="font-mono">{shortAddr(vault.managerPubkey)}</span>
                        </div>
                    </div>
                </div>

                {/* Status banners */}
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

                {/* Stats row */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 my-6">
                    <StatCard label="TVL" value={`${fmtUSD(vault.tvl, { decimals: 2 })} SOL`} />
                    <StatCard label="Junior" value={`${fmtUSD(vault.juniorCapital, { decimals: 2 })} SOL`} hint={`${juniorPct}% of TVL`} />
                    <StatCard label="Senior" value={`${fmtUSD(vault.seniorCapital, { decimals: 2 })} SOL`} hint="protected" />
                    <StatCard label="NAV" value={`${fmtUSD(vault.currentNav, { decimals: 2 })} SOL`} />
                    <StatCard label="HWM" value={`${fmtUSD(vault.highWaterMark, { decimals: 2 })} SOL`} />
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
                                    <p className="text-xs text-muted-foreground mt-0.5">SOL/USDC</p>
                                </div>
                                <div className="flex gap-1 text-[11px]">
                                    {LIVE_VIEW_RANGES.map(r => (
                                        <button
                                            key={r}
                                            type="button"
                                            onClick={() => setLiveViewRange(r)}
                                            className={`h-10 rounded px-2 ${r === liveViewRange ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}
                                        >
                                            {r}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="grid lg:grid-cols-[1fr_240px] gap-4">
                                <CandlestickChart count={liveViewCount} height={260} />
                                <OrderBook />
                            </div>
                        </div>

                        {/* Risk & rules */}
                        <div className="surface rounded-2xl p-6">
                            <h3 className="font-display font-semibold mb-4">Risk & rules</h3>
                            <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                <Row label="Paper mode" value={vault.status === "paper" ? "In progress" : "Completed"} />
                                <Row label="Trading" value={vault.tradingEnabled ? "Enabled" : "Disabled"} />
                                <Row label="Current junior ratio" value={`${juniorPct}%`} />
                                <Row label="Manager fee" value={`${vault.feeBps / 100}% of profit above HWM`} />
                                <Row label="Max slippage" value={`${vault.maxSlippageBps / 100}%`} />
                                <Row label="24h loss" value={`${vault.rolling24hLossBps / 100}%`} />
                                <Row label="7d loss" value={`${vault.rolling7dLossBps / 100}%`} />
                                <Row label="Investor cooldown" value="24h standard · instant if junior < 20%" />
                            </dl>
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
                                        <TooltipTrigger asChild>
                                            <button type="button" aria-label="How junior health is calculated" className="inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:text-foreground">
                                                <Info className="w-3.5 h-3.5" />
                                            </button>
                                        </TooltipTrigger>
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
                            <h3 className="font-display font-semibold mb-1">Deposit SOL</h3>
                            <p className="text-xs text-muted-foreground mb-4">24h withdrawal cooldown · instant if junior &lt; 20%</p>

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
                                                <span>Amount</span>
                                                <span>Balance: {solBalance.toFixed(4)} SOL</span>
                                            </div>
                                            <div className="relative">
                                                <Input
                                                    value={amount}
                                                    onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                                                    placeholder="0.00"
                                                    className="pr-14 text-lg tabular h-12"
                                                    inputMode="decimal"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">SOL</span>
                                            </div>
                                        </div>
                                        <div className="flex gap-1.5">
                                            {["25%", "50%", "75%", "MAX"].map(p => (
                                                <button
                                                    key={p}
                                                    type="button"
                                                    onClick={() => setAmount(p === "MAX" ? String(solBalance) : String(solBalance * (parseInt(p) / 100)))}
                                                    className="flex-1 h-10 text-xs py-1.5 rounded-md bg-secondary hover:bg-accent"
                                                >
                                                    {p}
                                                </button>
                                            ))}
                                        </div>
                                        {vault.juniorHealth < 30 && (
                                            <Banner variant="warning" title="Low junior buffer">
                                                Junior health is below 30%. Consider waiting for recovery.
                                            </Banner>
                                        )}
                                    </div>
                                    <Button
                                        onClick={handleDeposit}
                                        disabled={sending || !hasValidAmount}
                                        className="w-full mt-4 bg-gradient-ember text-white border-0 h-11"
                                    >
                                        {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                        Deposit SOL
                                    </Button>
                                    <Button
                                        onClick={handleWithdraw}
                                        disabled={sending}
                                        variant="outline"
                                        className="w-full mt-2"
                                    >
                                        Withdraw SOL
                                    </Button>
                                </>
                            )}
                        </div>

                        {/* Alerts */}
                        {connected && role === "investor" && (
                            <div className="surface rounded-2xl p-6">
                                <h3 className="font-display font-semibold flex items-center gap-2 mb-3">
                                    <Bell className="w-4 h-4" /> Alerts
                                </h3>
                                <div className="space-y-2 text-sm">
                                    {["Junior health drops below threshold", "Vault enters cooldown", "Vault frozen", "Performance fee claimed"].map(a => (
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
        </Layout>
    );
};

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
    <div className="flex justify-between gap-4">
        <dt className="text-muted-foreground">{label}</dt>
        <dd className="font-medium text-right">{value}</dd>
    </div>
);

export default VaultDetail;
