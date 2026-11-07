/**
 * Issue #657: the wave engine. tickCaseMatchWaves runs inside the lazy bus
 * drain (this repo has no cron), so every step is idempotent: the run row's
 * current_wave is advanced by compare-and-set before anything is sent.
 *
 * app_settings.case_match_waves_enabled only controls whether new runs start by
 * themselves. A run the desk started keeps advancing either way, which lets
 * staff pilot one case before switching it on for every tutor.
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
} from "@/features/cases/desk-db";
import { emitActionEvent } from "@/features/cases/action-required.functions";
import {
  caseMatchFingerprint,
  decideWaveStep,
  rankTutorsForCase,
  WAVE_SIZE,
  waveWindowEndsAt,
  type MatchCase,
  type MatchTutor,
} from "@/features/cases/case-match-waves";

const ENABLED_SETTING = "case_match_waves_enabled";
/** Keeps one drain short; the rest are picked up by the next drain. */
const NEW_RUNS_PER_TICK = 3;
const NEW_RUN_SCAN_LIMIT = 200;
const OPEN_RUNS_PER_TICK = 25;
/** Cases published before this stay out, so enabling never pings old cases. */
const NEW_RUN_MAX_AGE_MS = 14 * 24 * 60 * 60 * 1000;
const CLOSED_STATUSES = new Set(["matched", "closed", "rejected", "compliance_hold", "released"]);

const CASE_COLUMNS =
  "id, case_code, status, board_published_at, subjects, student_level, academic_tier, exam_system, district, mode, preferred_gender, tutor_background, tags, parent_id, matched_tutor_id, replacement_of_case_id, start_timing";

type CaseRow = {
  id: string;
  case_code: string;
  status: string;
  board_published_at: string | null;
  subjects: string[] | null;
  student_level: string | null;
  academic_tier: string | null;
  exam_system: string | null;
  district: string | null;
  mode: string | null;
  preferred_gender: string | null;
  tutor_background: string | null;
  tags: string[] | null;
  parent_id: string | null;
  matched_tutor_id: string | null;
  replacement_of_case_id: string | null;
  start_timing: string | null;
};

type RunRow = {
  case_id: string;
  status: "active" | "responded" | "paused" | "exhausted" | "stopped";
  current_wave: number;
  next_wave_at: string | null;
  match_fingerprint: string | null;
  stop_reason: string | null;
  taken_notified_at: string | null;
};

type QueueRow = {
  id: string;
  tutor_id: string;
  score: number;
  rank: number;
  wave_no: number | null;
  notified_at: string | null;
  opened_at: string | null;
};

const RUN_COLUMNS =
  "case_id, status, current_wave, next_wave_at, match_fingerprint, stop_reason, taken_notified_at";
const QUEUE_COLUMNS = "id, tutor_id, score, rank, wave_no, notified_at, opened_at";

function toMatchCase(c: CaseRow): MatchCase {
  return {
    subjects: c.subjects ?? [],
    studentLevel: c.student_level,
    academicTier: c.academic_tier,
    examSystem: c.exam_system,
    district: c.district,
    mode: c.mode,
    preferredGender: c.preferred_gender,
    tutorBackground: c.tutor_background,
    tags: c.tags ?? [],
    parentId: c.parent_id,
  };
}

async function loadMatchTutors(db: Db, excludeIds: string[], now: Date): Promise<MatchTutor[]> {
  const rows = await selectRows<{
    id: string;
    tutor_code: string | null;
    user_id: string | null;
    subjects: string[] | null;
    stations: string[] | null;
    district: string | null;
    lesson_mode: string | null;
    gender: string | null;
    tutor_status: string | null;
    target_students: string[] | null;
    profile_tags: string[] | null;
    is_accepting_students: boolean | null;
    owner_account_status: string | null;
    photo_url: string | null;
    headline: string | null;
    updated_at: string | null;
  }>(
    db,
    "tutors",
    "id, tutor_code, user_id, subjects, stations, district, lesson_mode, gender, tutor_status, target_students, profile_tags, is_accepting_students, owner_account_status, photo_url, headline, updated_at",
    [{ col: "is_published", op: "eq", value: true }],
  );
  const tutors = rows.filter((row) => !excludeIds.includes(row.id));
  const userIds = tutors.flatMap((row) => (row.user_id ? [row.user_id] : []));
  const profiles = userIds.length
    ? await selectRows<{ id: string; notification_preferences: unknown }>(
        db,
        "profiles",
        "id, notification_preferences",
        [{ col: "id", op: "in", value: userIds }],
      )
    : [];
  const muted = new Set(
    profiles
      .filter(
        (p) =>
          (p.notification_preferences as Record<string, unknown> | null)?.case_match_alerts ===
          false,
      )
      .map((p) => p.id),
  );
  const { activeShadowbansByTutor } = await import("@/features/trust/trust-db");
  const shadowbans = await activeShadowbansByTutor(
    db,
    tutors.map((row) => row.id),
    now,
  );
  return tutors.map((row) => ({
    id: row.id,
    tutorCode: row.tutor_code ?? row.id,
    userId: row.user_id,
    subjects: row.subjects ?? [],
    stations: row.stations ?? [],
    district: row.district,
    lessonMode: row.lesson_mode,
    gender: row.gender,
    tutorStatus: row.tutor_status,
    targetStudents: row.target_students ?? [],
    profileTags: row.profile_tags ?? [],
    isAccepting: row.is_accepting_students !== false,
    accountStatus: row.owner_account_status,
    hasPhoto: Boolean(row.photo_url),
    hasHeadline: Boolean(row.headline?.trim()),
    updatedAt: row.updated_at,
    matchAlertsMuted: Boolean(row.user_id && muted.has(row.user_id)),
    shadowbanned: shadowbans.has(row.id),
  }));
}

/** Adds newly eligible tutors behind the existing queue; returns how many. */
async function appendToQueue(db: Db, c: CaseRow, now: Date): Promise<number> {
  const existing = await selectRows<QueueRow>(db, "case_match_queue", QUEUE_COLUMNS, [
    { col: "case_id", op: "eq", value: c.id },
  ]);
  const queued = new Set(existing.map((row) => row.tutor_id));
  const failedTutorId = await replacedCaseTutor(db, c);
  const tutors = await loadMatchTutors(db, failedTutorId ? [failedTutorId] : [], now);
  const fresh = rankTutorsForCase(toMatchCase(c), tutors, now).filter(
    (ranked) => !queued.has(ranked.tutorId),
  );
  const lastRank = existing.reduce((max, row) => Math.max(max, row.rank), 0);
  let added = 0;
  for (const [index, ranked] of fresh.entries()) {
    const { error } = await db
      .from<Record<string, unknown>>("case_match_queue")
      .insert({
        case_id: c.id,
        tutor_id: ranked.tutorId,
        score: ranked.score,
        rank: lastRank + index + 1,
      })
      .select("id")
      .single();
    if (error) console.warn("[match-waves] queue insert skipped:", error.message);
    else added += 1;
  }
  return added;
}

/** #449: a rematch case never pings the tutor who failed the replaced case. */
async function replacedCaseTutor(db: Db, c: CaseRow): Promise<string | null> {
  if (!c.replacement_of_case_id) return null;
  const rows = await selectRows<{ matched_tutor_id: string | null }>(
    db,
    "tutoring_cases",
    "matched_tutor_id",
    [{ col: "id", op: "eq", value: c.replacement_of_case_id }],
  );
  return rows[0]?.matched_tutor_id ?? null;
}

async function updateRun(db: Db, caseId: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await db
    .from<Record<string, unknown>>("case_match_runs")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("case_id", caseId);
  if (error) throw new Error(error.message);
}

async function alertDesk(db: Db, c: CaseRow): Promise<void> {
  await emitActionEvent(
    db,
    "case.match_waves_exhausted",
    { case_id: c.id, case_code: c.case_code },
    c.id,
  );
}

async function markExhausted(db: Db, c: CaseRow): Promise<void> {
  await updateRun(db, c.id, { status: "exhausted", next_wave_at: null });
  await alertDesk(db, c);
}

/**
 * Claims wave N+1 by compare-and-set, then notifies. A concurrent drain loses
 * the claim and sends nothing. `all` is the desk's explicit notify-all override.
 */
async function sendNextWave(
  db: Db,
  c: CaseRow,
  run: RunRow,
  now: Date,
  opts: { all?: boolean } = {},
): Promise<number> {
  const queue = await selectRows<QueueRow>(db, "case_match_queue", QUEUE_COLUMNS, [
    { col: "case_id", op: "eq", value: c.id },
  ]);
  const pending = queue.filter((row) => row.wave_no === null).sort((a, b) => a.rank - b.rank);
  const batch = opts.all ? pending : pending.slice(0, WAVE_SIZE);
  if (batch.length === 0) return 0;

  const wave = run.current_wave + 1;
  const { error, count } = await db
    .from<Record<string, unknown>>("case_match_runs")
    .update(
      {
        current_wave: wave,
        status: "active",
        next_wave_at: waveWindowEndsAt(now).toISOString(),
        updated_at: now.toISOString(),
      },
      { count: "exact" },
    )
    .eq("case_id", c.id)
    .eq("current_wave", run.current_wave);
  if (error) throw new Error(error.message);
  if (count !== 1) return 0;

  const payload = {
    case_id: c.id,
    case_code: c.case_code,
    subject: (c.subjects ?? [])[0] ?? "",
    level: c.student_level ?? "",
    mode: c.mode ?? "",
    area: c.district ?? "",
    start: c.start_timing ?? "",
    link: `/tutor-requests/${c.case_code}`,
  };
  for (const row of batch) {
    await db
      .from<Record<string, unknown>>("case_match_queue")
      .update({ wave_no: wave, notified_at: now.toISOString() })
      .eq("id", row.id);
    await emitActionEvent(db, "case.match_alert", { ...payload, tutor_id: row.tutor_id }, row.id);
  }
  return batch.length;
}

/** Creates the run and its queue. Loses quietly to a concurrent drain. */
async function startRun(db: Db, c: CaseRow, now: Date): Promise<RunRow | null> {
  const { error } = await db
    .from<Record<string, unknown>>("case_match_runs")
    .insert({ case_id: c.id, match_fingerprint: caseMatchFingerprint(toMatchCase(c)) })
    .select("case_id")
    .single();
  if (error) return null;
  await appendToQueue(db, c, now);
  const rows = await selectRows<RunRow>(db, "case_match_runs", RUN_COLUMNS, [
    { col: "case_id", op: "eq", value: c.id },
  ]);
  return rows[0] ?? null;
}

/** Moves the run to stopped by compare-and-set; only the winner returns true. */
async function stopRun(db: Db, c: CaseRow, run: RunRow, now: Date): Promise<boolean> {
  const { error, count } = await db
    .from<Record<string, unknown>>("case_match_runs")
    .update(
      {
        status: "stopped",
        stop_reason: c.board_published_at ? c.status : "unpublished",
        next_wave_at: null,
        taken_notified_at: c.status === "matched" ? now.toISOString() : null,
        updated_at: now.toISOString(),
      },
      { count: "exact" },
    )
    .eq("case_id", c.id)
    .eq("status", run.status);
  if (error) throw new Error(error.message);
  return count === 1;
}

/** #657 §2c: applicants hear the case is taken. Only called by the stopRun winner. */
async function notifyTaken(db: Db, c: CaseRow): Promise<void> {
  const applications = await selectRows<{ id: string; tutor_id: string }>(
    db,
    "case_applications",
    "id, tutor_id",
    [{ col: "case_id", op: "eq", value: c.id }],
  );
  for (const application of applications) {
    if (application.tutor_id === c.matched_tutor_id) continue;
    await emitActionEvent(
      db,
      "case.already_taken",
      { case_id: c.id, case_code: c.case_code, tutor_id: application.tutor_id },
      application.id,
    );
  }
}

async function countResponses(db: Db, c: CaseRow, run: RunRow): Promise<number> {
  const queue = await selectRows<QueueRow>(db, "case_match_queue", QUEUE_COLUMNS, [
    { col: "case_id", op: "eq", value: c.id },
  ]);
  const inWave = queue.filter((row) => row.wave_no === run.current_wave);
  const applications = await selectRows<{ tutor_id: string }>(db, "case_applications", "tutor_id", [
    { col: "case_id", op: "eq", value: c.id },
  ]);
  const applied = new Set(applications.map((row) => row.tutor_id));
  return inWave.filter((row) => row.opened_at || applied.has(row.tutor_id)).length;
}

async function advanceRun(db: Db, c: CaseRow, run: RunRow, now: Date): Promise<void> {
  const fingerprint = caseMatchFingerprint(toMatchCase(c));
  if (fingerprint !== run.match_fingerprint) {
    await appendToQueue(db, c, now);
    await updateRun(db, c.id, { match_fingerprint: fingerprint });
  }
  if (run.status !== "active") return;

  const queue = await selectRows<{ wave_no: number | null }>(db, "case_match_queue", "wave_no", [
    { col: "case_id", op: "eq", value: c.id },
  ]);
  const step = decideWaveStep({
    currentWave: run.current_wave,
    nextWaveAt: run.next_wave_at,
    responses: run.current_wave > 0 ? await countResponses(db, c, run) : 0,
    remaining: queue.filter((row) => row.wave_no === null).length,
    now,
  });
  if (step === "responded") await updateRun(db, c.id, { status: "responded", next_wave_at: null });
  else if (step === "exhausted") await markExhausted(db, c);
  else if (step === "send_next") await sendNextWave(db, c, run, now);
}

async function tickExistingRuns(db: Db, now: Date): Promise<void> {
  const runs = await selectRows<RunRow>(
    db,
    "case_match_runs",
    RUN_COLUMNS,
    [{ col: "status", op: "in", value: ["active", "responded", "paused", "exhausted"] }],
    { col: "updated_at", asc: true, limit: OPEN_RUNS_PER_TICK },
  );
  if (runs.length === 0) return;
  const cases = await selectRows<CaseRow>(db, "tutoring_cases", CASE_COLUMNS, [
    { col: "id", op: "in", value: runs.map((run) => run.case_id) },
  ]);
  const byId = new Map(cases.map((c) => [c.id, c]));
  for (const run of runs) {
    const c = byId.get(run.case_id);
    if (!c) continue;
    try {
      if (CLOSED_STATUSES.has(c.status) || !c.board_published_at) {
        const won = await stopRun(db, c, run, now);
        if (won && c.status === "matched") await notifyTaken(db, c);
      } else {
        await advanceRun(db, c, run, now);
      }
    } catch (err) {
      console.error(`[match-waves] run ${c.case_code} failed:`, err);
    }
  }
}

async function wavesEnabled(db: Db): Promise<boolean> {
  const rows = await selectRows<{ value: unknown }>(db, "app_settings", "value", [
    { col: "key", op: "eq", value: ENABLED_SETTING },
  ]);
  return rows[0]?.value === true;
}

async function startNewRuns(db: Db, now: Date): Promise<void> {
  if (!(await wavesEnabled(db))) return;
  const since = new Date(now.getTime() - NEW_RUN_MAX_AGE_MS).toISOString();
  const published = await selectRowsInRange<CaseRow>(db, "tutoring_cases", CASE_COLUMNS, [], {
    col: "board_published_at",
    from: since,
    to: now.toISOString(),
    limit: NEW_RUN_SCAN_LIMIT,
  });
  const recent = published.filter((c) => !CLOSED_STATUSES.has(c.status));
  if (recent.length === 0) return;
  const runs = await selectRows<{ case_id: string }>(db, "case_match_runs", "case_id", [
    { col: "case_id", op: "in", value: recent.map((c) => c.id) },
  ]);
  const started = new Set(runs.map((run) => run.case_id));
  for (const c of recent.filter((row) => !started.has(row.id)).slice(0, NEW_RUNS_PER_TICK)) {
    try {
      const run = await startRun(db, c, now);
      if (run) await advanceRun(db, c, run, now);
    } catch (err) {
      console.error(`[match-waves] start ${c.case_code} failed:`, err);
    }
  }
}

/** Called from the bus drain. */
export async function tickCaseMatchWaves(db: Db, now: Date = new Date()): Promise<void> {
  await tickExistingRuns(db, now);
  await startNewRuns(db, now);
}

// ---------------------------------------------------------------------------
// Server fns
// ---------------------------------------------------------------------------

/** Tutor opened the case detail: this is a wave response. No-op for everyone else. */
export const markCaseMatchOpened = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ caseCode: z.string().trim().min(1).max(40) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<void> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const tutors = await selectRows<{ id: string }>(db, "tutors", "id", [
      { col: "user_id", op: "eq", value: context.userId },
    ]);
    if (tutors.length === 0) return;
    const cases = await selectRows<{ id: string }>(db, "tutoring_cases", "id", [
      { col: "case_code", op: "eq", value: data.caseCode },
    ]);
    if (cases.length === 0) return;
    const queue = await selectRows<QueueRow>(db, "case_match_queue", QUEUE_COLUMNS, [
      { col: "case_id", op: "eq", value: cases[0].id },
      { col: "tutor_id", op: "in", value: tutors.map((t) => t.id) },
    ]);
    for (const row of queue) {
      if (!row.notified_at || row.opened_at) continue;
      await db
        .from<Record<string, unknown>>("case_match_queue")
        .update({ opened_at: new Date().toISOString() })
        .eq("id", row.id);
    }
  });

export type CaseMatchWavesState = {
  run: {
    status: RunRow["status"];
    currentWave: number;
    nextWaveAt: string | null;
    stopReason: string | null;
  } | null;
  tutors: {
    tutorId: string;
    tutorCode: string;
    displayName: string;
    score: number;
    waveNo: number | null;
    opened: boolean;
    applied: boolean;
  }[];
};

export const getCaseMatchWaves = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CaseMatchWavesState> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    const runs = await selectRows<RunRow>(db, "case_match_runs", RUN_COLUMNS, [
      { col: "case_id", op: "eq", value: data.caseId },
    ]);
    const run = runs[0];
    if (!run) return { run: null, tutors: [] };
    const queue = await selectRows<QueueRow>(db, "case_match_queue", QUEUE_COLUMNS, [
      { col: "case_id", op: "eq", value: data.caseId },
    ]);
    const tutorIds = queue.map((row) => row.tutor_id);
    const tutors = tutorIds.length
      ? await selectRows<{ id: string; tutor_code: string | null; display_name: string | null }>(
          db,
          "tutors",
          "id, tutor_code, display_name",
          [{ col: "id", op: "in", value: tutorIds }],
        )
      : [];
    const applications = await selectRows<{ tutor_id: string }>(
      db,
      "case_applications",
      "tutor_id",
      [{ col: "case_id", op: "eq", value: data.caseId }],
    );
    const applied = new Set(applications.map((row) => row.tutor_id));
    const byId = new Map(tutors.map((t) => [t.id, t]));
    return {
      run: {
        status: run.status,
        currentWave: run.current_wave,
        nextWaveAt: run.next_wave_at,
        stopReason: run.stop_reason,
      },
      tutors: [...queue]
        .sort((a, b) => a.rank - b.rank)
        .map((row) => ({
          tutorId: row.tutor_id,
          tutorCode: byId.get(row.tutor_id)?.tutor_code ?? "",
          displayName: byId.get(row.tutor_id)?.display_name ?? "",
          score: Number(row.score),
          waveNo: row.wave_no,
          opened: Boolean(row.opened_at),
          applied: applied.has(row.tutor_id),
        })),
    };
  });

/** Desk overrides. Explicit staff actions, audited, and open-cases only. */
export const runCaseMatchWaveAction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        action: z.enum(["next", "notify_all", "pause", "resume"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ notified: number }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    await requireAdmin(db, context.userId);
    const now = new Date();
    const cases = await selectRows<CaseRow>(db, "tutoring_cases", CASE_COLUMNS, [
      { col: "id", op: "eq", value: data.caseId },
    ]);
    const c = cases[0];
    if (!c) throw new Error("Case not found");
    if (CLOSED_STATUSES.has(c.status) || !c.board_published_at) {
      throw new Error("Only an open, published case can send match alerts.");
    }
    const existing = await selectRows<RunRow>(db, "case_match_runs", RUN_COLUMNS, [
      { col: "case_id", op: "eq", value: c.id },
    ]);
    const run = existing[0] ?? (await startRun(db, c, now));
    if (!run) throw new Error("Could not start match alerts for this case.");

    let notified = 0;
    if (data.action === "pause") {
      await updateRun(db, c.id, { status: "paused", next_wave_at: null });
    } else if (data.action === "resume") {
      await updateRun(db, c.id, {
        status: "active",
        next_wave_at: waveWindowEndsAt(now).toISOString(),
      });
    } else {
      await appendToQueue(db, c, now);
      notified = await sendNextWave(db, c, run, now, { all: data.action === "notify_all" });
    }
    await insertAudit(db, c.id, context.userId, c.status, `[#657] match alerts: ${data.action}`);
    return { notified };
  });
