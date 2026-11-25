/**
 * #794 §2.6 (was #730) — Report Card Checked, server half.
 *
 * Mirrors the shipped credential-evidence flow (#284) and the Verified Need
 * proof flow (#794 §2.3):
 *   - the bytes land in the PRIVATE `progress-proofs` bucket, service-role only;
 *   - the key is desk-only and is NULLed together with the object on EVERY
 *     decision (PDPO: purge on decision, never retain the document);
 *   - staff read through a 10-minute signed URL, never the object key;
 *   - an unreviewed upload older than 14 days is destroyed by a lazy sweep the
 *     queue read runs — this repo has no cron (`sweepExpiredHolds` pattern).
 *
 * Column discipline: every read here uses an explicit column list, and no
 * party path (upload) selects `proof_key`. Only the two desk paths
 * (signed URL, queue + sweep) ever read it, and only the sweep and the
 * decision write it back to null.
 *
 * Publishing: `uploadProgressProof` always stamps `tutor_unconfirmed`, so a
 * party can never make their own evidence public by uploading it. Only
 * `reviewProgressProof` (admin) can produce `desk_checked`.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { describeDbError, requireAdmin, selectRows, type Db } from "@/features/cases/desk-db";
import {
  PROGRESS_PROOF_BUCKET,
  PROGRESS_PROOF_MAX_BASE64_LENGTH,
  PROGRESS_PROOF_SIGNED_URL_SECONDS,
  PROGRESS_PROOF_TYPES,
  expiredProgressProofUpdate,
  planProgressProofReview,
  planProgressProofSweep,
  planProgressProofUpload,
  progressProofAgeDays,
  progressProofFolder,
  progressProofNamePrefix,
  type ProgressProofDecision,
  type ProgressProofRow,
  type ProgressProofSweepRow,
} from "@/features/cases/progress-proofs";
import type { CheckpointType, ScaleType } from "@/features/cases/progress-evidence";

/** Newest-first window; the desk clears this every working day. */
const QUEUE_LIMIT = 200;
/** Sweep window; bounded so one read never walks the whole table. */
const SWEEP_LIMIT = 200;

type CaseRow = {
  id: string;
  parent_id: string;
  matched_tutor_id: string | null;
  case_code: string | null;
};

const CASE_COLUMNS = "id, parent_id, matched_tutor_id, case_code";

type CheckpointOwnerRow = {
  id: string;
  case_id: string;
  author_side: "parent" | "tutor";
};

/**
 * Upload path read: explicitly NO `proof_key`. A party request must never be
 * able to shape a response around the stored object key.
 */
const CHECKPOINT_OWNER_COLUMNS = "id, case_id, author_side";

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

async function loadCase(db: Db, caseId: string): Promise<CaseRow | null> {
  const rows = await selectRows<CaseRow>(db, "tutoring_cases", CASE_COLUMNS, [
    { col: "id", op: "eq", value: caseId },
  ]);
  return rows[0] ?? null;
}

/** Which side of the case the caller is on. Staff and strangers get null. */
async function partySide(db: Db, userId: string, c: CaseRow): Promise<"parent" | "tutor" | null> {
  if (c.parent_id === userId) return "parent";
  if (!c.matched_tutor_id) return null;
  const tutors = await selectRows<{ id: string }>(db, "tutors", "id", [
    { col: "user_id", op: "eq", value: userId },
  ]);
  return tutors[0]?.id === c.matched_tutor_id ? "tutor" : null;
}

async function isAdminRole(db: Db, userId: string): Promise<boolean> {
  for (const role of ["admin", "super_admin"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return true;
  }
  return false;
}

async function removeObject(db: Db, path: string): Promise<string | null> {
  const { error } = await db.storage.from(PROGRESS_PROOF_BUCKET).remove([path]);
  return error ? (error.message ?? "remove failed") : null;
}

/** `list` is not on the structural AdminDb storage type (same cast as #560). */
type ListableBucket = {
  list: (
    folder: string,
    options?: { limit?: number; search?: string },
  ) => Promise<{
    data: { name: string }[] | null;
    error: { message?: string } | null;
  }>;
};

/**
 * Remove every object for this checkpoint except `keepName`. A re-upload writes
 * a new stamped key, so the previous document would otherwise linger with no
 * row pointing at it — which is exactly the retention PDPO forbids. Best-effort:
 * a failed cleanup never fails an upload that already landed.
 */
async function purgeOtherProofObjects(
  db: Db,
  caseId: string,
  checkpointId: string,
  keepName: string,
): Promise<void> {
  const folder = progressProofFolder(caseId);
  const prefix = progressProofNamePrefix(checkpointId);
  try {
    const bucket = db.storage.from(PROGRESS_PROOF_BUCKET) as unknown as ListableBucket;
    const { data, error } = await bucket.list(folder, { limit: 100, search: prefix });
    if (error) {
      console.warn("[progress-proofs] stale proof list failed:", error.message);
      return;
    }
    const stale = (data ?? [])
      .map((entry) => entry.name)
      .filter((name) => name.startsWith(prefix) && name !== keepName)
      .map((name) => `${folder}/${name}`);
    if (stale.length === 0) return;
    const { error: removeError } = await db.storage.from(PROGRESS_PROOF_BUCKET).remove(stale);
    if (removeError)
      console.warn("[progress-proofs] stale proof purge failed:", removeError.message);
  } catch (error) {
    console.warn("[progress-proofs] stale proof purge crashed:", error);
  }
}

/**
 * Unreviewed documents, oldest upload first. `selectRows` only expresses eq/in,
 * so this one read drops to the real builder for `not … is null` / `is null`,
 * the same structural cast `selectRowsInRange` uses.
 */
type ProofFilterQuery<T> = PromiseLike<{
  data: T[] | null;
  error: { message: string } | null;
}> & {
  not: (col: string, op: string, value: unknown) => ProofFilterQuery<T>;
  is: (col: string, value: null) => ProofFilterQuery<T>;
  order: (col: string, opts?: { ascending?: boolean }) => ProofFilterQuery<T>;
  limit: (n: number) => ProofFilterQuery<T>;
};

type QueueDbRow = {
  id: string;
  case_id: string;
  author_side: "parent" | "tutor";
  assessment_type: CheckpointType;
  scale_type: ScaleType;
  score_value: string;
  proof_uploaded_at: string | null;
};

const QUEUE_COLUMNS =
  "id, case_id, author_side, assessment_type, scale_type, score_value, proof_uploaded_at";

async function liveProofRows(db: Db, limit: number): Promise<QueueDbRow[]> {
  let q = db
    .from<QueueDbRow>("case_progress_checkpoints")
    .select(QUEUE_COLUMNS) as unknown as ProofFilterQuery<QueueDbRow>;
  q = q
    .not("proof_key", "is", null)
    .is("proof_reviewed_at", null)
    .order("proof_uploaded_at", { ascending: true })
    .limit(limit);
  const { data, error } = await q;
  if (error) throw new Error(describeDbError("case_progress_checkpoints", error));
  return data ?? [];
}

// ---------------------------------------------------------------------------
// Party upload
// ---------------------------------------------------------------------------

const UploadSchema = z.object({
  checkpointId: z.string().uuid(),
  /** Base64 of the raw file; the decoded byte count is what the cap checks. */
  base64Data: z.string().min(16).max(PROGRESS_PROOF_MAX_BASE64_LENGTH),
  contentType: z.enum(PROGRESS_PROOF_TYPES),
});

export type ProgressProofUploadResult = { ok: true; uploadedAt: string };

/**
 * Attach evidence to one checkpoint. Party-gated (the row's author side, or the
 * case's parent — the family may support a tutor-entered row), never staff; the
 * upload only registers the document, it never publishes anything.
 */
export const uploadProgressProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UploadSchema.parse(input))
  .handler(async ({ context, data }): Promise<ProgressProofUploadResult> => {
    const bytes = Buffer.from(data.base64Data, "base64");
    const db = await adminDb();

    const rows = await selectRows<CheckpointOwnerRow>(
      db,
      "case_progress_checkpoints",
      CHECKPOINT_OWNER_COLUMNS,
      [{ col: "id", op: "eq", value: data.checkpointId }],
    );
    const row = rows[0];
    if (!row) throw new Error("CHECKPOINT_NOT_FOUND");

    const c = await loadCase(db, row.case_id);
    if (!c) throw new Error("CHECKPOINT_NOT_FOUND");

    // A stranger and the desk both land here as "staff": the plan refuses them
    // with FORBIDDEN, so the gate is one rule, exercised by vitest.
    const side = (await partySide(db, context.userId, c)) ?? "staff";
    const plan = planProgressProofUpload({
      side,
      authorSide: row.author_side,
      caseId: c.id,
      checkpointId: row.id,
      contentType: data.contentType,
      bytes: bytes.byteLength,
    });
    if (!plan.ok) throw new Error(plan.reason);

    const { error: uploadError } = await db.storage
      .from(PROGRESS_PROOF_BUCKET)
      .upload(plan.path, new Uint8Array(bytes), {
        contentType: plan.contentType,
        upsert: false,
      });
    if (uploadError) throw new Error(uploadError.message);

    const uploadedAt = new Date().toISOString();
    const { error: updateError, count } = await db
      .from<CheckpointOwnerRow>("case_progress_checkpoints")
      .update(
        {
          proof_key: plan.path,
          proof_uploaded_at: uploadedAt,
          // Never public: the desk is the only path to desk_checked.
          verification: plan.verification,
          proof_rejection: null,
        },
        { count: "exact" },
      )
      .eq("id", row.id);
    if (updateError || (count ?? 0) === 0) {
      const cleanup = await removeObject(db, plan.path);
      if (cleanup) console.warn("[progress-proofs] orphan cleanup failed:", cleanup);
      throw new Error(updateError?.message ?? "CHECKPOINT_NOT_FOUND");
    }

    const fileName = plan.path.slice(plan.path.lastIndexOf("/") + 1);
    await purgeOtherProofObjects(db, c.id, row.id, fileName);

    return { ok: true, uploadedAt };
  });

// ---------------------------------------------------------------------------
// Desk
// ---------------------------------------------------------------------------

/** Short-lived signed URL for the staff-only evidence view. */
export const getProgressProofUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ checkpointId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ url: string }> => {
    const db = await adminDb();
    await requireAdmin(db, context.userId);

    // Desk path: the key is allowed to be read here, and only here + the sweep.
    const rows = await selectRows<{ proof_key: string | null }>(
      db,
      "case_progress_checkpoints",
      "proof_key",
      [{ col: "id", op: "eq", value: data.checkpointId }],
    );
    const key = rows[0]?.proof_key;
    if (!key) throw new Error("NO_PROOF");

    const { data: signed, error } = await db.storage
      .from(PROGRESS_PROOF_BUCKET)
      .createSignedUrl(key, PROGRESS_PROOF_SIGNED_URL_SECONDS);
    if (error || !signed?.signedUrl) {
      throw new Error(error?.message ?? "Could not create the evidence link.");
    }
    return { url: signed.signedUrl };
  });

/**
 * Lazy sweep: an unreviewed upload older than 14 days is destroyed and its
 * checkpoint reverts to tutor_unconfirmed. Object first, row second — a failed
 * purge leaves the row retryable instead of writing a decision over a document
 * nobody deleted. Advisory: never throws, because a desk read calls it.
 * Returns how many rows were swept.
 */
export async function purgeExpiredProgressProofs(db: Db, now: Date = new Date()): Promise<number> {
  try {
    let q = db
      .from<ProgressProofSweepRow>("case_progress_checkpoints")
      .select(
        "id, proof_key, proof_uploaded_at, proof_reviewed_at",
      ) as unknown as ProofFilterQuery<ProgressProofSweepRow>;
    q = q
      .not("proof_key", "is", null)
      .is("proof_reviewed_at", null)
      .order("proof_uploaded_at", { ascending: true })
      .limit(SWEEP_LIMIT);
    const { data, error } = await q;
    if (error) {
      console.warn(
        "[progress-proofs] sweep read failed:",
        describeDbError("case_progress_checkpoints", error),
      );
      return 0;
    }

    const targets = planProgressProofSweep(data ?? [], now);
    let swept = 0;
    for (const target of targets) {
      const removal = await removeObject(db, target.purgeKey);
      if (removal) {
        console.warn("[progress-proofs] sweep purge failed:", target.id, removal);
        continue;
      }
      const { error: updateError, count } = await db
        .from<ProgressProofSweepRow>("case_progress_checkpoints")
        .update(expiredProgressProofUpdate(), { count: "exact" })
        .eq("id", target.id)
        .eq("proof_key", target.purgeKey);
      if (updateError) {
        console.warn("[progress-proofs] sweep update failed:", target.id, updateError.message);
        continue;
      }
      if ((count ?? 0) > 0) swept += 1;
    }
    return swept;
  } catch (error) {
    console.warn("[progress-proofs] sweep crashed:", error);
    return 0;
  }
}

export type ProgressProofQueueItem = {
  checkpointId: string;
  caseId: string;
  caseCode: string | null;
  assessmentType: CheckpointType;
  scaleType: ScaleType;
  scoreValue: string;
  authorSide: "parent" | "tutor";
  uploadedAt: string | null;
  /** Whole days since upload, floored at 0 — the desk's SLA hint. */
  ageDays: number;
};

/**
 * Rows awaiting review, oldest upload first. Runs the 14-day sweep before the
 * read (the no-cron pattern), then resolves case codes in ONE extra query so a
 * full queue is never N+1. Never returns `proof_key`: the panel opens each
 * document through `getProgressProofUrl`.
 */
export const listProgressProofQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProgressProofQueueItem[]> => {
    const db = await adminDb();
    await requireAdmin(db, context.userId);
    await purgeExpiredProgressProofs(db);

    const rows = await liveProofRows(db, QUEUE_LIMIT);
    if (rows.length === 0) return [];

    const caseIds = [...new Set(rows.map((row) => row.case_id))];
    const cases = await selectRows<{ id: string; case_code: string | null }>(
      db,
      "tutoring_cases",
      "id, case_code",
      [{ col: "id", op: "in", value: caseIds }],
    );
    const codeByCase = new Map(cases.map((c) => [c.id, c.case_code] as const));

    const now = new Date();
    return rows.map((row) => ({
      checkpointId: row.id,
      caseId: row.case_id,
      caseCode: codeByCase.get(row.case_id) ?? null,
      assessmentType: row.assessment_type,
      scaleType: row.scale_type,
      scoreValue: row.score_value,
      authorSide: row.author_side,
      uploadedAt: row.proof_uploaded_at,
      ageDays: progressProofAgeDays(row.proof_uploaded_at, now),
    }));
  });

const ReviewSchema = z.object({
  checkpointId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  note: z.string().trim().max(500).optional(),
});

export type ProgressProofReviewResult = {
  ok: true;
  verification: ProgressProofRow["verification"];
  proofRejection: string | null;
};

/**
 * Approve or reject one document. Approve flips the checkpoint to desk_checked
 * (public-eligible); reject reverts it to tutor_unconfirmed with the note
 * stored. BOTH delete the storage object and null the key before the row is
 * written, so no decided row can ever still point at a document.
 */
export const reviewProgressProof = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ReviewSchema.parse(input))
  .handler(async ({ context, data }): Promise<ProgressProofReviewResult> => {
    const db = await adminDb();

    const rows = await selectRows<ProgressProofRow>(
      db,
      "case_progress_checkpoints",
      "verification, proof_key, proof_uploaded_at, proof_reviewed_at",
      [{ col: "id", op: "eq", value: data.checkpointId }],
    );
    const row = rows[0] ?? null;

    const plan = planProgressProofReview({
      reviewerIsAdmin: await isAdminRole(db, context.userId),
      reviewerId: context.userId,
      row,
      decision: data.decision as ProgressProofDecision,
      note: data.note ?? null,
    });
    if (!plan.ok) throw new Error(plan.reason);

    // AC: purge first. A failed removal leaves the row untouched and retryable.
    const removal = await removeObject(db, plan.purgeKey);
    if (removal) throw new Error(removal);

    const { error, count } = await db
      .from<ProgressProofRow>("case_progress_checkpoints")
      .update(plan.update, { count: "exact" })
      .eq("id", data.checkpointId)
      .eq("proof_key", plan.purgeKey);
    if (error) throw new Error(error.message);
    if ((count ?? 0) === 0) throw new Error("NOT_PENDING");

    return {
      ok: true,
      verification: plan.update.verification,
      proofRejection: plan.update.proof_rejection,
    };
  });
