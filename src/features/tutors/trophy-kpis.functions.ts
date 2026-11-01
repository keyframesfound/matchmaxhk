import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";

/**
 * Issue #462 Phase A: Trophy Wall KPI banner. Numbers derive ONLY from the
 * #459 verified-hours ledger (+ visible case_reviews for the rating):
 *
 *   Active  — distinct learners whose latest verified lesson is within the
 *             last 45 days (inactivity drops them to Past).
 *   Past    — distinct learners whose last verified lesson is older.
 *   Avg retention hours — total verified hours ÷ distinct learners;
 *             suppressed unless ≥ 8 learners (anti-noise lock).
 *   Rating  — visible parent→tutor review average.
 *   Badges  — Rising (25h) / Azure (100h) from the teaching-hours sum.
 *
 * No PII: counts and aggregates only — roster rows are Phase B (On Hold).
 */

export const ACTIVE_WINDOW_DAYS = 45;
const AVG_RETENTION_MIN_LEARNERS = 8;

export type TrophyKpis = {
  totalHours: number;
  activeStudents: number;
  pastStudents: number;
  avgRetentionHours: number | null;
  rating: number | null;
  reviewsCount: number;
  badgeRising: boolean;
  badgeAzure: boolean;
};

const EMPTY: TrophyKpis = {
  totalHours: 0,
  activeStudents: 0,
  pastStudents: 0,
  avgRetentionHours: null,
  rating: null,
  reviewsCount: 0,
  badgeRising: false,
  badgeAzure: false,
};

async function computeKpis(db: Db, tutorId: string): Promise<TrophyKpis> {
  const { data: ledger } = await db
    .from<{ student_id: string | null; duration_hours: number | string; occurred_at: string }>(
      "verified_hours_ledger",
    )
    .select("student_id, duration_hours, occurred_at")
    .eq("tutor_id", tutorId)
    .eq("status", "verified_completed");

  const rows = ledger ?? [];
  if (rows.length === 0) return EMPTY;

  const totalHours = rows.reduce((sum, r) => sum + Number(r.duration_hours), 0);
  const lastByStudent = new Map<string, number>();
  for (const r of rows) {
    if (!r.student_id) continue;
    const at = Date.parse(r.occurred_at);
    const prev = lastByStudent.get(r.student_id);
    if (prev === undefined || at > prev) lastByStudent.set(r.student_id, at);
  }
  const learners = [...lastByStudent.values()];
  const cutoff = Date.now() - ACTIVE_WINDOW_DAYS * 86_400_000;
  const activeStudents = learners.filter((at) => at >= cutoff).length;
  const pastStudents = learners.filter((at) => at < cutoff).length;
  const avgRetentionHours =
    learners.length >= AVG_RETENTION_MIN_LEARNERS && learners.length > 0
      ? Math.round((totalHours / learners.length) * 10) / 10
      : null;

  const { data: reviews } = await db
    .from<{ rating: number }>("case_reviews")
    .select("rating")
    .eq("tutor_id", tutorId)
    .eq("direction", "parent_to_tutor")
    .eq("status", "visible");
  const ratings = (reviews ?? []).map((r) => Number(r.rating));

  return {
    totalHours: Math.round(totalHours * 100) / 100,
    activeStudents,
    pastStudents,
    avgRetentionHours,
    rating:
      ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null,
    reviewsCount: ratings.length,
    badgeRising: totalHours >= 25,
    badgeAzure: totalHours >= 100,
  };
}

export const getTutorTrophyKpis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: unknown) => z.object({ tutorId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<TrophyKpis> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    return computeKpis(db, data.tutorId);
  });
