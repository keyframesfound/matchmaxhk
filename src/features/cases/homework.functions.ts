/**
 * Issue #652: Homework tracker, server half. Every call goes through partyCase,
 * so only the matched tutor and the case's parent reach a row. Tutors assign
 * and review; parents submit. A second submit keeps the original timestamp, so
 * editing a note can't change on-time status. Ended cases are read-only.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db, type Row } from "@/features/cases/desk-db";
import { partyCase, type PartyRole } from "@/features/cases/case-schedule.functions";
import {
  HOMEWORK_LINK_MAX,
  HOMEWORK_NOTE_MAX,
  HOMEWORK_REVIEW_MAX,
  HOMEWORK_TEXT_MAX,
  HOMEWORK_TITLE_MAX,
  homeworkTextError,
  isAllowedHomeworkLink,
} from "@/features/cases/homework";

const ENDED_STATUSES = new Set(["closed", "replaced"]);

const optionalLink = z
  .string()
  .trim()
  .max(HOMEWORK_LINK_MAX)
  .optional()
  .refine((v) => !v || isAllowedHomeworkLink(v), "BAD_LINK");

type HomeworkRow = {
  id: string;
  case_id: string;
  title: string;
  due_at: string;
  instructions: string | null;
  resource_url: string | null;
  submitted_at: string | null;
  submission_note: string | null;
  submission_url: string | null;
  reviewed_at: string | null;
  review_comment: string | null;
};

const HOMEWORK_COLS =
  "id, case_id, title, due_at, instructions, resource_url, submitted_at, submission_note, submission_url, reviewed_at, review_comment";

export type HomeworkEntry = {
  id: string;
  title: string;
  dueAt: string;
  instructions: string | null;
  resourceUrl: string | null;
  submittedAt: string | null;
  submissionNote: string | null;
  submissionUrl: string | null;
  reviewedAt: string | null;
  reviewComment: string | null;
};

export type CaseHomework = {
  role: PartyRole;
  readOnly: boolean;
  items: HomeworkEntry[];
};

function assertCleanText(...texts: (string | null | undefined)[]): void {
  if (texts.some((text) => homeworkTextError(text))) throw new Error("CONTACT_DETAILS");
}

async function homeworkOnCase(db: Db, homeworkId: string, caseId: string): Promise<HomeworkRow> {
  const rows = await selectRows<HomeworkRow>(db, "case_homework", HOMEWORK_COLS, [
    { col: "id", op: "eq", value: homeworkId },
    { col: "case_id", op: "eq", value: caseId },
  ]);
  if (!rows[0]) throw new Error("HOMEWORK_NOT_FOUND");
  return rows[0];
}

export const getCaseHomework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CaseHomework> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c, role } = await partyCase(db, data.caseId, context.userId);
    const rows = await selectRows<HomeworkRow>(db, "case_homework", HOMEWORK_COLS, [
      { col: "case_id", op: "eq", value: c.id },
    ]);
    return {
      role,
      readOnly: c.sor_status !== null && ENDED_STATUSES.has(c.sor_status),
      items: rows.map((r) => ({
        id: r.id,
        title: r.title,
        dueAt: r.due_at,
        instructions: r.instructions,
        resourceUrl: r.resource_url,
        submittedAt: r.submitted_at,
        submissionNote: r.submission_note,
        submissionUrl: r.submission_url,
        reviewedAt: r.reviewed_at,
        reviewComment: r.review_comment,
      })),
    };
  });

/** The caller's party role, refusing writes once the case has ended. */
async function writableParty(db: Db, caseId: string, userId: string) {
  const party = await partyCase(db, caseId, userId);
  if (party.c.sor_status && ENDED_STATUSES.has(party.c.sor_status)) {
    throw new Error("CASE_ENDED");
  }
  return party;
}

export const assignHomework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        title: z.string().trim().min(1).max(HOMEWORK_TITLE_MAX),
        dueAtIso: z.string().datetime(),
        instructions: z.string().trim().max(HOMEWORK_TEXT_MAX).optional(),
        resourceUrl: optionalLink,
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c, role } = await writableParty(db, data.caseId, context.userId);
    if (role !== "tutor") throw new Error("TUTOR_ONLY");
    if (Date.parse(data.dueAtIso) <= Date.now()) throw new Error("DUE_IN_PAST");
    assertCleanText(data.title, data.instructions);
    const { data: row, error } = await db
      .from<Row>("case_homework")
      .insert({
        case_id: c.id,
        title: data.title,
        due_at: new Date(data.dueAtIso).toISOString(),
        instructions: data.instructions || null,
        resource_url: data.resourceUrl || null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: String((row as { id: string }).id) };
  });

export const submitHomework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        homeworkId: z.string().uuid(),
        note: z.string().trim().max(HOMEWORK_NOTE_MAX).optional(),
        link: optionalLink,
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ submittedAt: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c, role } = await writableParty(db, data.caseId, context.userId);
    if (role !== "parent") throw new Error("PARENT_ONLY");
    assertCleanText(data.note);
    const row = await homeworkOnCase(db, data.homeworkId, c.id);
    if (row.reviewed_at) throw new Error("ALREADY_REVIEWED");
    const submittedAt = row.submitted_at ?? new Date().toISOString();
    const { error } = await db
      .from<Row>("case_homework")
      .update({
        submitted_at: submittedAt,
        submitted_by: context.userId,
        submission_note: data.note || null,
        submission_url: data.link || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    return { submittedAt };
  });

export const reviewHomework = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        caseId: z.string().uuid(),
        homeworkId: z.string().uuid(),
        comment: z.string().trim().max(HOMEWORK_REVIEW_MAX).optional(),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ reviewedAt: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { c, role } = await writableParty(db, data.caseId, context.userId);
    if (role !== "tutor") throw new Error("TUTOR_ONLY");
    assertCleanText(data.comment);
    const row = await homeworkOnCase(db, data.homeworkId, c.id);
    if (!row.submitted_at) throw new Error("NOT_SUBMITTED");
    const reviewedAt = row.reviewed_at ?? new Date().toISOString();
    const { error } = await db
      .from<Row>("case_homework")
      .update({
        reviewed_at: reviewedAt,
        reviewed_by: context.userId,
        review_comment: data.comment || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    if (error) throw new Error(error.message);
    return { reviewedAt };
  });
