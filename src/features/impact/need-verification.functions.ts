/**
 * Issue #794 §2.3 (AC-560-1..AC-560-4) — Verified Need, server half.
 *
 * A family uploads ONE proof document, staff approve or reject it, and the raw
 * document is destroyed on decision. The rules this file enforces:
 *
 *  - Uploads are SIGNED, not base64: the browser asks for a token under its own
 *    `<userId>/…` folder, PUTs the bytes straight into the private
 *    `access-verification` bucket, then registers the attempt here.
 *  - A second attempt while one is pending or verified is refused
 *    (`blocksNewRequest`), so a family cannot stack documents for the desk.
 *  - The stored object's REAL size/content-type is read back; the client cannot
 *    register a 200 MB object as "PDF, 40 KB".
 *  - Decision order is document first, row second: if the purge fails the row
 *    stays pending and retryable, and a decided row always carries a null
 *    `file_path` (the `access_verifications_purge_check` demands it).
 *  - No function here returns `file_path` to a browser. The queue returns a
 *    10-minute signed read URL to STAFF only; tutors reach none of these fns.
 *
 * A family that never submits anything is Self-Declared: absence of a row is a
 * valid state, no fn blocks on it, and request matching never waits on the desk.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import {
  NEED_VERIFICATION_BUCKET,
  isOwnedNeedVerificationPath,
  needVerificationFileError,
  needVerificationPath,
} from "@/features/impact/need-verification-path";
import {
  PROOF_KINDS,
  blocksNewRequest,
  needState,
  verifiedUntilFrom,
  type NeedState,
  type ProofKind,
  type VerificationRow,
  type VerificationStatus,
} from "@/features/impact/need-verification";

const TABLE = "access_verifications";
/** 10 minutes — long enough for staff to open a scan, short enough not to leak. */
const SIGNED_URL_SECONDS = 600;
/** Newest first; the desk clears this every working day. */
const QUEUE_LIMIT = 50;
/** Both notes are CHECK-constrained to 1..500 in the migration. */
const NOTE_MAX = 500;
/** The bucket only ever holds one proof per folder. */
const FOLDER_LIST_LIMIT = 20;

type VerificationRecord = {
  id: string;
  user_id: string;
  status: VerificationStatus;
  proof_kind: ProofKind;
  file_path: string | null;
  file_name: string | null;
  context_note: string | null;
  reviewed_at: string | null;
  verified_until: string | null;
  cascade_to_household: boolean;
  created_at: string;
};

const RECORD_COLUMNS =
  "id, user_id, status, proof_kind, file_path, file_name, context_note, reviewed_at, verified_until, cascade_to_household, created_at";

/**
 * The service-role client's storage surface for this flow. createSignedUploadUrl
 * / info / list are not on the structural AdminDb storage type, so they are
 * declared here the way case-files.functions.ts does.
 */
type NeedVerificationStorage = {
  storage: {
    from: (bucket: string) => {
      createSignedUploadUrl: (path: string) => Promise<{
        data: { token: string; path: string } | null;
        error: { message?: string } | null;
      }>;
      createSignedUrl: (
        path: string,
        expiresIn: number,
      ) => Promise<{ data: { signedUrl: string } | null; error: { message?: string } | null }>;
      remove: (paths: string[]) => Promise<{ error: { message?: string } | null }>;
      info: (path: string) => Promise<{
        data: {
          size?: number;
          contentType?: string;
          metadata?: { size?: number; mimetype?: string } | null;
        } | null;
        error: { message?: string } | null;
      }>;
      list: (
        folder: string,
        options?: { limit?: number; search?: string },
      ) => Promise<{
        data: { name: string; metadata: { size?: number; mimetype?: string } | null }[] | null;
        error: { message?: string } | null;
      }>;
    };
  };
};

async function adminDb(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return asAdminDb(supabaseAdmin);
}

async function storageClient(): Promise<NeedVerificationStorage> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as NeedVerificationStorage;
}

/** staff / admin / super_admin — the desk that reviews proofs (#308). */
async function requireStaff(db: Db, userId: string): Promise<void> {
  for (const role of ["staff", "admin", "super_admin"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return;
  }
  throw new Error("FORBIDDEN");
}

/**
 * The caller's newest attempt. Ordering by `created_at` means a rejection is
 * what the family sees next, so a fresh upload is allowed after a refusal.
 */
async function latestRecord(db: Db, userId: string): Promise<VerificationRecord | null> {
  const rows = await selectRows<VerificationRecord>(
    db,
    TABLE,
    RECORD_COLUMNS,
    [{ col: "user_id", op: "eq", value: userId }],
    { col: "created_at", asc: false, limit: 1 },
  );
  return rows[0] ?? null;
}

/** The pure state machine reads this shape; `null` = never submitted. */
function stateRow(record: VerificationRecord | null): VerificationRow {
  if (!record) return null;
  return { status: record.status, verified_until: record.verified_until };
}

function stateOf(record: VerificationRecord | null): NeedState {
  return needState(stateRow(record), new Date());
}

function normalizedType(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().split(";")[0].trim();
}

/** Backends report these when the browser sent no type — not a mismatch. */
const GENERIC_TYPES = new Set(["application/octet-stream", "binary/octet-stream", ""]);

type StoredObject = { size: number | null; contentType: string | null };

/**
 * The stored object's real metadata: `info` when the storage backend exposes it,
 * else a `list` of the caller's folder matched by exact file name. null = no
 * object, which `submitNeedVerification` turns into FILE_TYPE.
 */
async function readStoredObject(
  storage: NeedVerificationStorage,
  path: string,
): Promise<StoredObject | null> {
  const bucket = storage.storage.from(NEED_VERIFICATION_BUCKET);
  const info = await bucket.info(path);
  if (!info.error && info.data) {
    const size =
      typeof info.data.size === "number" ? info.data.size : (info.data.metadata?.size ?? null);
    const contentType =
      typeof info.data.contentType === "string" && info.data.contentType
        ? info.data.contentType
        : (info.data.metadata?.mimetype ?? null);
    return { size, contentType };
  }

  const cut = path.lastIndexOf("/");
  const folder = cut >= 0 ? path.slice(0, cut) : "";
  const fileName = path.slice(cut + 1);
  const listed = await bucket.list(folder, { limit: FOLDER_LIST_LIMIT, search: fileName });
  if (listed.error) throw new Error(listed.error.message || "FILE_TYPE");
  const found = (listed.data ?? []).find((entry) => entry.name === fileName);
  if (!found) return null;
  const size = typeof found.metadata?.size === "number" ? found.metadata.size : null;
  const mimetype = found.metadata?.mimetype;
  return { size, contentType: typeof mimetype === "string" && mimetype ? mimetype : null };
}

/** A staff-only 10-minute read URL; null when the object is gone. */
async function signedUrl(
  storage: NeedVerificationStorage,
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await storage.storage
    .from(NEED_VERIFICATION_BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  return error || !data?.signedUrl ? null : data.signedUrl;
}

/** Remove a stored object; the caller decides whether the failure is fatal. */
async function removeObject(
  storage: NeedVerificationStorage,
  path: string,
): Promise<string | null> {
  const { error } = await storage.storage.from(NEED_VERIFICATION_BUCKET).remove([path]);
  return error ? (error.message ?? "remove failed") : null;
}

// ---------------------------------------------------------------------------
// The family's own view
// ---------------------------------------------------------------------------

export type MyNeedVerification = {
  state: NeedState;
  /** The raw row status, null when the family never submitted anything. */
  status: VerificationStatus | null;
  verifiedUntil: string | null;
  proofKind: ProofKind | null;
  /** False while a pending/verified attempt is live (`blocksNewRequest`). */
  canSubmit: boolean;
};

export const getMyNeedVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyNeedVerification> => {
    const db = await adminDb();
    const record = await latestRecord(db, context.userId);
    const state = stateOf(record);
    return {
      state,
      status: record?.status ?? null,
      verifiedUntil: record?.verified_until ?? null,
      proofKind: record?.proof_kind ?? null,
      canSubmit: !blocksNewRequest(state),
    };
  });

// ---------------------------------------------------------------------------
// Upload target
// ---------------------------------------------------------------------------

/** Size is deliberately unbounded here so the pure rules own the error codes. */
const FileMeta = {
  name: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(3).max(120),
  size: z.number(),
} as const;

const UploadTargetSchema = z.object(FileMeta);

export type NeedVerificationUploadTarget = {
  /** Key inside the private `access-verification` bucket, always `<userId>/…`. */
  path: string;
  /** Upload token for `uploadToSignedUrl(path, token, file)` — never logged. */
  token: string;
};

/**
 * Mint a signed upload target. No row is written here: the object only becomes a
 * verification attempt when submitNeedVerification verifies it.
 */
export const createNeedVerificationUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => UploadTargetSchema.parse(input))
  .handler(async ({ context, data }): Promise<NeedVerificationUploadTarget> => {
    const failure = needVerificationFileError(data);
    if (failure) throw new Error(failure);

    const db = await adminDb();
    // One live attempt per account (also a partial unique index on the table).
    if (blocksNewRequest(stateOf(await latestRecord(db, context.userId)))) {
      throw new Error("ALREADY_SUBMITTED");
    }

    const path = needVerificationPath(
      context.userId,
      data.name,
      Date.now(),
      Math.random().toString(36).slice(2, 10),
    );
    const storage = await storageClient();
    const { data: signed, error } = await storage.storage
      .from(NEED_VERIFICATION_BUCKET)
      .createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message || "UPLOAD_UNAVAILABLE");

    // Only the path + token travel: a signed URL embeds credentials.
    return { path: signed.path || path, token: signed.token };
  });

// ---------------------------------------------------------------------------
// Submit for review
// ---------------------------------------------------------------------------

const SubmitSchema = z.object({
  proofKind: z.enum(PROOF_KINDS),
  path: z.string().trim().min(3).max(400),
  ...FileMeta,
  /** Trimmed and cut to 500 before it reaches the CHECK constraint. */
  contextNote: z.string().max(4000).optional(),
});

/**
 * Register an uploaded object as the family's one open attempt. The row stays
 * `pending` with `file_path` set — that is what staff read — and the decision fn
 * nulls it again (AC-560-3).
 */
export const submitNeedVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => SubmitSchema.parse(input))
  .handler(async ({ context, data }): Promise<{ state: NeedState }> => {
    const failure = needVerificationFileError(data);
    if (failure) throw new Error(failure);
    // The folder is the ownership scope: a path may never leave the caller's own.
    if (!isOwnedNeedVerificationPath(context.userId, data.path)) throw new Error("FILE_TYPE");

    const db = await adminDb();
    if (blocksNewRequest(stateOf(await latestRecord(db, context.userId)))) {
      throw new Error("ALREADY_SUBMITTED");
    }

    const storage = await storageClient();
    const stored = await readStoredObject(storage, data.path);
    // Missing object or a size that disagrees with the declaration: the caller
    // cannot register bytes it did not upload at this size.
    if (!stored) throw new Error("FILE_TYPE");
    if (stored.size !== null && stored.size !== data.size) throw new Error("FILE_TYPE");
    const storedType = normalizedType(stored.contentType);
    if (!GENERIC_TYPES.has(storedType) && storedType !== normalizedType(data.contentType)) {
      throw new Error("FILE_TYPE");
    }

    const note = (data.contextNote ?? "").trim().slice(0, NOTE_MAX);

    const { error } = await db.from<VerificationRecord>(TABLE).insert({
      user_id: context.userId,
      status: "pending",
      proof_kind: data.proofKind,
      file_path: data.path,
      file_name: data.name,
      context_note: note || null,
    });
    if (error) {
      // Do not leave an unregistered proof behind.
      const cleanup = await removeObject(storage, data.path);
      if (cleanup) console.warn("[need-verification] orphan cleanup failed:", cleanup);
      // The partial unique index caught a concurrent pending attempt.
      if (error.code === "23505") throw new Error("ALREADY_SUBMITTED");
      throw new Error(error.message);
    }

    return { state: "pending" };
  });

// ---------------------------------------------------------------------------
// Staff queue
// ---------------------------------------------------------------------------

export type NeedVerificationQueueItem = {
  id: string;
  /** The account that uploaded; staff need it to correlate the family. */
  user_id: string;
  proofKind: ProofKind;
  contextNote: string | null;
  /** Signed read URL (10 min). Never the object key. */
  fileUrl: string | null;
  createdAt: string;
};

/**
 * Pending attempts, newest first. Never returns `file_path`: staff open the
 * document through a short-lived signed URL, and everybody else has no call.
 */
export const listNeedVerificationQueue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NeedVerificationQueueItem[]> => {
    const db = await adminDb();
    await requireStaff(db, context.userId);

    const rows = await selectRows<VerificationRecord>(
      db,
      TABLE,
      RECORD_COLUMNS,
      [{ col: "status", op: "eq", value: "pending" }],
      { col: "created_at", asc: false, limit: QUEUE_LIMIT },
    );

    const storage = await storageClient();
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        user_id: row.user_id,
        proofKind: row.proof_kind,
        contextNote: row.context_note,
        fileUrl: await signedUrl(storage, row.file_path),
        createdAt: row.created_at,
      })),
    );
  });

// ---------------------------------------------------------------------------
// Decision
// ---------------------------------------------------------------------------

const DecideSchema = z.object({
  id: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  /** AC-560-4: cover the household's other child sub-profiles. */
  cascade: z.boolean().optional(),
  note: z.string().max(4000).optional(),
});

export const decideNeedVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => DecideSchema.parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await adminDb();
    await requireStaff(db, context.userId);

    const rows = await selectRows<VerificationRecord>(db, TABLE, RECORD_COLUMNS, [
      { col: "id", op: "eq", value: data.id },
    ]);
    const row = rows[0];
    if (!row) throw new Error("VERIFICATION_NOT_FOUND");
    if (row.status !== "pending") throw new Error("ALREADY_REVIEWED");

    // AC-560-3, object first: a failed purge leaves the row pending and intact,
    // so staff retry instead of writing a decision over a document nobody
    // deleted. The row is only ever nulled once the bytes are gone.
    const storage = await storageClient();
    if (row.file_path) {
      const removal = await removeObject(storage, row.file_path);
      if (removal) throw new Error(removal);
    }

    const now = new Date();
    // AdminDb update chains have no `.select()`: these are the values written,
    // and `count` is what proves the row was still pending at write time.
    const reviewedAt = now.toISOString();
    const approved = data.decision === "approve";
    const note = (data.note ?? "").trim().slice(0, NOTE_MAX);

    const { error, count } = await db
      .from<VerificationRecord>(TABLE)
      .update(
        {
          status: approved ? "verified" : "rejected",
          reviewed_by: context.userId,
          reviewed_at: reviewedAt,
          // AC-560-2: a pass runs 12 months from this decision; a rejection
          // carries no expiry at all.
          verified_until: approved ? verifiedUntilFrom(now) : null,
          cascade_to_household: approved && data.cascade === true,
          decision_note: note || null,
          // The purge check rejects a decided row that still points at a file.
          file_path: null,
          file_name: null,
          updated_at: reviewedAt,
        },
        { count: "exact" },
      )
      .eq("id", row.id)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    if ((count ?? 0) === 0) throw new Error("ALREADY_REVIEWED");

    return { ok: true };
  });

/**
 * AC-560-3: what the **tutor** sees on a private case card.
 *
 * The verification row is account-level, which is the AC's own model ("an
 * account-level pass ... valid 12 months across pro-bono requests"), so one
 * verified pass covers every child of that account. The read is batched over
 * the tutor's active cases: one query for the cases, one for their children's
 * accounts, one for the verification rows - never one per case.
 *
 * Returns only a badge state. The verdict, the proof kind, the note and the
 * document never leave the desk.
 */
export const getTutorCaseNeedBadges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Record<string, NeedState>> => {
    const db = await adminDb();

    const tutorRows = await selectRows<{ id: string }>(db, "tutors", "id", [
      { col: "user_id", op: "eq", value: context.userId },
    ]);
    const tutorId = tutorRows[0]?.id;
    if (!tutorId) return {};

    const cases = await selectRows<{
      id: string;
      student_id: string | null;
      parent_id: string | null;
      pro_bono_request: boolean | null;
    }>(db, "tutoring_cases", "id, student_id, parent_id, pro_bono_request", [
      { col: "matched_tutor_id", op: "eq", value: tutorId },
    ]);
    if (cases.length === 0) return {};

    const studentIds = [...new Set(cases.map((c) => c.student_id).filter(Boolean))] as string[];
    const students = studentIds.length
      ? await selectRows<{ id: string; owner_user_id: string | null }>(
          db,
          "students",
          "id, owner_user_id",
          [{ col: "id", op: "in", value: studentIds }],
        )
      : [];
    const ownerByStudent = new Map(students.map((s) => [s.id, s.owner_user_id ?? null] as const));

    const accountByCase = new Map<string, string | null>();
    for (const c of cases) {
      const owner = c.student_id ? (ownerByStudent.get(c.student_id) ?? null) : null;
      accountByCase.set(c.id, owner ?? c.parent_id ?? null);
    }
    const accounts = [...new Set([...accountByCase.values()].filter(Boolean))] as string[];

    const rows = accounts.length
      ? await selectRows<{
          user_id: string;
          status: VerificationStatus;
          verified_until: string | null;
        }>(db, "access_verifications", "user_id, status, verified_until", [
          { col: "user_id", op: "in", value: accounts },
        ])
      : [];
    // Newest decision wins when an account has history (rejected after a lapsed
    // pass, for instance); the row set is small because only pending/verified
    // are unique per account.
    const byAccount = new Map<string, VerificationRow>();
    for (const row of rows) {
      const current = byAccount.get(row.user_id);
      if (!current || (row.status === "verified" && current.status !== "verified")) {
        byAccount.set(row.user_id, { status: row.status, verified_until: row.verified_until });
      }
    }

    const now = new Date();
    const badges: Record<string, NeedState> = {};
    for (const c of cases) {
      if (!c.pro_bono_request) continue;
      const account = accountByCase.get(c.id) ?? null;
      badges[c.id] = needState(account ? (byAccount.get(account) ?? null) : null, now);
    }
    return badges;
  });
