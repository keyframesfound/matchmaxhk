/**
 * #533 admin side of MatchMax Managed (#530 Hybrid): opt a case in, top up
 * credits, read balance / burn, and the admin master calendar with occupancy.
 * Admin-gated, service role. Pure-matching cases never get an account.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import {
  insertAudit,
  requireAdmin,
  selectRows,
  selectRowsInRange,
  type Db,
  type Row,
} from "@/features/cases/desk-db";
import { generateSlots } from "@/features/cases/slot";
import { creditBurn, occupancyPct, type BurnEntry } from "@/features/academy/attendance";

async function adminDb(userId: string): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = asAdminDb(supabaseAdmin);
  await requireAdmin(db, userId);
  return db;
}

type CaseRow = {
  id: string;
  title: string | null;
  matched_tutor_id: string | null;
  managed: boolean;
  credit_account_id: string | null;
  cancellation_policy: Record<string, unknown> | null;
};

async function loadCase(db: Db, caseId: string): Promise<CaseRow> {
  const rows = await selectRows<CaseRow>(
    db,
    "tutoring_cases",
    "id, title, matched_tutor_id, managed, credit_account_id, cancellation_policy",
    [{ col: "id", op: "eq", value: caseId }],
  );
  if (!rows[0]) throw new Error("CASE_NOT_FOUND");
  return rows[0];
}

export type AcademyState = {
  managed: boolean;
  studentName: string | null;
  balance: number;
  held: number;
  burn30: number;
  lateCancelBillable: boolean;
  hasTutor: boolean;
  /** Lessons still waiting for attendance (planned / confirmed). */
  openLessons: { id: string; sequence: number; startsAt: string }[];
};

export const getAcademyState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<AcademyState> => {
    const db = await adminDb(context.userId);
    const c = await loadCase(db, data.caseId);
    const lessons = await selectRows<{
      id: string;
      sequence: number;
      starts_at: string;
      status: string;
    }>(
      db,
      "case_lessons",
      "id, sequence, starts_at, status",
      [{ col: "case_id", op: "eq", value: c.id }],
      { col: "starts_at", asc: true },
    );
    const base = {
      managed: c.managed,
      lateCancelBillable: c.cancellation_policy?.late_cancel_billable !== false,
      hasTutor: c.matched_tutor_id !== null,
      openLessons: lessons
        .filter((l) => l.status === "planned" || l.status === "confirmed")
        .map((l) => ({ id: l.id, sequence: l.sequence, startsAt: l.starts_at })),
    };
    if (!c.credit_account_id) {
      return { ...base, studentName: null, balance: 0, held: 0, burn30: 0 };
    }
    const [accounts, entries] = await Promise.all([
      selectRows<{ balance: string; held: string; students: { display_name: string } | null }>(
        db,
        "credit_accounts",
        "balance, held, students(display_name)",
        [{ col: "id", op: "eq", value: c.credit_account_id }],
      ),
      selectRows<BurnEntry & Row>(
        db,
        "credit_ledger_entries",
        "entry_type, held_delta, created_at",
        [
          { col: "account_id", op: "eq", value: c.credit_account_id },
          { col: "entry_type", op: "eq", value: "CONSUME" },
        ],
      ),
    ]);
    const a = accounts[0];
    return {
      ...base,
      studentName: a?.students?.display_name ?? null,
      balance: Number(a?.balance ?? 0),
      held: Number(a?.held ?? 0),
      burn30: creditBurn(entries, new Date()),
    };
  });

export const setCaseManaged = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        managed: z.boolean(),
        studentName: z.string().trim().min(1).max(80).optional(),
        lateCancelBillable: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ managed: boolean }> => {
    const db = await adminDb(context.userId);
    const c = await loadCase(db, data.caseId);
    const patch: Row = { managed: data.managed };
    if (data.lateCancelBillable !== undefined) {
      patch.cancellation_policy = {
        ...(c.cancellation_policy ?? { free_cancel_hours: 12 }),
        late_cancel_billable: data.lateCancelBillable,
      };
    }

    if (data.managed && !c.credit_account_id) {
      if (!c.matched_tutor_id) throw new Error("NO_MATCHED_TUTOR");
      const { data: student, error: sErr } = await db
        .from<Row>("students")
        .insert({ case_id: c.id, display_name: data.studentName ?? c.title ?? "Student" })
        .select("id")
        .single();
      if (sErr || !student) throw new Error(sErr?.message ?? "STUDENT_CREATE_FAILED");
      const { data: account, error: aErr } = await db
        .from<Row>("credit_accounts")
        .insert({ student_id: (student as { id: string }).id, tutor_id: c.matched_tutor_id })
        .select("id")
        .single();
      if (aErr || !account) throw new Error(aErr?.message ?? "ACCOUNT_CREATE_FAILED");
      patch.credit_account_id = (account as { id: string }).id;
    }

    const { error } = await db.from<Row>("tutoring_cases").update(patch).eq("id", c.id);
    if (error) throw new Error(error.message);
    await insertAudit(db, c.id, context.userId, "managed", `[#533] managed=${data.managed}`);
    return { managed: data.managed };
  });

export const addCaseCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        credits: z.number().positive().max(200),
        // Client-generated so a double-click posts once.
        idempotencyKey: z.string().uuid(),
        note: z.string().max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ balance: number }> => {
    const db = await adminDb(context.userId);
    const c = await loadCase(db, data.caseId);
    if (!c.credit_account_id) throw new Error("NOT_MANAGED");
    const { data: entry, error } = await db.rpc("post_credit_entry", {
      p_account_id: c.credit_account_id,
      p_entry_type: "PURCHASE",
      p_amount: data.credits,
      p_idempotency_key: `purchase:${data.idempotencyKey}`,
      p_actor_id: context.userId,
      p_actor_role: "admin",
      p_note: data.note ?? null,
    });
    if (error) throw new Error(error.message ?? "PURCHASE_FAILED");
    return { balance: Number((entry as { balance_after?: string } | null)?.balance_after ?? 0) };
  });

// ---------------------------------------------------------------------------
// Admin master calendar (#533): every lesson in the window + tutor occupancy.
// ---------------------------------------------------------------------------

export type CalendarLesson = {
  id: string;
  startsAt: string;
  durationMin: number;
  status: string;
  attendance: string | null;
  caseId: string;
  caseCode: string | null;
  managed: boolean;
  tutorId: string | null;
  tutorName: string | null;
};

export type TutorOccupancy = { tutorId: string; tutorName: string | null; pct: number };

type CalendarRow = {
  id: string;
  starts_at: string;
  duration_min: number;
  status: string;
  attendance: string | null;
  case_id: string;
  tutor_id: string | null;
  tutoring_cases: { case_code: string | null; managed: boolean | null } | null;
  tutors: { display_name: string | null } | null;
};

const LIVE = new Set(["planned", "confirmed", "done"]);

async function occupancyFor(
  db: Db,
  tutorIds: string[],
  lessons: CalendarRow[],
  now: Date,
  days: number,
): Promise<Map<string, number>> {
  if (tutorIds.length === 0) return new Map();
  const [windows, blackouts] = await Promise.all([
    selectRows<{ tutor_id: string; weekday: number; start_minute: number; end_minute: number }>(
      db,
      "tutor_weekly_windows",
      "tutor_id, weekday, start_minute, end_minute",
      [{ col: "tutor_id", op: "in", value: tutorIds }],
    ),
    selectRows<{ tutor_id: string; blackout_date: string }>(
      db,
      "tutor_blackout_dates",
      "tutor_id, blackout_date",
      [{ col: "tutor_id", op: "in", value: tutorIds }],
    ),
  ]);
  const result = new Map<string, number>();
  for (const tutorId of tutorIds) {
    const booked = lessons.filter(
      (l) => l.tutor_id === tutorId && LIVE.has(l.status) && new Date(l.starts_at) >= now,
    );
    const bookedMinutes = booked.reduce((s, l) => s + l.duration_min, 0);
    const free = generateSlots(
      windows
        .filter((w) => w.tutor_id === tutorId)
        .map((w) => ({ weekday: w.weekday, startMinute: w.start_minute, endMinute: w.end_minute })),
      blackouts.filter((b) => b.tutor_id === tutorId),
      booked.map((l) => ({ starts_at: l.starts_at, duration_min: l.duration_min })),
      now,
      now,
      { horizonDays: days },
    );
    const freeMinutes = free.reduce((s, slot) => s + slot.durationMin, 0);
    result.set(tutorId, occupancyPct(freeMinutes + bookedMinutes, bookedMinutes));
  }
  return result;
}

export const getAcademyCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ days: z.number().int().min(1).max(14).default(7) }).parse(input ?? {}),
  )
  .handler(
    async ({
      context,
      data,
    }): Promise<{ lessons: CalendarLesson[]; occupancy: TutorOccupancy[] }> => {
      const db = await adminDb(context.userId);
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const to = new Date(now.getTime() + data.days * 24 * 60 * 60 * 1000);
      const rows = await selectRowsInRange<CalendarRow>(
        db,
        "case_lessons",
        "id, starts_at, duration_min, status, attendance, case_id, tutor_id, tutoring_cases(case_code, managed), tutors(display_name)",
        [],
        { col: "starts_at", from: from.toISOString(), to: to.toISOString(), limit: 500 },
      );
      const tutorIds = [...new Set(rows.map((r) => r.tutor_id).filter((t): t is string => !!t))];
      const occ = await occupancyFor(db, tutorIds, rows, now, data.days);
      const nameOf = (id: string) =>
        rows.find((r) => r.tutor_id === id)?.tutors?.display_name ?? null;
      return {
        lessons: rows.map((r) => ({
          id: r.id,
          startsAt: r.starts_at,
          durationMin: r.duration_min,
          status: r.status,
          attendance: r.attendance,
          caseId: r.case_id,
          caseCode: r.tutoring_cases?.case_code ?? null,
          managed: r.tutoring_cases?.managed === true,
          tutorId: r.tutor_id,
          tutorName: r.tutors?.display_name ?? null,
        })),
        occupancy: tutorIds
          .map((id) => ({ tutorId: id, tutorName: nameOf(id), pct: occ.get(id) ?? 0 }))
          .sort((a, b) => b.pct - a.pct),
      };
    },
  );
