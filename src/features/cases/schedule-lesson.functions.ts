/**
 * Issue #461 Phase A 3c — tutor "Schedule next lesson" (single slot).
 *
 * Idempotent on clientRequestId (a double-tap returns the first row). The
 * lesson is created `planned` with the tutor side already confirmed, so the
 * parent's existing confirm turns it `confirmed`. Sequence = max + 1; the
 * UNIQUE (case_id, sequence) index settles a concurrent schedule, and the
 * partial unique (tutor_id, starts_at) index backs the double-book guard.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { insertAudit, selectRows, type Db } from "@/features/cases/desk-db";
import { nextLessonSequence, scheduleLessonError } from "@/features/cases/schedule-lesson";

type Row = Record<string, unknown>;

const LIVE_STATUSES = ["planned", "confirmed", "done"];
const SEQUENCE_RETRIES = 3;
const LOCATION_MAX = 300;

async function findByRequestId(
  db: Db,
  clientRequestId: string,
): Promise<{ id: string; case_id: string } | null> {
  const rows = await selectRows<{ id: string; case_id: string }>(
    db,
    "case_lessons",
    "id, case_id",
    [{ col: "client_request_id", op: "eq", value: clientRequestId }],
  );
  return rows[0] ?? null;
}

export const scheduleNextLesson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        startsAtIso: z.string().datetime(),
        durationMin: z.number().int(),
        locationOrLink: z.string().trim().max(LOCATION_MAX).optional(),
        clientRequestId: z.string().uuid(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ lessonId: string; duplicate: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutors = await selectRows<{ id: string }>(db, "tutors", "id", [
      { col: "user_id", op: "eq", value: context.userId },
    ]);
    const tutorId = tutors[0]?.id;
    if (!tutorId) throw new Error("NO_TUTOR_CARD");

    const cases = await selectRows<{
      id: string;
      matched_tutor_id: string | null;
      sor_status: string | null;
      mode: string | null;
    }>(db, "tutoring_cases", "id, matched_tutor_id, sor_status, mode", [
      { col: "id", op: "eq", value: data.caseId },
    ]);
    const c = cases[0];
    if (!c || c.matched_tutor_id !== tutorId) throw new Error("CASE_NOT_FOUND");

    const prior = await findByRequestId(db, data.clientRequestId);
    if (prior) {
      if (prior.case_id !== c.id) throw new Error("REQUEST_ID_REUSED");
      return { lessonId: prior.id, duplicate: true };
    }

    const live = await selectRows<{
      starts_at: string;
      duration_min: number;
      tutoring_cases: { mode: string | null } | null;
    }>(db, "case_lessons", "starts_at, duration_min, tutoring_cases(mode)", [
      { col: "tutor_id", op: "eq", value: tutorId },
      { col: "status", op: "in", value: LIVE_STATUSES },
    ]);
    const error = scheduleLessonError({
      sorStatus: c.sor_status,
      startsAtIso: data.startsAtIso,
      durationMin: data.durationMin,
      online: c.mode === "online",
      now: new Date(),
      existing: live.map((l) => ({
        starts_at: l.starts_at,
        duration_min: l.duration_min,
        mode: l.tutoring_cases?.mode ?? "in_person",
      })),
    });
    if (error) throw new Error(error);

    for (let attempt = 0; attempt < SEQUENCE_RETRIES; attempt += 1) {
      const existing = await selectRows<{ sequence: number }>(db, "case_lessons", "sequence", [
        { col: "case_id", op: "eq", value: c.id },
      ]);
      const now = new Date().toISOString();
      const { data: inserted, error: insertError } = await db
        .from<Row>("case_lessons")
        .insert({
          case_id: c.id,
          sequence: nextLessonSequence(existing),
          tutor_id: tutorId,
          starts_at: new Date(data.startsAtIso).toISOString(),
          duration_min: data.durationMin,
          location_or_link: data.locationOrLink || null,
          status: "planned",
          confirmed_by_tutor_at: now,
          client_request_id: data.clientRequestId,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (!insertError) {
        const lessonId = String((inserted as { id: string }).id);
        await insertAudit(db, c.id, context.userId, "planned", "tutor_scheduled_next_lesson");
        return { lessonId, duplicate: false };
      }
      const message = insertError.message;
      if (/client_request_id/i.test(message)) {
        const raced = await findByRequestId(db, data.clientRequestId);
        if (raced) return { lessonId: raced.id, duplicate: true };
      }
      if (/tutor_start_live/i.test(message)) throw new Error("SLOT_CONFLICT");
      if (!/duplicate|unique/i.test(message)) throw new Error(message);
      // (case_id, sequence) lost a race with another schedule: recompute.
    }
    throw new Error("SEQUENCE_BUSY");
  });
