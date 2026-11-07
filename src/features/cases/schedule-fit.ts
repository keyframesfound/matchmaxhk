/**
 * #659 / #660: the one Schedule Fit module, shared by the parent and tutor
 * surfaces. A unit is a weekday + band in HKT, the granularity the case slots
 * store. Everything here is soft: it ranks and reminds, it never blocks.
 */

import {
  hktClock,
  periodOfMinute,
  hktMinuteOfDay,
  type PrefSlot,
} from "@/features/cases/case-schedule";
import { hktFromParts, hktWeekdayIndex } from "@/features/cases/sor";
import {
  AVAIL_BANDS,
  BAND_ROWS,
  isAvailabilityActive,
  type AvailabilityPick,
} from "@/features/tutors/availability-filter";
import {
  GRID_DAYS,
  isGridEmpty,
  parseAvailabilityGrid,
} from "@/features/tutors/availability-grid-model";

export const FULL_FIT = 100;
/** One-off lessons further out than this do not claim a weekly slot. */
export const OCCUPIED_LOOKAHEAD_DAYS = 28;
/** A blackout is one date, so it only shapes the coming week. */
export const BLOCKED_LOOKAHEAD_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_STATUSES: ReadonlySet<string> = new Set(["planned", "confirmed"]);
const MINUTES_PER_DAY = 24 * 60;
const BAND_MINUTES = {
  morning: [0, 12 * 60],
  afternoon: [12 * 60, 18 * 60],
  evening: [18 * 60, MINUTES_PER_DAY],
} as const;

export const ALL_SLOT_KEYS: readonly string[] = GRID_DAYS.flatMap((day) =>
  AVAIL_BANDS.map((band) => `${day}-${band}`),
);

export type FitRole = "parent" | "tutor";

export type FitSource = {
  lessons: readonly {
    caseId: string;
    startsAt: string;
    durationMin: number;
    status: string;
    subject: string | null;
    role: FitRole;
  }[];
  proposed: readonly {
    caseId: string;
    subject: string | null;
    role: FitRole;
    scheduleMode: string | null;
    slots: readonly PrefSlot[];
  }[];
  blockedDates: readonly string[];
  openWindows: readonly { weekday: number; startMinute: number; endMinute: number }[];
  tutorGrid: unknown;
};

export type FitSchedule = {
  occupied: { key: string; startsAt: string; durationMin: number; title: string | null }[];
  proposed: { caseId: string; key: string; title: string | null }[];
  blocked: ReadonlySet<string>;
};

export type ClashLine = {
  state: "occupied" | "proposed" | "blocked";
  day: string;
  period: string;
  /** HH:mm range when a real lesson is the conflict; prefs only have a band. */
  clock: string | null;
  title: string | null;
};

/** Weekday + band of a moment, in HKT. */
export function slotKeyOf(iso: string): string {
  const day = GRID_DAYS[hktWeekdayIndex(new Date(iso))];
  return `${day}-${periodOfMinute(hktMinuteOfDay(iso))}`;
}

/** overlap / base as a whole percent; null when there is nothing to score. */
export function fitPercent(overlap: number, base: number): number | null {
  return base > 0 ? Math.round((overlap / base) * FULL_FIT) : null;
}

/** One role's view of the Case Manager graph, as weekly units. */
export function buildFitSchedule(source: FitSource, role: FitRole, now: Date): FitSchedule {
  const horizon = now.getTime() + OCCUPIED_LOOKAHEAD_DAYS * DAY_MS;
  const occupied = source.lessons
    .filter((l) => {
      const at = Date.parse(l.startsAt);
      return l.role === role && LIVE_STATUSES.has(l.status) && at > now.getTime() && at <= horizon;
    })
    .map((l) => ({
      key: slotKeyOf(l.startsAt),
      startsAt: l.startsAt,
      durationMin: l.durationMin,
      title: l.subject,
    }));
  const proposed = source.proposed
    .filter((p) => p.role === role && p.scheduleMode !== "flexible")
    .flatMap((p) =>
      p.slots.map((s) => ({
        caseId: p.caseId,
        key: `${s.day}-${s.period}`,
        title: p.subject,
      })),
    );
  return { occupied, proposed, blocked: role === "tutor" ? blockedKeys(source, now) : new Set() };
}

function blockedKeys(source: FitSource, now: Date): Set<string> {
  const horizon = now.getTime() + BLOCKED_LOOKAHEAD_DAYS * DAY_MS;
  const keys = source.blockedDates.flatMap((date) => {
    const at = hktFromParts(date, MINUTES_PER_DAY - 1);
    if (at.getTime() < now.getTime() || at.getTime() - MINUTES_PER_DAY * 60_000 > horizon) {
      return [];
    }
    const day = GRID_DAYS[hktWeekdayIndex(at)];
    return AVAIL_BANDS.map((band) => `${day}-${band}`);
  });
  return new Set(keys);
}

function withoutBusy(base: readonly string[], schedule: FitSchedule): Set<string> {
  const busy = new Set(schedule.occupied.map((o) => o.key));
  return new Set(base.filter((key) => !busy.has(key) && !schedule.blocked.has(key)));
}

/** Parent default windows; null on a cold start (nothing to sync from). */
export function parentOpenKeys(schedule: FitSchedule): Set<string> | null {
  if (schedule.occupied.length === 0 && schedule.blocked.size === 0) return null;
  return withoutBusy(ALL_SLOT_KEYS, schedule);
}

function tutorGridKeys(rawGrid: unknown): string[] {
  const grid = parseAvailabilityGrid(rawGrid);
  if (isGridEmpty(grid)) return [];
  return GRID_DAYS.flatMap((day) =>
    AVAIL_BANDS.filter((band) => BAND_ROWS[band].some((row) => grid[day][row] !== "u")).map(
      (band) => `${day}-${band}`,
    ),
  );
}

function windowKeys(windows: FitSource["openWindows"]): string[] {
  return windows.flatMap((w) => {
    const day = GRID_DAYS[w.weekday];
    if (!day) return [];
    return AVAIL_BANDS.filter(
      (band) => w.startMinute < BAND_MINUTES[band][1] && w.endMinute > BAND_MINUTES[band][0],
    ).map((band) => `${day}-${band}`);
  });
}

/** Tutor windows: teaching windows, else the soft grid; null with no data at all. */
export function tutorOpenKeys(schedule: FitSchedule, source: FitSource): Set<string> | null {
  const fromWindows = windowKeys(source.openWindows);
  const declared = fromWindows.length > 0 ? fromWindows : tutorGridKeys(source.tutorGrid);
  if (declared.length > 0) return withoutBusy(declared, schedule);
  return parentOpenKeys(schedule);
}

/** The windows that score right now: a manual pick narrows the base windows. */
export function activeOpenKeys(
  base: ReadonlySet<string> | null,
  pick: AvailabilityPick,
): Set<string> | null {
  if (!isAvailabilityActive(pick)) return base ? new Set(base) : null;
  const days = pick.days.length > 0 ? pick.days : GRID_DAYS;
  const bands = pick.bands.length > 0 ? pick.bands : AVAIL_BANDS;
  const picked = days.flatMap((day) => bands.map((band) => `${day}-${band}`));
  const kept = base ? picked.filter((key) => base.has(key)) : picked;
  return new Set(kept.length > 0 ? kept : picked);
}

/** #659: overlapping units / the parent's active open units. Null when unscored. */
export function parentTutorFit(
  active: ReadonlySet<string> | null,
  rawGrid: unknown,
): number | null {
  if (!active || active.size === 0) return null;
  const grid = parseAvailabilityGrid(rawGrid);
  if (isGridEmpty(grid)) return null;
  const tutor = new Set(tutorGridKeys(rawGrid));
  return fitPercent([...active].filter((key) => tutor.has(key)).length, active.size);
}

/** #660: overlapping units / the case's preferred units. Flexible is a full match. */
export function tutorCaseFit(
  open: ReadonlySet<string>,
  item: { scheduleMode: string | null; scheduleSlots: readonly PrefSlot[] },
): number {
  if (item.scheduleMode === "flexible" || item.scheduleSlots.length === 0) return FULL_FIT;
  const hits = item.scheduleSlots.filter((s) => open.has(`${s.day}-${s.period}`)).length;
  return fitPercent(hits, item.scheduleSlots.length) ?? FULL_FIT;
}

/** Stable best-first order; unscored sits below a zero score. */
export function compareFit(a: number | null, b: number | null): number {
  return (b ?? -1) - (a ?? -1);
}

function clockRange(startsAt: string, durationMin: number): string {
  const end = new Date(Date.parse(startsAt) + durationMin * 60_000).toISOString();
  return `${hktClock(startsAt)}–${hktClock(end)}`;
}

/**
 * The soft clash lines for preferred slots, one per slot and conflict.
 * A weekly series collapses to a single line; the case itself never clashes.
 */
export function findClashes(
  slots: readonly PrefSlot[],
  schedule: FitSchedule,
  ignoreCaseId?: string,
): ClashLine[] {
  const lines = slots.flatMap((slot): ClashLine[] => {
    const key = `${slot.day}-${slot.period}`;
    const base = { day: slot.day, period: slot.period };
    const occupied = schedule.occupied
      .filter((o) => o.key === key)
      .map((o): ClashLine => ({
        ...base,
        state: "occupied",
        clock: clockRange(o.startsAt, o.durationMin),
        title: o.title,
      }));
    const proposed = schedule.proposed
      .filter((p) => p.key === key && p.caseId !== ignoreCaseId)
      .map((p): ClashLine => ({ ...base, state: "proposed", clock: null, title: p.title }));
    const blocked: ClashLine[] = schedule.blocked.has(key)
      ? [{ ...base, state: "blocked", clock: null, title: null }]
      : [];
    return [...occupied, ...proposed, ...blocked];
  });
  const seen = new Set<string>();
  return lines.filter((line) => {
    const id = `${line.state}|${line.day}|${line.period}|${line.clock}|${line.title}`;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

/**
 * #660 board order. Matched hides zero-fit cases, unless that would empty the
 * board: then every case stays and `zeroFit` asks for the notice.
 */
export function rankCasesByFit<
  T extends { id: string; scheduleMode: string | null; scheduleSlots: readonly PrefSlot[] },
>(
  items: readonly T[],
  open: ReadonlySet<string> | null,
  matched: boolean,
): { items: T[]; scores: Map<string, number>; zeroFit: boolean } {
  if (!open) return { items: [...items], scores: new Map(), zeroFit: false };
  const scores = new Map(items.map((item) => [item.id, tutorCaseFit(open, item)]));
  const fits = items.filter((item) => (scores.get(item.id) ?? 0) > 0);
  const zeroFit = matched && items.length > 0 && fits.length === 0;
  const shown = matched && !zeroFit ? fits : items;
  const ranked = [...shown].sort((a, b) =>
    compareFit(scores.get(a.id) ?? null, scores.get(b.id) ?? null),
  );
  return { items: ranked, scores, zeroFit };
}
