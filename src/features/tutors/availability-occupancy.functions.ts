/**
 * Issue #768 (slice 1): Occupied overrides for the public hourly availability
 * grid, derived at READ time from confirmed bookings — never stored, so
 * editing base Open hours can never erase a confirmed Occupied cell and a
 * cancel/reschedule naturally restores the slot.
 *
 * Sources (the same bookings the private Case Manager / rosters live in):
 *  - case_lessons via tutoring_cases.matched_tutor_id (Case Manager #636
 *    lessons, which is where confirmed trials surface once scheduled), using
 *    the private engine's OCCUPYING statuses so the public grid never offers a
 *    time the private calendar already blocks.
 *  - roster_sessions via rosters.owner_user_id (#613 rosters — private classes
 *    and the WhatsApp-desk confirms recorded there).
 *  - group_cohorts weekly sessions, but ONLY once every seat is taken (issue
 *    #391 cohorts, #768 additional AC): a forming/running cohort with seats
 *    left never blocks the tutor's public 1-on-1 hours.
 *
 * Returns ONLY day/hour integers in HKT (Asia/Hong_Kong): no student names,
 * lesson titles, times of other days, or earnings ever leave this function.
 *
 * Part 2 (#768 AC3): the discovery directory needs the same numbers for a page
 * of cards, so the derivation lives in one batch core — at most six reads for
 * every tutor on the page instead of six per tutor.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import { cohortAvailability } from "@/features/cases/group-cohorts";
import { hktMinuteOfDay } from "@/features/cases/case-schedule";
import { hktDateKey, hktWeekdayIndex } from "@/features/cases/sor";
import {
  GRID_DAYS,
  HOURLY_GRID_END_HOUR,
  HOURLY_GRID_START_HOUR,
  emptyHourlyOpenHours,
  parseHourlyOpenHours,
  type GridDay,
  type HourlyOpenHours,
} from "@/features/tutors/availability-grid-model";

/** Lesson statuses that block time on the private schedule (#636 engine). */
const OCCUPYING_LESSON_STATUSES = ["planned", "confirmed", "done"] as const;
/** Public occupancy only looks ahead this far (private scheduling horizon). */
const OCCUPANCY_AHEAD_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
/** Page-size cap for the batched directory read. */
const BATCH_TUTOR_LIMIT = 60;

const inputSchema = z.object({
  tutorId: z.string().uuid(),
  tutorUserId: z.string().uuid().nullable(),
});

const batchInputSchema = z.object({
  tutors: z.array(inputSchema).max(BATCH_TUTOR_LIMIT),
});

/** One tutor the batched occupancy read needs to resolve. */
export type OccupancyTarget = { tutorId: string; tutorUserId: string | null };

function addHours(grid: HourlyOpenHours, day: GridDay, hours: number[]) {
  const bucket = grid[day];
  for (const hour of hours) {
    if (hour >= HOURLY_GRID_START_HOUR && hour < HOURLY_GRID_END_HOUR && !bucket.includes(hour)) {
      bucket.push(hour);
    }
  }
  bucket.sort((a, b) => a - b);
}

/** Hourly START hours covered by [startMinute, startMinute + duration). */
function hoursForRange(startMinute: number, durationMin: number): number[] {
  const first = Math.floor(startMinute / 60);
  const endExclusive = Math.ceil((startMinute + Math.max(durationMin, 0)) / 60);
  const hours: number[] = [];
  for (let h = first; h < endExclusive; h++) hours.push(h);
  return hours;
}

/**
 * Occupied (day, hour) cells a cohort's weekly sessions claim on its tutor's
 * public grid — empty unless every seat is taken (#768 additional AC). Seats
 * derive from the cohort's live cases (#391), so a cancellation frees the hours
 * again and a closed cohort never occupies anything. `sessions` is untrusted
 * JSONB (`{mon:[6,7],...}`) parsed defensively; null/empty claims nothing.
 */
export function cohortHoursWhenFull(
  cohort: { status: string; min_seats: number; max_seats: number; sessions: unknown },
  liveCases: { status: string; student_count: number }[],
): HourlyOpenHours {
  if (cohortAvailability(cohort, liveCases).state !== "full") return emptyHourlyOpenHours();
  return parseHourlyOpenHours(cohort.sessions);
}

/**
 * Batch core: derive Occupied (day, hour) cells for every tutor in ONE pass of
 * at most six queries. Every read failure degrades to base Open hours for the
 * affected source — this function never throws.
 */
export async function computeOccupiedHoursByTutor(
  db: Db,
  tutors: readonly OccupancyTarget[],
): Promise<Map<string, HourlyOpenHours>> {
  const grids = new Map<string, HourlyOpenHours>();
  const tutorIdByUserId = new Map<string, string>();
  for (const tutor of tutors) {
    if (grids.has(tutor.tutorId)) continue;
    grids.set(tutor.tutorId, emptyHourlyOpenHours());
    if (tutor.tutorUserId && !tutorIdByUserId.has(tutor.tutorUserId)) {
      tutorIdByUserId.set(tutor.tutorUserId, tutor.tutorId);
    }
  }
  if (grids.size === 0) return grids;

  const now = Date.now();
  const aheadCutoff = now + OCCUPANCY_AHEAD_DAYS * MS_PER_DAY;

  // 1) Case Manager lessons (includes confirmed trials once scheduled).
  try {
    const caseRows = await selectRows<{ id: string; matched_tutor_id: string }>(
      db,
      "tutoring_cases",
      "id, matched_tutor_id",
      [{ col: "matched_tutor_id", op: "in", value: [...grids.keys()] }],
    );
    const tutorIdByCaseId = new Map<string, string>();
    for (const row of caseRows) tutorIdByCaseId.set(row.id, row.matched_tutor_id);

    if (tutorIdByCaseId.size > 0) {
      const lessonRows = await selectRows<{
        case_id: string;
        starts_at: string;
        duration_min: number;
      }>(db, "case_lessons", "case_id, starts_at, duration_min", [
        { col: "case_id", op: "in", value: [...tutorIdByCaseId.keys()] },
        { col: "status", op: "in", value: [...OCCUPYING_LESSON_STATUSES] },
      ]);
      for (const lesson of lessonRows) {
        const tutorId = tutorIdByCaseId.get(lesson.case_id);
        const grid = tutorId ? grids.get(tutorId) : undefined;
        if (!grid) continue;
        const start = Date.parse(lesson.starts_at);
        // In-progress or upcoming lessons only: a past lesson (or one that
        // just ended) frees the weekly cell; a cancellation frees it too.
        if (!Number.isFinite(start)) continue;
        if (start + lesson.duration_min * 60_000 <= now) continue;
        if (start > aheadCutoff) continue;
        const day = GRID_DAYS[hktWeekdayIndex(new Date(start))];
        addHours(grid, day, hoursForRange(hktMinuteOfDay(lesson.starts_at), lesson.duration_min));
      }
    }
  } catch (error) {
    console.warn(
      "[availability-occupancy] case_lessons read failed, public grid shows base hours only:",
      error instanceof Error ? error.message : error,
    );
  }

  // 2) Roster sessions (#613 — private classes / WhatsApp-desk confirms).
  if (tutorIdByUserId.size > 0) {
    try {
      const rosterRows = await selectRows<{ id: string; owner_user_id: string }>(
        db,
        "rosters",
        "id, owner_user_id",
        [{ col: "owner_user_id", op: "in", value: [...tutorIdByUserId.keys()] }],
      );
      const tutorIdByRosterId = new Map<string, string>();
      for (const row of rosterRows) {
        const tutorId = tutorIdByUserId.get(row.owner_user_id);
        if (tutorId) tutorIdByRosterId.set(row.id, tutorId);
      }

      if (tutorIdByRosterId.size > 0) {
        const sessionRows = await selectRows<{
          roster_id: string;
          session_date: string;
          start_time: string;
          voided_at: string | null;
        }>(db, "roster_sessions", "roster_id, session_date, start_time, voided_at", [
          { col: "roster_id", op: "in", value: [...tutorIdByRosterId.keys()] },
        ]);
        const todayHkt = hktDateKey(new Date());
        for (const session of sessionRows) {
          if (session.voided_at) continue;
          if (!session.session_date || session.session_date < todayHkt) continue;
          const grid = grids.get(tutorIdByRosterId.get(session.roster_id) ?? "");
          if (!grid) continue;
          const day =
            GRID_DAYS[hktWeekdayIndex(new Date(`${session.session_date}T00:00:00+08:00`))];
          const hour = Number.parseInt(session.start_time.slice(0, 2), 10);
          if (Number.isFinite(hour)) addHours(grid, day, [hour]);
        }
      }
    } catch (error) {
      console.warn(
        "[availability-occupancy] roster_sessions read failed, public grid shows base hours only:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  // 3) Group cohorts at full capacity (#768 additional AC: a 1-on-1 confirm is
  // immediately Busy; a group/bootcamp only once every max_seats seat is taken).
  try {
    const cohortRows = await selectRows<{
      id: string;
      tutor_id: string;
      status: string;
      min_seats: number;
      max_seats: number;
      sessions: unknown;
    }>(db, "group_cohorts", "id, tutor_id, status, min_seats, max_seats, sessions", [
      { col: "tutor_id", op: "in", value: [...grids.keys()] },
    ]);

    if (cohortRows.length > 0) {
      const caseRows = await selectRows<{
        group_cohort_id: string;
        status: string;
        student_count: number;
      }>(db, "tutoring_cases", "group_cohort_id, status, student_count", [
        { col: "group_cohort_id", op: "in", value: cohortRows.map((row) => row.id) },
      ]);
      const casesByCohort = new Map<string, { status: string; student_count: number }[]>();
      for (const row of caseRows) {
        if (!row.group_cohort_id) continue;
        const cases = casesByCohort.get(row.group_cohort_id) ?? [];
        cases.push({ status: row.status, student_count: row.student_count });
        casesByCohort.set(row.group_cohort_id, cases);
      }

      for (const cohort of cohortRows) {
        const grid = grids.get(cohort.tutor_id);
        if (!grid) continue;
        const occupied = cohortHoursWhenFull(cohort, casesByCohort.get(cohort.id) ?? []);
        for (const day of GRID_DAYS) addHours(grid, day, occupied[day]);
      }
    }
  } catch (error) {
    console.warn(
      "[availability-occupancy] group_cohorts read failed, public grid shows base hours only:",
      error instanceof Error ? error.message : error,
    );
  }

  return grids;
}

async function loadAdminDb(): Promise<Db | null> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    return asAdminDb(supabaseAdmin);
  } catch (error) {
    console.warn(
      "[availability-occupancy] admin client unavailable, public grid shows base hours only:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

export const fetchTutorOccupiedHours = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ occupied: HourlyOpenHours }> => {
    const occupied = emptyHourlyOpenHours();
    const db = await loadAdminDb();
    if (!db) return { occupied };
    const grids = await computeOccupiedHoursByTutor(db, [
      { tutorId: data.tutorId, tutorUserId: data.tutorUserId },
    ]);
    return { occupied: grids.get(data.tutorId) ?? occupied };
  });

/**
 * Batched read for the discovery directory (#768 Part 2 AC3): the slots-left
 * count for a page of cards. A missing admin client, a schema gap or any read
 * failure yields no entry for that tutor, so the card renders no "Last slot"
 * line instead of a fabricated one.
 */
export const fetchTutorsOccupiedHours = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => batchInputSchema.parse(input))
  .handler(async ({ data }): Promise<{ occupiedById: Record<string, HourlyOpenHours> }> => {
    const db = await loadAdminDb();
    if (!db) return { occupiedById: {} };
    const grids = await computeOccupiedHoursByTutor(db, data.tutors);
    const occupiedById: Record<string, HourlyOpenHours> = {};
    for (const [tutorId, grid] of grids) occupiedById[tutorId] = grid;
    return { occupiedById };
  });

export type TutorOccupiedHours = Awaited<ReturnType<typeof fetchTutorOccupiedHours>>["occupied"];
