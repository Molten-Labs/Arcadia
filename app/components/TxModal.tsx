import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle2, AlertCircle, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

type Stage = "sign" | "submitted" | "confirmed" | "failed";

export const TxModal = ({ open, onOpenChange, kind = "deposit" }: { open: boolean; onOpenChange: (o: boolean) => void; kind?: string }) => {
  const [stage, setStage] = useState<Stage>("sign");

  useEffect(() => {
    if (!open) return;
    setStage("sign");
    const t1 = setTimeout(() => setStage("submitted"), 900);
    const t2 = setTimeout(() => setStage("confirmed"), 2200);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="surface-elevated sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display capitalize">{kind} transaction</DialogTitle>
        </DialogHeader>
        <div className="py-6 flex flex-col items-center text-center gap-4">
          {stage === "sign" && (
            <>
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-primary animate-pulse" />
              </div>
              <div>
                <div className="font-semibold">Awaiting signature</div>
                <p className="text-sm text-muted-foreground mt-1">Confirm in your wallet to continue.</p>
              </div>
            </>
          )}
          {stage === "submitted" && (
            <>
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <div>
                <div className="font-semibold">Submitting…</div>
                <p className="text-sm text-muted-foreground mt-1">Broadcasting to Solana.</p>
              </div>
            </>
          )}
          {stage === "confirmed" && (
            <>
              <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-success" />
              </div>
              <div>
                <div className="font-semibold">Confirmed</div>
                <p className="text-sm text-muted-foreground mt-1">Transaction settled on-chain.</p>
              </div>
              <Button onClick={() => onOpenChange(false)} className="w-full mt-2">Done</Button>
            </>
          )}
          {stage === "failed" && (
            <>
              <AlertCircle className="w-10 h-10 text-destructive" />
              <div>
                <div className="font-semibold">Transaction failed</div>
                <p className="text-sm text-muted-foreground mt-1">Try again or check your wallet.</p>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
