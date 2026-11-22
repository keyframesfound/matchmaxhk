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
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { insertAudit, selectRows, type Db, type Row } from "@/features/cases/desk-db";
import {
  canWriteLessonPrep,
  lessonStillUpcoming,
  normaliseLessonPrep,
} from "@/features/cases/case-manager/lesson-prep";
import {
  canClearMeetingUrl,
  canEditMeetingUrl,
  normaliseMeetingUrl,
} from "@/features/cases/case-manager/meeting-link";
import { insertLessonLifecycleEvent } from "@/features/cases/bus.functions";
import {
  RELEASED_SLOT_DAYS,
  SERIES_MAX_LESSONS,
  SERIES_MAX_WEEKS,
  buildWeeklySeries,
  hktClock,
  isLearnerParty,
  orderForShift,
  partitionSeriesClashes,
  readSlots,
  scheduleUpdatedCaseIds,
  seriesPrefill,
  shiftedStart,
  targetsForEdit,
  type PrefSlot,
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
import { loadFullCohortSessions } from "@/features/cases/cohort-busy.server";
import { AVAIL_BANDS } from "@/features/tutors/availability-filter";
import {
  GRID_DAYS,
  parseAvailabilityGrid,
  type GridCellState,
  type GridDay,
} from "@/features/tutors/availability-grid-model";

type GridMatrix = Record<GridDay, GridCellState[]>;

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
  /** #785 AC-CONV-1: the join link for an online lesson, null when unset. */
  meeting_url: string | null;
  /** #785 AC-CONV-2: Case Details facts. */
  learner_nickname: string | null;
  session_length_minutes: number | null;
  location_estate: string | null;
  student_count: number | null;
};

const CASE_COLS =
  "id, case_code, subjects, student_level, hourly_rate_hkd, mode, district, sor_status, schedule_mode, schedule_paused_at, student_id, meeting_url, learner_nickname, session_length_minutes, location_estate, student_count";

type LessonRow = {
  id: string;
  case_id: string;
  starts_at: string;
  duration_min: number;
  status: string;
  series_id: string | null;
  /** #785 AC-735-2a: the tutor's topic / prep note for the next lesson. */
  lesson_topic: string | null;
  prep_note: string | null;
};

const LESSON_COLS =
  "id, case_id, starts_at, duration_min, status, series_id, lesson_topic, prep_note";

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
  /** #785 AC-CONV-1: the saved online-lesson link, for the drawer bar. */
  meetingUrl: string | null;
  /** #785 AC-CONV-2: the Case Details card's read-only facts. */
  studentName: string | null;
  durationMin: number | null;
  address: string | null;
  studentCount: number | null;
  prefill: ReturnType<typeof seriesPrefill>;
};

export type HubScheduleLesson = ScheduleLesson & {
  caseCode: string;
  subject: string | null;
  role: PartyRole;
  /** #654: an open contested reschedule is waiting on this lesson. */
  reschedulePending: boolean;
  /** #785 AC-735-2a: what the lesson covers, and what to bring. */
  lessonTopic: string | null;
  prepNote: string | null;
};

export type ProposedItem = {
  caseId: string;
  caseCode: string;
  subject: string | null;
  role: PartyRole;
  scheduleMode: string | null;
  scheduleUpdated: boolean;
  /** #659/#660: the held soft slots, for clash lines. */
  slots: PrefSlot[];
};

export type CaseManagerSchedule = {
  cases: ScheduleCase[];
  lessons: HubScheduleLesson[];
  proposed: ProposedItem[];
  /** User-Blocked: whole HKT dates (tutor blackouts). */
  blockedDates: string[];
  /** Open: the tutor's weekly teaching windows in HKT minutes. */
  openWindows: { weekday: number; startMinute: number; endMinute: number }[];
  /** #660: the tutor's soft weekly grid, used when no teaching windows are set. */
  tutorGrid: GridMatrix | null;
  /** #659: the parent's weekly User-Blocked slots. */
  blockedSlots: PrefSlot[];
  isTutor: boolean;
  /** #673: last 1-tap availability confirmation (14-day staleness rule). */
  availabilityConfirmedAt: string | null;
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

/** Staff / admin / super_admin, the same has_role gate the desk fns use. */
async function isOps(db: Db, userId: string): Promise<boolean> {
  for (const role of ["staff", "admin", "super_admin"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return true;
  }
  return false;
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
    slots: readSlots(c.schedule_slots),
  }));
}

export const getCaseManagerSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CaseManagerSchedule> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const now = new Date();
    const tutorId = await myTutorId(db, context.userId);

    const [taught, owned, hidden, ownedStudentRows, blockedSlotRows] = await Promise.all([
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
      // #796 AC-733-4: student profiles the caller owns as the learner account.
      selectRows<{ id: string }>(
        db,
        "students",
        "id",
        [{ col: "owner_user_id", op: "eq", value: context.userId }],
        { col: "id", asc: true, limit: CASE_LIMIT },
      ),
      selectRows<PrefSlot>(db, "user_blocked_slots", "day, period", [
        { col: "user_id", op: "eq", value: context.userId },
      ]),
    ]);
    const ownedStudentIds = ownedStudentRows.map((s) => s.id);
    const learnerOwned = ownedStudentIds.length
      ? (
          await selectRows<CaseRow & { matched_tutor_id: string | null }>(
            db,
            "tutoring_cases",
            `${CASE_COLS}, matched_tutor_id`,
            [{ col: "student_id", op: "in", value: ownedStudentIds }],
          )
        ).filter((c) => c.matched_tutor_id !== null)
      : [];
    const ownedVisible = owned.filter((c) => !c.student_id || !hidden.has(c.student_id));
    const parentMatched = ownedVisible.filter((c) => c.matched_tutor_id !== null);

    const roleByCase = new Map<string, { row: CaseRow; role: PartyRole }>();
    for (const row of taught) roleByCase.set(row.id, { row, role: "tutor" });
    for (const row of parentMatched) {
      if (!roleByCase.has(row.id)) roleByCase.set(row.id, { row, role: "parent" });
    }
    // A student-owned case the caller reaches as the learner; a parent-owned case
    // (or a tutor match) above already holds the key, so nothing is counted twice.
    for (const row of learnerOwned) {
      if (!row.student_id || hidden.has(row.student_id)) continue;
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
    const pendingMoves =
      caseIds.length === 0
        ? []
        : await selectRows<{ lesson_id: string }>(db, "case_reschedule_requests", "lesson_id", [
            { col: "case_id", op: "in", value: caseIds },
            { col: "status", op: "eq", value: "pending" },
          ]);
    const pendingLessonIds = new Set(pendingMoves.map((m) => m.lesson_id));

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
      meetingUrl: row.meeting_url,
      studentName: row.learner_nickname,
      durationMin: row.session_length_minutes,
      address: row.location_estate ?? row.district,
      studentCount: row.student_count,
      prefill: seriesPrefill(
        lessons.filter((l) => l.caseId === row.id),
        now,
      ),
    }));
    const byId = new Map(cases.map((c) => [c.id, c]));
    const hubLessons = lessonRows.flatMap((row) => {
      const l = toLesson(row);
      const c = byId.get(l.caseId);
      if (!c) return [];
      return [
        {
          ...l,
          caseCode: c.code,
          subject: c.subject,
          role: c.role,
          reschedulePending: pendingLessonIds.has(l.id),
          lessonTopic: row.lesson_topic,
          prepNote: row.prep_note,
        },
      ];
    });

    const parentOpen = ownedVisible.filter(
      (c) => c.matched_tutor_id === null && OPEN_CASE_STATUSES.has(c.status),
    );
    const parentLessons = hubLessons.filter((l) => l.role === "parent");
    const proposed = toProposedItems(parentOpen, "parent", parentLessons, []);

    let blockedDates: string[] = [];
    let openWindows: CaseManagerSchedule["openWindows"] = [];
    let tutorGrid: GridMatrix | null = null;
    let availabilityConfirmedAt: string | null = null;
    if (tutorId) {
      const [{ pending, releasedSlots }, blackouts, windows, gridRows] = await Promise.all([
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
        selectRows<{ availability_grid: unknown; availability_confirmed_at: string | null }>(
          db,
          "tutors",
          "availability_grid, availability_confirmed_at",
          [{ col: "id", op: "eq", value: tutorId }],
        ),
      ]);
      tutorGrid = parseAvailabilityGrid(gridRows[0]?.availability_grid);
      // #673: the 14-day freshness rule reads the last 1-tap confirmation.
      availabilityConfirmedAt = gridRows[0]?.availability_confirmed_at ?? null;
      const tutorLessons = hubLessons.filter((l) => l.role === "tutor");
      proposed.push(...toProposedItems(pending, "tutor", tutorLessons, releasedSlots));
      blockedDates = blackouts.map((b) => b.blackout_date);
      openWindows = windows.map((w) => ({
        weekday: w.weekday,
        startMinute: w.start_minute,
        endMinute: w.end_minute,
      }));
    }

    return {
      cases,
      lessons: hubLessons,
      proposed,
      blockedDates,
      openWindows,
      tutorGrid,
      blockedSlots: readSlots(blockedSlotRows),
      isTutor: tutorId !== null,
      availabilityConfirmedAt,
    };
  });

/** #673: 1-tap "Confirm schedule is up to date" — resets the freshness clock
 * without touching the grid. Self-serve RPC (SECURITY DEFINER). */
export const confirmMyAvailabilityFresh = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.rpc("confirm_my_availability_fresh");
    if (error) {
      const code = (error as { code?: string }).code ?? "";
      throw new Error(code === "P0001" ? "NO_TUTOR_CARD" : error.message);
    }
    void context;
    return { ok: true };
  });

/** #659: writes the caller's own User-Blocked slot; soft, never touches lessons. */
export const setMyBlockedSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ day: z.enum(GRID_DAYS), period: z.enum(AVAIL_BANDS), blocked: z.boolean() })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const table = db.from<Row>("user_blocked_slots");
    const slot = { user_id: context.userId, day: data.day, period: data.period };
    const { error } = data.blocked
      ? await table.upsert(slot, { onConflict: "user_id,day,period", ignoreDuplicates: true })
      : await table
          .delete()
          .eq("user_id", slot.user_id)
          .eq("day", slot.day)
          .eq("period", slot.period);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type PartyCase = {
  id: string;
  case_code: string;
  parent_id: string | null;
  matched_tutor_id: string | null;
  student_id: string | null;
  sor_status: string | null;
  schedule_paused_at: string | null;
  mode: string | null;
};

export async function partyCase(
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
  // #796 AC-733-4: the student account that owns the case's student profile is
  // the learner too, not just the parent of record.
  const studentOwnerId = c.student_id
    ? ((
        await selectRows<{ owner_user_id: string | null }>(db, "students", "owner_user_id", [
          { col: "id", op: "eq", value: c.student_id },
        ])
      )[0]?.owner_user_id ?? null)
    : null;
  if (!isLearnerParty({ userId, parentId: c.parent_id, studentOwnerId })) {
    throw new Error("CASE_NOT_FOUND");
  }
  if (c.student_id && (await hiddenStudentIds(db, userId)).has(c.student_id)) {
    throw new Error("CASE_NOT_FOUND");
  }
  return { c, role: "parent", tutorId: c.matched_tutor_id };
}

/** Every occupied block on the tutor's or the learner's side, for clash checks. */
export async function occupiedFor(
  db: Db,
  c: PartyCase,
  tutorId: string,
): Promise<(ExistingLesson & { id: string })[]> {
  type Busy = {
    id: string;
    starts_at: string;
    duration_min: number;
    tutoring_cases: { mode: string | null } | null;
  };
  const tutorRows = await selectRows<Busy>(
    db,
    "case_lessons",
    "id, starts_at, duration_min, tutoring_cases(mode)",
    [
      { col: "tutor_id", op: "eq", value: tutorId },
      { col: "status", op: "in", value: OCCUPYING },
    ],
  );
  const learnerRows = c.student_id
    ? await selectRows<Busy>(
        db,
        "case_lessons",
        "id, starts_at, duration_min, tutoring_cases!inner(mode, student_id)",
        [
          { col: "tutoring_cases.student_id", op: "eq", value: c.student_id },
          { col: "status", op: "in", value: OCCUPYING },
        ],
      )
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
    // #768: one read of the tutor's full-cohort hours, reused by both guards below.
    const cohortSessions = (await loadFullCohortSessions(db, [tutorId])).get(tutorId);
    const shapeError = scheduleLessonError({
      sorStatus: c.sor_status,
      startsAtIso: starts[0],
      durationMin: data.durationMin,
      online,
      now,
      existing: [],
      cohortSessions,
    });
    if (shapeError) throw new Error(shapeError);

    const { free, clashes } = partitionSeriesClashes(
      starts,
      data.durationMin,
      online,
      await occupiedFor(db, c, tutorId),
      cohortSessions,
    );
    if (free.length === 0) throw new Error("SLOT_CONFLICT");

    const stamp = new Date().toISOString();
    const side =
      role === "tutor" ? { confirmed_by_tutor_at: stamp } : { confirmed_by_parent_at: stamp };
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
          no_request_expiry: true,
          created_by: context.userId,
          ...side,
        })),
      );
      if (!error) {
        await insertAudit(
          db,
          c.id,
          context.userId,
          "planned",
          `${role}_scheduled_series_${free.length}`,
        );
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
    // #768: a move may not land on a full cohort's hour either.
    const cohortSessions = (await loadFullCohortSessions(db, [tutorId])).get(tutorId);
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
        cohortSessions,
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
          no_request_expiry: true,
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

    // #654: an agreed move replaces any open proposal, so accepting a stale
    // one can't overwrite this edit.
    const { error: supersedeError } = await db
      .from<Row>("case_reschedule_requests")
      .update({ status: "superseded" })
      .in(
        "lesson_id",
        moves.map((m) => m.id),
      )
      .eq("status", "pending");
    if (supersedeError) throw new Error(supersedeError.message);

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

/**
 * #785 AC-735-2a: the tutor (or Ops) sets the upcoming lesson's topic and prep
 * note. Only a lesson on this case, and only while it is still in the future;
 * the parent and the learner read it, they never write it.
 */
export const setLessonPrep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        lessonId: z.string().uuid(),
        topic: z.string().max(400).nullish(),
        note: z.string().max(2000).nullish(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ topic: string | null; note: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c, role } = await partyCase(db, data.caseId, context.userId);
    if (!canWriteLessonPrep(role, await isOps(db, context.userId))) {
      throw new Error("FORBIDDEN");
    }
    if (data.topic === undefined && data.note === undefined) {
      throw new Error("NOTHING_TO_SAVE");
    }

    const rows = await selectRows<{
      id: string;
      starts_at: string;
      lesson_topic: string | null;
      prep_note: string | null;
    }>(db, "case_lessons", "id, starts_at, lesson_topic, prep_note", [
      { col: "id", op: "eq", value: data.lessonId },
      { col: "case_id", op: "eq", value: c.id },
    ]);
    const lesson = rows[0];
    if (!lesson) throw new Error("LESSON_NOT_FOUND");
    if (!lessonStillUpcoming(lesson.starts_at, new Date())) throw new Error("LESSON_PAST");

    const prep = normaliseLessonPrep({ topic: data.topic, note: data.note });
    // A field left out of the call keeps its stored value.
    const next = {
      topic: data.topic === undefined ? lesson.lesson_topic : prep.topic,
      note: data.note === undefined ? lesson.prep_note : prep.note,
    };
    const { error } = await db
      .from<Row>("case_lessons")
      .update({ lesson_topic: next.topic, prep_note: next.note })
      .eq("id", lesson.id)
      .eq("case_id", c.id);
    if (error) throw new Error(error.message);
    return next;
  });

/**
 * #785 AC-CONV-1: read the case's online-lesson link for the desk.
 *
 * `meeting_url` carries no SELECT grant for `authenticated` (only INSERT/UPDATE),
 * so the admin console cannot read it through the browser client even with a
 * staff RLS policy. This server fn is that read: a party or Ops only, and `null`
 * for anyone else so case existence does not leak.
 */
export const getCaseMeetingUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ url: string | null } | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    if (!(await isOps(db, context.userId))) {
      try {
        await partyCase(db, data.caseId, context.userId);
      } catch (error) {
        if (String((error as Error).message) !== "CASE_NOT_FOUND") throw error;
        return null;
      }
    }

    const rows = await selectRows<{ meeting_url: string | null }>(
      db,
      "tutoring_cases",
      "meeting_url",
      [{ col: "id", op: "eq", value: data.caseId }],
    );
    return rows[0] ? { url: rows[0].meeting_url } : null;
  });

/**
 * #785 AC-CONV-1: the tutor (or Ops) saves the case's online-lesson link, so
 * every party can open or copy it from the drawer in one tap. The same field
 * doubles as the backup link for an in-person case. An empty save clears it,
 * and only the tutor may clear.
 */
export const setCaseMeetingUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        url: z.string().max(2000).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ url: string | null }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);

    // The AC says "a tutor **or the desk**", and the desk is not a party of the
    // case: `partyCase` refuses anyone who is not the tutor, parent or learner,
    // so Ops is resolved first and may write without being one.
    const ops = await isOps(db, context.userId);
    let role: PartyRole | null = null;
    try {
      role = (await partyCase(db, data.caseId, context.userId)).role;
    } catch (error) {
      // Only CASE_NOT_FOUND is expected; anything else must still surface.
      if (String((error as Error).message) !== "CASE_NOT_FOUND") throw error;
      if (!ops) throw new Error("CASE_NOT_FOUND");
    }

    // The matched tutor owns the link; Ops may set or clear it on their behalf.
    // The parent and the learner are parties, but they only read it.
    if (!canEditMeetingUrl(role ?? "parent", ops)) throw new Error("FORBIDDEN");

    if (role === null) {
      // An Ops user who is not a party can only write a case that exists: an
      // update matching no row would otherwise report success.
      const rows = await selectRows<{ id: string }>(db, "tutoring_cases", "id", [
        { col: "id", op: "eq", value: data.caseId },
      ]);
      if (!rows[0]) throw new Error("CASE_NOT_FOUND");
    }

    const normalised = normaliseMeetingUrl(data.url);
    if (!normalised.ok) throw new Error(normalised.code);
    if (normalised.url === null && !canClearMeetingUrl(role ?? "parent", ops)) {
      throw new Error("FORBIDDEN");
    }

    const { error } = await db
      .from<Row>("tutoring_cases")
      .update({ meeting_url: normalised.url })
      .eq("id", data.caseId);
    if (error) throw new Error(error.message);
    return { url: normalised.url };
  });
