import { useState } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { useWallet } from "@/lib/wallet";
import { useDataMode } from "@/hooks/useDataMode";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { alerts as RAW_ALERTS } from "@/lib/mockData";
import type { Alert } from "@/lib/mockData";
import {
  Bell, BellRing, ShieldAlert, Zap, Award, TrendingDown,
  AlertTriangle, DollarSign, ExternalLink, Check, CheckCheck,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow } from "date-fns";

const KIND_META: Record<Alert["kind"], { icon: React.ElementType; color: string; label: string }> = {
  cooldown:       { icon: TrendingDown,  color: "text-warning",     label: "Cooldown" },
  freeze:         { icon: ShieldAlert,   color: "text-destructive",  label: "Freeze" },
  junior_low:     { icon: AlertTriangle, color: "text-warning",      label: "Low buffer" },
  instant_exit:   { icon: Zap,           color: "text-primary",      label: "Instant exit" },
  graduate:       { icon: Award,         color: "text-success",      label: "Graduated" },
  fee:            { icon: DollarSign,    color: "text-success",      label: "Fee event" },
  paper_complete: { icon: Award,         color: "text-success",      label: "Paper complete" },
};

const FILTERS = ["all", "unread", "cooldown", "freeze", "junior_low", "instant_exit", "graduate", "fee"] as const;
type Filter = (typeof FILTERS)[number];

const AlertRow = ({
  alert,
  onRead,
}: {
  alert: Alert & { read: boolean };
  onRead: (id: string) => void;
}) => {
  const meta = KIND_META[alert.kind] ?? KIND_META.fee;
  const Icon = meta.icon;
  const ago = formatDistanceToNow(new Date(alert.time), { addSuffix: true });

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6, transition: { duration: 0.18 } }}
      transition={{ duration: 0.28 }}
      className={cn(
        "surface rounded-[11px] p-5 flex gap-4 group relative overflow-hidden transition-all",
        !alert.read && "border-border-strong"
      )}
    >
      {!alert.read && (
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/60 to-transparent" />
      )}

      <div className={cn(
        "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5",
        !alert.read ? "bg-primary/10" : "bg-secondary/60"
      )}>
        <Icon className={cn("w-4 h-4", !alert.read ? meta.color : "text-muted-foreground")} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn(
                "font-display font-semibold text-[14px]",
                alert.read && "text-foreground/70"
              )}>
                {alert.title}
              </span>
              {!alert.read && (
                <span className="inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.1em] text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded-full">
                  New
                </span>
              )}
            </div>
            <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{alert.description}</p>
          </div>
          <div className="text-right shrink-0">
            <div className="font-mono text-[10px] text-muted-foreground">{ago}</div>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3">
          {alert.vaultId && (
            <Link
              to={`/vault/${alert.vaultId}`}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-primary/80 hover:text-primary transition-colors"
            >
              View vault <ExternalLink className="w-2.5 h-2.5" />
            </Link>
          )}
          {!alert.read && (
            <button
              onClick={() => onRead(alert.id)}
              className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              <Check className="w-3 h-3" /> Mark read
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

const Alerts = () => {
  const { connected } = useWallet();
  const { isMock } = useDataMode();
  const [filter, setFilter] = useState<Filter>("all");
  const [readSet, setReadSet] = useState<Set<string>>(
    () => new Set(RAW_ALERTS.filter(a => a.read).map(a => a.id))
  );

  const markRead = (id: string) => setReadSet(prev => new Set([...prev, id]));
  const markAllRead = () => setReadSet(new Set(RAW_ALERTS.map(a => a.id)));

  const enriched = RAW_ALERTS.map(a => ({ ...a, read: readSet.has(a.id) }));

  const filtered = enriched
    .filter(a => {
      if (filter === "all") return true;
      if (filter === "unread") return !a.read;
      return a.kind === filter;
    })
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());

  const unreadCount = enriched.filter(a => !a.read).length;
  const hasContent = isMock || connected;

  return (
    <Layout>
      <div className="container py-10">
        <div className="mb-8 flex flex-wrap justify-between gap-4 items-end">
          <div>
            <span className="page-header-label">
              <BellRing className="w-3 h-3" /> Notifications
            </span>
            <h1 className="font-display type-h1 font-semibold mt-3">Alerts</h1>
            <p className="text-muted-foreground mt-2 text-[14px]">
              Real-time notifications for vault events affecting your positions.
            </p>
          </div>
          {hasContent && unreadCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={markAllRead}
              className="h-8 text-[12px]"
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1.5" />
              Mark all read
            </Button>
          )}
        </div>

        {!hasContent ? (
          <div className="surface rounded-[11px] p-16 text-center">
            <Bell className="w-8 h-8 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-display font-semibold text-[16px] mb-2">Connect your wallet</h3>
            <p className="text-muted-foreground text-[14px]">
              Connect to receive alerts about your vault positions.
            </p>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
              {[
                { label: "Total", value: enriched.length },
                { label: "Unread", value: unreadCount, highlight: unreadCount > 0 },
                { label: "Critical", value: enriched.filter(a => a.kind === "freeze" || a.kind === "instant_exit").length },
                { label: "Action needed", value: enriched.filter(a => !a.read && (a.kind === "freeze" || a.kind === "cooldown" || a.kind === "instant_exit")).length },
              ].map(s => (
                <div key={s.label} className="surface rounded-lg p-4 relative overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />
                  <div className="font-mono text-[10px] uppercase tracking-[0.13em] text-muted-foreground mb-1">{s.label}</div>
                  <div className={cn(
                    "font-display font-semibold text-xl tabular",
                    s.highlight && s.value > 0 ? "text-primary" : ""
                  )}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Filter pills */}
            <div className="flex gap-2 flex-wrap mb-5 overflow-x-auto pb-1">
              {FILTERS.map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    "px-3 py-1.5 rounded-full font-mono text-[10px] uppercase tracking-[0.1em] border transition-all shrink-0",
                    filter === f
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-border-strong hover:text-foreground"
                  )}
                >
                  {f}
                  {f === "unread" && unreadCount > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-primary text-primary-foreground text-[9px]">
                      {unreadCount}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Alert list */}
            {filtered.length === 0 ? (
              <div className="surface rounded-[11px] p-12 text-center text-muted-foreground text-sm">
                No alerts match this filter.
              </div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence mode="popLayout">
                  {filtered.map(alert => (
                    <AlertRow key={alert.id} alert={alert} onRead={markRead} />
                  ))}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>
    </Layout>
  );
};

export default Alerts;
