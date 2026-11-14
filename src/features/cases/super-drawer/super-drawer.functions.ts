/**
 * Issue #767 Super-Drawer (was #746, packs #743) — server fns over the
 * case_lesson_logs / case_lesson_fanouts tables (migration
 * 20261114100000_issue_767_super_drawer.sql, not in the generated types).
 *
 * THE verified-lesson write path (the drawer is the sole tutor post-lesson
 * write surface): a drawer save — Full Sync OR Log Hours Only — inserts the
 * EXISTING case_lessons calendar row with status 'done' (idempotent via
 * client_request_id from #461), so:
 *   * the #459 verified-hours ledger trigger credits teaching hours,
 *   * the #760 fee pipeline fires through the SAME hook the desk and the
 *     academy attendance path already use: syncCaseFeeMilestones(db, caseId,
 *     "case_lesson") — amounts/calculator untouched, idempotent by recalc,
 *   * the lesson shows up in the tutor's existing lesson surfaces.
 * A case with a #613 roster keeps the roster counter as the fee SoT (same
 * precedence the desk mark already has); the drawer log row still records
 * the payload.
 *
 * Pure rules live in super-drawer-logic.ts (vitest-covered). Role gate: the
 * assigned tutor (and admin) only — parents/students have no entry point in
 * the DOM or the API. Unpaid admin fee never gates open or submit: nothing
 * here reads case_fees for permission.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { insertAudit, selectRows, type Db, type Row } from "@/features/cases/desk-db";
import { nextLessonSequence } from "@/features/cases/schedule-lesson";
import { syncCaseFeeMilestones } from "@/features/cases/fee-milestones.server";
import {
  DEFAULT_PULSE,
  FANOUT_JOBS,
  MASTERY_LEVELS,
  clampDurationMin,
  defaultDurationMin,
  fanoutJobsFor,
  nextLessonDefaultIso,
  normalizeTopicTag,
  recapStatusFor,
  suggestedTopics,
  syncValidationError,
  type DrawerLogRow,
  type DrawerPulse,
  type DrawerTopic,
  type FanoutJob,
  type PriorTopic,
} from "@/features/cases/super-drawer/super-drawer-logic";

const SEQUENCE_RETRIES = 3;
const PAST_SOR_STATUSES = new Set(["closed", "replaced"]);

// ---------------------------------------------------------------------------
// Structural types for the new untyped tables (storage-helpers Rows pattern;
// every handler runs on the service-role client — RLS is defense in depth)
// ---------------------------------------------------------------------------

const topicSchema = z.object({
  tag: z.string().trim().min(1).max(60),
  mastery: z.enum(MASTERY_LEVELS).nullable().optional(),
});

const pulseSchema = z.object({
  punctuality: z.enum(["on_time", "late"]),
  focus: z.enum(["attentive", "good", "distracted"]),
  prepHw: z.enum(["prepared", "partial", "none"]),
});

const CASE_COLS =
  "id, case_code, learner_nickname, subjects, student_level, session_length_minutes, sor_status, matched_tutor_id";

type CaseRow = {
  id: string;
  case_code: string;
  learner_nickname: string | null;
  subjects: string[] | null;
  student_level: string | null;
  session_length_minutes: number | string | null;
  sor_status: string | null;
  matched_tutor_id: string | null;
};

async function isAdminUser(db: Db, userId: string): Promise<boolean> {
  for (const role of ["admin", "super_admin"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return true;
  }
  return false;
}

/**
 * Drawer access = the assigned tutor or an admin. Unknown/forbidden callers
 * get the same CASE_NOT_FOUND so case ids never leak to other roles.
 */
async function requireDrawerAccess(
  db: Db,
  caseId: string,
  userId: string,
): Promise<{ kase: CaseRow; isTutor: boolean }> {
  const cases = await selectRows<CaseRow>(db, "tutoring_cases", CASE_COLS, [
    { col: "id", op: "eq", value: caseId },
  ]);
  const kase = cases[0];
  if (!kase) throw new Error("CASE_NOT_FOUND");
  if (await isAdminUser(db, userId)) return { kase, isTutor: false };
  const tutorRows = await selectRows<{ id: string }>(db, "tutors", "id", [
    { col: "user_id", op: "eq", value: userId },
  ]);
  const tutorId = tutorRows[0]?.id;
  if (!tutorId || kase.matched_tutor_id !== tutorId) throw new Error("CASE_NOT_FOUND");
  return { kase, isTutor: true };
}

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

/** Newest-first prior topics across this case's drawer logs (deduped by caller). */
async function priorTopicsFor(db: Db, caseId: string): Promise<PriorTopic[]> {
  const logs = await selectRows<Pick<DrawerLogRow, "topics">>(
    db,
    "case_lesson_logs",
    "topics",
    [{ col: "case_id", op: "eq", value: caseId }],
    { col: "created_at", asc: false, limit: 30 },
  );
  const seen = new Set<string>();
  const out: PriorTopic[] = [];
  for (const log of logs) {
    const topics = Array.isArray(log.topics) ? (log.topics as DrawerTopic[]) : [];
    for (const topic of topics) {
      if (!topic?.tag) continue;
      const key = topic.tag.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ tag: topic.tag, mastery: topic.mastery ?? null });
    }
  }
  return out;
}

async function pendingLogFor(db: Db, caseId: string): Promise<{ lessonId: string } | null> {
  const rows = await selectRows<Pick<DrawerLogRow, "lesson_id">>(
    db,
    "case_lesson_logs",
    "lesson_id",
    [
      { col: "case_id", op: "eq", value: caseId },
      { col: "recap_status", op: "eq", value: "incomplete" },
    ],
    { col: "created_at", asc: false, limit: 1 },
  );
  return rows[0] ? { lessonId: rows[0].lesson_id } : null;
}

// ---------------------------------------------------------------------------
// Context (drawer open): smart defaults + suggested chips + badge state
// ---------------------------------------------------------------------------

export type SuperDrawerContext = {
  caseCode: string;
  studentName: string | null;
  subject: string | null;
  level: string | null;
  /** Case weekly length clamped to the drawer stepper (fallback 60). */
  defaultDurationMin: number;
  suggestedTopics: DrawerTopic[];
  nextLessonDefaultIso: string;
  /** An incomplete log on this case → the dashboard badge re-opens it. */
  pendingLog: { lessonId: string } | null;
};

export const getSuperDrawerContext = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<SuperDrawerContext> => {
    const db = await adminDb();
    const { kase } = await requireDrawerAccess(db, data.caseId, context.userId);
    return {
      caseCode: kase.case_code,
      studentName: kase.learner_nickname,
      subject: kase.subjects?.[0] ?? null,
      level: kase.student_level,
      defaultDurationMin: defaultDurationMin(
        kase.session_length_minutes == null ? null : Number(kase.session_length_minutes),
      ),
      suggestedTopics: suggestedTopics(
        await priorTopicsFor(db, kase.id),
        kase.subjects?.[0] ?? null,
      ),
      nextLessonDefaultIso: nextLessonDefaultIso(),
      pendingLog: await pendingLogFor(db, kase.id),
    };
  });

// ---------------------------------------------------------------------------
// Sync (Full) / Log Hours Only — ONE idempotent verified-lesson write
// ---------------------------------------------------------------------------

const syncInput = z.object({
  caseId: z.string().uuid(),
  /** UI-generated UUID: a double-tap / retry resolves to the first row. */
  clientRequestId: z.string().uuid(),
  mode: z.enum(["full", "hours_only"]),
  durationMin: z.number().int().min(15).max(480),
  topics: z.array(topicSchema).max(8).default([]),
  pulse: pulseSchema.default(DEFAULT_PULSE),
  recap: z.string().trim().max(2000).optional(),
  nextLessonAtIso: z.string().datetime().optional(),
  homework: z
    .object({
      title: z.string().trim().min(1).max(120),
      dueAtIso: z.string().datetime().optional(),
    })
    .optional(),
});

export type SuperDrawerSyncResult = {
  lessonId: string;
  logId: string | null;
  recapStatus: "incomplete" | "complete";
  /** True when this call hit the idempotency key (double-tap / retry). */
  duplicate: boolean;
};

export const syncSuperDrawerLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => syncInput.parse(input))
  .handler(async ({ context, data }): Promise<SuperDrawerSyncResult> => {
    const db = await adminDb();
    const { kase } = await requireDrawerAccess(db, data.caseId, context.userId);
    if (!kase.sor_status || PAST_SOR_STATUSES.has(kase.sor_status)) {
      // Active cases only — never blocks on fee state, only on a closed case.
      throw new Error("CASE_NOT_ACTIVE");
    }

    const mode = data.mode;
    const topics: DrawerTopic[] =
      mode === "full"
        ? data.topics.flatMap((t) => {
            const tag = normalizeTopicTag(t.tag);
            return tag ? [{ tag, mastery: t.mastery ?? null }] : [];
          })
        : [];
    const validation = syncValidationError(mode, topics.length);
    if (validation) throw new Error(validation);
    const recapStatus = recapStatusFor(mode, topics.length);

    // Idempotency pre-check: the same request id returns the SAME lesson and
    // never moves a counter twice (#615/#760 milestones are recalc-shaped,
    // but the lesson row itself must not duplicate either).
    const existing = await selectRows<{ id: string; case_id: string }>(
      db,
      "case_lessons",
      "id, case_id",
      [{ col: "client_request_id", op: "eq", value: data.clientRequestId }],
    );
    if (existing[0]) {
      if (existing[0].case_id !== kase.id) throw new Error("REQUEST_ID_REUSED");
      return dupResult(db, existing[0].id);
    }

    const nowIso = new Date().toISOString();

    // Verified lesson = a 'done' row on the EXISTING case_lessons calendar.
    // Sequence races settle on the (case_id, sequence) unique index; the
    // client_request_id unique index is the double-submit backstop.
    for (let attempt = 0; attempt < SEQUENCE_RETRIES; attempt += 1) {
      const seqRows = await selectRows<{ sequence: number }>(db, "case_lessons", "sequence", [
        { col: "case_id", op: "eq", value: kase.id },
      ]);
      const { data: inserted, error } = await db
        .from<Row>("case_lessons")
        .insert({
          case_id: kase.id,
          sequence: nextLessonSequence(seqRows),
          tutor_id: kase.matched_tutor_id,
          starts_at: nowIso,
          duration_min: clampDurationMin(data.durationMin),
          status: "done",
          attendance: "present",
          attendance_marked_at: nowIso,
          attendance_marked_by: context.userId,
          confirmed_by_tutor_at: nowIso,
          marked_done_by: context.userId,
          done_at: nowIso,
          created_by: context.userId,
          client_request_id: data.clientRequestId,
        })
        .select("id")
        .single();
      if (!error) {
        const lessonId = String((inserted as unknown as { id: string }).id);
        return finishSync(db, {
          kaseId: kase.id,
          lessonId,
          userId: context.userId,
          mode,
          topics,
          pulse: data.pulse,
          recap: mode === "full" ? data.recap || null : null,
          nextLessonAtIso: mode === "full" ? (data.nextLessonAtIso ?? null) : null,
          homework: mode === "full" ? (data.homework ?? null) : null,
          recapStatus,
          nowIso,
        });
      }
      const message = error.message;
      if (/client_request_id/i.test(message)) {
        const raced = await selectRows<{ id: string; case_id: string }>(
          db,
          "case_lessons",
          "id, case_id",
          [{ col: "client_request_id", op: "eq", value: data.clientRequestId }],
        );
        if (raced[0]) {
          if (raced[0].case_id !== kase.id) throw new Error("REQUEST_ID_REUSED");
          return dupResult(db, raced[0].id);
        }
      }
      if (!/duplicate|unique/i.test(message)) throw new Error(message);
      // (case_id, sequence) lost a race: recompute and retry.
    }
    throw new Error("SEQUENCE_BUSY");
  });

async function dupResult(db: Db, lessonId: string): Promise<SuperDrawerSyncResult> {
  const logs = await selectRows<Pick<DrawerLogRow, "id" | "recap_status">>(
    db,
    "case_lesson_logs",
    "id, recap_status",
    [{ col: "lesson_id", op: "eq", value: lessonId }],
  );
  return {
    lessonId,
    logId: logs[0]?.id ?? null,
    recapStatus: logs[0]?.recap_status ?? "incomplete",
    duplicate: true,
  };
}

/** Post-insert half of a sync: log row, fan-outs, HW, audit, fee hook. */
async function finishSync(
  db: Db,
  input: {
    kaseId: string;
    lessonId: string;
    userId: string;
    mode: "full" | "hours_only";
    topics: DrawerTopic[];
    pulse: DrawerPulse;
    recap: string | null;
    nextLessonAtIso: string | null;
    homework: { title: string; dueAtIso?: string } | null;
    recapStatus: "incomplete" | "complete";
    nowIso: string;
  },
): Promise<SuperDrawerSyncResult> {
  const storedPulse = {
    punctuality: input.pulse.punctuality,
    focus: input.pulse.focus,
    prep_hw: input.pulse.prepHw,
  };
  const { data: logInserted, error: logError } = await db
    .from<Row>("case_lesson_logs")
    .insert({
      case_id: input.kaseId,
      lesson_id: input.lessonId,
      logged_by: input.userId,
      recap_status: input.recapStatus,
      topics: input.topics,
      pulse: storedPulse,
      recap: input.recap,
      next_lesson_at: input.nextLessonAtIso,
    })
    .select("id")
    .single();
  if (logError) throw new Error(logError.message);
  const logId = String((logInserted as unknown as { id: string }).id);

  await enqueueFanouts(db, {
    caseId: input.kaseId,
    lessonId: input.lessonId,
    jobs: fanoutJobsFor(input.mode, input.topics.length),
    topics: input.topics,
    recapStatus: input.recapStatus,
  });

  if (input.homework) {
    const dueAt = input.homework.dueAtIso ?? input.nextLessonAtIso ?? nextLessonDefaultIso();
    const { error: hwError } = await db
      .from<Row>("case_homework")
      .insert({
        case_id: input.kaseId,
        title: input.homework.title,
        due_at: dueAt,
        created_by: input.userId,
      })
      .select("id")
      .single();
    // HW is best-effort: a #652 constraint failure must not fail the log.
    if (hwError) console.warn("[super-drawer] homework insert failed:", hwError.message);
  }

  await insertAudit(
    db,
    input.kaseId,
    input.userId,
    "lesson_done",
    `[#767] super-drawer ${input.mode === "hours_only" ? "log-hours-only" : "sync"}`,
  );

  // #760 L1/L2 fee hook — the SAME executor the desk mark and the academy
  // attendance path call (idempotent recalc from the current counter; the
  // drawer never touches amounts or the settlement card).
  await syncCaseFeeMilestones(db, input.kaseId, "case_lesson");

  return { lessonId: input.lessonId, logId, recapStatus: input.recapStatus, duplicate: false };
}

/** Table-row fan-out; unique (lesson_id, job) makes retries no-ops. */
async function enqueueFanouts(
  db: Db,
  input: {
    caseId: string;
    lessonId: string;
    jobs: FanoutJob[];
    topics: DrawerTopic[];
    recapStatus: "incomplete" | "complete";
  },
): Promise<void> {
  for (const job of input.jobs) {
    if (!FANOUT_JOBS.includes(job)) continue;
    const payload =
      job === "weekly_digest"
        ? { recap_status: input.recapStatus, topic_count: input.topics.length }
        : { topics: input.topics };
    try {
      await db.from<Row>("case_lesson_fanouts").upsert(
        {
          case_id: input.caseId,
          lesson_id: input.lessonId,
          job,
          payload,
        },
        { onConflict: "lesson_id,job", ignoreDuplicates: true },
      );
    } catch (fanoutError) {
      // Fan-out must never fail the log (best-effort, lesson-lifecycle rule).
      console.warn("[super-drawer] fanout enqueue failed:", fanoutError);
    }
  }
}

// ---------------------------------------------------------------------------
// Badge completion: [ Add Recap & Tags ] re-opens the drawer in complete mode
// (duration already locked on the verified lesson — never accepted again)
// ---------------------------------------------------------------------------

const completeInput = z.object({
  lessonId: z.string().uuid(),
  topics: z.array(topicSchema).min(1).max(8),
  pulse: pulseSchema.optional(),
  recap: z.string().trim().max(2000).optional(),
});

export const completeSuperDrawerLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => completeInput.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await adminDb();
    const logs = await selectRows<Pick<DrawerLogRow, "id" | "case_id" | "recap_status">>(
      db,
      "case_lesson_logs",
      "id, case_id, recap_status",
      [{ col: "lesson_id", op: "eq", value: data.lessonId }],
    );
    const log = logs[0];
    if (!log) throw new Error("LOG_NOT_FOUND");
    await requireDrawerAccess(db, log.case_id, context.userId);
    if (log.recap_status === "complete") return { ok: true };

    const topics = data.topics.flatMap((t) => {
      const tag = normalizeTopicTag(t.tag);
      return tag ? [{ tag, mastery: t.mastery ?? null }] : [];
    });
    if (topics.length === 0) throw new Error("TAG_REQUIRED");
    const nowIso = new Date().toISOString();
    const { error } = await db
      .from<Row>("case_lesson_logs")
      .update({
        topics,
        pulse: data.pulse
          ? {
              punctuality: data.pulse.punctuality,
              focus: data.pulse.focus,
              prep_hw: data.pulse.prepHw,
            }
          : undefined,
        recap: data.recap || null,
        recap_status: "complete",
      })
      .eq("id", log.id)
      .eq("recap_status", "incomplete");
    if (error) throw new Error(error.message);

    // Completing the tags is what colours the heatmap — fan out now.
    await enqueueFanouts(db, {
      caseId: log.case_id,
      lessonId: data.lessonId,
      jobs: fanoutJobsFor("full", topics.length),
      topics,
      recapStatus: "complete",
    });
    await insertAudit(db, log.case_id, context.userId, "lesson_recap_completed", "[#767] badge");
    return { ok: true };
  });

// ---------------------------------------------------------------------------
// Dashboard badge feed: incomplete logs on MY cases
// ---------------------------------------------------------------------------

export type PendingRecapItem = {
  caseId: string;
  lessonId: string;
  caseCode: string;
  loggedAt: string;
};

export const getPendingRecapCases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .handler(async ({ context }): Promise<{ items: PendingRecapItem[] }> => {
    const db = await adminDb();
    const tutorRows = await selectRows<{ id: string }>(db, "tutors", "id", [
      { col: "user_id", op: "eq", value: context.userId },
    ]);
    const tutorId = tutorRows[0]?.id;
    // Admins (no tutor card) see the whole feed; tutors only their own cases.
    const isStaff = !tutorId && (await isAdminUser(db, context.userId));
    if (!tutorId && !isStaff) return { items: [] };

    const logs = await selectRows<
      Pick<DrawerLogRow, "case_id" | "lesson_id" | "created_at"> & {
        tutoring_cases: { case_code: string; matched_tutor_id: string | null } | null;
      }
    >(
      db,
      "case_lesson_logs",
      "case_id, lesson_id, created_at, tutoring_cases(case_code, matched_tutor_id)",
      [{ col: "recap_status", op: "eq", value: "incomplete" }],
      { col: "created_at", asc: false, limit: 100 },
    );
    const items: PendingRecapItem[] = [];
    for (const log of logs) {
      if (!log.tutoring_cases) continue;
      if (!isStaff && log.tutoring_cases.matched_tutor_id !== tutorId) continue;
      items.push({
        caseId: log.case_id,
        lessonId: log.lesson_id,
        caseCode: log.tutoring_cases.case_code,
        loggedAt: log.created_at,
      });
    }
    return { items };
  });
