/**
 * Shared byte/storage helpers for the notes marketplace (#131-#203 family).
 * Extracted from materials.functions.ts so the draft/upload pipeline and the
 * checkout pipeline share one encoder, one naming scheme and one encryption
 * gate. Server-side only (uses Buffer/atob via base64 utilities).
 */

/**
 * Supabase error shape we care about across the server functions. `code`
 * (PostgREST SQLSTATE, e.g. "23505" unique_violation) is present on real
 * responses; typed optional so test doubles may omit it.
 */
export type DbError = { message: string; code?: string } | null;

/**
 * Fluent builder subset actually used by the marketplace server functions.
 * Mirrors the real Supabase builder: every filter method returns the builder
 * (which is itself a thenable), terminal methods resolve results.
 */
export type Rows<T> = {
  eq: (col: string, value: unknown) => Rows<T>;
  neq: (col: string, value: unknown) => Rows<T>;
  in: (col: string, values: unknown[]) => Rows<T>;
  /** #543 release sweep: hold_expires_at <= now. */
  lte: (col: string, value: unknown) => Rows<T>;
  order: (col: string, opts?: { ascending?: boolean; nullsLast?: boolean }) => Rows<T>;
  limit: (n: number) => Rows<T>;
  maybeSingle: () => Promise<{ data: T | null; error: DbError }>;
  single: () => Promise<{ data: T; error: DbError }>;
} & PromiseLike<{ data: T[] | null; error: DbError }>;

/**
 * supabase-js update builder subset: chained filters return the builder
 * (which is also thenable AND has .catch, bus.functions relies on it);
 * awaiting resolves {error, count} (count populated only when requested —
 * #387 review: the predicate+rowCount race guard).
 */
export type AdminUpdateChain = {
  eq: (col: string, value: unknown) => AdminUpdateChain;
  /** #543 release sweep: flip a batch of due orders in one statement. */
  in: (col: string, values: unknown[]) => AdminUpdateChain;
  /** #429 hold sweep: hold_until <= now flips expired holds to released. */
  lte: (col: string, value: unknown) => AdminUpdateChain;
  /** #429: PostgREST or-filter, e.g. "dispute_status.is.null,dispute_status.neq.open". */
  or: (filter: string) => AdminUpdateChain;
} & PromiseLike<{ error: DbError; count: number | null }> & {
    catch: (
      onrejected?: ((reason: unknown) => unknown) | null | undefined,
    ) => Promise<{ error: DbError; count: number | null }>;
  };

export type AdminTable<T> = {
  select: (cols: string) => Rows<T>;
  insert: (row: unknown) => {
    select: (cols: string) => { single: () => Promise<{ data: T; error: DbError }> };
  } & PromiseLike<{ data: T | null; error: DbError }>;
  update: (row: unknown, opts?: { count?: "exact" | "planned" | "estimated" }) => AdminUpdateChain;
  /** #392: folder/course child rows are delete+reinserted while drafts. */
  delete: () => AdminUpdateChain;
  /**
   * #392 course lessons: upsert on (material_id, position) so a re-save
   * never clobbers an uploaded pdf_path on an untouched lesson.
   */
  upsert: (
    row: unknown,
    opts?: { onConflict?: string; ignoreDuplicates?: boolean },
  ) => PromiseLike<{ data: T | null; error: DbError }>;
};

/** The service-role client, typed just enough for the marketplace fns. */
export type AdminDb = {
  from: <T>(table: string) => AdminTable<T>;
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error?: { message?: string } | null }>;
  storage: {
    from: (bucket: string) => {
      upload: (
        path: string,
        body: unknown,
        opts?: unknown,
      ) => Promise<{ error?: { message?: string } | null }>;
      remove: (paths: string[]) => Promise<{ error?: { message?: string } | null }>;
      createSignedUrl: (
        path: string,
        expiresInSeconds: number,
      ) => Promise<{
        data?: { signedUrl: string } | null;
        error?: { message?: string } | null;
      }>;
      getPublicUrl: (path: string) => { data?: { publicUrl: string } | null };
    };
  };
};

export function asAdminDb(client: unknown): AdminDb {
  return client as AdminDb;
}

export function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function cleanNamePart(value: string): string {
  return value
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 60);
}

/** Private-original path: materials/<stamp>-<Tutor> - <Title>.pdf (or .apkg, #314). */
export function buildMaterialStorageName(fileName: string, tutorLabel: string): string {
  const apkg = /\.apkg$/i.test(fileName);
  const base = fileName.replace(/\.(pdf|apkg)$/i, "");
  const slug = `${cleanNamePart(tutorLabel)} - ${cleanNamePart(base)}`.replace(/^ - | - $/g, "");
  const stamp = Date.now().toString(36);
  return `materials/${stamp}-${slug || "study-materials"}${apkg ? ".apkg" : ".pdf"}`;
}

/** Public preview path (mirrors the original's stamp so pairs stay greppable). */
export function previewPathFor(originalPath: string): string {
  return originalPath.replace(/^materials\//, "previews/");
}

/**
 * Parse a PDF with pdf-lib WITHOUT ignoreEncryption, password-protected
 * files throw, which the callers surface as P8's "upload an unlocked file".
 */
export async function assertPdfNotEncrypted(bytes: Uint8Array): Promise<number> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
  return doc.getPageCount();
}
