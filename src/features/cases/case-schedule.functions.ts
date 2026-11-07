/**
 * Issue #636: Case Manager schedule, server half.
 *
 * getCaseManagerSchedule is the one read of the schedule graph (occupied,
 * proposed, blocked, open); #605, #659 and #660 consume it instead of keeping
 * a second calendar. Either party may fill a weekly series or move lessons;
 * changes reach the other side because both read the same case_lessons rows.
 * Counterparties stay masked here: no names, phones or fee amounts.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { insertAudit, selectRows, type Db, type Row } from "@/features/cases/desk-db";
import { insertLessonLifecycleEvent } from "@/features/cases/bus.functions";
import {
  RELEASED_SLOT_DAYS,
  SERIES_MAX_LESSONS,
  SERIES_MAX_WEEKS,
  buildWeeklySeries,
  hktClock,
  orderForShift,
  partitionSeriesClashes,
  scheduleUpdatedCaseIds,
  seriesPrefill,
  shiftedStart,
  targetsForEdit,
  type ScheduleLesson,
} from "@/features/cases/case-schedule";
import {
  SCHEDULABLE_SOR_STATUSES,
  SCHEDULE_MAX_AHEAD_DAYS,
  isTimeClashError,
  nextLessonSequence,
  scheduleLessonError,
} from "@/features/cases/schedule-lesson";
import { hktDateKey } from "@/features/cases/sor";
import type { ExistingLesson } from "@/features/cases/slot";

const CASE_LIMIT = 200;
const SEQUENCE_RETRIES = 3;
const LOCATION_MAX = 300;
const DAY_MS = 24 * 60 * 60 * 1000;
const OCCUPYING = ["planned", "confirmed", "done"];
const PENDING_APPLICATION = ["new", "reviewed", "shortlisted"];
const OPEN_CASE_STATUSES = new Set(["new", "contacted"]);

export type PartyRole = "tutor" | "parent";

type CaseRow = {
  id: string;
  case_code: string;
  subjects: string[] | null;
  student_level: string | null;
  hourly_rate_hkd: number | null;
  mode: string | null;
  district: string | null;
  sor_status: string | null;
  schedule_mode: string | null;
  schedule_paused_at: string | null;
  student_id: string | null;
};

const CASE_COLS =
  "id, case_code, subjects, student_level, hourly_rate_hkd, mode, district, sor_status, schedule_mode, schedule_paused_at, student_id";

type LessonRow = {
  id: string;
  case_id: string;
  starts_at: string;
  duration_min: number;
  status: string;
  series_id: string | null;
};

const LESSON_COLS = "id, case_id, starts_at, duration_min, status, series_id";

export type ScheduleCase = {
  id: string;
  code: string;
  role: PartyRole;
  sorStatus: string | null;
  paused: boolean;
  canSchedule: boolean;
  subject: string | null;
  level: string | null;
  rateHkd: number | null;
  mode: string | null;
  district: string | null;
  scheduleMode: string | null;
  prefill: ReturnType<typeof seriesPrefill>;
};

export type HubScheduleLesson = ScheduleLesson & {
  caseCode: string;
  subject: string | null;
  role: PartyRole;
};

export type ProposedItem = {
  caseId: string;
  caseCode: string;
  subject: string | null;
  role: PartyRole;
  scheduleMode: string | null;
  scheduleUpdated: boolean;
};

export type CaseManagerSchedule = {
  cases: ScheduleCase[];
  lessons: HubScheduleLesson[];
  proposed: ProposedItem[];
  /** User-Blocked: whole HKT dates (tutor blackouts). */
  blockedDates: string[];
  /** Open: the tutor's weekly teaching windows in HKT minutes. */
  openWindows: { weekday: number; startMinute: number; endMinute: number }[];
};

function toLesson(row: LessonRow): ScheduleLesson {
  return {
    id: row.id,
    caseId: row.case_id,
    startsAt: row.starts_at,
    durationMin: row.duration_min,
    status: row.status,
    seriesId: row.series_id,
  };
}

async function myTutorId(db: Db, userId: string): Promise<string | null> {
  const rows = await selectRows<{ id: string }>(db, "tutors", "id", [
    { col: "user_id", op: "eq", value: userId },
  ]);
  return rows[0]?.id ?? null;
}

/** #459 §4.4: a claimed child whose schedule is hidden from the parent. */
async function hiddenStudentIds(db: Db, userId: string): Promise<Set<string>> {
  const rows = await selectRows<{ id: string }>(db, "students", "id", [
    { col: "parent_user_id", op: "eq", value: userId },
    { col: "status", op: "eq", value: "claimed_independent" },
    { col: "can_view_schedule", op: "eq", value: false },
  ]);
  return new Set(rows.map((r) => r.id));
}

async function tutorProposals(
  db: Db,
  tutorId: string,
  now: Date,
): Promise<{ pending: ProposedRow[]; releasedSlots: unknown[] }> {
  const rows = await selectRows<{
    status: string;
    updated_at: string;
    tutoring_cases: (ProposedRow & { matched_tutor_id: string | null }) | null;
  }>(
    db,
    "case_applications",
    "status, updated_at, tutoring_cases(id, case_code, subjects, schedule_mode, schedule_slots, matched_tutor_id)",
    [{ col: "tutor_id", op: "eq", value: tutorId }],
  );
  const releasedSince = now.getTime() - RELEASED_SLOT_DAYS * DAY_MS;
  const pending: ProposedRow[] = [];
  const releasedSlots: unknown[] = [];
  for (const row of rows) {
    const c = row.tutoring_cases;
    if (!c) continue;
    const dead = row.status === "rejected" || c.matched_tutor_id !== null;
    if (!dead && PENDING_APPLICATION.includes(row.status)) pending.push(c);
    if (dead && Date.parse(row.updated_at) >= releasedSince && Array.isArray(c.schedule_slots)) {
      releasedSlots.push(...c.schedule_slots);
    }
  }
  return { pending, releasedSlots };
}

type ProposedRow = {
  id: string;
  case_code: string;
  subjects: string[] | null;
  schedule_mode: string | null;
  schedule_slots: unknown;
};

function toProposedItems(
  rows: readonly ProposedRow[],
  role: PartyRole,
  lessons: readonly ScheduleLesson[],
  releasedSlots: unknown[],
): ProposedItem[] {
  const updated = new Set(
    scheduleUpdatedCaseIds(
      rows.map((c) => ({ caseId: c.id, scheduleMode: c.schedule_mode, slots: c.schedule_slots })),
      lessons,
      releasedSlots,
    ),
  );
  return rows.map((c) => ({
    caseId: c.id,
    caseCode: c.case_code,
    subject: c.subjects?.[0] ?? null,
    role,
    scheduleMode: c.schedule_mode,
    scheduleUpdated: updated.has(c.id),
  }));
}

export const getCaseManagerSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CaseManagerSchedule> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const now = new Date();
    const tutorId = await myTutorId(db, context.userId);

    const [taught, owned, hidden] = await Promise.all([
      tutorId
        ? selectRows<CaseRow>(db, "tutoring_cases", CASE_COLS, [
            { col: "matched_tutor_id", op: "eq", value: tutorId },
          ])
        : Promise.resolve<CaseRow[]>([]),
      selectRows<
        CaseRow & {
          status: string;
          matched_tutor_id: string | null;
          schedule_slots: unknown;
        }
      >(db, "tutoring_cases", `${CASE_COLS}, status, matched_tutor_id, schedule_slots`, [
        { col: "parent_id", op: "eq", value: context.userId },
      ]),
      hiddenStudentIds(db, context.userId),
    ]);
    const ownedVisible = owned.filter((c) => !c.student_id || !hidden.has(c.student_id));
    const parentMatched = ownedVisible.filter((c) => c.matched_tutor_id !== null);

    const roleByCase = new Map<string, { row: CaseRow; role: PartyRole }>();
    for (const row of taught) roleByCase.set(row.id, { row, role: "tutor" });
    for (const row of parentMatched) {
      if (!roleByCase.has(row.id)) roleByCase.set(row.id, { row, role: "parent" });
    }
    const entries = [...roleByCase.values()].slice(0, CASE_LIMIT);
    const caseIds = entries.map((e) => e.row.id);
    const lessonRows =
      caseIds.length === 0
        ? []
        : await selectRows<LessonRow>(db, "case_lessons", LESSON_COLS, [
            { col: "case_id", op: "in", value: caseIds },
          ]);
    const lessons = lessonRows.map(toLesson);

    const cases: ScheduleCase[] = entries.map(({ row, role }) => ({
      id: row.id,
      code: row.case_code,
      role,
      sorStatus: row.sor_status,
      paused: row.schedule_paused_at !== null,
      canSchedule:
        row.schedule_paused_at === null &&
        row.sor_status !== null &&
        SCHEDULABLE_SOR_STATUSES.has(row.sor_status),
      subject: row.subjects?.[0] ?? null,
      level: row.student_level,
      rateHkd: row.hourly_rate_hkd,
      mode: row.mode,
      district: row.district,
      scheduleMode: row.schedule_mode,
      prefill: seriesPrefill(
        lessons.filter((l) => l.caseId === row.id),
        now,
      ),
    }));
    const byId = new Map(cases.map((c) => [c.id, c]));
    const hubLessons = lessons.flatMap((l) => {
      const c = byId.get(l.caseId);
      return c ? [{ ...l, caseCode: c.code, subject: c.subject, role: c.role }] : [];
    });

    const parentOpen = ownedVisible.filter(
      (c) => c.matched_tutor_id === null && OPEN_CASE_STATUSES.has(c.status),
    );
    const parentLessons = hubLessons.filter((l) => l.role === "parent");
    const proposed = toProposedItems(parentOpen, "parent", parentLessons, []);

    let blockedDates: string[] = [];
    let openWindows: CaseManagerSchedule["openWindows"] = [];
    if (tutorId) {
      const [{ pending, releasedSlots }, blackouts, windows] = await Promise.all([
        tutorProposals(db, tutorId, now),
        selectRows<{ blackout_date: string }>(db, "tutor_blackout_dates", "blackout_date", [
          { col: "tutor_id", op: "eq", value: tutorId },
        ]),
        selectRows<{ weekday: number; start_minute: number; end_minute: number }>(
          db,
          "tutor_weekly_windows",
          "weekday, start_minute, end_minute",
          [{ col: "tutor_id", op: "eq", value: tutorId }],
        ),
      ]);
      const tutorLessons = hubLessons.filter((l) => l.role === "tutor");
      proposed.push(...toProposedItems(pending, "tutor", tutorLessons, releasedSlots));
      blockedDates = blackouts.map((b) => b.blackout_date);
      openWindows = windows.map((w) => ({
        weekday: w.weekday,
        startMinute: w.start_minute,
        endMinute: w.end_minute,
      }));
    }

    return { cases, lessons: hubLessons, proposed, blockedDates, openWindows };
  });

type PartyCase = {
  id: string;
  case_code: string;
  parent_id: string | null;
  matched_tutor_id: string | null;
  student_id: string | null;
  sor_status: string | null;
  schedule_paused_at: string | null;
  mode: string | null;
};

async function partyCase(
  db: Db,
  caseId: string,
  userId: string,
): Promise<{ c: PartyCase; role: PartyRole; tutorId: string }> {
  const rows = await selectRows<PartyCase>(
    db,
    "tutoring_cases",
    "id, case_code, parent_id, matched_tutor_id, student_id, sor_status, schedule_paused_at, mode",
    [{ col: "id", op: "eq", value: caseId }],
  );
  const c = rows[0];
  if (!c?.matched_tutor_id) throw new Error("CASE_NOT_FOUND");
  const tutorId = await myTutorId(db, userId);
  if (tutorId && tutorId === c.matched_tutor_id) {
    return { c, role: "tutor", tutorId: c.matched_tutor_id };
  }
  if (c.parent_id !== userId) throw new Error("CASE_NOT_FOUND");
  if (c.student_id && (await hiddenStudentIds(db, userId)).has(c.student_id)) {
    throw new Error("CASE_NOT_FOUND");
  }
  return { c, role: "parent", tutorId: c.matched_tutor_id };
}

/** Every occupied block on the tutor's or the learner's side, for clash checks. */
async function occupiedFor(db: Db, c: PartyCase, tutorId: string): Promise<(ExistingLesson & { id: string })[]> {
  type Busy = {
    id: string;
    starts_at: string;
    duration_min: number;
    tutoring_cases: { mode: string | null } | null;
  };
  const tutorRows = await selectRows<Busy>(db, "case_lessons", "id, starts_at, duration_min, tutoring_cases(mode)", [
    { col: "tutor_id", op: "eq", value: tutorId },
    { col: "status", op: "in", value: OCCUPYING },
  ]);
  const learnerRows = c.student_id
    ? await selectRows<Busy>(db, "case_lessons", "id, starts_at, duration_min, tutoring_cases!inner(mode, student_id)", [
        { col: "tutoring_cases.student_id", op: "eq", value: c.student_id },
        { col: "status", op: "in", value: OCCUPYING },
      ])
    : [];
  const byId = new Map([...tutorRows, ...learnerRows].map((r) => [r.id, r]));
  return [...byId.values()].map((r) => ({
    id: r.id,
    starts_at: r.starts_at,
    duration_min: r.duration_min,
    mode: r.tutoring_cases?.mode ?? "in_person",
  }));
}

function lessonLine(iso: string): string {
  return `${hktDateKey(new Date(iso))} ${hktClock(iso)} HKT`;
}

async function resolveOpenScheduleActions(db: Db, caseId: string): Promise<void> {
  try {
    const { completeActionsFor } = await import("@/features/cases/action-required.functions");
    await completeActionsFor(db, "lesson_reschedule", caseId);
    await completeActionsFor(db, "intro_confirm", caseId);
  } catch (e) {
    console.warn("[case-schedule] action completion failed:", e);
  }
}

export const scheduleLessonSeries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        seriesId: z.string().uuid(),
        firstDateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        weekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7),
        minuteOfDay: z.number().int().min(0).max(1439),
        durationMin: z.number().int(),
        weeks: z.number().int().min(1).max(SERIES_MAX_WEEKS),
        locationOrLink: z.string().trim().max(LOCATION_MAX).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ created: number; skipped: string[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c, role, tutorId } = await partyCase(db, data.caseId, context.userId);
    if (c.schedule_paused_at) throw new Error("CASE_PAUSED");

    const prior = await selectRows<{ id: string }>(db, "case_lessons", "id", [
      { col: "series_id", op: "eq", value: data.seriesId },
    ]);
    if (prior.length > 0) return { created: prior.length, skipped: [] };

    const now = new Date();
    const starts = buildWeeklySeries({ ...data, now });
    if (starts.length === 0) throw new Error("NO_SLOTS");
    const online = c.mode === "online";
    const shapeError = scheduleLessonError({
      sorStatus: c.sor_status,
      startsAtIso: starts[0],
      durationMin: data.durationMin,
      online,
      now,
      existing: [],
    });
    if (shapeError) throw new Error(shapeError);

    const { free, clashes } = partitionSeriesClashes(
      starts,
      data.durationMin,
      online,
      await occupiedFor(db, c, tutorId),
    );
    if (free.length === 0) throw new Error("SLOT_CONFLICT");

    const stamp = new Date().toISOString();
    const side = role === "tutor" ? { confirmed_by_tutor_at: stamp } : { confirmed_by_parent_at: stamp };
    for (let attempt = 0; attempt < SEQUENCE_RETRIES; attempt += 1) {
      const existing = await selectRows<{ sequence: number }>(db, "case_lessons", "sequence", [
        { col: "case_id", op: "eq", value: c.id },
      ]);
      const first = nextLessonSequence(existing);
      const { error } = await db.from<Row>("case_lessons").insert(
        free.map((startsAt, index) => ({
          case_id: c.id,
          sequence: first + index,
          tutor_id: tutorId,
          starts_at: startsAt,
          duration_min: data.durationMin,
          location_or_link: data.locationOrLink || null,
          status: "planned",
          series_id: data.seriesId,
          created_by: context.userId,
          ...side,
        })),
      );
      if (!error) {
        await insertAudit(db, c.id, context.userId, "planned", `${role}_scheduled_series_${free.length}`);
        await insertLessonLifecycleEvent(
          db,
          `lesson.scheduled_by_${role}`,
          {
            case_id: c.id,
            case_code: c.case_code,
            caseCode: c.case_code,
            starts_at: free[0],
            heading: "Weekly lessons scheduled",
            body: `${free.length} lessons were added to your Case Manager.`,
            lessonLine: lessonLine(free[0]),
          },
          data.seriesId,
        );
        await resolveOpenScheduleActions(db, c.id);
        return { created: free.length, skipped: clashes };
      }
      const message = error.message;
      if (isTimeClashError(message)) throw new Error("SLOT_CONFLICT");
      // The same series id landed first (a double-tap): the fill is done.
      if (/series_start/i.test(message)) return { created: free.length, skipped: clashes };
      if (!/duplicate|unique/i.test(message)) throw new Error(message);
      // (case_id, sequence) lost a race with another schedule: recompute.
    }
    throw new Error("SEQUENCE_BUSY");
  });

export const editCaseLessons = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        scope: z.enum(["one", "selected", "series"]),
        lessonIds: z.array(z.string().uuid()).min(1).max(SERIES_MAX_LESSONS),
        dayDelta: z.number().int().min(-SCHEDULE_MAX_AHEAD_DAYS).max(SCHEDULE_MAX_AHEAD_DAYS),
        minuteOfDay: z.number().int().min(0).max(1439).optional(),
        durationMin: z.number().int().optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ updated: number; failed: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c, role, tutorId } = await partyCase(db, data.caseId, context.userId);
    const now = new Date();

    const rows = await selectRows<LessonRow>(db, "case_lessons", LESSON_COLS, [
      { col: "case_id", op: "eq", value: c.id },
    ]);
    const targets = targetsForEdit(rows.map(toLesson), c.id, data.lessonIds, data.scope, now);
    if (targets.length === 0) throw new Error("NO_EDITABLE_LESSONS");

    const targetIds = new Set(targets.map((t) => t.id));
    const others = (await occupiedFor(db, c, tutorId)).filter((o) => !targetIds.has(o.id));
    const online = c.mode === "online";
    const moves = targets.map((lesson) => ({
      id: lesson.id,
      startsAt: lesson.startsAt,
      newStart: shiftedStart(lesson.startsAt, data),
      durationMin: data.durationMin ?? lesson.durationMin,
    }));
    for (const move of moves) {
      const error = scheduleLessonError({
        sorStatus: c.sor_status,
        startsAtIso: move.newStart,
        durationMin: move.durationMin,
        online,
        now,
        existing: others,
      });
      if (error) throw new Error(error);
    }

    // The mover agrees to the new time; the other side is asked to re-confirm,
    // but the lesson stays on both calendars meanwhile (no propose/accept).
    const stamp = new Date().toISOString();
    const side =
      role === "tutor"
        ? { confirmed_by_tutor_at: stamp, confirmed_by_parent_at: null }
        : { confirmed_by_parent_at: stamp, confirmed_by_tutor_at: null };
    let updated = 0;
    let failed = 0;
    for (const move of orderForShift(moves, data.dayDelta)) {
      const { error } = await db
        .from<Row>("case_lessons")
        .update({
          starts_at: move.newStart,
          duration_min: move.durationMin,
          status: "planned",
          ...side,
        })
        .eq("id", move.id);
      if (!error) {
        updated += 1;
      } else if (isTimeClashError(error.message)) {
        failed += 1;
      } else {
        throw new Error(error.message);
      }
    }
    if (updated === 0) throw new Error("SLOT_CONFLICT");

    await insertAudit(db, c.id, context.userId, "planned", `${role}_moved_lessons_${updated}`);
    const firstMoved = moves[0].newStart;
    // A fresh source id: every edit notifies, the bus dedupes on source id.
    await insertLessonLifecycleEvent(
      db,
      `lesson.scheduled_by_${role}`,
      {
        case_id: c.id,
        case_code: c.case_code,
        caseCode: c.case_code,
        starts_at: firstMoved,
        heading: "Lesson times changed",
        body:
          updated === 1
            ? "A lesson moved to a new time. It is on your Case Manager."
            : `${updated} lessons moved to new times. They are on your Case Manager.`,
        lessonLine: lessonLine(firstMoved),
      },
      crypto.randomUUID(),
    );
    return { updated, failed };
  });
