import { useMemo } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useManagers, useVaults } from "@/hooks/useVaults";
import { VaultCard } from "@/components/VaultCard";
import { StatCard } from "@/components/StatCard";
import { fmtUSD } from "@/lib/format";
import { shortAddr } from "@/lib/wallet";
import { useDataMode } from "@/hooks/useDataMode";
import { traders, getTrader, type Trader } from "@/lib/mockData";
import { cn } from "@/lib/utils";
import { ArrowLeft, BadgeCheck, Shield, TrendingUp, TrendingDown, Loader2, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

const AVATAR_GRADIENTS = [
  "from-primary to-primary-glow",
  "from-primary-deep to-primary",
  "from-foreground to-primary",
  "from-primary-glow to-primary",
  "from-primary-deep to-primary-glow",
];

const TIER_COLOR: Record<string, string> = {
  elite: "text-yellow-400 bg-yellow-400/10 border-yellow-400/30",
  veteran: "text-primary bg-primary/10 border-primary/30",
  established: "text-success bg-success/10 border-success/30",
  proven: "text-foreground/80 bg-secondary border-border",
  novice: "text-muted-foreground bg-secondary/50 border-border/50",
};

const Stat = ({ label, value, trend }: { label: string; value: string; trend?: number }) => (
  <div className="surface rounded-lg p-4 relative overflow-hidden">
    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
    <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground mb-1">{label}</div>
    <div className="flex items-end gap-2">
      <div className="font-display font-semibold text-xl tabular leading-none">{value}</div>
      {trend !== undefined && (
        <div className={cn("flex items-center gap-0.5 font-mono text-[10px] mb-0.5", trend >= 0 ? "text-success" : "text-destructive")}>
          {trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          {trend >= 0 ? "+" : ""}{trend.toFixed(1)}%
        </div>
      )}
    </div>
  </div>
);

const MockProfile = ({ trader, vaults: myVaults }: { trader: Trader; vaults: ReturnType<typeof useVaults>["data"] }) => {
  const activeVaults = (myVaults ?? []).filter(v => v.status === "active" || v.status === "paper");
  const pastVaults   = (myVaults ?? []).filter(v => v.status === "frozen" || v.status === "closed");
  const totalAum     = (myVaults ?? []).reduce((s, v) => s + v.tvl, 0);
  const gradientIdx  = trader.wallet.charCodeAt(0) % AVATAR_GRADIENTS.length;
  const gradient     = AVATAR_GRADIENTS[gradientIdx];

  return (
    <>
      {/* Hero */}
      <div className="surface-elevated rounded-2xl p-6 md:p-8 mb-6 relative overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="flex flex-wrap gap-5 items-start">
          <div className={`w-[72px] h-[72px] rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-display font-bold text-2xl shadow-signal shrink-0`}>
            {trader.name.slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5 mb-1">
              <h1 className="font-display font-bold text-[22px] tracking-tight">{trader.name}</h1>
              <span className={cn(
                "inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] border rounded-full px-2.5 py-0.5",
                TIER_COLOR[trader.tier] ?? TIER_COLOR.novice
              )}>
                <BadgeCheck className="w-3 h-3" /> {trader.tier}
              </span>
            </div>
            <div className="font-mono text-[11px] text-muted-foreground">@{trader.handle}</div>
            <p className="text-[13px] text-foreground/70 mt-3 max-w-lg leading-relaxed">{trader.bio}</p>
          </div>
        </div>

        {/* Strategy tags */}
        <div className="flex flex-wrap gap-1.5 mt-5">
          {trader.strategyTags.map(tag => (
            <span key={tag} className="font-mono text-[10px] text-muted-foreground bg-secondary border border-border/60 rounded-full px-2.5 py-1">
              {tag}
            </span>
          ))}
        </div>

        {/* Reputation bar */}
        <div className="mt-5">
          <div className="flex justify-between font-mono text-[10px] text-muted-foreground mb-1.5">
            <span>Reputation</span>
            <span>{trader.reputation} / {trader.nextTierAt}</span>
          </div>
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-primary-deep to-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (trader.reputation / trader.nextTierAt) * 100)}%` }}
              transition={{ duration: 0.8, ease: "easeOut", delay: 0.2 }}
            />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="30d PnL" value={`${trader.pnl30d >= 0 ? "+" : ""}${trader.pnl30d.toFixed(1)}%`} trend={trader.pnl30d} />
        <Stat label="90d PnL" value={`${trader.pnl90d >= 0 ? "+" : ""}${trader.pnl90d.toFixed(1)}%`} trend={trader.pnl90d} />
        <Stat label="All-time" value={`${trader.pnlAllTime >= 0 ? "+" : ""}${trader.pnlAllTime.toFixed(1)}%`} trend={trader.pnlAllTime} />
        <Stat label="Max drawdown" value={`${trader.maxDrawdown.toFixed(1)}%`} />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        <Stat label="Total AUM" value={`${fmtUSD(totalAum, { compact: true })} USDC`} />
        <Stat label="Active vaults" value={String(trader.activeVaults)} />
        <Stat label="Graduated" value={String(trader.graduatedVaults)} />
        <Stat label="Avg jr ratio" value={`${trader.avgJuniorRatio}%`} />
      </div>

      {/* Risk badges */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Freezes", value: trader.freezeCount, good: trader.freezeCount === 0, icon: Shield },
          { label: "Cooldowns", value: trader.cooldownCount, good: trader.cooldownCount <= 2, icon: TrendingDown },
          { label: "Longest paper record", value: `${trader.longestPaperRecord}d`, good: true, icon: BadgeCheck },
          { label: "Avg recovery", value: trader.avgRecoveryDays > 0 ? `${trader.avgRecoveryDays}d` : "N/A", good: true, icon: TrendingUp },
        ].map(b => (
          <div key={b.label} className="surface rounded-lg p-4 flex items-center gap-3">
            <b.icon className={cn("w-4 h-4 shrink-0", b.good ? "text-success" : "text-warning")} />
            <div>
              <div className="font-mono text-[10px] text-muted-foreground">{b.label}</div>
              <div className="font-display font-semibold text-[15px]">{b.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Vaults */}
      <div className="space-y-6">
        {activeVaults.length > 0 && (
          <div className="surface rounded-[11px] p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display font-semibold text-[15px]">Active vaults</h3>
              <span className="font-mono text-[11px] text-muted-foreground">{activeVaults.length} live</span>
            </div>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeVaults.map(v => <VaultCard key={v.id} vault={v} />)}
            </div>
          </div>
        )}
        {pastVaults.length > 0 && (
          <div className="surface rounded-[11px] p-5">
            <h3 className="font-display font-semibold text-[15px] mb-4">Past vaults</h3>
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
              {pastVaults.map(v => <VaultCard key={v.id} vault={v} />)}
            </div>
          </div>
        )}
        {(myVaults ?? []).length === 0 && (
          <div className="surface rounded-[11px] p-12 text-center text-muted-foreground text-sm">
            This manager has no vaults yet.
          </div>
        )}
      </div>
    </>
  );
};

const TraderProfile = () => {
  const { wallet } = useParams();
  const { isMock } = useDataMode();
  const { data: managers, isLoading: loadingManagers } = useManagers();
  const { data: allVaults, isLoading: loadingVaults } = useVaults();

  const manager = useMemo(
    () => managers?.find(m => m.owner === wallet),
    [managers, wallet]
  );

  const mockTrader = useMemo(
    () => (isMock && wallet ? getTrader(wallet) : undefined),
    [isMock, wallet]
  );

  const myVaults = useMemo(
    () => (allVaults ?? []).filter(v => v.managerPubkey === wallet),
    [allVaults, wallet]
  );

  const activeVaults = myVaults.filter(v => v.status === "active" || v.status === "paper");
  const pastVaults   = myVaults.filter(v => v.status === "frozen" || v.status === "closed");
  const totalAum     = myVaults.reduce((s, v) => s + v.tvl, 0);

  if (loadingManagers || loadingVaults) {
    return (
      <Layout>
        <div className="container py-20 text-center text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading profile…
        </div>
      </Layout>
    );
  }

  if (!manager && !mockTrader) return <Navigate to="/traders" replace />;

  const initials = (mockTrader?.name ?? wallet)?.slice(0, 2).toUpperCase() ?? "??";
  const gradientIdx = (wallet?.charCodeAt(0) ?? 0) % AVATAR_GRADIENTS.length;
  const gradient = AVATAR_GRADIENTS[gradientIdx];

  return (
    <Layout>
      <div className="container py-8">
        <Link to="/traders" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> All traders
        </Link>

        {/* Rich mock view */}
        {mockTrader ? (
          <MockProfile trader={mockTrader} vaults={myVaults.length > 0 ? myVaults : undefined} />
        ) : (
          <>
            {/* On-chain fallback */}
            <div className="surface-elevated rounded-2xl p-6 md:p-8 mb-6 relative overflow-hidden">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
              <div className="flex flex-wrap gap-5 items-start">
                <div className={`w-[72px] h-[72px] rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-display font-bold text-2xl shadow-signal shrink-0`}>
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5 mb-1">
                    <h1 className="font-mono font-bold text-[22px] tracking-tight">{shortAddr(manager?.owner ?? wallet ?? "")}</h1>
                    <span className="inline-flex items-center gap-1.5 text-[11px] text-success bg-success/10 border border-success/20 rounded-full px-2.5 py-0.5">
                      <BadgeCheck className="w-3 h-3" /> On-chain manager
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground mt-0.5 break-all">{manager?.owner ?? wallet}</div>
                  {manager && (
                    <p className="text-[13px] text-foreground/70 mt-3">
                      Joined {new Date(manager.createdAt * 1000).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <StatCard label="Total vaults" value={manager?.totalVaults ?? myVaults.length} />
              <StatCard label="Active vaults" value={manager?.activeVaults ?? activeVaults.length} />
              <StatCard label="Total AUM" value={`${fmtUSD(totalAum, { compact: true })} USDC`} />
              <StatCard label="Junior deployed" value={`${fmtUSD(manager?.totalJuniorDeposited ?? 0, { compact: true })} USDC`} />
            </div>

            <div className="space-y-6">
              {activeVaults.length > 0 && (
                <div className="surface rounded-[11px] p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-display font-semibold text-[15px]">Active vaults</h3>
                    <span className="font-mono text-[11px] text-muted-foreground">{activeVaults.length} live</span>
                  </div>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {activeVaults.map(v => <VaultCard key={v.id} vault={v} />)}
                  </div>
                </div>
              )}
              {pastVaults.length > 0 && (
                <div className="surface rounded-[11px] p-5">
                  <h3 className="font-display font-semibold text-[15px] mb-4">Past vaults</h3>
                  <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                    {pastVaults.map(v => <VaultCard key={v.id} vault={v} />)}
                  </div>
                </div>
              )}
              {myVaults.length === 0 && (
                <div className="surface rounded-[11px] p-12 text-center text-muted-foreground text-sm">
                  This manager has no vaults yet.
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

export default TraderProfile;
