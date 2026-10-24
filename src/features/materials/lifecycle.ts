/**
 * Issues #203 + P8 (#288) + P9 (#289): pure helpers for the notes
 * marketplace lifecycle. Everything here is deliberately free of Supabase /
 * TanStack imports so the vitest suite can exercise the status machine,
 * validation and money rules directly (server fns are not testable
 * end-to-end — see tests/materials/orders.test.ts for the precedent).
 */

import { getSubjectOptionsForCategory } from "../tutors/subjects";

/** #203 listing status machine. */
export const MATERIAL_STATUSES = [
  "draft",
  "pending_review",
  "published",
  "hidden",
  "rejected",
] as const;

export type MaterialStatus = (typeof MATERIAL_STATUSES)[number];

/** Fields the owner may always edit (P8 "after publish" list + P9). */
export const OWNER_EDITABLE_FIELDS = ["title", "price", "description"] as const;

/** #203 file rules. */
export const MAX_PDF_BYTES = 20 * 1024 * 1024; // repo upload cap (issue allows 40MB; Workers body limits win)

/** #314 flashcards: .apkg decks ride the same 40MB cap as the issue allows. */
export const MAX_APKG_BYTES = MAX_PDF_BYTES;

/** P8: pages shown before the blur starts on the note page. */
export const CRISP_PREVIEW_PAGES = 3;

/**
 * Extended preview length (Ryan, 2026-10-11): roughly 30% of the document,
 * clamped to [5, 12] pages — enough to blur meaningfully like Clastify,
 * cheap enough to stamp at upload.
 */
export function extendedPreviewPageLimit(pageCount: number): number {
  const total = Math.max(1, Math.floor(pageCount));
  const thirtyPercent = Math.ceil(total * 0.3);
  return Math.min(12, Math.max(5, thirtyPercent));
}

export type SubmitCheckResult = {
  ok: boolean;
  /** i18n keys under notes.errors for each missing/invalid field (P8: "say which"). */
  missing: string[];
};

/**
 * P8 required-before-submit gate: title, price, PDF. (The sample images are
 * auto-generated from the PDF at upload, so they are never a tutor duty.)
 * #314: HK$0 is a VALID price (free pack) — only null/negative is missing.
 */
export function checkSubmitReadiness(input: {
  title?: string | null;
  priceHkd?: number | null;
  hasPdf: boolean;
}): SubmitCheckResult {
  const missing: string[] = [];
  if (!input.title || input.title.trim().length < 3) missing.push("title");
  if (input.priceHkd == null || Number.isNaN(input.priceHkd) || input.priceHkd < 0) {
    missing.push("price");
  }
  if (!input.hasPdf) missing.push("pdf");
  return { ok: missing.length === 0, missing };
}

/** P8: "An encrypted PDF is rejected. The reason is 'upload an unlocked file.'" */
export const ENCRYPTED_PDF_ERROR =
  "This PDF is password-protected. Please upload an unlocked file.";

/**
 * Heuristic PDF-encryption probe used BEFORE pdf-lib parsing: an encrypted
 * PDF's raw trailer carries /Encrypt. The authoritative check happens at
 * PDFDocument.load in the upload pipeline; this keeps the client-side
 * pre-submit message instant.
 */
export function looksLikeEncryptedPdf(bytes: Uint8Array): boolean {
  const marker = "Encrypt";
  const ascii: string[] = [];
  const window = bytes.subarray(0, Math.min(bytes.byteLength, 8192));
  for (let i = 0; i < window.length; i += 1) ascii.push(String.fromCharCode(window[i]));
  // Also scan the tail where the trailer lives.
  const tail: string[] = [];
  const tailStart = Math.max(0, bytes.byteLength - 2048);
  const tailWindow = bytes.subarray(tailStart);
  for (let i = 0; i < tailWindow.length; i += 1) tail.push(String.fromCharCode(tailWindow[i]));
  return ascii.join("").includes(marker) || tail.join("").includes(marker);
}

/** Money model (#203): platform_fee = round(gross × 0.20), net = gross − fee. */
export function splitMaterialMoney(grossHkd: number): {
  platformFeeHkd: number;
  tutorNetHkd: number;
} {
  const gross = Math.round(grossHkd * 100) / 100;
  const platformFeeHkd = Math.round(gross * 0.2 * 100) / 100;
  return { platformFeeHkd, tutorNetHkd: Math.round((gross - platformFeeHkd) * 100) / 100 };
}

/**
 * #392 Topic Folder upgrade proration (pure, money-critical — unit-tested):
 * a buyer who already holds delivered orders on folder children pays the
 * bulk price minus what they already paid for those children, floored at 0.
 * `paidChildGross` is the list of gross_hkd over the buyer's DELIVERED
 * orders on the folder's children (grant rows carry gross 0, so grants
 * consume no credit but still mark the child as owned — the CALLER decides
 * ownership; this helper only does the arithmetic).
 */
export function computeFolderAdjustedPrice(input: { bulkHkd: number; paidChildGross: number[] }): {
  ownedSum: number;
  adjusted: number;
} {
  const bulk = Math.max(0, Math.round(Number(input.bulkHkd) * 100) / 100);
  let ownedSum = 0;
  for (const gross of input.paidChildGross) {
    ownedSum += Math.max(0, Number(gross) || 0);
  }
  ownedSum = Math.round(ownedSum * 100) / 100;
  const adjusted = Math.round(Math.max(bulk - ownedSum, 0) * 100) / 100;
  return { ownedSum, adjusted };
}

/**
 * #392: folder savings vs buying every child at list price, as a whole
 * percent (0 when the bulk price is not a saving). Pure — the editor's
 * "Save HK$X (Y%)" line and the shop card badge share it.
 */
export function folderSavingsPercent(bulkHkd: number, childrenSumHkd: number): number {
  const sum = Math.max(0, Math.round(Number(childrenSumHkd) * 100) / 100);
  const bulk = Math.max(0, Math.round(Number(bulkHkd) * 100) / 100);
  if (sum <= 0 || bulk >= sum) return 0;
  return Math.round(((sum - bulk) / sum) * 100);
}

/**
 * Short human order reference (#203: "the order id as the reference").
 * MM- prefix + Crockford-ish base32 of the timestamp + 3 random chars —
 * readable over WhatsApp, unique in practice, and retried on collision by
 * the caller.
 */
export function buildOrderReference(now: number = Date.now(), rand = Math.random): string {
  const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  let stamp = "";
  let n = Math.floor(now / 1000);
  while (stamp.length < 7) {
    stamp = alphabet[n % alphabet.length] + stamp;
    n = Math.floor(n / alphabet.length);
  }
  let tail = "";
  for (let i = 0; i < 3; i += 1) {
    tail += alphabet[Math.floor(rand() * alphabet.length)];
  }
  return `MM-${stamp}${tail}`;
}

/** URL-safe listing slug (P8 publish step): "IB Physics HL — Waves" → ib-physics-hl-waves. */
export function buildMaterialSlug(title: string, suffix?: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60)
    .replace(/-+$/g, "");
  const tail = suffix ? `-${suffix.toLowerCase()}` : "";
  return `${base || "note"}${tail}`;
}

export type StatusTransition =
  | "submit" // draft|rejected -> pending_review (P8)
  | "approve" // pending_review -> published (staff)
  | "reject" // pending_review -> rejected (staff, reason stored)
  | "hide" // published|hidden -> hidden (owner or staff)
  | "unhide" // hidden -> published
  | "unpublish"; // published -> draft (owner pulls it)

/** P8/P9 status machine. Returns the next status, or null when illegal. */
export function nextStatus(
  current: MaterialStatus,
  action: StatusTransition,
): MaterialStatus | null {
  switch (action) {
    case "submit":
      return current === "draft" || current === "rejected" ? "pending_review" : null;
    case "approve":
      return current === "pending_review" ? "published" : null;
    case "reject":
      return current === "pending_review" ? "rejected" : null;
    case "hide":
      return current === "published" || current === "hidden" ? "hidden" : null;
    case "unhide":
      return current === "hidden" ? "published" : null;
    case "unpublish":
      return current === "published" ? "draft" : null;
    default:
      return null;
  }
}

/** P9: which owner edit triggers a new staff review, and which go live. */
export function classifyOwnerEdit(delta: {
  titleChanged: boolean;
  priceChanged: boolean;
  descriptionChanged: boolean;
  pdfReplaced: boolean;
}): { needsReview: boolean; liveFields: string[] } {
  return {
    needsReview: delta.pdfReplaced,
    liveFields: [
      ...(delta.titleChanged ? ["title"] : []),
      ...(delta.priceChanged ? ["price"] : []),
      ...(delta.descriptionChanged ? ["description"] : []),
    ],
  };
}

/** #203/P13: which statuses keep buyer access (Bought list shows Download). */
export function orderGrantsAccess(status: string): boolean {
  return status === "delivered";
}

/** P13: refunded orders stay in the Bought list, labelled, without Download. */
export function boughtListAction(status: string): "download" | "refunded" | "preparing" {
  if (status === "delivered") return "download";
  if (status === "refunded") return "refunded";
  return "preparing";
}

/**
 * P12/P8: which listing events ring a bell in this PR. Only delivery does
 * (buyer + tutor) — the #205 event bus owns everything else later.
 */
export const BELL_EVENTS_IN_PR = ["material_order.delivered"] as const;

/**
 * #313 note kinds: the classification a note carries on the marketplace.
 * Curriculum is one of the site's canonical systems (plus Other); type is
 * the notes/mock/exemplar/flashcards split (#314 added flashcards); topic
 * is a free 40-char filter, not a syllabus tree; grade achieved is
 * exemplar-only and self-reported.
 */
export const NOTE_CURRICULA = ["IB", "DSE", "IGCSE", "A-Level", "Other"] as const;
export type NoteCurriculum = (typeof NOTE_CURRICULA)[number];

/**
 * #314: flashcards join the 3-way split. A deck is a PDF or an .apkg file
 * (max 40MB) — no in-browser player, buyers download the file. Subject
 * allowlist + ban list + staff review still apply.
 */
export const MATERIAL_TYPES = ["notes", "mock", "exemplar", "flashcards"] as const;
export type MaterialType = (typeof MATERIAL_TYPES)[number];

export const NOTE_TOPIC_MAX_LEN = 40;
export const GRADE_ACHIEVED_MAX_LEN = 20;

/**
 * #136: tutor-entered approximate word count — OPTIONAL (Ryan: empty never
 * blocks publish). When present it must be a positive whole number; the cap
 * just stops fat-fingered 9-digit values from landing in the DB.
 */
export const WORD_COUNT_MAX = 500_000;

/** Returns a human-readable problem, or null when the value is acceptable. */
export function validateWordCount(value: number | null | undefined): string | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || value <= 0 || value > WORD_COUNT_MAX) {
    return "Approximate word count must be a positive whole number.";
  }
  return null;
}

/**
 * #314: which kind of file a listing carries, decided by extension. PDF is
 * valid for every type; an .apkg deck is only valid for flashcards (no
 * in-browser player — the buyer downloads the file).
 */
export type MaterialFileKind = "pdf" | "apkg";

export function materialFileKind(fileName: string): MaterialFileKind | null {
  const name = fileName.trim().toLowerCase();
  if (name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".apkg")) return "apkg";
  return null;
}

export function isAllowedMaterialFile(materialType: MaterialType, fileName: string): boolean {
  const kind = materialFileKind(fileName);
  if (!kind) return false;
  if (kind === "apkg") return materialType === "flashcards";
  return true;
}

/** Storage/content-type for an original upload by file kind. */
export function materialFileContentType(kind: MaterialFileKind): string {
  return kind === "apkg" ? "application/octet-stream" : "application/pdf";
}

/**
 * #346: subject is allowlisted server-side to match what the forms can
 * actually send. Both note forms render subject as a SELECT narrowed by
 * getSubjectOptionsForCategory (the "Other" curriculum falls back to the
 * full catalog pool), so free-text junk (contact details, arbitrary
 * strings) has no legitimate path in. One escape hatch survives: the
 * note's OWN stored legacy subjectTag — the form re-renders it as an
 * option so pre-#313 rows can be re-saved and migrated, so the stored
 * value is accepted (case-insensitively) alongside the catalog.
 */
export function isAllowedNoteSubject(
  curriculum: string | undefined,
  subject: string,
  storedSubject?: string | null,
): boolean {
  const normalized = subject.trim().toLowerCase();
  if (!normalized) return false;
  const stored = storedSubject?.trim().toLowerCase();
  if (stored && stored === normalized) return true;
  return getSubjectOptionsForCategory(curriculum?.trim() || undefined).some(
    (option) => option.trim().toLowerCase() === normalized,
  );
}

/** Legacy document_type values map onto the new 3-way type (mock_exam →
 * mock; everything else → notes — old coursework rows never carried the
 * exemplar permission confirmation). */
export function legacyDocumentTypeToMaterialType(documentType: string): MaterialType {
  return documentType === "mock_exam" ? "mock" : "notes";
}

/**
 * #313 merge with explicit-clear semantics (review fix): `null` / empty
 * clears a stored value, `undefined` keeps it. Whenever the effective type
 * is not exemplar, grade_achieved is dropped and exemplar_permission is
 * reset — a switched-away exemplar must never keep stale grade/permission
 * data that later fails validation (or leaks to the public card).
 */
export function mergeNoteKinds(
  input: {
    curriculum?: string | null;
    subject?: string | null;
    materialType?: MaterialType | null;
    topic?: string | null;
    gradeAchieved?: string | null;
    exemplarPermission?: boolean | null;
  },
  existing?: {
    curriculumTag?: string | null;
    subjectTag?: string | null;
    materialType?: MaterialType | null;
    topic?: string | null;
    gradeAchieved?: string | null;
    exemplarPermission?: boolean | null;
  },
): {
  curriculum: string;
  subject: string;
  materialType: MaterialType;
  topic: string;
  gradeAchieved: string | null;
  exemplarPermission: boolean;
} {
  const materialType =
    input.materialType != null && (MATERIAL_TYPES as readonly string[]).includes(input.materialType)
      ? input.materialType
      : (existing?.materialType ?? "notes");
  const curriculum =
    input.curriculum !== undefined
      ? (input.curriculum ?? "").trim()
      : (existing?.curriculumTag ?? "");
  const subject =
    input.subject !== undefined ? (input.subject ?? "").trim() : (existing?.subjectTag ?? "");
  const topic = input.topic !== undefined ? (input.topic ?? "").trim() : (existing?.topic ?? "");
  let gradeAchieved: string | null;
  if (input.gradeAchieved !== undefined) {
    gradeAchieved = input.gradeAchieved?.trim() ? input.gradeAchieved.trim() : null;
  } else {
    gradeAchieved = existing?.gradeAchieved ?? null;
  }
  let exemplarPermission: boolean;
  if (input.exemplarPermission !== undefined) {
    exemplarPermission = input.exemplarPermission === true;
  } else {
    exemplarPermission = existing?.exemplarPermission === true;
  }

  if (materialType !== "exemplar") {
    gradeAchieved = null;
    exemplarPermission = false;
  }
  return { curriculum, subject, materialType, topic, gradeAchieved, exemplarPermission };
}

/**
 * #313 strict validation at submit time: curriculum, subject and type are
 * required; topic/grade respect their caps; grade achieved is exemplar-only;
 * exemplars must carry the written-permission confirmation. Returns
 * human-readable problems (server errors) — empty array means clean.
 */
export function validateNoteKindsForSubmit(
  input: {
    curriculum?: string | null;
    subject?: string | null;
    materialType?: string | null;
    topic?: string | null;
    gradeAchieved?: string | null;
    exemplarPermission?: boolean | null;
  },
  storedSubject?: string | null,
): string[] {
  const errors: string[] = [];

  const curriculum = (input.curriculum ?? "").trim();
  if (!(NOTE_CURRICULA as readonly string[]).includes(curriculum)) {
    errors.push("Curriculum must be IB, DSE, IGCSE, A-Level, or Other.");
  }

  const subject = (input.subject ?? "").trim();
  if (subject.length === 0) errors.push("Subject is required.");
  else if (subject.length > 160) errors.push("Subject is too long (160 characters max).");
  // #346: the forms can only send catalog values (plus the note's own
  // stored legacy subject) — reject anything else on this authed path.
  else if (!isAllowedNoteSubject(curriculum, subject, storedSubject)) {
    errors.push("Subject must be selected from the list for the chosen curriculum.");
  }

  const materialType = (input.materialType ?? "").trim();
  if (!(MATERIAL_TYPES as readonly string[]).includes(materialType)) {
    errors.push("Type must be notes, mock, exemplar, or flashcards.");
  }

  const topic = (input.topic ?? "").trim();
  if (topic.length > NOTE_TOPIC_MAX_LEN) {
    errors.push(`Topic must be ${NOTE_TOPIC_MAX_LEN} characters or fewer.`);
  }

  const grade = (input.gradeAchieved ?? "").trim();
  if (grade.length > GRADE_ACHIEVED_MAX_LEN) {
    errors.push(`Grade achieved must be ${GRADE_ACHIEVED_MAX_LEN} characters or fewer.`);
  }
  if (grade && materialType !== "exemplar") {
    errors.push("Grade achieved can only be set on an exemplar.");
  }
  if (materialType === "exemplar" && input.exemplarPermission !== true) {
    errors.push("Exemplars need the written-permission confirmation.");
  }

  return errors;
}

/**
 * #313 soft validation for partial draft saves: only check what is present
 * (enum membership, caps). Required-field and exemplar gates run at submit.
 */
export function validateNoteKindsPartial(
  input: {
    curriculum?: string | null;
    subject?: string | null;
    materialType?: string | null;
    topic?: string | null;
    gradeAchieved?: string | null;
  },
  storedSubject?: string | null,
): string[] {
  const errors: string[] = [];

  if (input.curriculum != null) {
    const curriculum = input.curriculum.trim();
    if (curriculum && !(NOTE_CURRICULA as readonly string[]).includes(curriculum)) {
      errors.push("Curriculum must be IB, DSE, IGCSE, A-Level, or Other.");
    }
  }

  if (input.subject != null && input.subject.trim()) {
    const subject = input.subject.trim();
    if (subject.length > 160) {
      errors.push("Subject is too long (160 characters max).");
    } else if (
      // #346 review fix: always allowlist, even without a curriculum —
      // otherwise a subject-only draft save launders junk into subject_tag
      // and submit later accepts it via the stored-value exemption. With no
      // curriculum present, fall back to the full catalog (same pool the
      // "Other" curriculum uses).
      !isAllowedNoteSubject(input.curriculum ?? undefined, subject, storedSubject)
    ) {
      errors.push("Subject must be selected from the list for the chosen curriculum.");
    }
  }

  if (input.materialType != null && input.materialType.trim()) {
    const materialType = input.materialType.trim();
    if (!(MATERIAL_TYPES as readonly string[]).includes(materialType)) {
      errors.push("Type must be notes, mock, exemplar, or flashcards.");
    }
  }

  if (input.topic != null && input.topic.trim().length > NOTE_TOPIC_MAX_LEN) {
    errors.push(`Topic must be ${NOTE_TOPIC_MAX_LEN} characters or fewer.`);
  }

  if (input.gradeAchieved != null && input.gradeAchieved.trim().length > GRADE_ACHIEVED_MAX_LEN) {
    errors.push(`Grade achieved must be ${GRADE_ACHIEVED_MAX_LEN} characters or fewer.`);
  }

  return errors;
}
