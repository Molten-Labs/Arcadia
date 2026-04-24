import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useWallet, type Role } from "@/lib/wallet";
import { Wallet, Shield, TrendingUp, Layers, ArrowRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

export const ConnectModal = ({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) => {
  const { connect, setRole } = useWallet();
  const navigate = useNavigate();
  const [step, setStep] = useState<"role" | "wallet">("role");
  const [chosen, setChosen] = useState<Role | null>(null);

  const reset = () => { setStep("role"); setChosen(null); };

  const handleConnect = () => {
    if (chosen) setRole(chosen);
    connect();
    onOpenChange(false);
    setTimeout(() => {
      navigate(chosen === "trader" ? "/manager" : "/portfolio");
      reset();
    }, 100);
  };

  const wallets = [
    { name: "Phantom", color: "from-purple-500 to-purple-700" },
    { name: "Solflare", color: "from-orange-500 to-yellow-600" },
    { name: "Backpack", color: "from-red-500 to-pink-600" },
    { name: "Demo Wallet", color: "from-primary to-primary-glow" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset(); }}>
      <DialogContent className="surface-elevated border-border-strong sm:max-w-lg">
        {step === "role" ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">How will you use Kiln?</DialogTitle>
              <DialogDescription>
                Pick the experience that fits you. You can switch roles anytime from your wallet menu.
              </DialogDescription>
            </DialogHeader>
            <div className="grid sm:grid-cols-2 gap-3 mt-2">
              <RoleCard
                icon={Layers}
                title="Investor"
                desc="Discover graduated traders, deposit into vaults, and monitor risk in real time."
                bullets={["Browse vetted vaults", "First-loss protection", "Instant exits when buffers thin"]}
                selected={chosen === "investor"}
                onClick={() => setChosen("investor")}
              />
              <RoleCard
                icon={TrendingUp}
                title="Trader"
                desc="Create a vault, fund junior capital, and build an on-chain track record investors trust."
                bullets={["Pro trading terminal", "Earn fees above HWM", "Build reputation tier"]}
                selected={chosen === "trader"}
                onClick={() => setChosen("trader")}
              />
            </div>
            <button
              disabled={!chosen}
              onClick={() => setStep("wallet")}
              className="mt-2 w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-gradient-ember text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Connect a wallet</DialogTitle>
              <DialogDescription>
                Continuing as <span className="text-foreground font-medium">{chosen}</span>. This is a demo — any choice connects a mock address.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 mt-2">
              {wallets.map((w) => (
                <button
                  key={w.name}
                  onClick={handleConnect}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border hover:border-border-strong hover:bg-secondary transition-colors text-left"
                >
                  <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${w.color} flex items-center justify-center`}>
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{w.name}</div>
                    <div className="text-xs text-muted-foreground">{w.name === "Demo Wallet" ? "Recommended for demo" : "Detected"}</div>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => setStep("role")} className="text-xs text-muted-foreground hover:text-foreground self-start">
              ← Change role
            </button>
            <div className="flex items-start gap-2 p-3 rounded-lg bg-info/10 border border-info/20 text-xs text-info-foreground/90">
              <Shield className="w-4 h-4 shrink-0 mt-0.5 text-info" />
              <span>Kiln never custodies your funds. All vaults are non-custodial smart contracts on Solana.</span>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

const RoleCard = ({ icon: Icon, title, desc, bullets, selected, onClick }: {
  icon: typeof Layers; title: string; desc: string; bullets: string[]; selected: boolean; onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={cn(
      "text-left p-4 rounded-xl border transition-all relative overflow-hidden",
      selected
        ? "border-primary bg-primary/5 shadow-ember"
        : "border-border hover:border-border-strong bg-card/50"
    )}
  >
    {selected && (
      <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
        <Check className="w-3 h-3 text-white" />
      </div>
    )}
    <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3", selected ? "bg-gradient-ember" : "bg-secondary")}>
      <Icon className={cn("w-4 h-4", selected ? "text-white" : "text-primary")} />
    </div>
    <div className="font-display font-semibold">{title}</div>
    <p className="text-xs text-muted-foreground mt-1 mb-3">{desc}</p>
    <ul className="space-y-1">
      {bullets.map(b => (
        <li key={b} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
          <span className="w-1 h-1 rounded-full bg-primary mt-1.5" /> {b}
        </li>
      ))}
    </ul>
  </button>
);
