import { useMemo } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useManagers, useVaults } from "@/hooks/useVaults";
import { VaultCard } from "@/components/VaultCard";
import { StatCard } from "@/components/StatCard";
import { fmtUSD } from "@/lib/format";
import { shortAddr } from "@/lib/wallet";
import { ArrowLeft, BadgeCheck, Loader2 } from "lucide-react";

const TraderProfile = () => {
  const { wallet } = useParams();
  const { data: managers, isLoading: loadingManagers } = useManagers();
  const { data: allVaults, isLoading: loadingVaults } = useVaults();

  const manager = useMemo(
    () => managers?.find(m => m.owner === wallet),
    [managers, wallet]
  );

  const myVaults = useMemo(
    () => (allVaults ?? []).filter(v => v.managerPubkey === wallet),
    [allVaults, wallet]
  );

  const activeVaults = myVaults.filter(v => v.status === "active" || v.status === "paper");
  const pastVaults = myVaults.filter(v => v.status === "frozen" || v.status === "closed");
  const totalAum = myVaults.reduce((s, v) => s + v.tvl, 0);

  if (loadingManagers || loadingVaults) {
    return (
      <Layout>
        <div className="container py-20 text-center text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading profile...
        </div>
      </Layout>
    );
  }

  if (!manager) return <Navigate to="/traders" replace />;

  const initials = wallet?.slice(0, 2).toUpperCase() ?? "??";

  return (
    <Layout>
      <div className="container py-8">
        <Link to="/traders" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
          <ArrowLeft className="w-3.5 h-3.5" /> All traders
        </Link>

        {/* Hero */}
        <div className="surface-elevated rounded-lg p-6 md:p-8 mb-6">
          <div className="flex flex-wrap gap-6 items-start">
            <div className="w-20 h-20 rounded-full bg-gradient-signal flex items-center justify-center text-primary-foreground font-display type-h3 font-semibold shadow-signal shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="font-display type-h2 font-semibold font-mono">{shortAddr(manager.owner)}</h1>
                <span className="inline-flex items-center gap-1 text-xs text-success">
                  <BadgeCheck className="w-3.5 h-3.5" /> On-chain manager
                </span>
              </div>
              <div className="text-sm text-muted-foreground mt-1 font-mono break-all">{manager.owner}</div>
              <p className="text-foreground/80 mt-3 max-w-2xl">
                Joined {new Date(manager.createdAt * 1000).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>

        {/* Performance */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="Total vaults" value={manager.totalVaults} />
          <StatCard label="Active vaults" value={manager.activeVaults} />
          <StatCard label="Total AUM" value={`${fmtUSD(totalAum, { compact: true })} USDC`} />
          <StatCard label="Junior deployed" value={`${fmtUSD(manager.totalJuniorDeposited, { compact: true })} USDC`} />
        </div>

        <div className="space-y-6">
          {activeVaults.length > 0 && (
            <div className="surface rounded-lg p-6">
              <h3 className="font-display font-semibold mb-1">Active vaults</h3>
              <p className="text-xs text-muted-foreground mb-4">{activeVaults.length} live</p>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {activeVaults.map(v => <VaultCard key={v.id} vault={v} />)}
              </div>
            </div>
          )}

          {pastVaults.length > 0 && (
            <div className="surface rounded-lg p-6">
              <h3 className="font-display font-semibold mb-4">Past vaults</h3>
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
                {pastVaults.map(v => <VaultCard key={v.id} vault={v} />)}
              </div>
            </div>
          )}

          {myVaults.length === 0 && (
            <div className="surface rounded-lg p-10 text-center text-muted-foreground">
              This manager has no vaults yet.
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
};

export default TraderProfile;
