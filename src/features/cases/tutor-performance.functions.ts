/**
 * GitHub #736 AC6: the assigned tutor's 12-week operating metrics for the
 * Admin Case desk. Tutor-scoped reads over verified hours, homework and visible
 * parent reviews. Read-only; never returns contact data.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { requireDeskStaff, selectRows, selectRowsInRange } from "@/features/cases/desk-db";
import { hktFromParts } from "@/features/cases/sor";
import { perfFrom, weekStarts, type TutorPerformance } from "@/features/cases/tutor-performance";

/** Bounds on the 12-week windows; a tutor cannot realistically exceed these. */
const HOURS_LIMIT = 5000;
const HOMEWORK_LIMIT = 2000;
const REVIEW_LIMIT = 1000;

export const getTutorPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<TutorPerformance> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireDeskStaff(db, context.userId);

    // The case names the tutor whose 12-week record the desk should see.
    const cases = await selectRows<{ matched_tutor_id: string | null }>(
      db,
      "tutoring_cases",
      "matched_tutor_id",
      [{ col: "id", op: "eq", value: data.caseId }],
    );
    const tutorId = cases[0]?.matched_tutor_id ?? null;
    if (!tutorId) throw new Error("CASE_NOT_FOUND");

    const now = new Date();
    const starts = weekStarts(now);
    const fromIso = hktFromParts(starts[0], 0).toISOString();
    const toIso = now.toISOString();

    const [tutorCases, hoursRows, reviewRows] = await Promise.all([
      // Homework reaches the tutor through their matched cases, not a direct FK.
      selectRows<{ id: string }>(db, "tutoring_cases", "id", [
        { col: "matched_tutor_id", op: "eq", value: tutorId },
      ]),
      selectRowsInRange<{ occurred_at: string; duration_hours: number | string }>(
        db,
        "verified_hours_ledger",
        "occurred_at, duration_hours",
        [
          { col: "tutor_id", op: "eq", value: tutorId },
          { col: "status", op: "eq", value: "verified_completed" },
        ],
        { col: "occurred_at", from: fromIso, to: toIso, limit: HOURS_LIMIT },
      ),
      // A tutor's rating is what parents said about them, never the reverse.
      selectRowsInRange<{ rating: number | string; created_at: string }>(
        db,
        "case_reviews",
        "rating, created_at",
        [
          { col: "tutor_id", op: "eq", value: tutorId },
          { col: "direction", op: "eq", value: "parent_to_tutor" },
          { col: "status", op: "eq", value: "visible" },
        ],
        { col: "created_at", from: fromIso, to: toIso, limit: REVIEW_LIMIT },
      ),
    ]);

    const caseIds = tutorCases.map((row) => row.id);
    const homeworkRows =
      caseIds.length === 0
        ? []
        : await selectRowsInRange<{ due_at: string; reviewed_at: string | null }>(
            db,
            "case_homework",
            "due_at, reviewed_at",
            [{ col: "case_id", op: "in", value: caseIds }],
            { col: "due_at", from: fromIso, to: toIso, limit: HOMEWORK_LIMIT },
          );

    return perfFrom(
      {
        hoursRows: hoursRows.map((row) => ({
          occurredAt: row.occurred_at,
          // numeric columns come back from PostgREST as numbers or strings.
          hours: Number(row.duration_hours),
        })),
        homeworkRows: homeworkRows.map((row) => ({
          dueAt: row.due_at,
          reviewedAt: row.reviewed_at,
        })),
        reviewRows: reviewRows.map((row) => ({
          rating: Number(row.rating),
          createdAt: row.created_at,
        })),
      },
      now,
    );
  });
