import { useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";

import { trackBusinessEvents, type AnalyticsEventType } from "./business.functions";

function getSessionId(): string {
  try {
    const key = "mm-track-session";
    let id = localStorage.getItem(key);
    if (!id) {
      id =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `s-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return "";
  }
}

export type TrackInput = {
  organizationId: string;
  type: AnalyticsEventType;
  courseId?: string;
};

// Fires engagement events with per-session, per-day dedupe on the client and a
// server-side backstop. Never throws; analytics must not break the visitor UI.
export function useBusinessTracker() {
  const trackFn = useServerFn(trackBusinessEvents);

  return useCallback(
    (events: TrackInput[]) => {
      if (events.length === 0) return;
      const day = new Date().toISOString().slice(0, 10);
      const sessionId = getSessionId();
      const pending = events.filter((event) => {
        if (!sessionId) return true;
        const dedupeKey = `mm-tracked:${day}:${event.organizationId}:${event.type}:${event.courseId ?? "-"}`;
        try {
          if (sessionStorage.getItem(dedupeKey)) return false;
          sessionStorage.setItem(dedupeKey, "1");
        } catch {
          // Storage unavailable; send anyway and rely on server dedupe.
        }
        return true;
      });
      if (pending.length === 0) return;
      void trackFn({
        data: {
          events: pending.map((event) => ({
            organizationId: event.organizationId,
            type: event.type,
            courseId: event.courseId ?? null,
            sessionId,
          })),
        },
      }).catch(() => undefined);
    },
    [trackFn],
  );
}
