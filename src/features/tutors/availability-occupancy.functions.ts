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
 *
 * Returns ONLY day/hour integers in HKT (Asia/Hong_Kong): no student names,
 * lesson titles, times of other days, or earnings ever leave this function.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows } from "@/features/cases/desk-db";
import { hktMinuteOfDay } from "@/features/cases/case-schedule";
import { hktDateKey, hktWeekdayIndex } from "@/features/cases/sor";
import {
  GRID_DAYS,
  HOURLY_GRID_END_HOUR,
  HOURLY_GRID_START_HOUR,
  emptyHourlyOpenHours,
  type GridDay,
  type HourlyOpenHours,
} from "@/features/tutors/availability-grid-model";

/** Lesson statuses that block time on the private schedule (#636 engine). */
const OCCUPYING_LESSON_STATUSES = ["planned", "confirmed", "done"] as const;
/** Public occupancy only looks ahead this far (private scheduling horizon). */
const OCCUPANCY_AHEAD_DAYS = 90;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const inputSchema = z.object({
  tutorId: z.string().uuid(),
  tutorUserId: z.string().uuid().nullable(),
});

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

export const fetchTutorOccupiedHours = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }): Promise<{ occupied: HourlyOpenHours }> => {
    const occupied = emptyHourlyOpenHours();
    let db: ReturnType<typeof asAdminDb>;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      db = asAdminDb(supabaseAdmin);
    } catch (error) {
      // Optional override: a missing/broken service client (e.g. local dev
      // without server env) degrades the grid to base Open hours instead of
      // 500-ing the public profile.
      console.warn(
        "[availability-occupancy] admin client unavailable, public grid shows base hours only:",
        error instanceof Error ? error.message : error,
      );
      return { occupied };
    }
    const now = Date.now();
    const aheadCutoff = now + OCCUPANCY_AHEAD_DAYS * MS_PER_DAY;

    // 1) Case Manager lessons (includes confirmed trials once scheduled).
    try {
      const caseRows = await selectRows<{ id: string }>(db, "tutoring_cases", "id", [
        { col: "matched_tutor_id", op: "eq", value: data.tutorId },
      ]);
      const caseIds = caseRows.map((row) => row.id);
      if (caseIds.length > 0) {
        const lessonRows = await selectRows<{
          starts_at: string;
          duration_min: number;
        }>(db, "case_lessons", "starts_at, duration_min", [
          { col: "case_id", op: "in", value: caseIds },
          { col: "status", op: "in", value: [...OCCUPYING_LESSON_STATUSES] },
        ]);
        for (const lesson of lessonRows) {
          const start = Date.parse(lesson.starts_at);
          // In-progress or upcoming lessons only: a past lesson (or one that
          // just ended) frees the weekly cell; a cancellation frees it too.
          if (!Number.isFinite(start)) continue;
          if (start + lesson.duration_min * 60_000 <= now) continue;
          if (start > aheadCutoff) continue;
          const day = GRID_DAYS[hktWeekdayIndex(new Date(start))];
          addHours(
            occupied,
            day,
            hoursForRange(hktMinuteOfDay(lesson.starts_at), lesson.duration_min),
          );
        }
      }
    } catch (error) {
      console.warn(
        "[availability-occupancy] case_lessons read failed, public grid shows base hours only:",
        error instanceof Error ? error.message : error,
      );
    }

    // 2) Roster sessions (#613 — private classes / WhatsApp-desk confirms).
    if (data.tutorUserId) {
      try {
        const rosterRows = await selectRows<{ id: string }>(db, "rosters", "id", [
          { col: "owner_user_id", op: "eq", value: data.tutorUserId },
        ]);
        const rosterIds = rosterRows.map((row) => row.id);
        if (rosterIds.length > 0) {
          const sessionRows = await selectRows<{
            session_date: string;
            start_time: string;
            voided_at: string | null;
          }>(db, "roster_sessions", "session_date, start_time, voided_at", [
            { col: "roster_id", op: "in", value: rosterIds },
          ]);
          const todayHkt = hktDateKey(new Date());
          for (const session of sessionRows) {
            if (session.voided_at) continue;
            if (!session.session_date || session.session_date < todayHkt) continue;
            const day =
              GRID_DAYS[hktWeekdayIndex(new Date(`${session.session_date}T00:00:00+08:00`))];
            const hour = Number.parseInt(session.start_time.slice(0, 2), 10);
            if (Number.isFinite(hour)) addHours(occupied, day, [hour]);
          }
        }
      } catch (error) {
        console.warn(
          "[availability-occupancy] roster_sessions read failed, public grid shows base hours only:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    return { occupied };
  });

export type TutorOccupiedHours = Awaited<ReturnType<typeof fetchTutorOccupiedHours>>["occupied"];
