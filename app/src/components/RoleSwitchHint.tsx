import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRightLeft, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useWallet, type Role } from "@/lib/wallet";

const SESSION_KEY = "arcadia.role-hint.dismissed";

const roleLabel: Record<Role, string> = {
  investor: "Investor",
  trader: "Trader",
};

const oppositeRole: Record<Role, Role> = {
  investor: "trader",
  trader: "investor",
};

export const RoleSwitchHint = () => {
  const { connected, role, setRole } = useWallet();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => sessionStorage.getItem(SESSION_KEY) === "true");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!connected || dismissed) {
      setVisible(false);
      return;
    }

    const showTimer = window.setTimeout(() => setVisible(true), 450);
    const hideTimer = window.setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem(SESSION_KEY, "true");
      setDismissed(true);
    }, 9500);

    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [connected, dismissed]);

  if (!visible) return null;

  const nextRole = oppositeRole[role];

  const dismiss = () => {
    sessionStorage.setItem(SESSION_KEY, "true");
    setDismissed(true);
    setVisible(false);
  };

  const switchRole = () => {
    setRole(nextRole);
    navigate("/");
    toast.success(`Switched to ${roleLabel[nextRole]} mode`);
    dismiss();
  };

  return (
    <aside className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-xl border border-primary/25 bg-background/92 p-4 shadow-[0_24px_90px_hsl(var(--primary)/0.18)] backdrop-blur-xl sm:inset-x-auto sm:right-5 sm:top-20 sm:bottom-auto">
      <div className="flex gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
          <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-sm font-semibold text-foreground">
                You are in {roleLabel[role]} mode.
              </p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Switch anytime from the wallet menu, or jump to the other Arcadia experience now.
              </p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              className="-mr-1 -mt-1 rounded-md p-1 text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Dismiss role switch hint"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={switchRole}
            className="mt-3 h-8 border-0 bg-primary px-3 text-xs font-semibold text-primary-foreground hover:bg-primary-glow"
          >
            Switch to {roleLabel[nextRole]}
          </Button>
        </div>
      </div>
    </aside>
  );
};

