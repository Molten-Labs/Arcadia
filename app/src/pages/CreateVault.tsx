import { useState, type ReactNode } from "react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Banner } from "@/components/Banner";
import { Check, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { TxModal, type Stage as TxStage } from "@/components/TxModal";
import { cn } from "@/lib/utils";

const steps = ["Identity", "Risk setup", "Junior capital", "Paper mode", "Review"];

const CreateVault = () => {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [risk, setRisk] = useState<"conservative" | "balanced" | "aggressive">("balanced");
  const [junior, setJunior] = useState("10000");
  const [accept, setAccept] = useState(false);
  const [tx, setTx] = useState(false);
  const [txStage, setTxStage] = useState<TxStage>("sign");
  const navigate = useNavigate();

  const next = () => setStep(s => Math.min(steps.length - 1, s + 1));
  const back = () => setStep(s => Math.max(0, s - 1));

  return (
    <Layout>
      <div className="container py-10 max-w-3xl">
        <h1 className="font-display font-bold text-4xl mb-2">Create vault</h1>
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

        <div className="surface rounded-2xl p-6 md:p-8 min-h-[360px]">
          {step === 0 && (
            <div className="space-y-4">
              <h2 className="font-display font-semibold text-xl">Vault identity</h2>
              <div><label className="text-sm font-medium">Name</label><Input className="mt-1.5" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Ember Macro III" /></div>
              <div><label className="text-sm font-medium">Strategy summary</label><Textarea className="mt-1.5" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Describe your approach..." rows={4} /></div>
              <div><label className="text-sm font-medium">Tags (comma separated)</label><Input className="mt-1.5" placeholder="Momentum, SOL, Macro" /></div>
            </div>
          )}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-display font-semibold text-xl">Risk setup</h2>
              <p className="text-sm text-muted-foreground">Defines what assets your vault can trade and how aggressively.</p>
              <div>
                <label className="text-sm font-medium">Allowed assets</label>
                <Input className="mt-1.5" placeholder="USDC, SOL, ETH, BTC" defaultValue="USDC, SOL, ETH" />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Risk profile</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["conservative", "balanced", "aggressive"] as const).map(r => (
                    <button key={r} onClick={() => setRisk(r)} className={cn("p-4 rounded-xl border text-left", risk === r ? "border-primary bg-primary/5" : "border-border hover:bg-secondary")}>
                      <div className="font-semibold capitalize">{r}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {r === "conservative" && "10% max position, 1% slippage"}
                        {r === "balanced" && "20% max position, 2% slippage"}
                        {r === "aggressive" && "30% max position, 3% slippage"}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-display font-semibold text-xl">Junior capital</h2>
              <p className="text-sm text-muted-foreground">Your first-loss capital. Required to back the vault.</p>
              <div>
                <label className="text-sm font-medium">Junior deposit (USDC)</label>
                <Input className="mt-1.5 text-lg tabular h-12" value={junior} onChange={e => setJunior(e.target.value)} type="number" />
              </div>
              <Banner variant="info" title="Capacity preview">
                With ${parseFloat(junior || "0").toLocaleString()} junior, your vault can support up to ${(parseFloat(junior || "0") * 4).toLocaleString()} TVL at your current tier.
              </Banner>
            </div>
          )}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-display font-semibold text-xl">Paper mode</h2>
              <ul className="space-y-3 text-sm">
                {["30-day paper-mode trading required", "Investor deposits disabled until graduation", "All trades publicly recorded on-chain", "Performance affects future investor trust"].map(t => (
                  <li key={t} className="flex items-start gap-2"><Check className="w-4 h-4 text-primary mt-0.5 shrink-0" />{t}</li>
                ))}
              </ul>
              <label className="flex items-start gap-2 mt-6 p-4 rounded-xl border border-border cursor-pointer">
                <input type="checkbox" checked={accept} onChange={e => setAccept(e.target.checked)} className="mt-1 accent-primary" />
                <span className="text-sm">I understand this vault starts in paper mode and cannot accept investor deposits until graduation.</span>
              </label>
            </div>
          )}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-display font-semibold text-xl">Review</h2>
              <dl className="text-sm space-y-2 surface-elevated rounded-xl p-4">
                <Row label="Name" value={name || "—"} />
                <Row label="Risk profile" value={<span className="capitalize">{risk}</span>} />
                <Row label="Junior deposit" value={`$${parseFloat(junior || "0").toLocaleString()} USDC`} />
                <Row label="Paper mode ends" value={new Date(Date.now() + 30 * 86400000).toLocaleDateString()} />
                <Row label="Estimated gas" value="~0.0008 SOL" />
              </dl>
            </div>
          )}

          <div className="flex justify-between mt-8 pt-6 border-t border-border">
            <Button variant="outline" onClick={back} disabled={step === 0}>Back</Button>
            {step < steps.length - 1 ? (
              <Button onClick={next} className="bg-gradient-ember text-white border-0" disabled={(step === 0 && !name) || (step === 3 && !accept)}>Continue</Button>
            ) : (
              <Button
                onClick={() => {
                  setTxStage("sign");
                  setTx(true);
                }}
                className="bg-gradient-ember text-white border-0"
              >
                Create & fund vault
              </Button>
            )}
          </div>
        </div>
      </div>
      <TxModal
        open={tx}
        onOpenChange={(o) => {
          setTx(o);
          if (!o && txStage === "confirmed") {
            toast.success("Vault created!");
            navigate("/manager");
          }
        }}
        onStageChange={setTxStage}
        kind="create"
      />
    </Layout>
  );
};

const Row = ({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) => <div className="flex justify-between"><dt className="text-muted-foreground">{label}</dt><dd className="font-medium">{value}</dd></div>;

export default CreateVault;
