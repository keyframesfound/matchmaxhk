import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";

import type { EngagementSummary } from "@/features/tutors/engagement";
import { supabase } from "@/integrations/supabase/client";

// Issues #102/#151: client-side engagement tracking + summary fetching.
// Anonymous-only: the viewer is identified by a random localStorage UUID —
// no account link, no IP/UA storage. Every call is fire-and-forget: tracking
// must never break the click or page it wraps (the RPC also swallows junk).

const VIEWER_KEY_STORAGE = "matchmax.viewer_key";

export type TutorEngagementEventType = "profile_view" | "inquiry_click" | "request_click";

/** Stable anonymous viewer key (created on first use). */
export function getViewerKey(): string {
  try {
    const existing = window.localStorage.getItem(VIEWER_KEY_STORAGE);
    if (existing) return existing;
    const generated = crypto.randomUUID();
    window.localStorage.setItem(VIEWER_KEY_STORAGE, generated);
    return generated;
  } catch {
    // Storage unavailable (private mode etc.), the RPC dedupes this shared
    // key per day, so worst case we undercount, never break.
    return "anonymous";
  }
}

/** Record one engagement event. Never throws; dedupe is server-side. */
export async function trackTutorEvent(
  tutorId: string,
  eventType: TutorEngagementEventType,
): Promise<void> {
  try {
    await supabase.rpc("record_tutor_engagement", {
      p_tutor_id: tutorId,
      p_event_type: eventType,
      p_viewer_key: getViewerKey(),
    });
  } catch {
    // Swallow, analytics must not surface errors to parents.
  }
}

/** Fire a profile_view once per mount (#102/#151 popularity input). */
export function useTrackProfileView(tutorId: string | undefined): void {
  useEffect(() => {
    if (tutorId) void trackTutorEvent(tutorId, "profile_view");
  }, [tutorId]);
}

export type TutorEngagementMap = Map<string, EngagementSummary>;

/**
 * Batched engagement summaries for a page's tutor ids (#102 badge data).
 * One RPC call per surface, 60s fresh, badge counters do not need to be
 * realtime.
 */
export function useTutorEngagementSummaries(tutorIds: string[]) {
  const joined = tutorIds.join("|");
  const stableIds = useMemo(
    () => Array.from(new Set(joined ? joined.split("|") : [])).sort(),
    [joined],
  );

  return useQuery({
    queryKey: ["tutor-engagement", stableIds],
    queryFn: async (): Promise<TutorEngagementMap> => {
      if (stableIds.length === 0) return new Map<string, EngagementSummary>();
      const { data, error } = await supabase.rpc("get_tutor_engagement", {
        p_tutor_ids: stableIds,
      });
      if (error) throw error;
      const map: TutorEngagementMap = new Map();
      for (const row of data ?? []) map.set(row.tutor_id, row);
      return map;
    },
    staleTime: 60_000,
  });
}
