import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ArrowRightLeft, ShieldAlert, Wallet } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Layout } from "@/components/Layout";
import { useWallet, type Role } from "@/lib/wallet";

type ProtectedRouteProps = {
  children: ReactNode;
  allowedRoles?: Role[];
  requireConnection?: boolean;
  redirectTo?: string;
  mode?: "redirect" | "screen";
};

const roleLabels: Record<Role, string> = {
  investor: "Investor",
  trader: "Trader",
};

export const ProtectedRoute = ({
  children,
  allowedRoles,
  requireConnection = true,
  redirectTo = "/",
  mode = "screen",
}: ProtectedRouteProps) => {
  const location = useLocation();
  const { connected, role, setRole } = useWallet();

  if (requireConnection && !connected) {
    if (mode === "redirect") {
      return <Navigate to={redirectTo} replace state={{ from: location.pathname, reason: "wallet_required" }} />;
    }

    return (
      <AccessScreen
        icon={<Wallet className="h-6 w-6" aria-hidden="true" />}
        eyebrow="Wallet required"
        title="Connect your wallet to continue"
        description="This area is tied to your Arcadia account, vault permissions, and transaction history. Connect from the top navigation, then return to this flow."
        primaryHref="/"
        primaryLabel="Go to home"
        secondaryHref="/vaults"
        secondaryLabel="Explore vaults"
      />
    );
  }

  if (allowedRoles?.length && !allowedRoles.includes(role)) {
    const preferredRole = allowedRoles[0];

    if (mode === "redirect") {
      return <Navigate to="/" replace state={{ from: location.pathname, reason: "role_required" }} />;
    }

    return (
      <AccessScreen
        icon={<ShieldAlert className="h-6 w-6" aria-hidden="true" />}
        eyebrow="Role-gated flow"
        title={`${roleLabels[preferredRole]} access required`}
        description={`You are currently in ${roleLabels[role].toLowerCase()} mode. Switch roles to access this flow without disconnecting your wallet.`}
        primaryLabel={`Switch to ${roleLabels[preferredRole]}`}
        onPrimaryClick={() => {
          setRole(preferredRole);
          toast.success(`Switched to ${roleLabels[preferredRole]} mode`);
        }}
        secondaryHref={preferredRole === "trader" ? "/vaults" : "/manager"}
        secondaryLabel={preferredRole === "trader" ? "View marketplace" : "View manager"}
      />
    );
  }

  return <>{children}</>;
};

const AccessScreen = ({
  icon,
  eyebrow,
  title,
  description,
  primaryLabel,
  primaryHref,
  onPrimaryClick,
  secondaryHref,
  secondaryLabel,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
  description: string;
  primaryLabel: string;
  primaryHref?: string;
  onPrimaryClick?: () => void;
  secondaryHref?: string;
  secondaryLabel?: string;
}) => {
  const primary = primaryHref ? (
    <Button asChild className="bg-gradient-signal text-primary-foreground border-0">
      <Link to={primaryHref}>{primaryLabel}</Link>
    </Button>
  ) : (
    <Button onClick={onPrimaryClick} className="bg-gradient-signal text-primary-foreground border-0">
      <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
      {primaryLabel}
    </Button>
  );

  return (
    <Layout>
      <main className="container flex min-h-[calc(100vh-12rem)] items-center justify-center py-16">
        <section className="surface-elevated relative w-full max-w-xl overflow-hidden rounded-lg p-8 text-center shadow-card">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-signal" />
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
            {icon}
          </div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-primary">{eyebrow}</p>
          <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">{title}</h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
          <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
            {primary}
            {secondaryHref && secondaryLabel && (
              <Button asChild variant="outline">
                <Link to={secondaryHref}>{secondaryLabel}</Link>
              </Button>
            )}
          </div>
        </section>
      </main>
    </Layout>
  );
};

export default ProtectedRoute;
