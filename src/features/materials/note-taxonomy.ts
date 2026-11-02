import { findContactViolations } from "@/lib/contact-filter";

/**
 * Notes upload v2: the finer note categories, document languages, accepted
 * upload formats and the external-link rules. Pure data + helpers, shared by
 * the upload form, the shop filters, the search index and the server fns.
 */

export type NoteSubcategory = {
  /** Stored value (digital_materials.subcategory). */
  value: string;
  /** i18n key under notes.subcategory.* */
  labelKey: string;
};

const sub = (value: string): NoteSubcategory => ({
  value,
  labelKey: `notes.subcategory.${value}`,
});

/**
 * Per-curriculum subcategories (Carousell / Taobao style second level).
 * "general" is the catch-all every curriculum carries.
 */
export const NOTE_SUBCATEGORIES: Record<string, NoteSubcategory[]> = {
  IB: [
    sub("ia"),
    sub("ee"),
    sub("tok"),
    sub("paper_1"),
    sub("paper_2"),
    sub("paper_3"),
    sub("revision_notes"),
    sub("past_paper_practice"),
    sub("formula_sheet"),
    sub("general"),
  ],
  DSE: [
    sub("paper_1"),
    sub("paper_2"),
    sub("sba"),
    sub("elective"),
    sub("revision_notes"),
    sub("past_paper_practice"),
    sub("vocab_essay"),
    sub("formula_sheet"),
    sub("general"),
  ],
  IGCSE: [
    sub("paper_1"),
    sub("paper_2"),
    sub("paper_3"),
    sub("paper_4"),
    sub("coursework"),
    sub("revision_notes"),
    sub("past_paper_practice"),
    sub("formula_sheet"),
    sub("general"),
  ],
  "A-Level": [
    sub("as_level"),
    sub("a2_level"),
    sub("paper_1"),
    sub("paper_2"),
    sub("paper_3"),
    sub("coursework"),
    sub("revision_notes"),
    sub("past_paper_practice"),
    sub("formula_sheet"),
    sub("general"),
  ],
  Other: [
    sub("revision_notes"),
    sub("past_paper_practice"),
    sub("formula_sheet"),
    sub("coursework"),
    sub("general"),
  ],
};

export const ALL_SUBCATEGORY_VALUES: string[] = Array.from(
  new Set(Object.values(NOTE_SUBCATEGORIES).flatMap((list) => list.map((s) => s.value))),
);

export function getSubcategoriesForCurriculum(curriculum: string | null | undefined) {
  return NOTE_SUBCATEGORIES[(curriculum ?? "").trim()] ?? NOTE_SUBCATEGORIES.Other;
}

export function isValidSubcategory(
  curriculum: string | null | undefined,
  value: string | null | undefined,
): boolean {
  if (!value) return true;
  return getSubcategoriesForCurriculum(curriculum).some((s) => s.value === value);
}

/** Language of the document itself (not the UI language). */
export const CONTENT_LANGUAGES = ["en", "zh-Hant", "zh-Hans", "mixed"] as const;
export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number];

export function isContentLanguage(value: unknown): value is ContentLanguage {
  return typeof value === "string" && (CONTENT_LANGUAGES as readonly string[]).includes(value);
}

// ---------------------------------------------------------------------------
// Upload formats
// ---------------------------------------------------------------------------

/** Main PDF (watermarked preview source), after images are merged into it. */
export const MAX_MAIN_PDF_BYTES = 50 * 1024 * 1024;
/** Each extra deliverable file (Word, PPT, ZIP, video...). */
export const MAX_EXTRA_FILE_BYTES = 2 * 1024 * 1024 * 1024;
export const MAX_EXTRA_FILES = 10;
export const MAX_LINKS = 10;
export const MAX_IMAGES_TO_MERGE = 80;

export type UploadFormat =
  | "pdf"
  | "image"
  | "word"
  | "powerpoint"
  | "excel"
  | "zip"
  | "video"
  | "audio"
  | "apkg"
  | "text"
  | "link";

const EXTENSION_FORMATS: Record<string, UploadFormat> = {
  pdf: "pdf",
  png: "image",
  jpg: "image",
  jpeg: "image",
  webp: "image",
  gif: "image",
  heic: "image",
  heif: "image",
  bmp: "image",
  doc: "word",
  docx: "word",
  odt: "word",
  rtf: "word",
  pages: "word",
  ppt: "powerpoint",
  pptx: "powerpoint",
  odp: "powerpoint",
  key: "powerpoint",
  xls: "excel",
  xlsx: "excel",
  csv: "excel",
  ods: "excel",
  numbers: "excel",
  zip: "zip",
  rar: "zip",
  "7z": "zip",
  mp4: "video",
  mov: "video",
  m4v: "video",
  webm: "video",
  mkv: "video",
  avi: "video",
  mp3: "audio",
  m4a: "audio",
  wav: "audio",
  apkg: "apkg",
  txt: "text",
  md: "text",
  tex: "text",
};

export function fileExtension(fileName: string): string {
  const match = /\.([A-Za-z0-9]+)$/.exec(fileName.trim());
  return match ? match[1].toLowerCase() : "";
}

/** Classify an uploaded file by extension (null = not accepted). */
export function classifyUploadFile(fileName: string): UploadFormat | null {
  return EXTENSION_FORMATS[fileExtension(fileName)] ?? null;
}

/** Images the browser can merge into the main PDF. */
export function isMergeableImage(fileName: string): boolean {
  return classifyUploadFile(fileName) === "image";
}

/** The `accept` attribute for the multi-format picker. */
export const UPLOAD_ACCEPT = Object.keys(EXTENSION_FORMATS)
  .map((ext) => `.${ext}`)
  .join(",");

export function contentTypeForExtension(fileName: string): string {
  const ext = fileExtension(fileName);
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ppt: "application/vnd.ms-powerpoint",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    zip: "application/zip",
    rar: "application/vnd.rar",
    "7z": "application/x-7z-compressed",
    mp4: "video/mp4",
    mov: "video/quicktime",
    m4v: "video/x-m4v",
    webm: "video/webm",
    mkv: "video/x-matroska",
    avi: "video/x-msvideo",
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    wav: "audio/wav",
    txt: "text/plain",
    md: "text/markdown",
    tex: "application/x-tex",
    apkg: "application/octet-stream",
  };
  return map[ext] ?? "application/octet-stream";
}

/** Safe object name segment for storage paths. */
export function safeStorageSegment(fileName: string): string {
  const ext = fileExtension(fileName);
  const base = fileName
    .replace(/\.[A-Za-z0-9]+$/, "")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${base || "file"}${ext ? `.${ext}` : ""}`;
}

// ---------------------------------------------------------------------------
// External links
// ---------------------------------------------------------------------------

export type LinkProvider = "google_drive" | "google_docs" | "dropbox" | "onedrive";

const LINK_HOSTS: { provider: LinkProvider; hosts: string[] }[] = [
  { provider: "google_docs", hosts: ["docs.google.com"] },
  { provider: "google_drive", hosts: ["drive.google.com"] },
  { provider: "dropbox", hosts: ["www.dropbox.com", "dropbox.com", "dl.dropboxusercontent.com"] },
  {
    provider: "onedrive",
    hosts: ["onedrive.live.com", "1drv.ms", "sharepoint.com"],
  },
];

/** Which cloud provider a pasted link belongs to (null = not allowed). */
export function detectLinkProvider(rawUrl: string): LinkProvider | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  for (const entry of LINK_HOSTS) {
    if (entry.hosts.some((h) => host === h || host.endsWith(`.${h}`))) return entry.provider;
  }
  return null;
}

/**
 * The server may FETCH only these exact hosts when importing a public PDF
 * (SSRF guard). OneDrive is link-only: its share pages need a browser.
 */
export const IMPORT_FETCH_HOSTS = [
  "drive.google.com",
  "docs.google.com",
  "drive.usercontent.google.com",
  "www.dropbox.com",
  "dl.dropboxusercontent.com",
] as const;

/** Download redirects may land on these provider CDN domains (suffix match). */
const IMPORT_REDIRECT_SUFFIXES = [".googleusercontent.com", ".dropboxusercontent.com"] as const;

export function isImportFetchHost(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    if (url.username || url.password || (url.port && url.port !== "443")) return false;
    const host = url.hostname.toLowerCase();
    return (
      (IMPORT_FETCH_HOSTS as readonly string[]).includes(host) ||
      IMPORT_REDIRECT_SUFFIXES.some((suffix) => host.endsWith(suffix))
    );
  } catch {
    return false;
  }
}

/**
 * Turn a public share link into a direct PDF download URL, or null when the
 * link is not importable (folders, OneDrive, unknown shapes).
 *  - Drive file:  /file/d/<id>/view   -> drive.usercontent.google.com/download?id=<id>&export=download
 *  - Drive open:  /open?id=<id>       -> same
 *  - Docs:        /document/d/<id>/.. -> docs.google.com/document/d/<id>/export?format=pdf
 *  - Slides:      /presentation/d/<id>/export/pdf
 *  - Sheets:      /spreadsheets/d/<id>/export?format=pdf
 *  - Dropbox:     ?dl=0 -> ?dl=1
 */
export function toDirectImportUrl(rawUrl: string): string | null {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();
  const idPattern = /^[A-Za-z0-9_-]{10,}$/;

  if (host === "drive.google.com") {
    const fileMatch = /\/file\/d\/([^/]+)/.exec(url.pathname);
    const id = fileMatch?.[1] ?? url.searchParams.get("id") ?? "";
    if (!idPattern.test(id)) return null;
    return `https://drive.usercontent.google.com/download?id=${id}&export=download&confirm=t`;
  }
  if (host === "docs.google.com") {
    const docMatch = /\/(document|presentation|spreadsheets)\/d\/([^/]+)/.exec(url.pathname);
    if (!docMatch || !idPattern.test(docMatch[2])) return null;
    const [, kind, id] = docMatch;
    if (kind === "presentation") return `https://docs.google.com/presentation/d/${id}/export/pdf`;
    return `https://docs.google.com/${kind}/d/${id}/export?format=pdf`;
  }
  if (host === "www.dropbox.com" || host === "dropbox.com") {
    if (!/\/(s|scl)\//.test(url.pathname)) return null;
    url.hostname = "www.dropbox.com";
    url.searchParams.set("dl", "1");
    return url.toString();
  }
  return null;
}

/**
 * Public "What's included" label: a stored file name / label carrying
 * contact details is never shown (the UI falls back to the format name).
 */
export function publicExtraLabel(text: string | null): string | null {
  if (!text) return null;
  return findContactViolations(text).length > 0 ? null : text;
}
