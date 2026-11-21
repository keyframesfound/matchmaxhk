/**
 * Issue #796 §2.2 — Digital Mistake Book (錯題本), server half.
 *
 * Every read/write re-checks who the caller is (linked parent, claimed student,
 * assigned tutor, Ops/Admin/Staff) and runs on the service-role client, so the
 * table policies in 20261120130000_issue_796_mistake_book.sql are defense in
 * depth rather than the only gate.
 *
 * Deliberately absent (MUST NOT for this ticket): OCR / LaTeX, spaced
 * repetition, public sharing, official past-paper hosting, and any change to
 * the 5 MB image cap or the #785 50 MB case-file cap.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import {
  MISTAKE_ERROR_REASONS,
  MISTAKE_SOURCE_MAX,
  MISTAKE_STATUSES,
  MISTAKE_TAG_MAX,
  MISTAKE_TEXT_MAX,
  MISTAKE_TITLE_MAX,
  MISTAKE_TIP_MAX,
  canSetMistakeStatus,
  mistakeBookRevealed,
  mistakeCounts,
  mistakeDraftError,
  mistakeImageError,
  normalizeMistakeTag,
  sortMistakes,
  type MistakeActor,
  type MistakeCounter,
  type MistakeErrorReason,
  type MistakeStatus,
} from "@/features/cases/mistake-book";
import type { LessonConfirmRow } from "@/features/cases/case-reviews";

const BUCKET = "case-mistakes";
/** 10 minutes — long enough to read a photo, short enough to not leak. */
const SIGNED_URL_SECONDS = 600;

type CaseRow = {
  id: string;
  case_code: string;
  parent_id: string | null;
  student_id: string | null;
  matched_tutor_id: string | null;
  subject: string;
  subjects: string[] | null;
  sor_status: string | null;
};

type MistakeRow = {
  id: string;
  case_id: string;
  student_id: string | null;
  owner_user_id: string;
  subject: string;
  title: string;
  source: string | null;
  topic_tag: string | null;
  error_reason: MistakeErrorReason;
  question_text: string | null;
  question_image_path: string | null;
  solution_text: string | null;
  solution_image_path: string | null;
  tutor_tip_text: string | null;
  status: MistakeStatus;
  mastered_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

const MISTAKE_COLUMNS =
  "id, case_id, student_id, owner_user_id, subject, title, source, topic_tag, error_reason, question_text, question_image_path, solution_text, solution_image_path, tutor_tip_text, status, mastered_at, created_by, created_at, updated_at";

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

async function isOps(db: Db, userId: string): Promise<boolean> {
  for (const role of ["staff", "admin", "super_admin"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return true;
  }
  return false;
}

type MistakeAccess = {
  kase: CaseRow;
  role: MistakeActor;
  /** The learner scope: the #459 child sub-profile's own account, else the parent. */
  ownerUserId: string;
};

/**
 * Resolve the caller against the case. Returns null when they are not a party
 * of it — the caller turns that into CASE_NOT_FOUND so an unrelated tutor can
 * never distinguish "exists" from "forbidden".
 */
async function loadAccess(db: Db, caseId: string, userId: string): Promise<MistakeAccess | null> {
  const cases = await selectRows<CaseRow>(
    db,
    "tutoring_cases",
    "id, case_code, parent_id, student_id, matched_tutor_id, subject, subjects, sor_status",
    [{ col: "id", op: "eq", value: caseId }],
  );
  const kase = cases[0];
  if (!kase) return null;

  const studentOwner = kase.student_id
    ? ((
        await selectRows<{ owner_user_id: string | null }>(db, "students", "owner_user_id", [
          { col: "id", op: "eq", value: kase.student_id },
        ])
      )[0]?.owner_user_id ?? null)
    : null;
  const ownerUserId = studentOwner ?? kase.parent_id ?? userId;

  const tutorUserId = kase.matched_tutor_id
    ? ((
        await selectRows<{ user_id: string | null }>(db, "tutors", "user_id", [
          { col: "id", op: "eq", value: kase.matched_tutor_id },
        ])
      )[0]?.user_id ?? null)
    : null;

  if (await isOps(db, userId)) return { kase, role: "ops", ownerUserId };
  if (userId === kase.parent_id || userId === studentOwner) {
    return { kase, role: "learner", ownerUserId };
  }
  if (tutorUserId && userId === tutorUserId) return { kase, role: "tutor", ownerUserId };
  return null;
}

/** Subjects the book is scoped by: the case's subject list plus its primary. */
function caseSubjects(kase: CaseRow): string[] {
  const list = [...(kase.subjects ?? []), kase.subject]
    .map((s) => (s ?? "").trim())
    .filter(Boolean);
  return [...new Set(list)];
}

/** Case-insensitive comparison key — display casing is preserved in the row. */
function subjectKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Every row this learner already owns in the same subject — including the ones
 * booked on an earlier case, so a rematch in the same subject keeps the book.
 */
async function historyRows(db: Db, kase: CaseRow, ownerUserId: string): Promise<MistakeRow[]> {
  const byCase = await selectRows<MistakeRow>(db, "case_mistakes", MISTAKE_COLUMNS, [
    { col: "case_id", op: "eq", value: kase.id },
  ]);
  const byLearner = kase.student_id
    ? await selectRows<MistakeRow>(db, "case_mistakes", MISTAKE_COLUMNS, [
        { col: "student_id", op: "eq", value: kase.student_id },
      ])
    : await selectRows<MistakeRow>(db, "case_mistakes", MISTAKE_COLUMNS, [
        { col: "owner_user_id", op: "eq", value: ownerUserId },
      ]);
  const merged = new Map<string, MistakeRow>();
  for (const row of [...byCase, ...byLearner]) merged.set(row.id, row);
  const subjects = new Set(caseSubjects(kase).map(subjectKey));
  return [...merged.values()].filter((row) => subjects.has(subjectKey(row.subject)));
}

/** Syllabus #tags already used on this case (#767 drawer) plus the book's own. */
async function caseTags(db: Db, kase: CaseRow, rows: MistakeRow[]): Promise<string[]> {
  const logs = await selectRows<{ topics: { tag?: string }[] | null }>(
    db,
    "case_lesson_logs",
    "topics",
    [{ col: "case_id", op: "eq", value: kase.id }],
  );
  const seen = new Map<string, string>();
  for (const log of logs) {
    for (const topic of log.topics ?? []) {
      const tag = normalizeMistakeTag(topic?.tag);
      if (tag && !seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag);
    }
  }
  for (const row of rows) {
    const tag = normalizeMistakeTag(row.topic_tag);
    if (tag && !seen.has(tag.toLowerCase())) seen.set(tag.toLowerCase(), tag);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

async function signedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  return error || !data?.signedUrl ? null : data.signedUrl;
}

export type MistakeItem = {
  id: string;
  title: string;
  source: string | null;
  topicTag: string | null;
  errorReason: MistakeErrorReason;
  questionText: string | null;
  questionImageUrl: string | null;
  solutionText: string | null;
  solutionImageUrl: string | null;
  tutorTipText: string | null;
  status: MistakeStatus;
  createdAt: string;
  fromEarlierCase: boolean;
  canEdit: boolean;
};

export type MistakeBookState = {
  role: MistakeActor;
  subject: string;
  revealed: boolean;
  tags: string[];
  counts: MistakeCounter;
  items: MistakeItem[];
};

export const getCaseMistakeBook = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<MistakeBookState> => {
    const db = await adminDb();
    const access = await loadAccess(db, data.caseId, context.userId);
    if (!access) throw new Error("CASE_NOT_FOUND");

    const lessons = await selectRows<LessonConfirmRow>(
      db,
      "case_lessons",
      "status, confirmed_by_parent_at, confirmed_by_tutor_at",
      [{ col: "case_id", op: "eq", value: data.caseId }],
    );
    const rows = sortMistakes(
      (await historyRows(db, access.kase, access.ownerUserId)).map((row) => ({
        ...row,
        createdAt: row.created_at,
      })),
    );

    const items: MistakeItem[] = await Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        title: row.title,
        source: row.source,
        topicTag: row.topic_tag,
        errorReason: row.error_reason,
        questionText: row.question_text,
        questionImageUrl: await signedUrl(row.question_image_path),
        solutionText: row.solution_text,
        solutionImageUrl: await signedUrl(row.solution_image_path),
        tutorTipText: row.tutor_tip_text,
        status: row.status,
        createdAt: row.created_at,
        fromEarlierCase: row.case_id !== data.caseId,
        // Rows inherited from an earlier case are a read-only history here.
        canEdit: row.case_id === data.caseId,
      })),
    );

    return {
      role: access.role,
      subject: access.kase.subject,
      revealed: mistakeBookRevealed(lessons.filter((lesson) => lesson.status === "done").length),
      tags: await caseTags(db, access.kase, rows),
      counts: mistakeCounts(rows),
      items,
    };
  });

// ---------------------------------------------------------------------------
// Add (student / parent self-upload, tutor exercise, ops correction)
// ---------------------------------------------------------------------------

const UploadFile = z.object({
  filename: z.string().min(1).max(200),
  contentType: z.string().min(3).max(100),
  size: z.number().int().positive(),
  content: z.string().min(1),
});

const AddSchema = z.object({
  caseId: z.string().uuid(),
  title: z.string().trim().max(MISTAKE_TITLE_MAX),
  source: z.string().trim().max(MISTAKE_SOURCE_MAX).optional(),
  topicTag: z.string().trim().max(MISTAKE_TAG_MAX).optional(),
  errorReason: z.enum(MISTAKE_ERROR_REASONS),
  questionText: z.string().trim().max(MISTAKE_TEXT_MAX).optional(),
  solutionText: z.string().trim().max(MISTAKE_TEXT_MAX).optional(),
  questionImage: UploadFile.optional(),
  solutionImage: UploadFile.optional(),
});

async function storeImage(file: z.infer<typeof UploadFile>, caseId: string): Promise<string> {
  const failure = mistakeImageError({ contentType: file.contentType, size: file.size });
  if (failure) throw new Error(failure);
  const bytes = Buffer.from(file.content, "base64");
  if (bytes.length === 0 || bytes.length !== file.size) throw new Error("IMAGE_TYPE");
  const ext =
    file.contentType === "image/png" ? "png" : file.contentType === "image/webp" ? "webp" : "jpg";
  const path = `${caseId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.contentType, upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export const addCaseMistake = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => AddSchema.parse(input))
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const db = await adminDb();
    const access = await loadAccess(db, data.caseId, context.userId);
    if (!access) throw new Error("CASE_NOT_FOUND");

    const questionImagePath = data.questionImage
      ? await storeImage(data.questionImage, data.caseId)
      : null;

    const draftError = mistakeDraftError({
      title: data.title,
      errorReason: data.errorReason,
      questionText: data.questionText ?? "",
      questionImagePath,
      topicTag: data.topicTag ?? null,
    });
    if (draftError) throw new Error(draftError);

    const solutionImagePath = data.solutionImage
      ? await storeImage(data.solutionImage, data.caseId)
      : null;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: inserted, error } = await supabaseAdmin
      .from("case_mistakes" as never)
      .insert({
        case_id: data.caseId,
        student_id: access.kase.student_id,
        owner_user_id: access.ownerUserId,
        subject: caseSubjects(access.kase)[0] ?? "general",
        title: data.title,
        source: data.source?.trim() || null,
        topic_tag: normalizeMistakeTag(data.topicTag),
        error_reason: data.errorReason,
        question_text: data.questionText?.trim() || null,
        question_image_path: questionImagePath,
        solution_text: data.solutionText?.trim() || null,
        solution_image_path: solutionImagePath,
        created_by: context.userId,
      } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: String((inserted as unknown as { id: string }).id) };
  });

// ---------------------------------------------------------------------------
// Status + tutor tip
// ---------------------------------------------------------------------------

async function requireMistake(db: Db, caseId: string, mistakeId: string): Promise<MistakeRow> {
  const rows = await selectRows<MistakeRow>(db, "case_mistakes", MISTAKE_COLUMNS, [
    { col: "id", op: "eq", value: mistakeId },
  ]);
  const row = rows[0];
  // Rows inherited from an earlier case are readable but never writable here.
  if (!row || row.case_id !== caseId) throw new Error("MISTAKE_NOT_FOUND");
  return row;
}

export const setCaseMistakeStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        mistakeId: z.string().uuid(),
        status: z.enum(MISTAKE_STATUSES),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ status: MistakeStatus }> => {
    const db = await adminDb();
    const access = await loadAccess(db, data.caseId, context.userId);
    if (!access) throw new Error("CASE_NOT_FOUND");
    const row = await requireMistake(db, data.caseId, data.mistakeId);
    if (!canSetMistakeStatus(row.status, data.status, access.role)) {
      throw new Error("STATUS_LOCKED");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("case_mistakes" as never)
      .update({
        status: data.status,
        mastered_at: data.status === "mastered" ? new Date().toISOString() : null,
      } as never)
      .eq("id", data.mistakeId);
    if (error) throw new Error(error.message);
    return { status: data.status };
  });

export const saveCaseMistakeTip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        mistakeId: z.string().uuid(),
        tipText: z.string().trim().max(MISTAKE_TIP_MAX),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await adminDb();
    const access = await loadAccess(db, data.caseId, context.userId);
    if (!access) throw new Error("CASE_NOT_FOUND");
    // Only the tutor of the case (or Ops) reviews and leaves a tip.
    if (access.role === "learner") throw new Error("TIP_FORBIDDEN");
    await requireMistake(db, data.caseId, data.mistakeId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("case_mistakes" as never)
      .update({ tutor_tip_text: data.tipText || null } as never)
      .eq("id", data.mistakeId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Structural export kept for callers that only need the row shape. */
export type { MistakeRow };
