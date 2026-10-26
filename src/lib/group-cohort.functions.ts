/**
 * Issue #391, Small Group Classes server fns.
 *
 * Tutors own their cohorts (RLS: tutors.user_id owner policies); the server
 * fns re-check ownership server-side before any service-role write, the same
 * belt-and-braces the admin desk uses. Booking spawns ONE tutoring_case per
 * parent with student_count = seats and group_cohort_id set, siblings share
 * the parent's case; unrelated parents never see each other (PDPO).
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb } from "@/features/materials/storage-helpers";
import type { Database } from "@/integrations/supabase/types";
import { contactFilterError, sanitizeCaseFreeText } from "@/lib/contact-filter";
import { DEFAULT_CURRENCY } from "@/lib/money";
import { FEE_TERMS_VERSION } from "@/features/legal/terms";
import {
  COHORT_DESCRIPTION_MAX,
  COHORT_MAX_SEATS,
  COHORT_MIN_SEATS,
  COHORT_SCHEDULE_MAX,
  COHORT_TITLE_MAX,
  cohortAvailability,
  type CohortStudentInput,
} from "@/features/cases/group-cohorts";
import { RATE_MAX, RATE_MIN } from "@/features/tutors/rates";

type Row = Record<string, unknown>;
type Db = ReturnType<typeof asAdminDb>;

type CohortRow = {
  id: string;
  tutor_id: string;
  title: string;
  curriculum: string;
  subject: string;
  student_level: string;
  weekly_schedule: string;
  mode: string;
  district: string | null;
  per_student_rate_hkd: number;
  min_seats: number;
  max_seats: number;
  description: string | null;
  status: string;
  created_at: string;
};

type CohortTutorJoin = {
  display_name: string | null;
  tutor_code: string | null;
  verification_tier: string | null;
  photo_url: string | null;
  is_published: boolean | null;
} | null;

/** Cohort shaped for the dashboard / public board (seats derived, not stored). */
export type GroupCohortView = {
  id: string;
  title: string;
  curriculum: string;
  subject: string;
  studentLevel: string;
  weeklySchedule: string;
  mode: string;
  district: string | null;
  perStudentRateHkd: number;
  minSeats: number;
  maxSeats: number;
  description: string | null;
  status: CohortRow["status"];
  createdAt: string;
  tutorCode: string | null;
  tutorName: string | null;
  verified: boolean;
  seatsTaken: number;
  seatsLeft: number;
  state: string;
  bookable: boolean;
};

async function selectRows<T extends Row>(
  db: Db,
  table: string,
  cols: string,
  match: { col: string; op: "eq" | "in" | "neq"; value: unknown }[],
  order?: { col: string; asc?: boolean; limit?: number },
): Promise<T[]> {
  let q = db.from<T>(table).select(cols);
  for (const m of match) {
    if (m.op === "eq") q = q.eq(m.col, m.value);
    else if (m.op === "neq") q = q.neq(m.col, m.value);
    else q = q.in(m.col, m.value as unknown[]);
  }
  if (order) q = q.order(order.col, { ascending: order.asc ?? true });
  if (order?.limit) q = q.limit(order.limit);
  const { data } = await q;
  return (data ?? []) as T[];
}

/** Seat sums per cohort id from live cases (closed/rejected free their seats). */
async function seatSumsByCohort(db: Db, cohortIds: string[]): Promise<Map<string, number>> {
  const sums = new Map<string, number>();
  if (cohortIds.length === 0) return sums;
  const cases = await selectRows<{
    group_cohort_id: string | null;
    status: string;
    student_count: number;
  }>(db, "tutoring_cases", "group_cohort_id, status, student_count", [
    { col: "group_cohort_id", op: "in", value: cohortIds },
  ]);
  for (const c of cases) {
    if (!c.group_cohort_id) continue;
    const count = Number.isInteger(c.student_count) && c.student_count >= 1 ? c.student_count : 1;
    if (c.status === "closed" || c.status === "rejected") continue;
    sums.set(c.group_cohort_id, (sums.get(c.group_cohort_id) ?? 0) + count);
  }
  return sums;
}

function toView(row: CohortRow, tutor: CohortTutorJoin, seatsTaken: number): GroupCohortView {
  const availability = cohortAvailability(row, [{ status: "matched", student_count: seatsTaken }]);
  return {
    id: row.id,
    title: row.title,
    curriculum: row.curriculum,
    subject: row.subject,
    studentLevel: row.student_level,
    weeklySchedule: row.weekly_schedule,
    mode: row.mode,
    district: row.district,
    perStudentRateHkd: row.per_student_rate_hkd,
    minSeats: row.min_seats,
    maxSeats: row.max_seats,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
    tutorCode: tutor?.tutor_code ?? null,
    tutorName: tutor?.display_name ?? null,
    verified: tutor?.verification_tier === "tier_2_verified",
    seatsTaken,
    seatsLeft: availability.seatsLeft,
    state: availability.state,
    bookable: availability.bookable,
  };
}

// ---------------------------------------------------------------------------
// Tutor-owned CRUD
// ---------------------------------------------------------------------------

const cohortInputSchema = z
  .object({
    id: z.string().uuid().optional(),
    title: z.string().trim().min(1).max(COHORT_TITLE_MAX),
    curriculum: z.string().trim().min(1).max(40),
    subject: z.string().trim().min(1).max(120),
    studentLevel: z.string().trim().min(1).max(80),
    weeklySchedule: z.string().trim().min(1).max(COHORT_SCHEDULE_MAX),
    mode: z.enum(["online", "in_person"]),
    district: z.string().trim().max(80).optional().nullable(),
    perStudentRateHkd: z.number().int().min(RATE_MIN).max(RATE_MAX),
    minSeats: z.number().int().min(1).max(COHORT_MAX_SEATS).default(2),
    maxSeats: z.number().int().min(COHORT_MIN_SEATS).max(COHORT_MAX_SEATS),
    description: z.string().trim().max(COHORT_DESCRIPTION_MAX).optional().nullable(),
    // Tutors confirm an early start by flipping status to running.
    status: z.enum(["forming", "running"]).default("forming"),
  })
  .refine((data) => data.minSeats <= data.maxSeats, {
    message: "Min seats cannot exceed max seats.",
    path: ["minSeats"],
  })
  .refine((data) => data.mode !== "in_person" || (data.district ?? "").length > 0, {
    message: "In-person cohorts need a district.",
    path: ["district"],
  });

async function requireOwnedTutorId(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<string> {
  const { data, error } = await supabase
    .from("tutors")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data?.id) throw new Error("NOT_A_TUTOR");
  return data.id as string;
}

export const upsertMyGroupCohort = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => cohortInputSchema.parse(input))
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    const tutorId = await requireOwnedTutorId(context.supabase, context.userId);

    // Contact filter: titles, schedules and descriptions must never leak
    // phones/emails/socials (same rule as case free text).
    for (const [field, value] of [
      ["title", data.title],
      ["weekly schedule", data.weeklySchedule],
      ["description", data.description ?? ""],
    ] as const) {
      const violation = contactFilterError(value);
      if (violation) throw new Error(`${field}: ${violation}`);
    }

    const payload = {
      tutor_id: tutorId,
      title: data.title,
      curriculum: data.curriculum,
      subject: data.subject,
      student_level: data.studentLevel,
      weekly_schedule: data.weeklySchedule,
      mode: data.mode,
      district: data.mode === "in_person" ? (data.district ?? null) : null,
      per_student_rate_hkd: data.perStudentRateHkd,
      min_seats: data.minSeats,
      max_seats: data.maxSeats,
      description: sanitizeCaseFreeText(data.description ?? "", COHORT_DESCRIPTION_MAX),
      status: data.status,
    };

    if (data.id) {
      const owned = await selectRows<{ id: string }>(db, "group_cohorts", "id", [
        { col: "id", op: "eq", value: data.id },
        { col: "tutor_id", op: "eq", value: tutorId },
      ]);
      if (!owned[0]) throw new Error("FORBIDDEN");
      const { error } = await db
        .from<Row>("group_cohorts")
        .update(payload)
        .eq("id", data.id)
        .eq("tutor_id", tutorId);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }

    const { data: inserted, error } = await db
      .from<Row>("group_cohorts")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: String(inserted.id) };
  });

export const closeMyGroupCohort = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ cohortId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutorId = await requireOwnedTutorId(context.supabase, context.userId);
    const { error } = await db
      .from<Row>("group_cohorts")
      .update({ status: "closed" })
      .eq("id", data.cohortId)
      .eq("tutor_id", tutorId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getMyGroupCohorts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GroupCohortView[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutorId = await requireOwnedTutorId(context.supabase, context.userId);

    const rows = await selectRows<CohortRow & { tutors: CohortTutorJoin }>(
      db,
      "group_cohorts",
      "*, tutors(display_name, tutor_code, verification_tier, photo_url, is_published)",
      [{ col: "tutor_id", op: "eq", value: tutorId }],
      { col: "created_at", asc: false },
    );
    const seats = await seatSumsByCohort(
      db,
      rows.map((r) => r.id),
    );
    return rows.map((row) => {
      const { tutors: tutor, ...cohort } = row;
      return toView(cohort, tutor, seats.get(row.id) ?? 0);
    });
  });

// ---------------------------------------------------------------------------
// Public board
// ---------------------------------------------------------------------------

/**
 * Open cohorts for /group-classes. Public data only (no contact fields live
 * on cohort rows); only cohorts of published tutors surface. Runs without
 * auth, the service-role read is scoped to exactly the public columns.
 */
export const getPublicGroupCohorts = createServerFn({ method: "GET" }).handler(
  async (): Promise<GroupCohortView[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const rows = await selectRows<CohortRow & { tutors: CohortTutorJoin }>(
      db,
      "group_cohorts",
      "*, tutors(display_name, tutor_code, verification_tier, photo_url, is_published)",
      [{ col: "status", op: "neq", value: "closed" }],
      { col: "created_at", asc: false, limit: 100 },
    );
    const visible = rows.filter((row) => row.tutors?.is_published === true);
    const seats = await seatSumsByCohort(
      db,
      visible.map((r) => r.id),
    );
    return visible.map((row) => {
      const { tutors: tutor, ...cohort } = row;
      return toView(cohort, tutor, seats.get(row.id) ?? 0);
    });
  },
);

// ---------------------------------------------------------------------------
// Parent booking
// ---------------------------------------------------------------------------

const bookingInputSchema = z.object({
  cohortId: z.string().uuid(),
  seats: z.number().int().min(1).max(COHORT_MAX_SEATS),
  students: z
    .array(
      z.object({
        firstName: z.string().trim().min(1).max(40),
        grade: z.string().trim().min(1).max(40),
      }),
    )
    .max(COHORT_MAX_SEATS),
  contactName: z.string().trim().min(1).max(80),
  contactPhone: z.string().trim().min(5).max(40),
  whatsappOk: z.boolean().default(true),
  notes: z.string().trim().max(500).optional().nullable(),
  termsAck: z.literal(true),
  feeTermsAck: z.literal(true),
});

/**
 * Book 1+ seats on a cohort. Spawns one `new` case under the caller's
 * account (student_count = seats, group_cohort_id set) that staff then match
 * to the cohort tutor and run through the normal SoR lifecycle, the admin
 * fee invoices at 1.5 × per-student rate × student_count.
 */
export const bookGroupCohort = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => bookingInputSchema.parse(input))
  .handler(async ({ context, data }): Promise<{ caseCode: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    if (data.students.length !== data.seats) {
      throw new Error("STUDENT_COUNT_MISMATCH");
    }

    const rows = await selectRows<CohortRow & { tutors: CohortTutorJoin }>(
      db,
      "group_cohorts",
      "*, tutors(display_name, tutor_code, verification_tier, photo_url, is_published)",
      [{ col: "id", op: "eq", value: data.cohortId }],
    );
    const cohort = rows[0];
    if (!cohort || cohort.tutors?.is_published !== true) throw new Error("COHORT_NOT_FOUND");

    // Tutors do not book their own cohorts through the parent flow.
    const { data: ownTutor } = await context.supabase
      .from("tutors")
      .select("id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (ownTutor?.id === cohort.tutor_id) throw new Error("OWN_COHORT_BOOKING");

    const seats = await seatSumsByCohort(db, [cohort.id]);
    const availability = cohortAvailability(cohort, [
      { status: "matched", student_count: seats.get(cohort.id) ?? 0 },
    ]);
    if (!availability.bookable) throw new Error("COHORT_NOT_BOOKABLE");
    if (data.seats > availability.seatsLeft) throw new Error("NOT_ENOUGH_SEATS");

    // Contact filter on the optional parent note.
    const notesViolation = data.notes ? contactFilterError(data.notes) : null;
    if (notesViolation) throw new Error(`notes: ${notesViolation}`);

    const studentLine = data.students
      .map((s: CohortStudentInput) => `${s.firstName} (${s.grade})`)
      .join(", ");
    const description = [
      cohort.description ?? null,
      studentLine ? `Students: ${studentLine}` : null,
      sanitizeCaseFreeText(data.notes ?? "", 500),
    ]
      .filter(Boolean)
      .join("\n\n");

    const insertRow = {
      parent_id: context.userId,
      title: cohort.title,
      description: description || null,
      subjects: [cohort.subject],
      exam_system: cohort.curriculum,
      student_level: cohort.student_level,
      district: cohort.district,
      mode: cohort.mode,
      sessions_per_week: 1,
      session_length_minutes: 60,
      schedule_note: cohort.weekly_schedule,
      preferred_gender: "any" as const,
      language_of_instruction: "either",
      urgency: "normal" as const,
      budget_min: cohort.per_student_rate_hkd,
      budget_max: cohort.per_student_rate_hkd,
      budget_currency: DEFAULT_CURRENCY,
      // Fee basis: the PER-STUDENT rate; totals scale by student_count at
      // invoice time (fee-breakdown × count, issue #391).
      hourly_rate_hkd: cohort.per_student_rate_hkd,
      package_type: "ongoing_1_5",
      student_count: data.seats,
      rate_unit: "hr",
      group_cohort_id: cohort.id,
      contact_name: data.contactName,
      contact_phone: data.contactPhone,
      whatsapp_ok: data.whatsappOk,
      source: "website",
      requester_type: "parent",
      status: "new" as const,
    };

    const { data: row, error } = await db
      .from<Row>("tutoring_cases")
      .insert(insertRow)
      .select("id,case_code")
      .single();
    if (error) {
      // The seat-cap trigger (20261024120000) is the race backstop for the
      // availability check above, a booking that slipped past the pre-flight
      // surfaces as the same parent-facing error.
      if (error.message.includes("COHORT_SEAT_CAP_EXCEEDED")) {
        throw new Error("NOT_ENOUGH_SEATS");
      }
      throw new Error(error.message);
    }

    // Same fail-closed matching-fee acceptance as submitCaseRequest: the
    // acceptance write is atomic with the case via compensating delete.
    const { recordTermsAcceptance } = await import("@/features/legal/terms-acceptance.server");
    try {
      await recordTermsAcceptance({
        userId: context.userId,
        surface: "case_request",
        termsVersion: FEE_TERMS_VERSION,
        subjectId: row.id as string,
      });
    } catch (acceptanceError) {
      // Compensating delete on the raw service-role client (the AdminDb
      // facade has no .delete).
      const { error: rollbackError } = await supabaseAdmin
        .from("tutoring_cases")
        .delete()
        .eq("id", row.id as string);
      if (rollbackError) {
        console.error(
          "[group-cohort] failed to roll back case after acceptance write failed:",
          rollbackError.message,
        );
      }
      throw acceptanceError;
    }

    return { caseCode: row.case_code as string };
  });
