/**
 * Issue #454 — cockpit server half: fast-tutor pins per subject, tutor
 * decline reasons, and the per-case cockpit fields (group size + the manual
 * Master Sheet market band). Staff only; tables are RLS-deny.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { requireAdmin, selectRows, type Row } from "@/features/cases/desk-db";
import { DECLINE_REASONS, GROUP_SIZES } from "@/features/cases/cockpit";

/** Pins per subject: enough for a wave of 3 plus spares. */
const MAX_PINS = 6;

export type PinnedTutor = { id: string; code: string; name: string };
export type CockpitDecline = { tutorId: string; reason: string; createdAt: string };
export type CockpitCase = {
  caseCode: string;
  status: string;
  rateHkd: number | null;
  studentCount: number | null;
  groupSize: string;
  marketMinHkd: number | null;
  marketMaxHkd: number | null;
  budgetMaxHkd: number | null;
  isShortCase: boolean;
  sessionLengthMinutes: number | null;
  scheduledLessonCount: number | null;
  firstLessonAt: string | null;
};
export type CockpitData = {
  caseRow: CockpitCase | null;
  subject: string | null;
  pins: PinnedTutor[];
  declines: CockpitDecline[];
};

async function adminDb(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = asAdminDb(supabaseAdmin);
  await requireAdmin(db, userId);
  return db;
}

export const getCockpit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CockpitData> => {
    const db = await adminDb(context.userId);
    const cases = await selectRows<{
      subjects: string[] | null;
      case_code: string;
      status: string;
      hourly_rate_hkd: number | null;
      student_count: number | null;
      group_size: string | null;
      market_min_hkd: number | null;
      market_max_hkd: number | null;
      budget_max_hkd: number | null;
      is_short_case: boolean | null;
      session_length_minutes: number | null;
      scheduled_lesson_count: number | null;
    }>(
      db,
      "tutoring_cases",
      "subjects, case_code, status, hourly_rate_hkd, student_count, group_size, market_min_hkd, market_max_hkd, budget_max_hkd, is_short_case, session_length_minutes, scheduled_lesson_count",
      [{ col: "id", op: "eq", value: data.caseId }],
    );
    const c = cases[0];
    const subject = c?.subjects?.[0] ?? null;
    const firstLesson = await selectRows<{ starts_at: string }>(db, "case_lessons", "starts_at", [
      { col: "case_id", op: "eq", value: data.caseId },
      { col: "sequence", op: "eq", value: 1 },
    ]);
    const caseRow: CockpitCase | null = c
      ? {
          caseCode: c.case_code,
          status: c.status,
          rateHkd: c.hourly_rate_hkd === null ? null : Number(c.hourly_rate_hkd),
          studentCount: c.student_count,
          groupSize: c.group_size ?? "1_ON_1",
          marketMinHkd: c.market_min_hkd,
          marketMaxHkd: c.market_max_hkd,
          budgetMaxHkd: c.budget_max_hkd === null ? null : Number(c.budget_max_hkd),
          isShortCase: c.is_short_case === true,
          sessionLengthMinutes: c.session_length_minutes,
          scheduledLessonCount: c.scheduled_lesson_count,
          firstLessonAt: firstLesson[0]?.starts_at ?? null,
        }
      : null;
    const [pinRows, declines] = await Promise.all([
      subject
        ? selectRows<{ tutor_ids: string[] }>(db, "desk_fast_pins", "tutor_ids", [
            { col: "subject", op: "eq", value: subject },
          ])
        : Promise.resolve([]),
      selectRows<{ tutor_id: string; reason: string; created_at: string }>(
        db,
        "case_tutor_declines",
        "tutor_id, reason, created_at",
        [{ col: "case_id", op: "eq", value: data.caseId }],
      ),
    ]);
    const ids = pinRows[0]?.tutor_ids ?? [];
    const tutors =
      ids.length === 0
        ? []
        : await selectRows<{ id: string; tutor_code: string; display_name: string | null }>(
            db,
            "tutors",
            "id, tutor_code, display_name",
            [{ col: "id", op: "in", value: ids }],
          );
    const byId = new Map(tutors.map((t) => [t.id, t]));
    return {
      caseRow,
      subject,
      pins: ids.flatMap((id) => {
        const t = byId.get(id);
        return t ? [{ id: t.id, code: t.tutor_code, name: t.display_name ?? t.tutor_code }] : [];
      }),
      declines: declines.map((d) => ({
        tutorId: d.tutor_id,
        reason: d.reason,
        createdAt: d.created_at,
      })),
    };
  });

/** Replace a subject's pins from tutor codes (unknown codes are reported back). */
export const setFastPins = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject: z.string().trim().min(1).max(80),
        tutorCodes: z.array(z.string().trim().min(1).max(40)).max(MAX_PINS),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ unknownCodes: string[] }> => {
    const db = await adminDb(context.userId);
    const codes = [...new Set(data.tutorCodes.map((c) => c.toUpperCase()))];
    const tutors =
      codes.length === 0
        ? []
        : await selectRows<{ id: string; tutor_code: string }>(db, "tutors", "id, tutor_code", [
            { col: "tutor_code", op: "in", value: codes },
          ]);
    const byCode = new Map(tutors.map((t) => [t.tutor_code.toUpperCase(), t.id]));
    const ids = codes.flatMap((c) => {
      const id = byCode.get(c);
      return id ? [id] : [];
    });
    const { error } = await db.from<Row>("desk_fast_pins").upsert(
      {
        subject: data.subject,
        tutor_ids: ids,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "subject" },
    );
    if (error) throw new Error(error.message);
    return { unknownCodes: codes.filter((c) => !byCode.has(c)) };
  });

export const logTutorDecline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        tutorId: z.string().uuid(),
        reason: z.enum(DECLINE_REASONS),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await adminDb(context.userId);
    const { error } = await db.from<Row>("case_tutor_declines").insert({
      case_id: data.caseId,
      tutor_id: data.tutorId,
      reason: data.reason,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateCockpitFields = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        groupSize: z.enum(GROUP_SIZES),
        marketMinHkd: z.number().int().positive().max(100_000).nullable(),
        marketMaxHkd: z.number().int().positive().max(100_000).nullable(),
      })
      .refine(
        (v) =>
          v.marketMinHkd === null || v.marketMaxHkd === null || v.marketMinHkd <= v.marketMaxHkd,
        { message: "MARKET_BAND_INVALID" },
      )
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await adminDb(context.userId);
    const { error } = await db
      .from<Row>("tutoring_cases")
      .update({
        group_size: data.groupSize,
        market_min_hkd: data.marketMinHkd,
        market_max_hkd: data.marketMaxHkd,
      })
      .eq("id", data.caseId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
