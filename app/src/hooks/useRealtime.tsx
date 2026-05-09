import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getArcadiaRealtimeUrl, getKilnApiUrl } from "@/lib/api";
import { useDataMode } from "@/hooks/useDataMode";
import { useWallet } from "@/lib/wallet";
import { normalizeApiPosition } from "@/hooks/usePositions";
import { normalizeVaultView, type ManagerView, type VaultView } from "@/hooks/useVaults";
import { eventToActivity, type DemoStorySnapshot, type NavPoint, type RealtimeEvent, type TradeEvent, type VaultActivityEvent } from "@/lib/realtime";
import type { MarketQuote } from "@/lib/surfpoolDemo";
import { RealtimeContext, type RealtimeContextValue, type RealtimeStatus } from "@/hooks/realtimeContext";

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const value = useRealtimeBridge();
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

function useRealtimeBridge(): RealtimeContextValue {
  const queryClient = useQueryClient();
  const { mode, isMock } = useDataMode();
  const { publicKey } = useWallet();
  const [status, setStatus] = useState<RealtimeStatus>("disabled");
  const [lastEventAt, setLastEventAt] = useState<number | null>(null);
  const retryRef = useRef(0);
  const timeoutRef = useRef<number | undefined>();

  const apiUrl = getKilnApiUrl();
  const realtimeUrl = getArcadiaRealtimeUrl();
  const wallet = publicKey?.toBase58();

  const topics = useMemo(() => {
    const values = ["vaults", "managers"];
    if (wallet) values.push(`positions:${wallet}`);
    return values.join(",");
  }, [wallet]);

  useEffect(() => {
    if (isMock || !apiUrl || !realtimeUrl) {
      setStatus(isMock ? "disabled" : "polling");
      return;
    }

    let closed = false;
    let socket: WebSocket | null = null;

    const connect = () => {
      setStatus(retryRef.current === 0 ? "connecting" : "reconnecting");
      socket = new WebSocket(`${realtimeUrl}?topics=${encodeURIComponent(topics)}`);

      socket.onopen = () => {
        retryRef.current = 0;
        setStatus("live");
      };

      socket.onmessage = (message) => {
        try {
          const event = JSON.parse(message.data) as RealtimeEvent;
          setLastEventAt(Date.now());
          applyRealtimeEvent(queryClient, event, mode, apiUrl, wallet);
        } catch (error) {
          console.warn("Arcadia realtime message ignored", error);
        }
      };

      socket.onerror = () => {
        setStatus("reconnecting");
      };

      socket.onclose = () => {
        if (closed) return;
        retryRef.current += 1;
        const delay = Math.min(10_000, 750 * retryRef.current);
        setStatus(retryRef.current > 5 ? "polling" : "reconnecting");
        timeoutRef.current = window.setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      closed = true;
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      socket?.close();
    };
  }, [apiUrl, isMock, mode, queryClient, realtimeUrl, topics, wallet]);

  return { status, lastEventAt };
}

function applyRealtimeEvent(
  queryClient: ReturnType<typeof useQueryClient>,
  event: RealtimeEvent,
  mode: string,
  apiUrl: string,
  wallet?: string,
) {
  const vaultsKey = ["vaults", mode, apiUrl || "rpc"];
  const managersKey = ["managers", mode, apiUrl || "rpc"];

  if (event.type === "heartbeat") return;

  if (event.type === "resync_required") {
    queryClient.invalidateQueries({ queryKey: ["vaults"] });
    queryClient.invalidateQueries({ queryKey: ["managers"] });
    queryClient.invalidateQueries({ queryKey: ["positions"] });
    queryClient.invalidateQueries({ queryKey: ["demo-story"] });
    return;
  }

  if (event.type === "vault.upsert") {
    const vault = normalizeVaultView(event.item);
    upsertList<VaultView>(queryClient, vaultsKey, vault, (item) => item.configPubkey);
    queryClient.setQueryData(["vault", vault.configPubkey], vault);
    return;
  }

  if (event.type === "manager.upsert") {
    upsertList<ManagerView>(queryClient, managersKey, event.item, (item) => item.pubkey);
    return;
  }

  if (event.type === "position.upsert") {
    const position = normalizeApiPosition(event.item);
    const positionKey = ["positions", mode, event.wallet || wallet || "mock", apiUrl || "rpc"];
    upsertList(queryClient, positionKey, position, (item) => item.pubkey);
    appendActivity(queryClient, event);
    return;
  }

  if (event.type === "nav.point") {
    appendList<NavPoint>(queryClient, ["vault-nav", event.vaultConfigPubkey], event.item, 80);
    return;
  }

  if (event.type === "trade.public") {
    appendList<TradeEvent>(queryClient, ["vault-trades", event.vaultConfigPubkey], event.item, 40);
    appendActivity(queryClient, event);
    return;
  }

  if (event.type === "market.quote") {
    queryClient.setQueryData<MarketQuote>(["market-quote", event.item.vaultConfigPubkey], event.item);
    appendActivity(queryClient, event);
    return;
  }

  if (event.type === "demo.step") {
    queryClient.setQueryData<DemoStorySnapshot>(["demo-story"], (old) => {
      const completed = new Set(old?.completedSteps ?? []);
      if (event.item.stage === "completed") completed.add(event.item.id);
      const terminal = ["story-complete", "stopped", "reset", "story-error"].includes(event.item.id) || event.item.stage === "failed";
      return {
        running: event.item.stage === "active" ? true : terminal ? false : old?.running ?? false,
        activeStep: event.item.stage === "active" ? event.item.id : old?.activeStep === event.item.id ? null : old?.activeStep ?? null,
        completedSteps: Array.from(completed),
        lastStep: event.item,
      };
    });
    appendActivity(queryClient, event);
    return;
  }

  appendActivity(queryClient, event);
}

function upsertList<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: unknown[],
  item: T,
  getKey: (item: T) => string,
) {
  queryClient.setQueryData<T[]>(queryKey, (old = []) => {
    const key = getKey(item);
    const index = old.findIndex((entry) => getKey(entry) === key);
    if (index === -1) return [item, ...old];
    const next = [...old];
    next[index] = item;
    return next;
  });
}

function appendList<T>(
  queryClient: ReturnType<typeof useQueryClient>,
  queryKey: unknown[],
  item: T,
  limit: number,
) {
  queryClient.setQueryData<T[]>(queryKey, (old = []) => [item, ...old].slice(0, limit));
}

function appendActivity(queryClient: ReturnType<typeof useQueryClient>, event: RealtimeEvent) {
  const activity = eventToActivity(event);
  if (!activity) return;
  queryClient.setQueryData<VaultActivityEvent[]>(
    ["vault-activity", activityIdVault(event)],
    (old = []) => [activity, ...old.filter((item) => item.id !== activity.id)].slice(0, 30),
  );
}

function activityIdVault(event: RealtimeEvent): string {
  if ("vaultConfigPubkey" in event) return event.vaultConfigPubkey;
  if ("item" in event && event.item && "vaultConfigPubkey" in event.item) {
    return event.item.vaultConfigPubkey;
  }
  return "global";
}
