import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { postKilnApi, isArcadiaDemoMode } from "@/lib/api";
import { useRealtimeStatus } from "@/hooks/realtimeContext";
import { useDataMode } from "@/hooks/useDataMode";
import { Activity, Loader2, Play, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const ACTIONS = [
  { label: "Trader joins", path: "/demo/trader-joins" },
  { label: "Create vault", path: "/demo/create-vault" },
  { label: "Trader deposits", path: "/demo/trader-deposit-junior" },
  { label: "Investor deposits", path: "/demo/investor-deposit" },
  { label: "Profit trade", path: "/demo/profit-trade" },
  { label: "Claim fees", path: "/demo/claim-fees" },
  { label: "Loss trade", path: "/demo/loss-trade" },
  { label: "Investor withdraws", path: "/demo/investor-withdraw" },
  { label: "Freeze vault", path: "/demo/freeze-vault" },
  { label: "Trader withdraw blocked", path: "/demo/trader-withdraw" },
] as const;

const DemoControl = () => {
  const { status } = useRealtimeStatus();
  const { setMode } = useDataMode();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    setMode("real");
  }, [setMode]);

  if (!isArcadiaDemoMode()) return <Navigate to="/" replace />;

  const run = async (label: string, path: string) => {
    setPending(label);
    try {
      await postKilnApi(path);
      toast.success(label);
    } catch (error) {
      toast.error("Demo action failed", {
        description: error instanceof Error ? error.message : "Check server demo mode.",
      });
    } finally {
      setPending(null);
    }
  };

  return (
    <Layout>
      <div className="container max-w-5xl py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <span className="page-header-label">
              <Activity className="h-3 w-3" /> Hackathon demo
            </span>
            <h1 className="mt-3 font-display type-h1 font-semibold">Realtime control</h1>
            <p className="mt-2 max-w-xl text-[14px] text-muted-foreground">
              Replay Arcadia’s capital lifecycle without wallet popups. Events go through the server and WebSocket path so every open browser updates live.
            </p>
          </div>
          <div className="rounded-lg bg-secondary/50 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            Realtime: <span className="text-foreground">{status}</span>
          </div>
        </div>

        <div className="surface rounded-[11px] p-5">
          <div className="mb-4 flex flex-wrap gap-2">
            <Button
              onClick={() => run("Reset demo", "/demo/reset")}
              variant="outline"
              disabled={!!pending}
              className="h-10"
            >
              {pending === "Reset demo" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Reset demo
            </Button>
            <Button
              onClick={() => run("Full demo", "/demo/run-full")}
              disabled={!!pending}
              className="h-10 bg-primary text-primary-foreground hover:bg-primary-glow"
            >
              {pending === "Full demo" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
              Run full demo
            </Button>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {ACTIONS.map((action, index) => (
              <button
                key={action.path}
                type="button"
                onClick={() => run(action.label, action.path)}
                disabled={!!pending}
                className="flex min-h-16 items-center justify-between rounded-lg bg-secondary/35 px-4 py-3 text-left transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  <span className="block font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                    Step {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="mt-1 block font-display text-[15px] font-semibold">{action.label}</span>
                </span>
                {pending === action.label && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DemoControl;
