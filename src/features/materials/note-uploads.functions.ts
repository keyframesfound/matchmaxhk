import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAccountActive } from "@/lib/account-status-enforcement";
import { findContactViolations } from "@/lib/contact-filter";
import { asAdminDb, previewPathFor, type AdminDb } from "@/features/materials/storage-helpers";
import {
  loadOwnedMaterial,
  myTutorRow,
  stageFileBytesForMaterial,
} from "@/features/materials/note-drafts.functions";
import {
  classifyUploadFile,
  contentTypeForExtension,
  detectLinkProvider,
  isImportFetchHost,
  MAX_EXTRA_FILE_BYTES,
  MAX_EXTRA_FILES,
  MAX_LINKS,
  MAX_GALLERY_IMAGE_BYTES,
  MAX_GALLERY_IMAGES,
  MAX_MAIN_PDF_BYTES,
  publicExtraLabel,
  safeStorageSegment,
  toDirectImportUrl,
} from "@/features/materials/note-taxonomy";
import { sanitizePreviewIndices } from "@/features/materials/preview-pages";
import { anyOrderGrantsNoteAccess } from "@/features/materials/note-reviews";
import { watermarkPdfPreview } from "@/features/materials/watermark";

/**
 * Notes upload v2: large and multi-format uploads.
 *
 * Big files never pass through the Worker request body (Cloudflare caps it):
 * the server mints Supabase SIGNED UPLOAD URLs for the note's owner and the
 * browser uploads straight to Storage with a progress bar.
 *
 *  - main PDF (<= 50 MB, images are merged into it client-side) goes to the
 *    private materials-originals bucket under materials/u-<tutorId>/..., so
 *    attachNoteMainPdf can prove the path belongs to the caller;
 *  - extra files (Word / PPT / ZIP / video..., <= 2 GB each) go to the
 *    private materials-extras bucket under extras/<materialId>/...;
 *  - links (Google Drive / Docs / Dropbox / OneDrive) are stored as rows.
 *
 * Extras and links reach buyers only after purchase (getNoteDeliverables,
 * signed URLs, 1 hour).
 */

const ORIGINALS_BUCKET = "materials-originals";
const PREVIEWS_BUCKET = "materials-previews";
const EXTRAS_BUCKET = "materials-extras";
const DELIVERABLE_URL_SECONDS = 60 * 60;

type StorageV2 = {
  storage: {
    from: (bucket: string) => {
      createSignedUploadUrl: (path: string) => Promise<{
        data: { signedUrl: string; token: string; path: string } | null;
        error: { message?: string } | null;
      }>;
      download: (path: string) => Promise<{
        data: Blob | null;
        error: { message?: string } | null;
      }>;
      createSignedUrl: (
        path: string,
        expiresIn: number,
        options?: { download?: string | boolean },
      ) => Promise<{ data: { signedUrl: string } | null; error: { message?: string } | null }>;
      upload: (
        path: string,
        body: unknown,
        options?: unknown,
      ) => Promise<{ error: { message?: string } | null }>;
      remove: (paths: string[]) => Promise<{ error: { message?: string } | null }>;
      getPublicUrl: (path: string) => { data: { publicUrl: string } | null };
    };
  };
};

const asStorage = (client: unknown) => client as StorageV2;

/** Notes kinds only; folders / courses / gigs keep their own pipelines. */
const NOTE_KINDS = new Set(["notes", "mock", "exemplar", "flashcards"]);

function stamp(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function mainPdfPrefix(tutorId: string): string {
  return `materials/u-${tutorId}/`;
}

function isLive(status: string): boolean {
  return status === "published" || status === "hidden";
}

function hasPdfMagic(bytes: Uint8Array): boolean {
  return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
}

async function ownerContext(userId: string, materialId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const db = asAdminDb(supabaseAdmin);
  const tutor = await myTutorRow(db, userId);
  const material = await loadOwnedMaterial(db, materialId, tutor.id);
  if (!NOTE_KINDS.has(material.material_type)) {
    throw new Error("This upload flow is for notes listings only.");
  }
  return { db, storage: asStorage(supabaseAdmin), tutor, material };
}

// ---------------------------------------------------------------------------
// 1. Signed upload targets
// ---------------------------------------------------------------------------

const UploadTargetInput = z.object({
  materialId: z.string().uuid(),
  files: z
    .array(
      z.object({
        role: z.enum(["main", "extra", "gallery"]),
        fileName: z.string().trim().min(1).max(200),
        sizeBytes: z.number().int().min(1),
      }),
    )
    .min(1)
    .max(MAX_EXTRA_FILES + 1),
});

export type UploadTarget = {
  role: "main" | "extra" | "gallery";
  fileName: string;
  bucket: string;
  path: string;
  signedUrl: string;
  token: string;
};

export const createNoteUploadTargets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) => UploadTargetInput.parse(data))
  .handler(async ({ data, context }): Promise<UploadTarget[]> => {
    const { storage, tutor, material } = await ownerContext(context.userId, data.materialId);
    if (data.files.filter((f) => f.role === "main").length > 1) {
      throw new Error("Only one main PDF per note.");
    }
    const targets: UploadTarget[] = [];
    for (const file of data.files) {
      const format = classifyUploadFile(file.fileName);
      if (file.role === "gallery") {
        // #556 gallery: public watermarked preview images, 5 MB each.
        if (format !== "image") throw new Error("Gallery images must be JPG, PNG or WebP.");
        if (file.sizeBytes > MAX_GALLERY_IMAGE_BYTES) {
          throw new Error(`"${file.fileName}" is larger than 5 MB.`);
        }
        const path = `gallery/${material.id}/${stamp()}-${safeStorageSegment(file.fileName)}`;
        const { data: signed, error } = await storage.storage
          .from(PREVIEWS_BUCKET)
          .createSignedUploadUrl(path);
        if (error || !signed) throw new Error(error?.message || "Could not prepare the upload.");
        targets.push({
          role: "gallery",
          fileName: file.fileName,
          bucket: PREVIEWS_BUCKET,
          ...signed,
          path,
        });
        continue;
      }
      if (file.role === "main") {
        if (format !== "pdf") throw new Error("The main file must be a PDF.");
        if (file.sizeBytes > MAX_MAIN_PDF_BYTES) {
          throw new Error(
            "The main PDF is larger than 50 MB. Split it or add it as an extra file.",
          );
        }
        const path = `${mainPdfPrefix(tutor.id)}${stamp()}-${safeStorageSegment(file.fileName)}`;
        const { data: signed, error } = await storage.storage
          .from(ORIGINALS_BUCKET)
          .createSignedUploadUrl(path);
        if (error || !signed) throw new Error(error?.message || "Could not prepare the upload.");
        targets.push({
          role: "main",
          fileName: file.fileName,
          bucket: ORIGINALS_BUCKET,
          ...signed,
          path,
        });
      } else {
        if (!format || format === "link") {
          throw new Error(`"${file.fileName}" is not a supported file type.`);
        }
        if (file.sizeBytes > MAX_EXTRA_FILE_BYTES) {
          throw new Error(`"${file.fileName}" is larger than 2 GB.`);
        }
        const path = `extras/${material.id}/${stamp()}-${safeStorageSegment(file.fileName)}`;
        const { data: signed, error } = await storage.storage
          .from(EXTRAS_BUCKET)
          .createSignedUploadUrl(path);
        if (error || !signed) throw new Error(error?.message || "Could not prepare the upload.");
        targets.push({
          role: "extra",
          fileName: file.fileName,
          bucket: EXTRAS_BUCKET,
          ...signed,
          path,
        });
      }
    }
    return targets;
  });

// ---------------------------------------------------------------------------
// 2. Attach an uploaded main PDF (builds the watermarked preview)
// ---------------------------------------------------------------------------

const PreviewPick = z.array(z.number().int().min(0).max(5000)).max(200).nullable();

async function downloadPdf(storage: StorageV2, path: string): Promise<Uint8Array> {
  const { data, error } = await storage.storage.from(ORIGINALS_BUCKET).download(path);
  if (error || !data) throw new Error(error?.message || "The uploaded file was not found.");
  if (data.size > MAX_MAIN_PDF_BYTES) throw new Error("The main PDF is larger than 50 MB.");
  const bytes = new Uint8Array(await data.arrayBuffer());
  if (!hasPdfMagic(bytes)) throw new Error("That file is not a valid PDF.");
  return bytes;
}

export const attachNoteMainPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) =>
    z
      .object({
        materialId: z.string().uuid(),
        path: z.string().trim().min(10).max(400),
        fileName: z.string().trim().min(1).max(200),
        previewPageIndices: PreviewPick,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { db, storage, tutor, material } = await ownerContext(context.userId, data.materialId);
    // The path must be one this tutor's signed upload produced.
    if (!data.path.startsWith(mainPdfPrefix(tutor.id)) || data.path.includes("..")) {
      throw new Error("Upload path does not belong to this account.");
    }
    const bytes = await downloadPdf(storage, data.path);
    const result = await stageFileBytesForMaterial(
      db,
      tutor,
      material,
      data.fileName.toLowerCase().endsWith(".pdf") ? data.fileName : `${data.fileName}.pdf`,
      bytes,
      { storedPath: data.path, previewPageIndices: data.previewPageIndices },
    );
    return result;
  });

// ---------------------------------------------------------------------------
// 3. Import a public PDF from Google Drive / Docs / Dropbox
// ---------------------------------------------------------------------------

/** Fetch with manual redirects, every hop re-checked against the allowlist. */
async function fetchAllowlisted(startUrl: string): Promise<Response> {
  let url = startUrl;
  for (let hop = 0; hop < 6; hop += 1) {
    if (!isImportFetchHost(url)) throw new Error("This link host is not allowed for import.");
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(45_000),
      headers: { "User-Agent": "MatchMax-NotesImport/1.0" },
    });
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      if (!next) throw new Error("The link redirected nowhere.");
      url = new URL(next, url).toString();
      continue;
    }
    return response;
  }
  throw new Error("Too many redirects while importing the link.");
}

async function readCapped(response: Response, cap: number): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (declared > cap) throw new Error("The linked file is larger than 50 MB.");
  if (!response.body) return new Uint8Array(await response.arrayBuffer());
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > cap) {
      await reader.cancel();
      throw new Error("The linked file is larger than 50 MB.");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

export const importNotePdfFromLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) =>
    z
      .object({
        materialId: z.string().uuid(),
        url: z.string().trim().url().max(2000),
        previewPageIndices: PreviewPick,
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { db, storage, tutor, material } = await ownerContext(context.userId, data.materialId);
    const direct = toDirectImportUrl(data.url);
    if (!direct) {
      throw new Error(
        "Only public Google Drive files, Google Docs/Slides/Sheets and Dropbox file links can be imported. Add other links as a deliverable link instead.",
      );
    }
    const response = await fetchAllowlisted(direct);
    if (!response.ok) {
      throw new Error(
        `Could not download the link (${response.status}). Make sure sharing is set to "Anyone with the link".`,
      );
    }
    const bytes = await readCapped(response, MAX_MAIN_PDF_BYTES);
    if (!hasPdfMagic(bytes)) {
      throw new Error(
        'The link did not return a PDF. Set sharing to "Anyone with the link", or download it and upload the file.',
      );
    }
    const path = `${mainPdfPrefix(tutor.id)}${stamp()}-imported.pdf`;
    const { error } = await storage.storage
      .from(ORIGINALS_BUCKET)
      .upload(path, bytes, { contentType: "application/pdf" });
    if (error) throw new Error(error.message || "Could not store the imported file.");
    const result = await stageFileBytesForMaterial(db, tutor, material, "imported.pdf", bytes, {
      storedPath: path,
      previewPageIndices: data.previewPageIndices,
    });
    // The owner gets a short-lived link to the imported original so the form
    // can render page thumbnails and run AI detection on it.
    const { data: signed } = await storage.storage
      .from(ORIGINALS_BUCKET)
      .createSignedUrl(path, 15 * 60);
    return { ...result, ownerFileUrl: signed?.signedUrl ?? null };
  });

// ---------------------------------------------------------------------------
// 4. Re-pick preview pages on a draft / pending / rejected note
// ---------------------------------------------------------------------------

export const updateNotePreviewPages = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) =>
    z
      .object({
        materialId: z.string().uuid(),
        previewPageIndices: z.array(z.number().int().min(0).max(5000)).min(1).max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { db, storage, material } = await ownerContext(context.userId, data.materialId);
    if (isLive(material.status)) {
      throw new Error("Preview pages of a live note change together with a new file upload.");
    }
    if (!material.original_file_path || !/\.pdf$/i.test(material.original_file_path)) {
      throw new Error("Upload the main PDF first.");
    }
    const bytes = await downloadPdf(storage, material.original_file_path);
    const { PDFDocument } = await import("pdf-lib");
    const pageCount = (await PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount();
    const indices = sanitizePreviewIndices(data.previewPageIndices, pageCount);
    const { bytes: previewBytes, pageCount: previewPages } = await watermarkPdfPreview(bytes, {
      pageLimit: indices.length,
      pageIndices: indices,
    });

    const { data: current } = await db
      .from<{ watermarked_preview_url: string | null }>("digital_materials")
      .select("watermarked_preview_url")
      .eq("id", material.id)
      .maybeSingle();
    const previewPath = previewPathFor(material.original_file_path).replace(
      /\.pdf$/i,
      `-p${stamp()}.pdf`,
    );
    const { error: uploadError } = await storage.storage
      .from(PREVIEWS_BUCKET)
      .upload(previewPath, previewBytes, { contentType: "application/pdf" });
    if (uploadError) throw new Error(uploadError.message || "Could not save the preview.");
    const publicUrl = storage.storage.from(PREVIEWS_BUCKET).getPublicUrl(previewPath)
      .data?.publicUrl;
    const { error } = await db
      .from<never>("digital_materials")
      .update({
        watermarked_preview_url: publicUrl ?? "",
        preview_pages: previewPages,
        preview_page_indices: indices,
      })
      .eq("id", material.id);
    if (error) throw new Error(error.message);

    // Best effort: drop the replaced preview object.
    const oldUrl = current?.watermarked_preview_url ?? "";
    const marker = `/${PREVIEWS_BUCKET}/`;
    const oldPath = oldUrl.includes(marker) ? oldUrl.split(marker)[1] : "";
    if (oldPath && oldPath !== previewPath) {
      await storage.storage
        .from(PREVIEWS_BUCKET)
        .remove([decodeURIComponent(oldPath)])
        .catch(() => undefined);
    }
    return { previewPages, indices };
  });

// ---------------------------------------------------------------------------
// 5. Extra files + links
// ---------------------------------------------------------------------------

type MaterialFileRow = {
  id: string;
  material_id: string;
  kind: "file" | "link";
  storage_path: string | null;
  url: string | null;
  file_name: string | null;
  label: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  format: string | null;
  position: number;
};

export type NoteExtra = {
  id: string;
  kind: "file" | "link";
  fileName: string | null;
  label: string | null;
  sizeBytes: number | null;
  format: string | null;
  /** Owner view: the storage path / pasted URL. Buyer view: a signed URL. */
  path: string | null;
  url: string | null;
};

function assertNoContactDetails(text: string | null | undefined, field: string) {
  if (!text) return;
  const violations = findContactViolations(text);
  if (violations.length > 0) {
    throw new Error(
      `${field} contains contact details (${violations
        .map((v) => v.match)
        .slice(0, 2)
        .join(", ")}). Rename it to save.`,
    );
  }
}

const ExtrasInput = z.object({
  materialId: z.string().uuid(),
  files: z
    .array(
      z.object({
        path: z.string().trim().min(5).max(400),
        fileName: z.string().trim().min(1).max(200),
        sizeBytes: z.number().int().min(0).max(MAX_EXTRA_FILE_BYTES),
        label: z.string().trim().max(120).nullish(),
      }),
    )
    .max(MAX_EXTRA_FILES),
  links: z
    .array(
      z.object({
        url: z.string().trim().url().max(2000),
        label: z.string().trim().max(120).nullish(),
      }),
    )
    .max(MAX_LINKS),
});

async function readExtras(db: AdminDb, materialId: string): Promise<MaterialFileRow[]> {
  const { data, error } = await db
    .from<MaterialFileRow>("material_files")
    .select(
      "id, material_id, kind, storage_path, url, file_name, label, mime_type, size_bytes, format, position",
    )
    .eq("material_id", materialId)
    .order("position", { ascending: true });
  if (error) {
    if (error.code === "42P01") return [];
    throw new Error(error.message);
  }
  return data ?? [];
}

/** Replace the note's extra files + links (draft / pending / rejected only). */
export const saveNoteExtras = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) => ExtrasInput.parse(data))
  .handler(async ({ data, context }) => {
    const { db, storage, material } = await ownerContext(context.userId, data.materialId);
    if (isLive(material.status)) {
      throw new Error(
        "Extra files of a live note cannot change without review. Contact staff to update them.",
      );
    }
    const prefix = `extras/${material.id}/`;
    for (const file of data.files) {
      if (!file.path.startsWith(prefix) || file.path.includes("..")) {
        throw new Error("Upload path does not belong to this note.");
      }
      if (!classifyUploadFile(file.fileName)) {
        throw new Error(`"${file.fileName}" is not a supported file type.`);
      }
      // File names and labels are shown publicly under "What's included":
      // same contact filter as every other public listing field.
      assertNoContactDetails(file.fileName, "File name");
      assertNoContactDetails(file.label, "File label");
    }
    for (const link of data.links) {
      assertNoContactDetails(link.label, "Link label");
      if (!detectLinkProvider(link.url)) {
        throw new Error(
          "Links must be https Google Drive, Google Docs, Dropbox or OneDrive share links.",
        );
      }
    }

    const existing = await readExtras(db, material.id);
    const keepPaths = new Set(data.files.map((f) => f.path));
    const removedPaths = existing
      .filter((row) => row.kind === "file" && row.storage_path && !keepPaths.has(row.storage_path))
      .map((row) => row.storage_path as string);

    const { error: deleteError } = await db
      .from<never>("material_files")
      .delete()
      .eq("material_id", material.id);
    if (deleteError) throw new Error(deleteError.message);

    const rows = [
      ...data.files.map((file, index) => ({
        material_id: material.id,
        kind: "file",
        storage_path: file.path,
        url: null,
        file_name: file.fileName,
        label: file.label || null,
        mime_type: contentTypeForExtension(file.fileName),
        size_bytes: file.sizeBytes,
        format: classifyUploadFile(file.fileName),
        position: index,
      })),
      ...data.links.map((link, index) => ({
        material_id: material.id,
        kind: "link",
        storage_path: null,
        url: link.url,
        file_name: null,
        label: link.label || null,
        mime_type: null,
        size_bytes: null,
        format: detectLinkProvider(link.url),
        position: data.files.length + index,
      })),
    ];
    if (rows.length > 0) {
      const { error } = await db.from<never>("material_files").insert(rows);
      if (error) throw new Error(error.message);
    }
    if (removedPaths.length > 0) {
      await storage.storage
        .from(EXTRAS_BUCKET)
        .remove(removedPaths)
        .catch(() => undefined);
    }
    return { count: rows.length };
  });

function toExtra(row: MaterialFileRow): NoteExtra {
  return {
    id: row.id,
    kind: row.kind,
    fileName: row.file_name,
    label: row.label,
    sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
    format: row.format,
    path: row.storage_path,
    url: row.url,
  };
}

/** The owner's own extras (edit form). */
export const getNoteExtrasForOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ materialId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<NoteExtra[]> => {
    const { db, material } = await ownerContext(context.userId, data.materialId);
    return (await readExtras(db, material.id)).map(toExtra);
  });

/** Public: what formats a note ships with (names + sizes, never paths or URLs). */
export const getNoteExtrasSummary = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ materialId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const { data: material } = await db
      .from<{ id: string; status: string }>("digital_materials")
      .select("id, status")
      .eq("id", data.materialId)
      .maybeSingle();
    if (!material || material.status !== "published") return [];
    return (await readExtras(db, data.materialId)).map((row) => ({
      kind: row.kind,
      format: row.format,
      // Defense in depth for rows saved before the filter: a name with
      // contact details is never shown (the UI falls back to the format).
      label: publicExtraLabel(row.label ?? row.file_name ?? null),
      sizeBytes: row.size_bytes == null ? null : Number(row.size_bytes),
    }));
  });

/**
 * Buyer deliverables: signed download URLs for extra files plus the links,
 * only for the owner or a buyer whose order grants access.
 */
export const getNoteDeliverables = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ materialId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ hasAccess: boolean; extras: NoteExtra[] }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = asAdminDb(supabaseAdmin);
    const storage = asStorage(supabaseAdmin);

    const { data: material } = await db
      .from<{ id: string; tutor_id: string }>("digital_materials")
      .select("id, tutor_id")
      .eq("id", data.materialId)
      .maybeSingle();
    if (!material) return { hasAccess: false, extras: [] };

    const { data: owner } = await db
      .from<{ id: string }>("tutors")
      .select("id")
      .eq("id", material.tutor_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    let hasAccess = Boolean(owner);
    if (!hasAccess) {
      const { data: orders } = await db
        .from<{ status: string; refund_amount: number | null; gross_hkd: number }>(
          "material_orders",
        )
        .select("status, refund_amount, gross_hkd")
        .eq("material_id", material.id)
        .eq("buyer_account_id", context.userId);
      hasAccess = anyOrderGrantsNoteAccess(orders ?? []);
    }
    if (!hasAccess) return { hasAccess: false, extras: [] };

    const rows = await readExtras(db, material.id);
    const extras: NoteExtra[] = [];
    for (const row of rows) {
      if (row.kind === "link") {
        extras.push({ ...toExtra(row), path: null });
        continue;
      }
      if (!row.storage_path) continue;
      const { data: signed } = await storage.storage
        .from(EXTRAS_BUCKET)
        .createSignedUrl(row.storage_path, DELIVERABLE_URL_SECONDS, {
          download: row.file_name ?? true,
        });
      extras.push({ ...toExtra(row), path: null, url: signed?.signedUrl ?? null });
    }
    return { hasAccess: true, extras };
  });

/** The owner's own main PDF (short-lived signed URL) for page thumbnails / AI. */
export const getNoteOriginalUrlForOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => z.object({ materialId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }): Promise<{ url: string | null }> => {
    const { storage, material } = await ownerContext(context.userId, data.materialId);
    const path = material.original_file_path;
    if (!path || !/\.pdf$/i.test(path)) return { url: null };
    const { data: signed } = await storage.storage
      .from(ORIGINALS_BUCKET)
      .createSignedUrl(path, 15 * 60);
    return { url: signed?.signedUrl ?? null };
  });

/** #556: set the listing's gallery (1-5 public preview images, in order). */
export const saveNoteGallery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth, requireAccountActive])
  .inputValidator((data: unknown) =>
    z
      .object({
        materialId: z.string().uuid(),
        paths: z.array(z.string().trim().min(5).max(400)).max(MAX_GALLERY_IMAGES),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { db, storage, material } = await ownerContext(context.userId, data.materialId);
    const prefix = `gallery/${material.id}/`;
    for (const path of data.paths) {
      if (!path.startsWith(prefix) || path.includes("..")) {
        throw new Error("Image path does not belong to this note.");
      }
    }
    const { data: current } = await db
      .from<{ preview_image_paths: string[] | null }>("digital_materials")
      .select("preview_image_paths")
      .eq("id", material.id)
      .maybeSingle();
    const { error } = await db
      .from<never>("digital_materials")
      .update({ preview_image_paths: data.paths })
      .eq("id", material.id);
    if (error) {
      if (error.code === "42703") throw new Error("Gallery images open after the next update.");
      throw new Error(error.message);
    }
    const removed = (current?.preview_image_paths ?? []).filter((p) => !data.paths.includes(p));
    if (removed.length > 0) {
      await storage.storage
        .from(PREVIEWS_BUCKET)
        .remove(removed)
        .catch(() => undefined);
    }
    return { count: data.paths.length };
  });
