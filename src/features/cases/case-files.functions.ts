/**
 * Issue #785 AC-CONV-5 — case file uploads, server half.
 *
 * Uploads are SIGNED, not base64: a 50 MB file is ~67 MB of base64 JSON, which
 * is the wrong shape inside a 128 MB Worker isolate. The browser asks for a
 * signed upload target, PUTs the bytes straight to the private `case-files`
 * bucket, then registers the row here.
 *
 *  - createCaseFileUpload: party-gated, runs the pure 50 MB / allowlist rules,
 *    mints a token for `<caseId>/<stamp>-<rand>-<name>` and inserts nothing;
 *  - recordCaseFile: re-checks the party and the pure rules, reads the stored
 *    object's real size/content-type so the client cannot register a 500 MB
 *    object as "PDF, 50 KB", runs the contraband scan, then inserts the row
 *    (removing the object if the insert fails);
 *  - listCaseFiles: party-gated, signed reads (10 min), never `file_path` or
 *    `uploaded_by`, null for non-parties;
 *  - deleteCaseFile: uploader, matched tutor or Ops; object first, then row.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { asAdminDb } from "@/features/materials/storage-helpers";
import { selectRows, type Db } from "@/features/cases/desk-db";
import {
  CASE_FILE_CATEGORIES,
  caseFileError,
  caseFileStoragePath,
  type CaseFileCategory,
} from "@/features/cases/case-files";
import { canCreateMaterial } from "@/features/cases/homework";

const BUCKET = "case-files";
/** 10 minutes — long enough to open a PDF, short enough to not leak. */
const SIGNED_URL_SECONDS = 600;
const MAX_FILES = 100;

type CaseRow = {
  id: string;
  parent_id: string | null;
  student_id: string | null;
  matched_tutor_id: string | null;
};

type CaseFileRole = "ops" | "learner" | "tutor";

type CaseFileAccess = { kase: CaseRow; role: CaseFileRole };

type CaseFileRow = {
  id: string;
  case_id: string;
  file_path: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  category: CaseFileCategory;
  uploaded_by: string;
  created_at: string;
};

const FILE_COLUMNS =
  "id, case_id, file_path, file_name, content_type, size_bytes, category, uploaded_by, created_at";

/**
 * The service-role client's storage surface for this flow. createSignedUploadUrl
 * / info / list are not on the structural AdminDb storage type, so they are
 * declared here the way note-uploads.functions.ts does.
 */
type CaseFileStorage = {
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

async function storageClient(): Promise<CaseFileStorage> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as unknown as CaseFileStorage;
}

async function isOps(db: Db, userId: string): Promise<boolean> {
  for (const role of ["staff", "admin", "super_admin"] as const) {
    const { data } = await db.rpc("has_role", { _user_id: userId, _role: role });
    if (data === true) return true;
  }
  return false;
}

/**
 * Resolve the caller against the case. null = not a party; reads turn that into
 * null and writes into CASE_NOT_FOUND, so an unrelated tutor cannot tell
 * "exists" from "forbidden".
 */
async function loadAccess(db: Db, caseId: string, userId: string): Promise<CaseFileAccess | null> {
  const cases = await selectRows<CaseRow>(
    db,
    "tutoring_cases",
    "id, parent_id, student_id, matched_tutor_id",
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

  const tutorUserId = kase.matched_tutor_id
    ? ((
        await selectRows<{ user_id: string | null }>(db, "tutors", "user_id", [
          { col: "id", op: "eq", value: kase.matched_tutor_id },
        ])
      )[0]?.user_id ?? null)
    : null;

  if (await isOps(db, userId)) return { kase, role: "ops" };
  if (userId === kase.parent_id || userId === studentOwner) return { kase, role: "learner" };
  if (tutorUserId && userId === tutorUserId) return { kase, role: "tutor" };
  return null;
}

/** Uploads and reads are allowed to every party of the case (learner, tutor, Ops). */
function requireParty(access: CaseFileAccess | null): CaseFileAccess {
  if (!access) throw new Error("CASE_NOT_FOUND");
  return access;
}

/**
 * #785 AC-CONV-3: the tutor and Ops file anywhere; a learner only pre-class and
 * post-class material. Checked at target minting as well as at record time, so a
 * learner cannot spend a 50 MB upload before being refused.
 */
function requireCategory(
  access: CaseFileAccess,
  category: CaseFileCategory | undefined,
): CaseFileCategory {
  const effective = category ?? "general";
  if (!canCreateMaterial(access.role, effective)) throw new Error("CATEGORY_FORBIDDEN");
  return effective;
}

/** The case folder is the ownership scope: a path may never leave it. */
function ownedPath(caseId: string, path: string): boolean {
  return path.startsWith(`${caseId}/`) && !path.includes("..") && !path.includes("\\");
}

function normalizedType(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().split(";")[0].trim();
}

/** Backends report these when the browser sent no type — not a mismatch. */
const GENERIC_TYPES = new Set(["application/octet-stream", "binary/octet-stream", ""]);

type StoredObject = { size: number | null; contentType: string | null };

/**
 * The stored object's real metadata: `info` when the storage backend exposes it,
 * else a `list` of the case folder matched by exact file name. null = no object.
 */
async function readStoredObject(
  storage: CaseFileStorage,
  path: string,
): Promise<StoredObject | null> {
  const bucket = storage.storage.from(BUCKET);
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
  const listed = await bucket.list(folder, { limit: MAX_FILES, search: fileName });
  if (listed.error) throw new Error(listed.error.message || "FILE_TYPE");
  const found = (listed.data ?? []).find((entry) => entry.name === fileName);
  if (!found) return null;
  const size = typeof found.metadata?.size === "number" ? found.metadata.size : null;
  const mimetype = found.metadata?.mimetype;
  return { size, contentType: typeof mimetype === "string" && mimetype ? mimetype : null };
}

async function signedUrl(storage: CaseFileStorage, path: string): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await storage.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_SECONDS);
  return error || !data?.signedUrl ? null : data.signedUrl;
}

/** Remove a stored object; the caller decides whether the failure is fatal. */
async function removeObject(storage: CaseFileStorage, path: string): Promise<string | null> {
  const { error } = await storage.storage.from(BUCKET).remove([path]);
  return error ? (error.message ?? "remove failed") : null;
}

/** Size is deliberately unbounded here so the pure rules own the error codes. */
const FileMeta = {
  name: z.string().trim().min(1).max(200),
  contentType: z.string().trim().min(3).max(120),
  size: z.number(),
} as const;

const UploadTargetSchema = z.object({
  caseId: z.string().uuid(),
  ...FileMeta,
  category: z.enum(CASE_FILE_CATEGORIES).optional(),
});

export type CaseFileUploadTarget = {
  /** Path inside the private `case-files` bucket, always `<caseId>/…`. */
  path: string;
  /** Upload token for `uploadToSignedUrl(path, token, file)` — never logged. */
  token: string;
};

/**
 * Mint a signed upload target. No row is written here: the object only becomes
 * a case file when recordCaseFile verifies it.
 */
export const createCaseFileUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => UploadTargetSchema.parse(input))
  .handler(async ({ context, data }): Promise<CaseFileUploadTarget> => {
    const failure = caseFileError(data);
    if (failure) throw new Error(failure);

    const db = await adminDb();
    requireCategory(requireParty(await loadAccess(db, data.caseId, context.userId)), data.category);

    const path = caseFileStoragePath(
      data.caseId,
      data.name,
      Date.now(),
      Math.random().toString(36).slice(2, 10),
    );
    const storage = await storageClient();
    const { data: signed, error } = await storage.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error || !signed) throw new Error(error?.message || "UPLOAD_UNAVAILABLE");

    // Only the path + token travel: the signed URL embeds credentials.
    return { path: signed.path || path, token: signed.token };
  });

const RecordSchema = z.object({
  caseId: z.string().uuid(),
  path: z.string().trim().min(3).max(400),
  ...FileMeta,
  category: z.enum(CASE_FILE_CATEGORIES).optional(),
});

/**
 * Register an uploaded object as a case file. The row is only written once the
 * stored object's real size (and, when the backend reports one, its content
 * type) matches the declaration.
 */
export const recordCaseFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) => RecordSchema.parse(input))
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const failure = caseFileError(data);
    if (failure) throw new Error(failure);
    if (!ownedPath(data.caseId, data.path)) throw new Error("FILE_TYPE");

    const db = await adminDb();
    const access = requireParty(await loadAccess(db, data.caseId, context.userId));
    const category = requireCategory(access, data.category);

    // #782 §2.3: banned terms / dangerous file types are rejected, never dropped.
    const { assertNoContraband } = await import("@/features/trust/contraband.server");
    await assertNoContraband(context.userId, "recordCaseFile", {
      name: data.name,
      contentType: data.contentType,
      category,
    });

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

    const { error, data: inserted } = await db
      .from<{ id: string }>("case_files")
      .insert({
        case_id: data.caseId,
        file_path: data.path,
        file_name: data.name,
        content_type: normalizedType(data.contentType),
        size_bytes: data.size,
        category,
        uploaded_by: context.userId,
      })
      .select("id")
      .single();
    if (error) {
      // Do not leave an unregistered object behind.
      const cleanup = await removeObject(storage, data.path);
      if (cleanup) console.warn("[case-files] orphan cleanup failed:", cleanup);
      throw new Error(error.message);
    }
    return { id: String(inserted.id) };
  });

export type CaseFileItem = {
  id: string;
  name: string;
  contentType: string;
  sizeBytes: number;
  category: CaseFileCategory;
  createdAt: string;
  /** Signed read URL (10 min) or null when the object is gone. */
  url: string | null;
};

/**
 * The Files modal's read. Never returns `file_path` or `uploaded_by`; a
 * non-party gets null, not an error, so case existence does not leak.
 */
export const listCaseFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ caseId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<CaseFileItem[] | null> => {
    const db = await adminDb();
    const access = await loadAccess(db, data.caseId, context.userId);
    if (!access) return null;

    const rows = await selectRows<CaseFileRow>(
      db,
      "case_files",
      FILE_COLUMNS,
      [{ col: "case_id", op: "eq", value: data.caseId }],
      { col: "created_at", asc: false, limit: MAX_FILES },
    );

    const storage = await storageClient();
    return Promise.all(
      rows.map(async (row) => ({
        id: row.id,
        name: row.file_name,
        contentType: row.content_type,
        sizeBytes: row.size_bytes,
        category: row.category,
        createdAt: row.created_at,
        url: await signedUrl(storage, row.file_path),
      })),
    );
  });

/** Uploader, matched tutor or Ops. A learner may only remove their own upload. */
function canRemove(access: CaseFileAccess, row: CaseFileRow, userId: string): boolean {
  if (access.role === "ops" || access.role === "tutor") return true;
  return row.uploaded_by === userId;
}

export const deleteCaseFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((input: unknown) =>
    z.object({ caseId: z.string().uuid(), fileId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const db = await adminDb();
    const access = requireParty(await loadAccess(db, data.caseId, context.userId));

    const rows = await selectRows<CaseFileRow>(db, "case_files", FILE_COLUMNS, [
      { col: "id", op: "eq", value: data.fileId },
    ]);
    const row = rows[0];
    if (!row || row.case_id !== data.caseId) throw new Error("FILE_NOT_FOUND");
    if (!canRemove(access, row, context.userId)) throw new Error("FORBIDDEN");

    // Object first: a failed removal leaves the row (and the file) intact so the
    // user can retry, instead of a row pointing at nothing.
    const storage = await storageClient();
    const removal = await removeObject(storage, row.file_path);
    if (removal) throw new Error(removal);

    const { error } = await db.from<CaseFileRow>("case_files").delete().eq("id", row.id);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
