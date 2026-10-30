/**
 * Issue #508 — 6-Month Ownership Boundary + Retained-Only ladder.
 *
 * Pure helpers that turn a tutor's history with ONE counterparty (a centre,
 * or a parent for siblings / secondary students) into the inputs the #536
 * engine (fee-drop.ts) needs: the ownership state and the retained tier.
 *
 * CEO locks encoded:
 *   * The 180-day window opens on the FIRST COMPLETED PAID Lesson 1 between
 *     that tutor and that counterparty — never on match / intro date. A
 *     match rejected before L1 opens nothing.
 *   * Day 181+ → the relationship is the tutor's: $0, not a MatchMax case,
 *     and the dispatch filter must not route that tutor to that centre again.
 *   * Retained-Only: only cases that passed Lesson 2 advance the tier; a
 *     verified L1 drop keeps the next student on the same tier.
 *   * Centre ladder: 1st 1.5 / 2nd 1.0 / 3rd 0.5 / 4th+ $0. For a parent, the
 *     first private match is the normal "primary" 1.5 case and the ladder
 *     counts SECONDARY students after it (1st secondary 1.5, 2nd 1.0, ...).
 */

import type { OwnershipState, SecondaryTier } from "@/features/cases/fee-drop";

export const INTRO_WINDOW_DAYS = 180;
const DAY_MS = 24 * 60 * 60 * 1000;
const HKT_OFFSET_MS = 8 * 60 * 60 * 1000;

export type CounterpartyKind = "centre" | "parent";

/** One earlier case between the same tutor and the same counterparty. */
export type PriorCase = {
  caseId: string;
  /** done_at of the case's Lesson 1, null when L1 never completed. */
  firstPaidL1At: string | null;
  /** Passed Lesson 2 (lesson 2 done, or further) — the Retained-Only signal. */
  retained: boolean;
};

export type OwnershipSnapshot = {
  state: OwnershipState;
  /** ISO timestamp of the first paid L1, null while the window has not opened. */
  windowStartAt: string | null;
  /** ISO timestamp the window closes (start + 180 d). */
  windowEndsAt: string | null;
  /** Whole days left, 0 once closed, null before the window opens. */
  daysLeft: number | null;
  retainedCount: number;
  tier: SecondaryTier;
};

function toTime(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

/** The earliest completed paid L1 among the prior cases, or null. */
export function windowStartFrom(priorCases: readonly PriorCase[]): string | null {
  const times = priorCases
    .map((c) => toTime(c.firstPaidL1At))
    .filter((t): t is number => t !== null);
  if (times.length === 0) return null;
  return new Date(Math.min(...times)).toISOString();
}

/**
 * Tier from the retained count. A centre's first case is Tier 1; a parent's
 * first case is the primary match and siblings climb from there.
 */
export function tierFromRetained(kind: CounterpartyKind, retainedCount: number): SecondaryTier {
  const n = Math.max(0, Math.floor(retainedCount));
  if (kind === "parent") {
    return n === 0 ? "primary" : (Math.min(4, n) as SecondaryTier);
  }
  return Math.min(4, n + 1) as SecondaryTier;
}

/**
 * Snapshot for the current case, evaluated at `asOf` — the current case's
 * own L1 date when it has one, else now. Only prior cases whose L1 fell
 * inside the window count toward the retained tier.
 */
export function ownershipSnapshot(input: {
  kind: CounterpartyKind;
  priorCases: readonly PriorCase[];
  asOf: Date;
}): OwnershipSnapshot {
  const startIso = windowStartFrom(input.priorCases);
  if (startIso === null) {
    return {
      state: "not_started",
      windowStartAt: null,
      windowEndsAt: null,
      daysLeft: null,
      retainedCount: 0,
      tier: tierFromRetained(input.kind, 0),
    };
  }
  const start = Date.parse(startIso);
  const end = start + INTRO_WINDOW_DAYS * DAY_MS;
  const asOf = input.asOf.getTime();
  const isClosed = asOf > end;
  const retainedCount = input.priorCases.filter((c) => {
    const t = toTime(c.firstPaidL1At);
    return c.retained && t !== null && t <= end;
  }).length;
  return {
    state: isClosed ? "closed" : "inside",
    windowStartAt: startIso,
    windowEndsAt: new Date(end).toISOString(),
    daysLeft: isClosed ? 0 : Math.ceil((end - asOf) / DAY_MS),
    retainedCount,
    tier: tierFromRetained(input.kind, retainedCount),
  };
}

/**
 * #508 dispatch filter: true when a tutor must NOT be suggested or assigned
 * to this counterparty again (their window closed — the fee would be $0).
 */
export function isPastOwnershipWindow(firstPaidL1At: string | null, now: Date): boolean {
  const start = toTime(firstPaidL1At);
  if (start === null) return false;
  return now.getTime() > start + INTRO_WINDOW_DAYS * DAY_MS;
}

/** The exact admin hard-warning copy from #508 (date shown in HKT). */
export function outOfWindowWarning(windowEndsAt: string): string {
  const hktDate = new Date(Date.parse(windowEndsAt) + HKT_OFFSET_MS).toISOString().slice(0, 10);
  return `Out of Window: this tutor passed the 6-month mark with this centre on ${hktDate}. Route a new tutor to earn a fee, or advise centre to contact them directly.`;
}

function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th+`;
}

/** Banner line for the admin case view (#508 §5). */
export function ownershipBannerLabel(kind: CounterpartyKind, snap: OwnershipSnapshot): string {
  if (snap.state === "closed") return "Past intro window: fee $0, tutor-owned";
  const prefix = kind === "centre" ? "B2B match" : "B2C";
  const tierLabel =
    snap.tier === "primary"
      ? "primary match"
      : `${ordinal(snap.tier)} ${kind === "centre" ? "student" : "secondary"}`;
  const days =
    snap.daysLeft === null
      ? "window opens on first paid Lesson 1"
      : `${snap.daysLeft} days left in intro window`;
  return `${prefix}: ${tierLabel} · ${days}`;
}
