import { useParams, Link, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { traders, vaults } from "@/lib/mockData";
import { TierBadge } from "@/components/TierBadge";
import { VaultCard } from "@/components/VaultCard";
import { StatCard } from "@/components/StatCard";
import { NavChart } from "@/components/NavChart";
import { Progress } from "@/components/ui/progress";
import { fmtUSD, fmtPct, fmtDate } from "@/lib/format";
import { ArrowLeft, BadgeCheck } from "lucide-react";

const TraderProfile = () => {
  const { wallet } = useParams();
  const trader = traders.find(t => t.wallet === wallet);
  if (!trader) return <Navigate to="/traders" replace />;

  const myVaults = vaults.filter(v => v.traderWallet === trader.wallet);
  const activeVaults = myVaults.filter(v => v.status === "active" || v.status === "paper");
  const pastVaults = myVaults.filter(v => v.status === "frozen" || v.status === "closed");
  const initials = trader.name.split(" ").map(n => n[0]).join("");
  const repPct = (trader.reputation / trader.nextTierAt) * 100;

  // Aggregate nav for timeline
  const aggregate = vaults[0].navHistory.map((p, i) => ({
    t: p.t,
    nav: myVaults.reduce((s, v) => s + (v.navHistory[i]?.nav || 0), 0),
  }));

  return (
    <Layout>
      <div className="container py-8">
        <Link to="/traders" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> All traders
        </Link>

        {/* Hero */}
        <div className="surface-elevated rounded-2xl p-6 md:p-8 mb-6">
          <div className="flex flex-wrap gap-6 items-start">
            <div className="w-20 h-20 rounded-full bg-gradient-ember flex items-center justify-center text-white font-display font-bold text-2xl shadow-ember shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display font-bold text-3xl">{trader.name}</h1>
                <TierBadge tier={trader.tier} />
                <span className="inline-flex items-center gap-1 text-xs text-success">
                  <BadgeCheck className="w-3.5 h-3.5" /> Verified on-chain
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-1 font-mono">@{trader.handle} · joined {fmtDate(trader.joinedAt)}</div>
              <p className="text-foreground/80 mt-3 max-w-2xl">{trader.bio}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {trader.strategyTags.map(t => (
                  <span key={t} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{t}</span>
                ))}
              </div>
            </div>
            <div className="w-full md:w-72 surface rounded-xl p-4">
              <div className="flex items-center justify-between text-xs mb-2">
                <span className="text-muted-foreground">Reputation</span>
                <span className="tabular font-semibold">{trader.reputation} / {trader.nextTierAt}</span>
              </div>
              <Progress value={repPct} className="h-1.5" />
              <div className="text-[11px] text-muted-foreground mt-2">{trader.nextTierAt - trader.reputation} pts to next tier</div>
            </div>
          </div>
        </div>

        {/* Performance */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="All-time PnL" value={fmtPct(trader.pnlAllTime)} hint={`max DD ${fmtPct(trader.maxDrawdown)}`} />
          <StatCard label="90d return" value={fmtPct(trader.pnl90d)} />
          <StatCard label="30d return" value={fmtPct(trader.pnl30d)} />
          <StatCard label="Total AUM" value={`$${fmtUSD(trader.totalAUM, { compact: true })}`} hint={`${trader.activeVaults} active`} />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="surface rounded-2xl p-6">
              <h3 className="font-display font-semibold mb-4">Managed NAV — all-time</h3>
              <NavChart data={aggregate} />
            </div>

            <div className="surface rounded-2xl p-6">
              <h3 className="font-display font-semibold mb-1">Active vaults</h3>
              <p className="text-xs text-muted-foreground mb-4">{activeVaults.length} live</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {activeVaults.map(v => <VaultCard key={v.id} vault={v} />)}
              </div>
            </div>

            {pastVaults.length > 0 && (
              <div className="surface rounded-2xl p-6">
                <h3 className="font-display font-semibold mb-4">Past vaults</h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  {pastVaults.map(v => <VaultCard key={v.id} vault={v} />)}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <div className="surface rounded-2xl p-6">
              <h3 className="font-display font-semibold mb-4">Risk behavior</h3>
              <dl className="space-y-3 text-sm">
                <Row label="Vault freezes" value={trader.freezeCount} good={trader.freezeCount === 0} />
                <Row label="Cooldowns triggered" value={trader.cooldownCount} />
                <Row label="Avg junior ratio" value={`${trader.avgJuniorRatio}%`} />
                <Row label="Largest drawdown" value={fmtPct(trader.maxDrawdown)} />
                <Row label="Longest paper record" value={`${trader.longestPaperRecord}d`} />
                <Row label="Avg recovery" value={`${trader.avgRecoveryDays}d`} />
              </dl>
            </div>

            <div className="surface rounded-2xl p-6">
              <h3 className="font-display font-semibold mb-3">Strategy</h3>
              <p className="text-sm text-foreground/80">{trader.strategy}</p>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

const Row = ({ label, value, good }: { label: string; value: React.ReactNode; good?: boolean }) => (
  <div className="flex justify-between">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className={`font-medium tabular ${good ? "text-success" : ""}`}>{value}</dd>
  </div>
);

export default TraderProfile;
