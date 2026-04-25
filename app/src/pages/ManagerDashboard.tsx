import { Layout } from "@/components/Layout";
import { Link, useNavigate } from "react-router-dom";
import { vaults, traders } from "@/lib/mockData";
import { StatCard } from "@/components/StatCard";
import { StatusBadge } from "@/components/StatusBadge";
import { HealthMeter } from "@/components/HealthMeter";
import { TierBadge } from "@/components/TierBadge";
import { Banner } from "@/components/Banner";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { fmtUSD, fmtPct } from "@/lib/format";
import { Plus, DollarSign, ExternalLink } from "lucide-react";
import { toast } from "sonner";

const ManagerDashboard = () => {
  const navigate = useNavigate();

  // Treat trader[0] as "you"
  const me = traders[0];
  const myVaults = vaults.filter(v => v.traderWallet === me.wallet);
  const aum = myVaults.reduce((s, v) => s + v.tvl, 0);
  const junior = myVaults.reduce((s, v) => s + v.juniorCapital, 0);
  const fees = myVaults.reduce((s, v) => s + v.unclaimedFees, 0);
  const repPct = (me.reputation / me.nextTierAt) * 100;

  const graduationTarget = myVaults.find((v) => v.status === "paper");

  const handleClaimFees = () => {
    if (fees <= 0) {
      toast("No claimable fees yet", {
        description: "Performance fees accrue only above high-water mark.",
      });
      return;
    }

    toast.success("Claim flow started", {
      description: "Open the manager vault to execute claim transaction.",
    });

    const targetVault =
      myVaults.find((v) => v.unclaimedFees > 0) ??
      myVaults.find((v) => v.status === "active");

    if (targetVault) navigate(`/manager/vault/${targetVault.id}`);
  };

  return (
    <Layout>
      <div className="container py-10">
        <div className="flex flex-wrap justify-between gap-4 items-end mb-8">
          <div>
            <h1 className="font-display font-bold text-4xl">Manager dashboard</h1>
            <p className="text-muted-foreground mt-2">Operate your vaults and grow your reputation.</p>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline"><Link to={`/trader/${me.wallet}`}>Public profile <ExternalLink className="w-3.5 h-3.5 ml-1.5" /></Link></Button>
            <Button asChild className="bg-gradient-ember text-white border-0"><Link to="/manager/create"><Plus className="w-4 h-4 mr-1.5" />Create vault</Link></Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <StatCard label="Active vaults" value={myVaults.filter(v => v.status === "active").length} />
          <StatCard label="Paper vaults" value={myVaults.filter(v => v.status === "paper").length} />
          <StatCard label="Total AUM" value={`$${fmtUSD(aum, { compact: true })}`} />
          <StatCard label="Junior deployed" value={`$${fmtUSD(junior, { compact: true })}`} />
          <StatCard label="Unclaimed fees" value={`$${fmtUSD(fees, { compact: true })}`} />
        </div>

        <Banner
          variant="ember"
          title="Vault graduation eligible"
          action={
            <Button
              size="sm"
              className="bg-primary text-white border-0"
              onClick={() => {
                if (!graduationTarget) {
                  toast("No paper vault ready yet");
                  return;
                }
                navigate(`/manager/vault/${graduationTarget.id}`);
              }}
            >
              Graduate
            </Button>
          }
        >
          First Steps has completed performance review and is eligible to graduate.
        </Banner>

        <div className="grid lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-display font-semibold text-lg">My vaults</h2>
            {myVaults.map(v => (
              <Link key={v.id} to={`/manager/vault/${v.id}`} className="surface rounded-2xl p-5 block hover:border-border-strong">
                <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-display font-semibold">{v.name}</span>
                      <StatusBadge status={v.status} />
                    </div>
                  </div>
                  <span className={`tabular text-sm font-semibold ${v.return30d >= 0 ? "text-success" : "text-destructive"}`}>{fmtPct(v.return30d)} 30d</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm border-y border-border py-3 mb-3">
                  <div><div className="text-xs uppercase text-muted-foreground">TVL</div><div className="tabular font-semibold">${fmtUSD(v.tvl, { compact: true })}</div></div>
                  <div><div className="text-xs uppercase text-muted-foreground">Junior</div><div className="tabular font-semibold">${fmtUSD(v.juniorCapital, { compact: true })}</div></div>
                  <div><div className="text-xs uppercase text-muted-foreground">Senior</div><div className="tabular font-semibold">${fmtUSD(v.seniorCapital, { compact: true })}</div></div>
                  <div><div className="text-xs uppercase text-muted-foreground">Max position</div><div className="tabular font-semibold">{v.maxPositionPct}%</div></div>
                </div>
                <HealthMeter health={v.juniorHealth} />
              </Link>
            ))}
          </div>

          <div className="space-y-6">
            <div className="surface rounded-2xl p-6">
              <h3 className="font-display font-semibold mb-4">Reputation</h3>
              <div className="flex items-center gap-2 mb-3"><TierBadge tier={me.tier} /><span className="text-2xl font-display font-bold tabular">{me.reputation}</span></div>
              <Progress value={repPct} className="h-1.5 mb-2" />
              <p className="text-xs text-muted-foreground">{me.nextTierAt - me.reputation} pts to next tier</p>
              <div className="border-t border-border mt-4 pt-4 text-xs space-y-1.5 text-foreground/80">
                <div>✓ Sustained performance · +rep</div>
                <div>✓ No freezes · +rep</div>
                <div>✗ Cooldowns reduce score</div>
              </div>
            </div>

            <div className="surface rounded-2xl p-6">
              <h3 className="font-display font-semibold mb-4 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Quick actions</h3>
              <div className="space-y-2">
                <Button variant="outline" size="sm" className="w-full justify-start" onClick={handleClaimFees}>Claim all fees (${fmtUSD(fees, { compact: true })})</Button>
                <Button variant="outline" size="sm" className="w-full justify-start" asChild><Link to="/manager/create">Create new vault</Link></Button>
              </div>
            </div>

            <div className="surface rounded-2xl p-6">
              <h3 className="font-display font-semibold mb-4">Warnings</h3>
              <ul className="text-sm space-y-2 text-foreground/80">
                <li>• First Steps eligible for graduation</li>
                <li>• No vaults in cooldown</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default ManagerDashboard;
