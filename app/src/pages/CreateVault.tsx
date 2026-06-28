import { useState, type ReactNode } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Banner } from "@/components/Banner";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useKilnTransactions } from "@/hooks/useTransactions";
import { cn } from "@/lib/utils";
import { PublicKey } from "@solana/web3.js";
import { useWallet } from "@/lib/wallet";
import { getVaultConfigPDA, getManagerProfilePDA } from "@/lib/solana/pdas";
import { parseUsdcToUnits } from "@/lib/solana/amounts";
import { useDataMode } from "@/hooks/useDataMode";
import { mockStore } from "@/lib/mockStore";


const steps = ["Identity", "Risk setup", "Junior capital", "Paper mode", "Review"];

const RISK_PROFILES = {
  conservative: { feeBps: 1500, maxSlippageBps: 100 },
  balanced: { feeBps: 2000, maxSlippageBps: 200 },
  aggressive: { feeBps: 2000, maxSlippageBps: 300 },
} as const;

const CreateVault = () => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [risk, setRisk] = useState<"conservative" | "balanced" | "aggressive">("balanced");
  const [reserveAllocBps, setReserveAllocBps] = useState(1000);
  const [junior, setJunior] = useState("1");
  const [accept, setAccept] = useState(false);
  const [sending, setSending] = useState(false);
  const navigate = useNavigate();
  const { initManager, createVault, depositJunior } = useKilnTransactions();
  const { publicKey, connection } = useWallet();
  const { isMock } = useDataMode();

  const next = () => setStep(s => Math.min(steps.length - 1, s + 1));
  const back = () => setStep(s => Math.max(0, s - 1));

  const handleCreate = async () => {
    const juniorUsdcUnits = parseUsdcToUnits(junior);
    const juniorUsdc = parseFloat(junior || "0");
    if (!Number.isFinite(juniorUsdc) || !juniorUsdcUnits || juniorUsdcUnits <= 0n) { toast.error("Enter a valid junior deposit amount"); return; }

    setSending(true);
    try {
      if (isMock) {
        const profile = RISK_PROFILES[risk];
        await new Promise(r => setTimeout(r, 800));
        toast.info("Initialising manager profile…");
        await new Promise(r => setTimeout(r, 700));
        toast.info("Creating vault on-chain…");
        await new Promise(r => setTimeout(r, 900));
        toast.info("Depositing junior capital…");
        await new Promise(r => setTimeout(r, 700));
        mockStore.createVault({
          name: name.slice(0, 32),
          feeBps: profile.feeBps,
          maxSlippageBps: profile.maxSlippageBps,
          juniorAmount: juniorUsdc,
        });
        toast.success("Vault created & funded!", { description: `${juniorUsdc.toFixed(2)} USDC junior capital posted. Paper mode begins now.` });
        navigate("/manager");
        return;
      }

      if (!publicKey || !connection) { toast.error("Wallet not connected"); return; }
      try {
        await initManager();
      } catch {
        // Manager profile may already exist
      }

      const profile = RISK_PROFILES[risk];
      await createVault({
        name: name.slice(0, 32),
        feeBps: profile.feeBps,
        maxSlippageBps: profile.maxSlippageBps,
        paperWindowSecs: 30 * 24 * 60 * 60,
      });

      const [profilePda] = getManagerProfilePDA(publicKey);
      const profileInfo = await connection.getAccountInfo(profilePda);
      const vaultIndex = profileInfo
        ? Buffer.from(profileInfo.data).readUInt16LE(56) - 1
        : 0;
      const [configPda] = getVaultConfigPDA(publicKey, vaultIndex);

      await depositJunior(configPda, juniorUsdcUnits);

      toast.success("Vault created & funded!");
      navigate("/manager");
    } catch (e) {
      toast.error("Create vault failed", { description: e instanceof Error ? e.message : "Unknown error" });
    } finally {
      setSending(false);
    }
  };

  return (
    <Layout>
      <div className="container py-10 max-w-3xl">
        <h1 className="font-display type-h1 font-semibold mb-2">Create vault</h1>
        <p className="text-muted-foreground mb-8">Launch a new managed vault. Starts in paper mode.</p>

        {/* Stepper */}
        <div className="flex items-center gap-2 mb-8 overflow-x-auto scrollbar-thin pb-2">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2 shrink-0">
              <div className={cn("flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium",
                i === step ? "border-primary text-primary bg-primary/10" :
                i < step ? "border-success/30 text-success bg-success/10" : "border-border text-muted-foreground")}>
                {i < step ? <Check className="w-3 h-3" /> : <span className="tabular">{i + 1}</span>}
                {s}
              </div>
              {i < steps.length - 1 && <ChevronRight className="w-3 h-3 text-muted-foreground" />}
            </div>
          ))}
        </div>

        <div className="surface rounded-lg p-6 md:p-8 min-h-[360px]">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-display type-h3 font-semibold">Vault identity</h2>
              <div>
                <label className="text-sm font-medium">Name (max 32 chars)</label>
                <Input className="mt-1.5" value={name} onChange={e => setName(e.target.value.slice(0, 32))} placeholder="e.g. Signal Macro III" />
              </div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-5">
              <h2 className="font-display type-h3 font-semibold">Risk setup</h2>
              <p className="text-sm text-muted-foreground">Defines fee, slippage, and reserve parameters.</p>
              <div>
                <label className="text-sm font-medium mb-2 block">Risk profile</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["conservative", "balanced", "aggressive"] as const).map(r => (
                    <button key={r} onClick={() => setRisk(r)} className={cn("p-4 rounded-lg border text-left", risk === r ? "border-primary bg-primary/5" : "border-border hover:bg-secondary")}>
                      <div className="font-semibold capitalize">{r}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {r === "conservative" && "15% fee, 1% slippage"}
                        {r === "balanced" && "20% fee, 2% slippage"}
                        {r === "aggressive" && "20% fee, 3% slippage"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Reserve allocation</label>
                <p className="text-xs text-muted-foreground mb-2">Percentage of your performance fees automatically routed into the reserve pool. Higher reserve means stronger investor protection.</p>
                <div className="grid grid-cols-4 gap-2">
                  {[500, 1000, 1500, 2000].map(bps => (
                    <button key={bps} onClick={() => setReserveAllocBps(bps)} className={cn("p-3 rounded-lg border text-center", reserveAllocBps === bps ? "border-primary bg-primary/5" : "border-border hover:bg-secondary")}>
                      <div className="font-semibold text-sm">{bps / 100}%</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display type-h3 font-semibold">Junior capital</h2>
              <p className="text-sm text-muted-foreground">Your first-loss USDC. Required to back the vault.</p>
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                  <label className="text-sm font-medium">Junior deposit (USDC)</label>
                  <span>Base asset: USDC</span>
                </div>
                <Input className="mt-1.5 text-lg tabular h-12" value={junior} onChange={e => setJunior(e.target.value)} type="number" step="0.01" min="0" />
              </div>
              <Banner variant="info" title="Capacity preview">
                With {parseFloat(junior || "0").toFixed(2)} USDC junior, your vault can support up to {(parseFloat(junior || "0") * 4).toFixed(2)} USDC TVL.
              </Banner>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-display type-h3 font-semibold">Paper mode</h2>
              <ul className="space-y-3 text-sm">
                {["30-day paper-mode trading required", "Investor deposits disabled until graduation", "All trades publicly recorded on-chain", "Performance affects future investor trust"].map(t => (
                  <li key={t} className="flex items-start gap-2"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />{t}</li>
                ))}
              </ul>
              <label className="flex items-start gap-2 mt-6 p-4 rounded-lg border border-border cursor-pointer">
                <input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} className="mt-1 accent-primary" />
                <span className="text-sm">I understand this vault starts in paper mode and cannot accept investor deposits until graduation.</span>
              </label>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-display type-h3 font-semibold">Review</h2>
              <dl className="text-sm space-y-2 surface-elevated rounded-lg p-4">
                <Row label="Name" value={name || "—"} />
                <Row label="Risk profile" value={<span className="capitalize">{risk}</span>} />
                <Row label="Fee" value={`${RISK_PROFILES[risk].feeBps / 100}% above HWM`} />
                <Row label="Reserve allocation" value={`${reserveAllocBps / 100}% of fees → reserve`} />
                <Row label="Max slippage" value={`${RISK_PROFILES[risk].maxSlippageBps / 100}%`} />
                <Row label="Junior deposit" value={`${parseFloat(junior || "0").toFixed(4)} USDC`} />
                <Row label="Paper window" value="30 days" />
                <Row label="Estimated gas" value="~0.003 SOL" />
              </dl>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <Button variant="outline" onClick={back} disabled={step === 0}>Back</Button>
            {step < steps.length - 1 ? (
              <Button onClick={next} className="bg-gradient-signal text-primary-foreground border-0" disabled={(step === 0 && !name) || (step === 3 && !accept)}>Continue</Button>
            ) : (
              <Button
                onClick={handleCreate}
                disabled={sending}
                className="bg-gradient-signal text-primary-foreground border-0"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Create & fund vault
              </Button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

const Row = ({ label, value }: { label: string; value: ReactNode }) => (
  <div className="flex justify-between">
    <dt className="text-muted-foreground">{label}</dt>
    <dd className="font-medium">{value}</dd>
  </div>
);

export default CreateVault;
