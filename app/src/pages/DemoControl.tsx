import { useEffect, useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Activity, AlertTriangle, Check, Circle, Loader2, Pause, Play, RadioTower, RefreshCw, ShieldCheck, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useRealtimeStatus } from "@/hooks/realtimeContext";
import { useDataMode } from "@/hooks/useDataMode";
import { useDemoStory } from "@/hooks/useDemoStory";
import { useManagers, useVaults } from "@/hooks/useVaults";
import { useVaultActivity, useVaultNavHistory } from "@/hooks/useVaultLiveData";
import { isArcadiaDemoMode, isArcadiaSurfpoolMode } from "@/lib/api";
import { DEMO_VAULT_CONFIG } from "@/lib/surfpoolDemo";
import type { VaultActivityEvent } from "@/lib/realtime";

const STORY_STEPS = [
  { id: "trader-joins", label: "Trader joins", actor: "Trader", detail: "Profile and reputation record appear." },
  { id: "paper-mode", label: "Paper mode", actor: "Protocol", detail: "Vault starts without investor deposits." },
  { id: "proof-built", label: "Proof built", actor: "Protocol", detail: "Public performance earns visibility." },
  { id: "junior-funded", label: "Junior funded", actor: "Trader", detail: "20,000 USDC first-loss capital posted." },
  { id: "investor-deposit", label: "Investor deposits", actor: "Investor", detail: "80,000 USDC senior capital enters." },
  { id: "jupiter-quote", label: "Jupiter quote", actor: "Market", detail: "Live USDC to SOL quote is fetched." },
  { id: "surfpool-swap", label: "Surfpool swap", actor: "Market", detail: "Execution updates local mainnet-fork state." },
  { id: "profit", label: "Profit", actor: "Market", detail: "NAV rises and fee becomes claimable." },
  { id: "fee-claimed", label: "Fee claimed", actor: "Trader", detail: "Trader earns only above HWM." },
  { id: "investor-withdraw-profit", label: "Mid-vault exit", actor: "Investor", detail: "Investor withdraws without trader approval." },
  { id: "loss-buffer", label: "Loss absorbed", actor: "Protocol", detail: "Trader buffer absorbs the drawdown first." },
  { id: "frozen", label: "Vault freezes", actor: "Protocol", detail: "Protection is exhausted; trading stops." },
  { id: "investor-withdraw-remaining", label: "Remaining claim", actor: "Investor", detail: "Investor exits remaining claim." },
  { id: "trader-withdraw-blocked", label: "Trader blocked", actor: "Protocol", detail: "Trader withdrawal is blocked after freeze." },
  { id: "story-complete", label: "Recording ready", actor: "Protocol", detail: "Full lifecycle completed." },
] as const;

const DemoControl = () => {
  const { status } = useRealtimeStatus();
  const { setMode } = useDataMode();
  const story = useDemoStory();
  const { data: vaults } = useVaults();
  const { data: managers } = useManagers();
  const { data: activity = [] } = useVaultActivity(DEMO_VAULT_CONFIG);
  const { data: navHistory = [] } = useVaultNavHistory(DEMO_VAULT_CONFIG);

  useEffect(() => {
    setMode("real");
  }, [setMode]);

  const vault = vaults?.find((item) => item.configPubkey === DEMO_VAULT_CONFIG) ?? vaults?.[0] ?? null;
  const manager = managers?.find((item) => item.pubkey === vault?.managerPubkey || item.owner === vault?.managerPubkey || item.pubkey === "DemoManager1111111111111111111111111111111") ?? managers?.[0] ?? null;
  const completed = new Set(story.story.completedSteps);
  const activeStep = story.story.activeStep ?? (story.story.lastStep?.stage === "active" ? story.story.lastStep.id : null);
  const completedCount = STORY_STEPS.filter((step) => completed.has(step.id)).length;
  const progressPct = Math.round((completedCount / STORY_STEPS.length) * 100);

  const currentNav = vault?.currentNav ?? 0;
  const previousNav = navHistory?.[1]?.nav ?? navHistory?.[0]?.nav ?? currentNav;
  const navChange = currentNav - previousNav;
  const juniorBase =
    vault?.originalJuniorDepositLamports && vault.originalJuniorDepositLamports > 0n
      ? Number(vault.originalJuniorDepositLamports) / 1_000_000
      : 20_000;
  const juniorPct = Math.max(0, Math.min(100, ((vault?.juniorCapital ?? 0) / juniorBase) * 100));
  const claimableFees = Math.max(0, ((vault?.currentNav ?? 0) - (vault?.highWaterMark ?? 0)) * ((vault?.feeBps ?? 2000) / 10_000));
  const claimedFees = manager?.claimedFees ?? 0;
  const feeState = claimedFees > 0 ? "Claimed" : claimableFees > 0 ? "Claimable" : currentNav > 0 && currentNav < (vault?.highWaterMark ?? 0) ? "No fee in drawdown" : "No fee";
  const investorImpacted = (vault?.seniorCapital ?? 0) > 0 && (vault?.currentNav ?? 0) < (vault?.seniorCapital ?? 0);
  const investorExited = completed.has("investor-withdraw-remaining");
  const investorClaimDetail = investorExited
    ? "claim paid"
    : investorImpacted
      ? "impacted after buffer"
      : vault?.seniorCapital
        ? "protected by junior"
        : "awaiting deposit";
  const riskState = !vault
    ? "Waiting"
    : vault.status === "frozen" || vault.status === "closed"
      ? "Frozen"
      : juniorPct < 25
        ? "Exit priority"
        : juniorPct < 80
          ? "Caution"
          : "Healthy";
  const error = story.error instanceof Error ? story.error.message : story.error ? "Demo backend is unavailable." : null;

  const enrichedActivity = useMemo(() => {
    const live = activity.slice(0, 8);
    if (live.length) return live;
    return [] as VaultActivityEvent[];
  }, [activity]);

  if (!isArcadiaDemoMode()) {
    return (
      <Layout>
        <div className="container max-w-4xl py-12">
          <span className="page-header-label">
            <RadioTower className="h-3 w-3" /> Surfpool preview
          </span>
          <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Jupiter execution is shown in demo mode
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-muted-foreground">
            This devnet app signs real Arcadia program transactions for vault creation, deposits,
            NAV, and withdrawals. Jupiter swap execution is mainnet-only, so Arcadia shows live
            Jupiter quotes with Surfpool local simulation in the recording cockpit.
          </p>
          <div className="mt-6 rounded-2xl border border-border bg-card/80 p-5 font-mono text-xs text-muted-foreground">
            <p className="text-foreground">Run Surfpool preview locally:</p>
            <p className="mt-3">ARCADIA_DEMO_MODE=true ARCADIA_SURFPOOL_MODE=true cargo run --manifest-path server-rs/Cargo.toml</p>
            <p className="mt-2">VITE_ARCADIA_DEMO_MODE=true VITE_ARCADIA_EXECUTION_ENV=surfpool pnpm --dir app dev --host 0.0.0.0 --port 8080</p>
          </div>
          <Button asChild className="mt-6">
            <Link to="/trade">Back to trade terminal</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const busy = story.isBusy || story.story.running;

  return (
    <Layout>
      <div className="container max-w-7xl py-8 lg:py-10">
        <section className="mb-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr] lg:items-end">
          <div>
            <span className="page-header-label">
              <Activity className="h-3 w-3" /> Recording cockpit
            </span>
            <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
              Arcadia live capital demo
            </h1>
            <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground">
              Run the whole product story without wallet popups: trader proof, vault unlock,
              investor deposit, live market quote, profit fees, first-loss protection, freeze logic,
              and enforceable withdrawals.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-start gap-2 lg:justify-end">
            <StatusPill label="Realtime" value={status} tone={status === "live" ? "success" : "warning"} />
            <StatusPill label="Execution" value={isArcadiaSurfpoolMode() ? "Surfpool" : "Demo"} tone="neutral" />
          </div>
        </section>

        {error && (
          <div className="mb-5 rounded-xl border border-danger/30 bg-danger/10 p-4 text-sm text-foreground">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 text-danger" />
              <div>
                <p className="font-semibold">Demo backend is not ready</p>
                <p className="mt-1 text-muted-foreground">{error}</p>
                <p className="mt-1 text-muted-foreground">Start `server-rs` with demo + Surfpool mode, then retry.</p>
              </div>
            </div>
          </div>
        )}

        <section className="mb-6 rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary lg:w-80 lg:flex-none">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {completedCount}/{STORY_STEPS.length} complete
                </span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {story.story.lastStep?.summary ?? "Ready to run the recording flow."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() => story.resetStory.mutate()}
                variant="outline"
                disabled={busy}
                className="h-10"
              >
                {story.resetStory.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Reset
              </Button>
              <Button
                onClick={() => story.runStory.mutate()}
                disabled={busy}
                className="h-10 bg-primary text-primary-foreground hover:bg-primary-glow"
              >
                {story.runStory.isPending || story.story.running ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
                Run cinematic demo
              </Button>
              <Button
                onClick={() => story.stopStory.mutate()}
                variant="outline"
                disabled={!story.story.running || story.stopStory.isPending}
                className="h-10"
              >
                <Pause className="mr-2 h-4 w-4" />
                Stop
              </Button>
              <Button
                onClick={() => story.fetchQuote.mutate()}
                variant="outline"
                disabled={story.fetchQuote.isPending}
                className="h-10"
              >
                {story.fetchQuote.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RadioTower className="mr-2 h-4 w-4" />}
                Fetch quote
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.25fr_0.85fr]">
          <StoryTimeline completed={completed} activeStep={activeStep} />

          <div className="space-y-5">
            <section className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Vault state</p>
                  <h2 className="font-display text-2xl font-semibold">Live capital board</h2>
                </div>
                <RiskBadge state={riskState} />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <KpiCard label="NAV" value={formatUsdc(currentNav)} detail={formatDelta(navChange)} tone={navChange >= 0 ? "success" : "danger"} icon={<TrendingUp className="h-4 w-4" />} />
                <KpiCard label="Liquid USDC" value={formatUsdc(vault?.liquidUsdc ?? currentNav)} detail="withdrawal reserve" icon={<WalletCards className="h-4 w-4" />} />
                <KpiCard label="WSOL exposure" value={formatUsdc(vault?.wsolExposureValue ?? 0)} detail={vault?.executionEnv === "surfpool" ? "Surfpool state" : "not active"} icon={<RadioTower className="h-4 w-4" />} />
                <KpiCard label="Investor claim" value={formatUsdc(vault?.seniorCapital ?? 0)} detail={investorClaimDetail} tone={investorImpacted ? "danger" : investorExited || vault?.seniorCapital ? "success" : "neutral"} icon={<ShieldCheck className="h-4 w-4" />} />
              </div>

              <div className="mt-4 rounded-xl bg-secondary/45 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Junior first-loss buffer</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Trader capital absorbs losses before investor capital is touched.
                    </p>
                  </div>
                  <span className="font-display text-2xl font-semibold">{Math.round(juniorPct)}%</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-background">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${juniorPct < 25 ? "bg-danger" : juniorPct < 80 ? "bg-warning" : "bg-primary"}`}
                    style={{ width: `${juniorPct}%` }}
                  />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <span>Remaining {formatUsdc(vault?.juniorCapital ?? 0)}</span>
                  <span className="text-center">Used {Math.round(100 - juniorPct)}%</span>
                  <span className="text-right">Original {formatUsdc(juniorBase)}</span>
                </div>
              </div>
            </section>

            <QuotePanel quote={story.quote} onSimulate={() => story.runStep.mutate("/demo/surfpool/simulate-swap")} busy={story.runStep.isPending} />
          </div>

          <div className="space-y-5">
            <RolePanel
              title="Trader"
              subtitle="Earns only on performance"
              value={feeState === "Claimed" ? formatUsdc(claimedFees) : feeState === "Claimable" ? formatUsdc(claimableFees) : feeState}
              rows={[
                ["Reputation", manager?.reputationScore ? `${Math.round(manager.reputationScore)}` : "Waiting"],
                ["Junior capital", formatUsdc(vault?.juniorCapital ?? 0)],
                ["Max drawdown", manager?.maxDrawdown !== undefined ? `${manager.maxDrawdown.toFixed(1)}%` : "0.0%"],
                ["Withdrawal", riskState === "Frozen" || riskState === "Exit priority" ? "Blocked" : "Allowed by rules"],
              ]}
              tone={feeState === "Claimable" || feeState === "Claimed" ? "success" : riskState === "Frozen" ? "danger" : "neutral"}
            />
            <RolePanel
              title="Investor"
              subtitle="Sees live vault state"
              value={investorExited ? "Exited" : investorImpacted ? "Impacted" : vault?.seniorCapital ? "Protected" : "Waiting"}
              rows={[
                ["Deposited", vault?.seniorCapital ? "80,000 USDC" : "0 USDC"],
                ["Current claim", formatUsdc(vault?.seniorCapital ?? 0)],
                ["Mid-vault exit", completed.has("investor-withdraw-profit") ? "Settled" : "Ready"],
                ["After freeze", completed.has("investor-withdraw-remaining") ? "Paid remaining claim" : "Exit priority"],
              ]}
              tone={investorImpacted ? "danger" : vault?.seniorCapital ? "success" : "neutral"}
            />
            <ActivityFeed items={enrichedActivity} />
          </div>
        </div>
      </div>
    </Layout>
  );
};

function StoryTimeline({ completed, activeStep }: { completed: Set<string>; activeStep?: string | null }) {
  return (
    <section className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
      <div className="mb-4">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Lifecycle</p>
        <h2 className="font-display text-2xl font-semibold">Visible product intent</h2>
      </div>
      <div className="space-y-2">
        {STORY_STEPS.map((step, index) => {
          const done = completed.has(step.id);
          const active = activeStep === step.id;
          return (
            <div
              key={step.id}
              className={`rounded-xl border p-3 transition-all duration-300 ${
                active
                  ? "border-primary bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]"
                  : done
                    ? "border-primary/30 bg-primary/5"
                    : "border-border bg-secondary/25"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full ${done ? "bg-primary text-primary-foreground" : active ? "bg-primary/20 text-primary" : "bg-background text-muted-foreground"}`}>
                  {done ? <Check className="h-4 w-4" /> : active ? <Loader2 className="h-4 w-4 animate-spin" /> : <Circle className="h-3 w-3" />}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{step.actor}</span>
                  </div>
                  <p className="mt-1 font-display text-base font-semibold">{step.label}</p>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{step.detail}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function QuotePanel({ quote, onSimulate, busy }: { quote: ReturnType<typeof useDemoStory>["quote"]; onSimulate: () => void; busy: boolean }) {
  return (
    <section className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Surfpool + Jupiter</p>
          <h2 className="font-display text-2xl font-semibold">Live quote, local execution</h2>
        </div>
        <RadioTower className="h-5 w-5 text-primary" />
      </div>
      {quote ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <MiniMetric label="Route" value={quote.route} />
          <MiniMetric label="Quote source" value={quote.quoteSource} />
          <MiniMetric label="Input" value={`${formatCompact(quote.inputAmount)} ${quote.inputSymbol}`} />
          <MiniMetric label="Expected output" value={`${formatCompact(quote.expectedOutput)} ${quote.outputSymbol}`} />
          <MiniMetric label="Price impact" value={`${quote.priceImpactPct.toFixed(3)}%`} />
          <MiniMetric label="Execution" value="Surfpool local simulation" />
          <div className="sm:col-span-2 rounded-xl bg-secondary/35 p-3 text-sm text-muted-foreground">
            Route labels: {quote.routeLabels.length ? quote.routeLabels.join(" + ") : "Jupiter best route"}
          </div>
          <Button onClick={onSimulate} disabled={busy} className="sm:col-span-2 h-10 bg-primary text-primary-foreground hover:bg-primary-glow">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Simulate quote on Surfpool
          </Button>
        </div>
      ) : (
        <div className="rounded-xl bg-secondary/35 p-4 text-sm text-muted-foreground">
          Fetch or run the story to show a real Jupiter SOL/USDC quote here. Execution remains local and no mainnet funds are touched.
        </div>
      )}
    </section>
  );
}

function RolePanel({ title, subtitle, value, rows, tone }: { title: string; subtitle: string; value: string; rows: [string, string][]; tone: "success" | "danger" | "neutral" }) {
  return (
    <section className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">{title}</p>
          <h3 className="mt-1 font-display text-xl font-semibold">{subtitle}</h3>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone === "success" ? "bg-primary/15 text-primary" : tone === "danger" ? "bg-danger/15 text-danger" : "bg-secondary text-muted-foreground"}`}>
          {value}
        </span>
      </div>
      <div className="mt-4 space-y-2">
        {rows.map(([label, rowValue]) => (
          <div key={label} className="flex items-center justify-between gap-3 rounded-lg bg-secondary/30 px-3 py-2 text-sm">
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium">{rowValue}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function ActivityFeed({ items }: { items: VaultActivityEvent[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card/80 p-4 shadow-sm">
      <div className="mb-4">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted-foreground">Live feed</p>
        <h2 className="font-display text-xl font-semibold">What viewers see</h2>
      </div>
      {items.length ? (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-xl bg-secondary/30 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="font-medium">{item.label}</p>
                {item.amount !== undefined && <span className="font-mono text-xs text-muted-foreground">{formatUsdc(item.amount)}</span>}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{item.detail}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="rounded-xl bg-secondary/30 p-3 text-sm text-muted-foreground">
          Run the cinematic demo and this feed will fill with deposits, trades, fees, risk changes, withdrawals, and blocked actions.
        </p>
      )}
    </section>
  );
}

function KpiCard({ label, value, detail, tone = "neutral", icon }: { label: string; value: string; detail: string; tone?: "success" | "danger" | "neutral"; icon: ReactNode }) {
  return (
    <div className="rounded-xl bg-secondary/35 p-4">
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span className="font-mono text-xs uppercase tracking-[0.14em]">{label}</span>
        <span className={tone === "success" ? "text-primary" : tone === "danger" ? "text-danger" : "text-muted-foreground"}>{icon}</span>
      </div>
      <p className="mt-3 font-display text-2xl font-semibold">{value}</p>
      <p className={`mt-1 text-sm ${tone === "success" ? "text-primary" : tone === "danger" ? "text-danger" : "text-muted-foreground"}`}>{detail}</p>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/35 p-3">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value}</p>
    </div>
  );
}

function StatusPill({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "neutral" }) {
  return (
    <span className={`rounded-full px-3 py-2 font-mono text-xs uppercase tracking-[0.14em] ${tone === "success" ? "bg-primary/15 text-primary" : tone === "warning" ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground"}`}>
      {label}: <span className="text-foreground">{value}</span>
    </span>
  );
}

function RiskBadge({ state }: { state: string }) {
  const danger = state === "Frozen" || state === "Exit priority";
  const warning = state === "Caution";
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${danger ? "bg-danger/15 text-danger" : warning ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary"}`}>
      {state}
    </span>
  );
}

function formatUsdc(value: number) {
  return `${formatCompact(value)} USDC`;
}

function formatCompact(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: Math.abs(value) >= 100 ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDelta(value: number) {
  if (!Number.isFinite(value) || value === 0) return "flat";
  return `${value > 0 ? "+" : ""}${formatUsdc(value)}`;
}

export default DemoControl;
