import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/features/auth/useAuth";
import { getCaseManagerSchedule } from "@/features/cases/case-schedule.functions";
import {
  activeOpenKeys,
  buildFitSchedule,
  parentOpenKeys,
  tutorOpenKeys,
  ALL_SLOT_KEYS,
  type FitRole,
  type FitSchedule,
} from "@/features/cases/schedule-fit";
import type { AvailabilityPick } from "@/features/tutors/availability-filter";

const SCHEDULE_STALE_MS = 60_000;

/** Reads the one schedule graph. A failed read is silent: surfaces stay manual. */
export function useFitSchedule(role: FitRole): {
  schedule: FitSchedule | null;
  openKeys: Set<string> | null;
  isLoading: boolean;
} {
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["case-manager-schedule"],
    queryFn: () => getCaseManagerSchedule(),
    enabled: Boolean(user),
    retry: false,
    staleTime: SCHEDULE_STALE_MS,
  });
  return useMemo(() => {
    if (!data) return { schedule: null, openKeys: null, isLoading: Boolean(user) && isLoading };
    const schedule = buildFitSchedule(data, role, new Date());
    const openKeys = role === "tutor" ? tutorOpenKeys(schedule, data) : parentOpenKeys(schedule);
    return { schedule, openKeys, isLoading: false };
  }, [data, isLoading, role, user]);
}

function readSession(key: string): Set<string> | null {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return new Set(ALL_SLOT_KEYS.filter((slot) => parsed.includes(slot)));
  } catch {
    return null;
  }
}

function writeSession(key: string, value: ReadonlySet<string> | null): void {
  try {
    if (value) window.sessionStorage.setItem(key, JSON.stringify([...value]));
    else window.sessionStorage.removeItem(key);
  } catch {
    // Private windows may refuse storage; the edit still holds for this page.
  }
}

/** Session-only slot edits. Nothing here ever writes to Case Manager. */
function useSessionSlots(storageKey: string, base: Set<string> | null) {
  const [edited, setEdited] = useState<Set<string> | null>(null);
  useEffect(() => setEdited(readSession(storageKey)), [storageKey]);

  const keys = useMemo(() => (base ? (edited ?? base) : null), [base, edited]);
  const toggle = useCallback(
    (slot: string) => {
      if (!keys) return;
      const next = new Set(keys);
      if (!next.delete(slot)) next.add(slot);
      writeSession(storageKey, next);
      setEdited(next);
    },
    [keys, storageKey],
  );
  const reset = useCallback(() => {
    writeSession(storageKey, null);
    setEdited(null);
  }, [storageKey]);
  return useMemo(
    () => ({ keys, edited: edited !== null, toggle, reset }),
    [keys, edited, toggle, reset],
  );
}

export type ScheduleSync = {
  schedule: FitSchedule;
  open: ReadonlySet<string>;
  edited: boolean;
  toggle: (slot: string) => void;
  reset: () => void;
};

function toSync(
  schedule: FitSchedule | null,
  session: ReturnType<typeof useSessionSlots>,
): ScheduleSync | null {
  if (!schedule || !session.keys) return null;
  return {
    schedule,
    open: session.keys,
    edited: session.edited,
    toggle: session.toggle,
    reset: session.reset,
  };
}

/** #659: the parent's active windows on Tutor Search. Guests get none. */
export function useParentScheduleSync(pick: AvailabilityPick) {
  const { user } = useAuth();
  const { schedule, openKeys, isLoading } = useFitSchedule("parent");
  const session = useSessionSlots("mm.schedule-fit.parent", openKeys);
  const active = useMemo(
    () => (user ? activeOpenKeys(session.keys, pick) : null),
    [user, session.keys, pick],
  );
  const sync = useMemo(() => toSync(schedule, session), [schedule, session]);
  return { active, sync, isLoading };
}

/** #660: the tutor's windows on Case Board. */
export function useTutorScheduleSync() {
  const { schedule, openKeys, isLoading } = useFitSchedule("tutor");
  const session = useSessionSlots("mm.schedule-fit.tutor", openKeys);
  const sync = useMemo(() => toSync(schedule, session), [schedule, session]);
  return { open: session.keys, sync, isLoading };
}
