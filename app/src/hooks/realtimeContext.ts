import { createContext, useContext } from "react";

export type RealtimeStatus = "disabled" | "connecting" | "live" | "reconnecting" | "polling";

export interface RealtimeContextValue {
  status: RealtimeStatus;
  lastEventAt: number | null;
}

export const RealtimeContext = createContext<RealtimeContextValue>({
  status: "disabled",
  lastEventAt: null,
});

export function useRealtimeStatus() {
  return useContext(RealtimeContext);
}
