/**
 * Issue #785 AC-CONV-5 / AC-CONV-4 — the one browser-side upload path for a case
 * file, shared by the Files tray and the coaching-note attachment.
 *
 * The upload is signed: the server mints a path and token, the browser PUTs the
 * bytes straight into the private `case-files` bucket, then registers the row.
 * Nothing is base64'd through a server fn, so a 50 MB file never becomes 67 MB
 * of JSON inside a Worker isolate.
 */

import { caseFileError, type CaseFileCategory } from "@/features/cases/case-files";
import { createCaseFileUpload, recordCaseFile } from "@/features/cases/case-files.functions";

export const CASE_FILE_ACCEPT = "application/pdf,image/jpeg,image/png,.docx,.pptx";

/** Browsers hand back an empty `type` for some Office files, so fall back to the extension. */
const EXT_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

export function contentTypeFor(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TYPE[ext] ?? "";
}

export type CaseFileUploadInput = {
  caseId: string;
  file: File;
  category: CaseFileCategory;
  /** #785 AC-CONV-4: attach this file to one lesson's coaching note. */
  lessonId?: string;
};

/**
 * Validates locally first so the message lands before any bytes move, then mints
 * the target, uploads and records. Throws `Error` with a `case_files.err_*` code.
 */
export async function uploadCaseFile(input: CaseFileUploadInput): Promise<void> {
  const meta = {
    caseId: input.caseId,
    name: input.file.name,
    contentType: contentTypeFor(input.file),
    size: input.file.size,
    category: input.category,
  };
  // Same rules the server enforces.
  const invalid = caseFileError(meta);
  if (invalid) throw new Error(invalid);

  const { path, token } = await createCaseFileUpload({
    data: input.lessonId ? { ...meta, lessonId: input.lessonId } : meta,
  });
  const { supabase } = await import("@/integrations/supabase/client");
  const { error } = await supabase.storage
    .from("case-files")
    .uploadToSignedUrl(path, token, input.file);
  if (error) throw error;

  // `path` comes from the upload target; the rest is the metadata the user saw.
  await recordCaseFile({
    data: input.lessonId ? { ...meta, path, lessonId: input.lessonId } : { ...meta, path },
  });
}
