/**
 * Issue #768: read the weekly session hours of every FULL group cohort, so the
 * scheduling guards can treat them as Occupied the way the public grid does.
 *
 * Mirrors the cohort source in availability-occupancy.functions.ts (do not
 * duplicate the derivation there): a cohort blocks its tutor's hours only once
 * every max_seats seat is taken. Two reads at most — cohorts for the tutors in
 * scope, then their live cases for the seat sums. Any read failure returns an
 * empty map, so scheduling falls back to lesson clashes only and never throws
 * because an occupancy lookup failed.
 */

import { selectRows, type Db } from "@/features/cases/desk-db";
import { cohortAvailability } from "@/features/cases/group-cohorts";
import {
  GRID_DAYS,
  emptyHourlyOpenHours,
  parseHourlyOpenHours,
  type HourlyOpenHours,
} from "@/features/tutors/availability-grid-model";

type CohortRow = {
  id: string;
  tutor_id: string;
  status: string;
  min_seats: number;
  max_seats: number;
  sessions: unknown;
};

type CohortCaseRow = {
  group_cohort_id: string | null;
  status: string;
  student_count: number;
};

/** Sorted union of two hour lists (both already 6..23 and deduped). */
function mergeHours(a: number[], b: number[]): number[] {
  if (b.length === 0) return a;
  return [...new Set([...a, ...b])].sort((x, y) => x - y);
}

/**
 * Full-cohort sessions per tutor id. Tutors with no full cohort are absent
 * from the map (the caller's guard then behaves exactly as before); a tutor
 * whose several cohorts are all full gets the union of their hours.
 */
export async function loadFullCohortSessions(
  db: Db,
  tutorIds: readonly string[],
): Promise<Map<string, HourlyOpenHours>> {
  const byTutor = new Map<string, HourlyOpenHours>();
  const ids = [...new Set(tutorIds.filter((id) => id.length > 0))];
  if (ids.length === 0) return byTutor;

  try {
    const cohorts = await selectRows<CohortRow>(
      db,
      "group_cohorts",
      "id, tutor_id, status, min_seats, max_seats, sessions",
      [{ col: "tutor_id", op: "in", value: ids }],
    );
    if (cohorts.length === 0) return byTutor;

    const caseRows = await selectRows<CohortCaseRow>(
      db,
      "tutoring_cases",
      "group_cohort_id, status, student_count",
      [{ col: "group_cohort_id", op: "in", value: cohorts.map((cohort) => cohort.id) }],
    );
    const casesByCohort = new Map<string, { status: string; student_count: number }[]>();
    for (const row of caseRows) {
      if (!row.group_cohort_id) continue;
      const cases = casesByCohort.get(row.group_cohort_id) ?? [];
      cases.push({ status: row.status, student_count: row.student_count });
      casesByCohort.set(row.group_cohort_id, cases);
    }

    for (const cohort of cohorts) {
      // #768 additional AC: only a full cohort occupies its hours.
      if (cohortAvailability(cohort, casesByCohort.get(cohort.id) ?? []).state !== "full") continue;
      const sessions = parseHourlyOpenHours(cohort.sessions);
      const merged = byTutor.get(cohort.tutor_id) ?? emptyHourlyOpenHours();
      for (const day of GRID_DAYS) merged[day] = mergeHours(merged[day], sessions[day]);
      byTutor.set(cohort.tutor_id, merged);
    }
    return byTutor;
  } catch (error) {
    console.warn(
      "[cohort-busy] full-cohort read failed, scheduling falls back to lesson clashes only:",
      error instanceof Error ? error.message : error,
    );
    return new Map();
  }
}
