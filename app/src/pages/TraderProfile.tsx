import { useMemo } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useManagers, useVaults } from "@/hooks/useVaults";
import { VaultCard } from "@/components/VaultCard";
import { StatCard } from "@/components/StatCard";
import { fmtUSD } from "@/lib/format";
import { shortAddr } from "@/lib/wallet";
import { ArrowLeft, BadgeCheck, Loader2 } from "lucide-react";

const AVATAR_GRADIENTS = [
  "from-emerald-500 to-teal-600",
  "from-violet-500 to-purple-600",
  "from-sky-500 to-blue-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
];

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
          <Loader2 className="w-4 h-4 animate-spin" /> Loading profile…
        </div>
      </Layout>
    );
  }

  if (!manager) return <Navigate to="/traders" replace />;

  const initials = wallet?.slice(0, 2).toUpperCase() ?? "??";
  const gradientIdx = (wallet?.charCodeAt(0) ?? 0) % AVATAR_GRADIENTS.length;
  const gradient = AVATAR_GRADIENTS[gradientIdx];

  return (
    <Layout>
      <div className="container py-8">
        <Link to="/traders" className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> All traders
        </Link>

        {/* Profile hero */}
        <div className="surface-elevated rounded-[11px] p-6 md:p-8 mb-6 relative overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="flex flex-wrap gap-5 items-start">
            <div className={`w-[72px] h-[72px] rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-white font-display font-bold text-2xl shadow-signal shrink-0`}>
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2.5 mb-1">
                <h1 className="font-mono font-bold text-[22px] tracking-tight">{shortAddr(manager.owner)}</h1>
                <span className="inline-flex items-center gap-1.5 text-[11px] text-success bg-success/10 border border-success/20 rounded-full px-2.5 py-0.5">
                  <BadgeCheck className="w-3 h-3" /> On-chain manager
                </span>
              </div>
              <div className="font-mono text-[11px] text-muted-foreground mt-0.5 break-all">{manager.owner}</div>
              <p className="text-[13px] text-foreground/70 mt-3">
                Joined {new Date(manager.createdAt * 1000).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
              </p>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          <StatCard label="Total vaults" value={manager.totalVaults} />
          <StatCard label="Active vaults" value={manager.activeVaults} />
          <StatCard label="Total AUM" value={`${fmtUSD(totalAum, { compact: true })} USDC`} />
          <StatCard label="Junior deployed" value={`${fmtUSD(manager.totalJuniorDeposited, { compact: true })} USDC`} />
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
      </div>
    </Layout>
  );
};

export default TraderProfile;
