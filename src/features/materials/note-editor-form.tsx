import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  FileText,
  ImageIcon,
  Link2,
  Loader2,
  Lock,
  Paperclip,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { findContactViolations } from "@/lib/contact-filter";
import {
  GRADE_ACHIEVED_MAX_LEN,
  MATERIAL_TYPES,
  MAX_APKG_BYTES,
  NOTE_CURRICULA,
  NOTE_TOPIC_MAX_LEN,
  validateWordCount,
  type MaterialType,
} from "@/features/materials/lifecycle";
import { getSubjectOptionsForCategory } from "@/features/tutors/subjects";
import { TermsGateCheckbox } from "@/features/legal/TermsGateCheckbox";
import {
  editLiveNote,
  saveNoteDraft,
  submitNoteForReview,
  uploadNotePdf,
  type MyMaterialsRow,
} from "@/features/materials/note-drafts.functions";
import {
  attachNoteMainPdf,
  createNoteUploadTargets,
  getNoteExtrasForOwner,
  getNoteOriginalUrlForOwner,
  saveNoteGallery,
  importNotePdfFromLink,
  saveNoteExtras,
  updateNotePreviewPages,
  type NoteExtra,
} from "@/features/materials/note-uploads.functions";
import { suggestNoteDetails } from "@/features/materials/note-ai.functions";
import {
  classifyUploadFile,
  CONTENT_LANGUAGES,
  detectLinkProvider,
  getSubcategoriesForCurriculum,
  MAX_EXTRA_FILE_BYTES,
  MAX_EXTRA_FILES,
  MAX_IMAGES_TO_MERGE,
  MAX_LINKS,
  MAX_MAIN_PDF_BYTES,
  toDirectImportUrl,
  MAX_GALLERY_IMAGE_BYTES,
  MAX_GALLERY_IMAGES,
  MAX_WHATS_INCLUDED,
  SYLLABUS_MAX,
  trailerEmbedUrl,
  isTextExtractable,
  type UploadFormat,
} from "@/features/materials/note-taxonomy";
import {
  extractPdfText,
  fileToBase64,
  formatBytes,
  mergeImagesToPdf,
  openPdf,
  renderPage,
  uploadToSignedUrl,
  watermarkImageFile,
} from "@/features/materials/note-file-tools";
import { materialCoverUrl } from "@/features/materials/material-card";
import { BulkNotesDialog } from "@/features/materials/bulk-notes-dialog";
import { CollectionPicker } from "@/features/materials/collection-picker";
import { setMaterialCollection } from "@/features/materials/collections.functions";
import { setMaterialVariant } from "@/features/materials/store-context.functions";
import { VariantPicker, type VariantValue } from "@/features/materials/variant-picker";
import { TAG_SUGGESTIONS, TagChipsInput } from "@/features/materials/tag-chips-input";
import { extractOfficeText } from "@/features/materials/office-text";
import { buildOfficePreviewPdf } from "@/features/materials/office-preview";
import { renderCoverCard } from "@/features/materials/note-cover-card";
import { detectDocumentLanguage } from "@/features/materials/note-ai";
import { NotePreviewPicker } from "@/features/materials/note-preview-picker";
import { NotePriceGuidePanel } from "@/features/materials/note-price-guide-panel";
import {
  earningsEstimate,
  marketplaceTakeRate,
  NOTES_OPTION_A_LIVE,
  validateListingPrice,
} from "@/features/materials/marketplace-policy";
import { isCourseMaterialType } from "@/features/materials/lifecycle";

/** #573 Option A live calculator; the payment fee is always an estimate. #672: tiered take rate. */
function EarningsCalculator({
  priceHkd,
  materialType,
}: {
  priceHkd: number;
  materialType: string;
}) {
  const { t } = useTranslation();
  const takeRate = marketplaceTakeRate({
    // The seller sees the rate they will be charged; verification tier is
    // confirmed at checkout — the form shows the standard tier for
    // unverified sellers and the course tier for course kinds.
    verified: false,
    isCourse: isCourseMaterialType(materialType),
  });
  const e = earningsEstimate(priceHkd, takeRate);
  const money = (v: number) => `HK$${v.toFixed(2)}`;
  return (
    <div className="space-y-2 rounded-xl border border-border p-4 text-sm">
      <p className="font-semibold">{t("notes_option_a.fee_title")}</p>
      <dl className="space-y-1">
        <div className="flex justify-between">
          <dt>{t("notes_option_a.fee_gross")}</dt>
          <dd>{money(e.gross)}</dd>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <dt>{t("notes_option_a.fee_platform")}</dt>
          <dd>- {money(e.platform)}</dd>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <dt>{t("notes_option_a.fee_gateway")}</dt>
          <dd>- {money(e.gateway)}</dd>
        </div>
        <div className="flex justify-between border-t border-border pt-1 font-bold">
          <dt>{t("notes_option_a.fee_net")}</dt>
          <dd>{money(e.net)}</dd>
        </div>
      </dl>
      <p className="text-xs text-muted-foreground">{t("notes_option_a.fee_note")}</p>
    </div>
  );
}

/**
 * P8/P9/#313/#314/#136 + notes upload v2: the draft-or-submit note form,
 * shared by /account/notes/new and /account/notes/$id/edit.
 *
 * v2 adds, all inside this one form:
 *  - one multi-format drop zone: a PDF (main), photos/scans (merged into one
 *    PDF in the browser), Word/PPT/ZIP/video extras up to 2 GB each, and
 *    cloud links (import a public Drive/Docs/Dropbox PDF, or attach the link
 *    as a buyer download). Big files upload straight to Storage through
 *    signed URLs with a progress bar;
 *  - AI detection (Qwen via OpenRouter) that fills title, summary,
 *    description, curriculum, subject, type, category, topic, year,
 *    language and tags; every field stays editable;
 *  - the preview-page picker (thumbnails, never the whole document);
 *  - the Carousell-style price guide.
 *
 * Submit still enforces the required fields, the contact filter and the
 * notes-terms gate exactly as before.
 */

type ExtraItem = {
  key: string;
  /** New file picked in this session (uploaded on save). */
  file?: File;
  /** Already stored extra (edit mode). */
  stored?: NoteExtra;
  name: string;
  size: number;
  format: UploadFormat | null;
};

type LinkItem = { key: string; url: string; label: string };

const isNoteCurriculum = (value: string): value is (typeof NOTE_CURRICULA)[number] =>
  (NOTE_CURRICULA as readonly string[]).includes(value);

const isMaterialType = (value: string): value is MaterialType =>
  (MATERIAL_TYPES as readonly string[]).includes(value);

const isContentLanguage = (value: string): value is (typeof CONTENT_LANGUAGES)[number] =>
  (CONTENT_LANGUAGES as readonly string[]).includes(value);

let keySeq = 0;
const nextKey = () => `k${(keySeq += 1)}`;

const LIVE_STATUSES = new Set(["published", "hidden"]);

function parseTags(text: string): string[] {
  return Array.from(
    new Set(
      text
        .split(/[,，、\n]/)
        .map((t) => t.trim())
        .filter((t) => t.length >= 1 && t.length <= 30),
    ),
  ).slice(0, 20);
}

const BULK_MIN_FILES = 2;

export function NoteEditorForm({ existing }: { existing?: MyMaterialsRow | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isLive = Boolean(existing && LIVE_STATUSES.has(existing.status));

  // --- Listing details -----------------------------------------------------
  const [title, setTitle] = useState(existing?.title ?? "");
  const [summary, setSummary] = useState(existing?.summary ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [price, setPrice] = useState<string>(existing ? String(existing.priceHkd ?? 0) : "");
  const [curriculum, setCurriculum] = useState<string>(existing?.curriculumTag ?? "");
  const [subcategory, setSubcategory] = useState<string>(existing?.subcategory ?? "");
  const [subject, setSubject] = useState(existing?.subjectTag ?? "");
  const [bulkFiles, setBulkFiles] = useState<File[] | null>(null);
  const [collectionId, setCollectionId] = useState<string | null>(null);
  const [legalOriginals, setLegalOriginals] = useState(false);
  const [variant, setVariant] = useState<VariantValue>({ variantOfId: null, label: "" });
  const [linkAck, setLinkAck] = useState(false);
  const [materialType, setMaterialType] = useState<MaterialType>(
    existing?.materialType && isMaterialType(existing.materialType)
      ? existing.materialType
      : "notes",
  );
  const [topic, setTopic] = useState(existing?.topic ?? "");
  const [gradeAchieved, setGradeAchieved] = useState(existing?.gradeAchieved ?? "");
  const [exemplarPermission, setExemplarPermission] = useState(
    existing?.exemplarPermission === true,
  );
  const [year, setYear] = useState(existing?.yearTag ?? "");
  const [wordCount, setWordCount] = useState(
    existing?.wordCount != null ? String(existing.wordCount) : "",
  );
  const [language, setLanguage] = useState<string>(existing?.contentLanguage ?? "");
  const [tagsText, setTagsText] = useState((existing?.searchTags ?? []).join(", "));
  // #556 rich listing.
  const [trailerUrl, setTrailerUrl] = useState(existing?.trailerVideoUrl ?? "");
  const [includedText, setIncludedText] = useState((existing?.whatsIncluded ?? []).join(", "));
  const [syllabus, setSyllabus] = useState(existing?.syllabusOutline ?? "");
  const [galleryKept, setGalleryKept] = useState<string[]>(existing?.previewImagePaths ?? []);
  const [galleryNew, setGalleryNew] = useState<File[]>([]);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const hadRich = Boolean(
    existing?.trailerVideoUrl ||
    existing?.syllabusOutline ||
    (existing?.whatsIncluded ?? []).length > 0,
  );

  // --- Files -----------------------------------------------------------------
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);
  const [mergedPdf, setMergedPdf] = useState<File | null>(null);
  // Word / PowerPoint only: a PDF version drawn from the document's text,
  // used for preview pages (and delivered next to the original).
  const [officePdf, setOfficePdf] = useState<File | null>(null);
  const [officeSourceKey, setOfficeSourceKey] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);
  const [apkgFile, setApkgFile] = useState<File | null>(null);
  const [extras, setExtras] = useState<ExtraItem[]>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [extrasDirty, setExtrasDirty] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [importing, setImporting] = useState(false);
  /** Owner-signed URL of the server-side original (imported link / edit mode). */
  const [remoteMainUrl, setRemoteMainUrl] = useState<string | null>(null);
  const [previewPicks, setPreviewPicks] = useState<number[] | null>(
    existing?.previewPageIndices ?? null,
  );
  const [picksDirty, setPicksDirty] = useState(false);
  const [mainPageCount, setMainPageCount] = useState<number | null>(existing?.pageCount ?? null);
  const [materialId, setMaterialId] = useState<string | undefined>(existing?.id);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  // --- Progress / AI ---------------------------------------------------------
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState<Record<string, number>>({});
  const [aiBusy, setAiBusy] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);
  const autoDetected = useRef(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  // #573 seller activation declarations (age + originality), required to submit.
  const [declareAge, setDeclareAge] = useState(false);
  const [declareOriginality, setDeclareOriginality] = useState(false);

  const subjectOptions = useMemo(
    () => getSubjectOptionsForCategory(curriculum || undefined),
    [curriculum],
  );
  const subcategoryOptions = useMemo(
    () => (curriculum ? getSubcategoriesForCurriculum(curriculum) : []),
    [curriculum],
  );

  // Edit mode: load stored extras + links once.
  const extrasQuery = useQuery({
    queryKey: ["notes", "owner-extras", existing?.id],
    queryFn: () => getNoteExtrasForOwner({ data: { materialId: existing?.id ?? "" } }),
    enabled: Boolean(existing?.id),
    staleTime: Infinity,
  });
  useEffect(() => {
    if (!extrasQuery.data) return;
    setExtras(
      extrasQuery.data
        .filter((e) => e.kind === "file")
        .map((e) => ({
          key: nextKey(),
          stored: e,
          name: e.fileName ?? e.label ?? "file",
          size: e.sizeBytes ?? 0,
          format: (e.format as UploadFormat | null) ?? null,
        })),
    );
    setLinks(
      extrasQuery.data
        .filter((e) => e.kind === "link" && e.url)
        .map((e) => ({ key: nextKey(), url: e.url ?? "", label: e.label ?? "" })),
    );
  }, [extrasQuery.data]);

  // Edit mode: the stored original drives the page picker until replaced.
  useEffect(() => {
    if (!existing?.id || isLive) return;
    let cancelled = false;
    getNoteOriginalUrlForOwner({ data: { materialId: existing.id } })
      .then(({ url }) => {
        if (!cancelled && url) setRemoteMainUrl(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [existing?.id, isLive]);

  // GLM review fix: the owner URL is signed for ~15 min. If the seller idles
  // longer, thumbnails / AI detection fail with a 403 — refetch a fresh URL
  // once per served URL (the new string identity re-runs the consumers).
  const remoteRetryRef = useRef<{ served: string | null; busy: boolean }>({
    served: null,
    busy: false,
  });
  const refreshRemoteMainUrl = useCallback(
    async (failedUrl: string) => {
      if (!existing?.id || isLive) return;
      const state = remoteRetryRef.current;
      if (state.busy || state.served === failedUrl) return;
      state.busy = true;
      try {
        const { url } = await getNoteOriginalUrlForOwner({
          data: { materialId: existing.id },
        });
        if (url) {
          state.served = url;
          setRemoteMainUrl(url);
        }
      } catch {
        // Keep the old URL; the picker shows its failed state.
      } finally {
        state.busy = false;
      }
    },
    [existing?.id, isLive],
  );

  // Photos / scans merge into one PDF when there is no PDF.
  useEffect(() => {
    if (images.length === 0 || pdfFile) {
      setMergedPdf(null);
      return;
    }
    let cancelled = false;
    setMerging(true);
    mergeImagesToPdf(images, "photos.pdf")
      .then((file) => {
        if (cancelled) return;
        if (file.size > MAX_MAIN_PDF_BYTES) {
          toast.error(t("notes.upload.merged_too_large"));
          setMergedPdf(null);
        } else {
          setMergedPdf(file);
        }
      })
      .catch((error: unknown) =>
        toast.error(error instanceof Error ? error.message : t("notes.upload.merge_failed")),
      )
      .finally(() => {
        if (!cancelled) setMerging(false);
      });
    return () => {
      cancelled = true;
    };
  }, [images, pdfFile, t]);

  // Word / PowerPoint without any PDF or photo: build a PDF version from the
  // document text so buyers get real preview pages (picker + watermark).
  const officeCandidate =
    !pdfFile && images.length === 0 && !remoteMainUrl && !existing?.previewUrl && !isLive
      ? (extras.find((e) => e.file && /\.(docx|pptx|odt|odp|txt|md|rtf)$/i.test(e.name)) ?? null)
      : null;
  useEffect(() => {
    if (!officeCandidate?.file) {
      setOfficePdf(null);
      setOfficeSourceKey(null);
      return;
    }
    if (officeSourceKey === officeCandidate.key) return;
    let cancelled = false;
    setOfficeSourceKey(officeCandidate.key);
    setMerging(true);
    buildOfficePreviewPdf(officeCandidate.file, t("notes.upload.office_preview_footer"))
      .then((file) => {
        if (cancelled) return;
        setOfficePdf(file);
        if (file) {
          setPreviewPicks(null);
          setPicksDirty(true);
          toast.message(t("notes.upload.office_preview_made"));
        }
      })
      .catch(() => {
        if (!cancelled) setOfficePdf(null);
      })
      .finally(() => {
        if (!cancelled) setMerging(false);
      });
    return () => {
      cancelled = true;
    };
    // officeSourceKey guards re-runs; t is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [officeCandidate?.key]);

  const mainLocal = pdfFile ?? mergedPdf ?? officePdf;
  const mainSource: File | string | null = mainLocal ?? remoteMainUrl;

  // --- Validation -------------------------------------------------------------
  const copyViolations = useMemo(
    () => ({
      titleV: findContactViolations(title),
      summaryV: findContactViolations(summary),
      descV: findContactViolations(description),
      topicV: findContactViolations(topic),
      gradeV: findContactViolations(gradeAchieved),
    }),
    [title, summary, description, topic, gradeAchieved],
  );
  const blockedByContact = Object.values(copyViolations).some((v) => v.length > 0);
  const wordCountError = validateWordCount(wordCount.trim() === "" ? null : Number(wordCount));
  const apkgTooLarge = apkgFile != null && apkgFile.size > MAX_APKG_BYTES;
  // Owner (2026-11-03): any format counts as the note's file (Word, PPT,
  // images, ZIP...), a PDF is no longer required.
  const firstDocExtra = extras.find((e) => e.file) ?? null;
  const hasMainFile =
    Boolean(mainLocal || apkgFile || remoteMainUrl) ||
    extras.length > 0 ||
    links.length > 0 ||
    Boolean(existing?.previewUrl) ||
    Boolean(existing && existing.pageCount != null);

  const missing: string[] = [];
  if (title.trim().length < 3) missing.push(t("notes.form.field_title"));
  const priceNum = price.trim() === "" ? Number.NaN : Number(price);
  if (Number.isNaN(priceNum) || priceNum < 0) missing.push(t("notes.form.field_price"));
  // #543 / #573: free (HK$0) or HK$20 to HK$5,000.
  const priceProblem = Number.isNaN(priceNum) ? null : validateListingPrice(priceNum, materialType);
  if (priceProblem === "below_minimum" || priceProblem === "above_maximum") {
    missing.push(t("notes.form.field_price"));
  }
  if (!isLive && !(declareAge && declareOriginality)) {
    missing.push(t("notes_option_a.declare_missing"));
  }
  if (!hasMainFile) missing.push(t("notes.form.field_pdf"));
  if (!curriculum) missing.push(t("notes.form.field_curriculum"));
  if (!subject.trim()) missing.push(t("notes.form.field_subject"));
  if (materialType === "exemplar" && !exemplarPermission)
    missing.push(t("notes.form.exemplar_permission_short"));
  if (links.length > 0 && !linkAck && !isLive) {
    missing.push(t("materials_store.link_ack_short"));
  }
  if (materialType === "mock" && !legalOriginals && !isLive) {
    missing.push(t("materials_store.mock_attest_short"));
  }
  if (!isLive && !termsAccepted) missing.push(t("terms.gate.missing"));

  // --- Files: add / remove ------------------------------------------------------
  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list);
    // #556 bulk intercept: several PDFs on a brand-new Note become drafts in one
    // go. Anything else stays a normal extra on this note.
    const bulkPdfs = incoming.filter(
      (file) => classifyUploadFile(file.name) === "pdf" && file.size <= MAX_MAIN_PDF_BYTES,
    );
    if (!existing && !materialId && !pdfFile && bulkPdfs.length >= BULK_MIN_FILES) {
      setBulkFiles(bulkPdfs);
      return;
    }
    let nextExtras = [...extras];
    const nextImages = [...images];
    let nextPdf = pdfFile;
    for (const file of incoming) {
      const format = classifyUploadFile(file.name);
      if (!format) {
        toast.error(t("notes.upload.unsupported", { name: file.name }));
        continue;
      }
      if (format === "pdf" && !nextPdf) {
        if (file.size > MAX_MAIN_PDF_BYTES) {
          toast.message(t("notes.upload.pdf_too_big_for_preview", { name: file.name }));
        } else {
          nextPdf = file;
          continue;
        }
      }
      if (format === "image" && !nextPdf && nextImages.length < MAX_IMAGES_TO_MERGE) {
        nextImages.push(file);
        continue;
      }
      if (format === "apkg" && materialType === "flashcards" && !apkgFile) {
        setApkgFile(file);
        continue;
      }
      // Extras on a live note change through staff (saveNoteExtras refuses),
      // so the drop zone must not pretend to accept them.
      if (isLive) {
        toast.error(t("notes.upload.live_files_note"));
        continue;
      }
      if (file.size > MAX_EXTRA_FILE_BYTES) {
        toast.error(t("notes.upload.too_large_2gb", { name: file.name }));
        continue;
      }
      if (nextExtras.length >= MAX_EXTRA_FILES) {
        toast.error(t("notes.upload.too_many_files", { count: MAX_EXTRA_FILES }));
        break;
      }
      nextExtras = [
        ...nextExtras,
        { key: nextKey(), file, name: file.name, size: file.size, format },
      ];
    }
    if (nextPdf !== pdfFile) {
      setPdfFile(nextPdf);
      setPreviewPicks(null);
      setPicksDirty(true);
      autoDetected.current = false;
    }
    if (nextImages.length !== images.length) {
      setImages(nextImages);
      setPreviewPicks(null);
      setPicksDirty(true);
      autoDetected.current = false;
    }
    if (nextExtras.length !== extras.length) {
      setExtras(nextExtras);
      setExtrasDirty(true);
    }
    // Visible confirmation: without it a picked file can look ignored.
    const added =
      (nextPdf !== pdfFile ? 1 : 0) +
      (nextImages.length - images.length) +
      (nextExtras.length - extras.length);
    if (added > 0) toast.success(t("notes.upload.files_added", { count: added }));
    if (
      !nextPdf &&
      nextImages.length === 0 &&
      !remoteMainUrl &&
      !existing &&
      nextExtras.length > 0
    ) {
      toast.message(t("notes.upload.need_pdf_hint"));
    }
  };

  const removeExtra = (key: string) => {
    setExtras((prev) => prev.filter((e) => e.key !== key));
    setExtrasDirty(true);
  };

  const addLink = () => {
    const url = linkInput.trim();
    if (!detectLinkProvider(url)) {
      toast.error(t("notes.upload.link_invalid"));
      return;
    }
    if (links.length >= MAX_LINKS) {
      toast.error(t("notes.upload.too_many_links", { count: MAX_LINKS }));
      return;
    }
    setLinks((prev) => [...prev, { key: nextKey(), url, label: "" }]);
    setExtrasDirty(true);
    setLinkInput("");
  };

  // --- Meta payload ---------------------------------------------------------------
  const payload = () => ({
    title: title.trim(),
    description: description.trim() || undefined,
    priceHkd: price ? Number(price) : undefined,
    curriculumTag: isNoteCurriculum(curriculum) ? curriculum : undefined,
    subjectTag: subject.trim() || null,
    materialType,
    topic: topic.trim() || null,
    gradeAchieved: materialType === "exemplar" ? gradeAchieved.trim() || null : null,
    exemplarPermission: materialType === "exemplar" ? exemplarPermission : false,
    wordCount: wordCount.trim() === "" ? null : Number(wordCount),
    yearTag: year.trim() || undefined,
    summary: summary.trim() || null,
    subcategory: subcategory || null,
    searchTags: parseTags(tagsText),
    contentLanguage: isContentLanguage(language) ? language : null,
    sourceFormats: Array.from(
      new Set(
        [
          pdfFile || remoteMainUrl ? "pdf" : null,
          images.length > 0 ? "image" : null,
          apkgFile ? "apkg" : null,
          ...extras.map((e) => e.format),
          links.length > 0 ? "link" : null,
        ].filter((f): f is UploadFormat => Boolean(f)),
      ),
    ),
    // #556: only sent when used, so older schemas keep saving.
    ...(hadRich || trailerUrl.trim() || includedText.trim() || syllabus.trim()
      ? {
          trailerVideoUrl: trailerUrl.trim() || null,
          whatsIncluded: parseTags(includedText).slice(0, MAX_WHATS_INCLUDED),
          syllabusOutline: syllabus.trim() || null,
        }
      : {}),
  });

  /** Make sure a row exists (draft) and return its id. */
  const ensureDraft = async (): Promise<string> => {
    if (materialId) return materialId;
    const { materialId: id } = await saveNoteDraft({ data: payload() });
    if (!id) throw new Error(t("notes.form.save_failed"));
    setMaterialId(id);
    return id;
  };

  // --- AI detection -----------------------------------------------------------------
  // Fill the form from an AI suggestion (empty fields only unless overwrite).
  const applySuggestion = (
    suggestion: Awaited<ReturnType<typeof suggestNoteDetails>>,
    overwrite: boolean,
  ) => {
    let filled = 0;
    const apply = (current: string, next: string, set: (v: string) => void) => {
      if (!next) return;
      if (overwrite || !current.trim()) {
        set(next);
        filled += 1;
      }
    };
    apply(title, suggestion.title, setTitle);
    apply(summary, suggestion.summary, setSummary);
    apply(description, suggestion.description, setDescription);
    if (suggestion.curriculum && (overwrite || !curriculum)) {
      setCurriculum(suggestion.curriculum);
      filled += 1;
      if (suggestion.subject) {
        setSubject(suggestion.subject);
        filled += 1;
      }
      if (suggestion.subcategory) {
        setSubcategory(suggestion.subcategory);
        filled += 1;
      }
    } else {
      apply(subject, suggestion.subject, setSubject);
      apply(subcategory, suggestion.subcategory, setSubcategory);
    }
    if (
      suggestion.materialType &&
      (overwrite || (!existing && materialType === "notes")) &&
      suggestion.materialType !== materialType
    ) {
      setMaterialType(suggestion.materialType);
      filled += 1;
    }
    apply(topic, suggestion.topic, setTopic);
    apply(year, suggestion.year, setYear);
    apply(language, suggestion.language, setLanguage);
    if (suggestion.tags.length > 0 && (overwrite || !tagsText.trim())) {
      setTagsText(suggestion.tags.join(", "));
      filled += 1;
    }
    setAiNote(t("notes.ai.applied", { count: filled }));
  };

  const runDetect = useCallback(
    async (overwrite: boolean) => {
      // The Word / PPT PDF version has no text layer: read the original.
      const useDocText = Boolean(firstDocExtra?.file) && !pdfFile && !mergedPdf && !remoteMainUrl;
      if (!mainSource && !firstDocExtra?.file) {
        toast.error(t("notes.ai.need_file"));
        return;
      }
      setAiBusy(true);
      setAiNote(null);
      setAiError(null);
      try {
        // No PDF: read the text of the first Word / PPT / text file instead.
        if (useDocText && firstDocExtra?.file) {
          const docFile = firstDocExtra.file;
          const docText = isTextExtractable(docFile.name) ? await extractOfficeText(docFile) : "";
          const suggestion = await suggestNoteDetails({
            data: {
              fileName: docFile.name,
              pageCount: null,
              text: docText,
              documentLanguage: detectDocumentLanguage(docText),
              images: [],
            },
          });
          applySuggestion(suggestion, overwrite);
          return;
        }
        const doc = await openPdf(mainSource as File | string);
        const text = await extractPdfText(doc);
        const pageImages: string[] = [];
        if (text.replace(/\s+/g, "").length < 200) {
          // A page that will not render must not stop detection: the server
          // still has the file name and any text to work from.
          try {
            for (let i = 1; i <= Math.min(3, doc.numPages); i += 1) {
              pageImages.push(await renderPage(doc, i, 900, "image/jpeg", 0.7));
            }
          } catch {
            // keep whatever rendered
          }
        }
        const fileName = pdfFile?.name ?? (mergedPdf ? "photos.pdf" : null);
        const suggestion = await suggestNoteDetails({
          data: {
            fileName,
            pageCount: doc.numPages,
            text,
            documentLanguage: detectDocumentLanguage(text),
            images: pageImages,
          },
        });
        await doc.destroy();
        applySuggestion(suggestion, overwrite);
      } catch (error) {
        setAiNote(null);
        // Fallback: a readable title from the file name, so the seller is not
        // left with an empty form.
        const baseName = (pdfFile?.name ?? "").replace(/\.[^.]+$/, "");
        if (!title.trim() && baseName) {
          setTitle(baseName.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120));
        }
        // Expired signed URL: refresh it so the next attempt works.
        if (typeof mainSource === "string") await refreshRemoteMainUrl(mainSource);
        const message = error instanceof Error ? error.message : t("notes.ai.failed");
        setAiError(message);
        toast.error(message);
      } finally {
        setAiBusy(false);
      }
    },
    [
      mainSource,
      pdfFile,
      mergedPdf,
      title,
      summary,
      description,
      curriculum,
      subject,
      subcategory,
      materialType,
      topic,
      year,
      language,
      tagsText,
      existing,
      refreshRemoteMainUrl,
      firstDocExtra,
      applySuggestion,
      t,
    ],
  );

  // Auto-detect once per newly added (or imported) main file while the
  // title is still empty; edit mode never auto-runs (the title is set).
  useEffect(() => {
    if ((!mainSource && !firstDocExtra) || autoDetected.current || title.trim() || aiBusy) return;
    autoDetected.current = true;
    void runDetect(false);
  }, [mainSource, firstDocExtra, title, aiBusy, runDetect]);

  // --- Import a public link as the main PDF -------------------------------------------
  const importLink = async () => {
    const url = linkInput.trim();
    if (!toDirectImportUrl(url)) {
      toast.error(t("notes.upload.import_unsupported"));
      return;
    }
    setImporting(true);
    try {
      const id = await ensureDraft();
      const result = await importNotePdfFromLink({
        data: { materialId: id, url, previewPageIndices: null },
      });
      setPdfFile(null);
      setImages([]);
      setRemoteMainUrl(result.ownerFileUrl);
      setPreviewPicks(null);
      setPicksDirty(false);
      if (result.pageCount) setMainPageCount(result.pageCount);
      setLinkInput("");
      autoDetected.current = false;
      toast.success(t("notes.upload.imported"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("notes.upload.import_failed"));
    } finally {
      setImporting(false);
    }
  };

  // --- Save pipeline ----------------------------------------------------------------------
  const persist = async (kind: "draft" | "submit") => {
    const meta = payload();
    let id = materialId;

    // 1. Listing details.
    if (isLive && id) {
      await editLiveNote({
        data: {
          materialId: id,
          title: meta.title,
          description: meta.description,
          priceHkd: meta.priceHkd,
          yearTag: meta.yearTag,
          summary: meta.summary,
          subcategory: meta.subcategory,
          searchTags: meta.searchTags,
          contentLanguage: meta.contentLanguage,
        },
      });
    } else {
      const saved = await saveNoteDraft({ data: { materialId: id, ...meta } });
      id = saved.materialId;
      setMaterialId(id);
    }
    if (!id) throw new Error(t("notes.form.save_failed"));
    await setMaterialCollection({ data: { materialId: id, collectionId } });
    await setMaterialVariant({
      data: { materialId: id, variantOfId: variant.variantOfId, label: variant.label },
    });

    // 2. Files that go straight to Storage (main PDF + new extras).
    const newExtras = isLive ? [] : extras.filter((e) => e.file);
    const imagesAsExtras = pdfFile && images.length > 0 && !isLive ? images : [];
    const extraFiles: { key: string; file: File }[] = [
      ...newExtras.map((e) => ({ key: e.key, file: e.file as File })),
      ...imagesAsExtras.map((file) => ({ key: nextKey(), file })),
    ];
    const uploadMain = mainLocal && !apkgFile ? mainLocal : null;
    if (uploadMain || extraFiles.length > 0) {
      const targets = await createNoteUploadTargets({
        data: {
          materialId: id,
          files: [
            ...(uploadMain
              ? [{ role: "main" as const, fileName: uploadMain.name, sizeBytes: uploadMain.size }]
              : []),
            ...extraFiles.map((x) => ({
              role: "extra" as const,
              fileName: x.file.name,
              sizeBytes: x.file.size,
            })),
          ],
        },
      });
      let extraIndex = 0;
      const uploadedExtras: { path: string; fileName: string; sizeBytes: number }[] = [];
      for (const target of targets) {
        if (target.role === "main" && uploadMain) {
          await uploadToSignedUrl(target.signedUrl, uploadMain, (f) =>
            setProgress((p) => ({ ...p, main: f })),
          );
          await attachNoteMainPdf({
            data: {
              materialId: id,
              path: target.path,
              fileName: uploadMain.name,
              previewPageIndices: previewPicks,
            },
          });
        } else {
          const item = extraFiles[extraIndex];
          extraIndex += 1;
          await uploadToSignedUrl(target.signedUrl, item.file, (f) =>
            setProgress((p) => ({ ...p, [item.key]: f })),
          );
          uploadedExtras.push({
            path: target.path,
            fileName: item.file.name,
            sizeBytes: item.file.size,
          });
        }
      }
      if (!isLive && (extrasDirty || uploadedExtras.length > 0)) {
        await saveNoteExtras({
          data: {
            materialId: id,
            files: [
              ...extras
                .filter((e) => e.stored?.path)
                .map((e) => ({
                  path: e.stored?.path as string,
                  fileName: e.name,
                  sizeBytes: e.size,
                })),
              ...uploadedExtras,
            ],
            links: links.map((l) => ({ url: l.url, label: l.label || null })),
          },
        });
      }
    } else if (!isLive && extrasDirty) {
      await saveNoteExtras({
        data: {
          materialId: id,
          files: extras
            .filter((e) => e.stored?.path)
            .map((e) => ({ path: e.stored?.path as string, fileName: e.name, sizeBytes: e.size })),
          links: links.map((l) => ({ url: l.url, label: l.label || null })),
        },
      });
    }

    // 3. Flashcard decks (.apkg, <= 20 MB) keep the original base64 path.
    if (apkgFile) {
      await uploadNotePdf({
        data: { materialId: id, fileName: apkgFile.name, base64Data: await fileToBase64(apkgFile) },
      });
    }

    // 4. Re-picked preview pages on an already stored PDF.
    if (!uploadMain && !isLive && picksDirty && previewPicks && previewPicks.length > 0) {
      await updateNotePreviewPages({ data: { materialId: id, previewPageIndices: previewPicks } });
    }

    // 4b. #556 gallery: stamp + upload new images, then save the order.
    // #557 browse cards are photo-first: with no picture at all, the first
    // preview page (already public to buyers) becomes the card photo.
    let galleryFiles = galleryNew;
    if (galleryFiles.length === 0 && galleryKept.length === 0 && mainLocal && !isLive) {
      try {
        const doc = await openPdf(mainLocal);
        const firstPreviewPage = Math.min(doc.numPages, (previewPicks?.[0] ?? 0) + 1);
        const dataUrl = await renderPage(doc, firstPreviewPage, 800, "image/jpeg", 0.82);
        await doc.destroy();
        const blob = await (await fetch(dataUrl)).blob();
        galleryFiles = [new File([blob], "cover.jpg", { type: "image/jpeg" })];
      } catch {
        // No cover photo: the card shows its placeholder.
      }
    }
    // No PDF and no picture (Word / PPT / other files only): a clean cover
    // card from the title, so the listing and browse card still show a photo.
    if (galleryFiles.length === 0 && galleryKept.length === 0 && !mainLocal && !isLive) {
      try {
        galleryFiles = [
          await renderCoverCard({
            title: meta.title || t("notes.form.new_title"),
            subtitle: [meta.curriculumTag, meta.subjectTag].filter(Boolean).join(" · "),
            formats: Array.from(
              new Set(extras.map((e) => t(`notes.format.${e.format ?? "other"}`))),
            ),
          }),
        ];
      } catch {
        // keep the placeholder
      }
    }
    const galleryChanged =
      galleryFiles.length > 0 || galleryKept.length !== (existing?.previewImagePaths ?? []).length;
    if (galleryChanged) {
      const stamped = await Promise.all(galleryFiles.map((f) => watermarkImageFile(f)));
      let newPaths: string[] = [];
      if (stamped.length > 0) {
        const targets = await createNoteUploadTargets({
          data: {
            materialId: id,
            files: stamped.map((f) => ({
              role: "gallery" as const,
              fileName: f.name,
              sizeBytes: f.size,
            })),
          },
        });
        for (let i = 0; i < targets.length; i += 1) {
          await uploadToSignedUrl(targets[i].signedUrl, stamped[i]);
        }
        newPaths = targets.map((tg) => tg.path);
      }
      await saveNoteGallery({
        data: { materialId: id, paths: [...galleryKept, ...newPaths].slice(0, MAX_GALLERY_IMAGES) },
      });
    }

    // 5. Publish: the automatic check publishes, rejects or queues for staff.
    if (kind === "submit" && !isLive) {
      // #573 scanner: send the main PDF's text layer (none for scans).
      let fileText: string | null = null;
      const pageImages: string[] = [];
      const scanSource = officePdf ? null : (mainLocal ?? remoteMainUrl);
      if (!scanSource) {
        // Word / PPT / text files: read their text for the content check.
        const readable = extras.filter((e) => e.file && isTextExtractable(e.name)).slice(0, 3);
        const texts = await Promise.all(readable.map((e) => extractOfficeText(e.file as File)));
        fileText = texts.join("\n").slice(0, 60_000) || null;
      }
      if (scanSource) {
        try {
          const doc = await openPdf(scanSource);
          fileText = await extractPdfText(doc, 60_000, 200);
          // Scans / photos: the automatic review reads a few page images.
          if (fileText.replace(/\s+/g, "").length < 200) {
            for (let i = 1; i <= Math.min(4, doc.numPages); i += 1) {
              pageImages.push(await renderPage(doc, i, 900, "image/jpeg", 0.7));
            }
          }
          await doc.destroy();
        } catch {
          fileText = fileText ?? null;
        }
      }
      const result = await submitNoteForReview({
        data: {
          materialId: id,
          ...meta,
          legalAgreed: true,
          sellerDeclarations: { age: true, originality: true },
          legalOriginals,
          fileText,
          pageImages,
        },
      });
      if (result.status === "rejected") {
        // Shown on the Account page too (rejection reason); edit and resubmit.
        throw new Error(t("notes.auto.rejected", { reason: result.reason ?? "" }));
      }
      return result.status;
    }
    return null;
  };

  const saveMutation = useMutation({
    mutationFn: persist,
    onSuccess: (status, kind) => {
      toast.success(
        isLive
          ? t("notes.upload.live_saved")
          : kind === "submit"
            ? status === "published"
              ? t("notes_option_a.published_now")
              : t("notes_option_a.flagged_note")
            : t("notes.form.draft_saved"),
      );
      // SPA navigation keeps the /zh | /cn prefix; refresh the Account lists.
      void queryClient.invalidateQueries({ queryKey: ["account"] });
      void navigate({ to: "/account" });
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("notes.form.submit_failed")),
    onSettled: () => {
      setSaving(false);
      setProgress({});
    },
  });

  // Every click answers: a silent disabled button read as "Upload does nothing".
  const blockerMessage = (kind: "draft" | "submit"): string | null => {
    if (merging) return t("notes.form.still_processing");
    if (wordCountError || apkgTooLarge || (kind === "submit" && blockedByContact)) {
      return t("notes.form.fix_errors");
    }
    if (kind === "submit" && missing.length > 0) {
      return t("notes.form.missing_note", { fields: missing.join(", ") });
    }
    return null;
  };

  const run = (kind: "draft" | "submit") => {
    if (saving) return;
    const blocker = blockerMessage(kind);
    if (blocker) {
      toast.error(blocker);
      document
        .getElementById("note-missing-box")
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSaving(true);
    saveMutation.mutate(kind);
  };

  const violationNote = (violations: { match: string }[]) =>
    violations.length > 0 ? (
      <p className="text-xs text-destructive">
        {t("notes.form.contact_block", {
          match: violations
            .map((v) => v.match)
            .slice(0, 2)
            .join(", "),
        })}
      </p>
    ) : null;

  const progressBar = (key: string) =>
    progress[key] != null ? (
      <Progress value={Math.round((progress[key] ?? 0) * 100)} className="mt-1 h-1.5" />
    ) : null;

  const tags = parseTags(tagsText);

  return (
    <form
      className="space-y-8"
      onSubmit={(event) => {
        event.preventDefault();
        run("submit");
      }}
    >
      {/* 1. Files ------------------------------------------------------------- */}
      <section className="space-y-3">
        <div>
          <h2 className="text-base font-bold">{t("notes.upload.step_files")}</h2>
          <p className="text-sm text-muted-foreground">{t("notes.upload.step_files_hint")}</p>
        </div>

        {/* A native <label> opens the picker in every browser (Safari ignores
            a scripted input.click() fired from the input's own ancestor). */}
        <label
          htmlFor="note-files"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length > 0) addFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
            dragOver
              ? "border-[color:var(--brand-link)] bg-[color:var(--brand-link)]/5"
              : "border-border hover:bg-muted/30",
          )}
        >
          <Upload className="h-6 w-6 text-[color:var(--brand-link)]" aria-hidden />
          <p className="text-sm font-semibold">{t("notes.upload.drop_title")}</p>
          <p className="text-xs text-muted-foreground">{t("notes.upload.drop_formats")}</p>
          <span className="mt-1 inline-flex h-10 items-center rounded-full bg-[color:var(--brand-link)] px-5 text-sm font-semibold text-white">
            {t("notes.upload.choose_files")}
          </span>
          <input
            ref={fileInputRef}
            id="note-files"
            type="file"
            multiple
            className="sr-only"
            onChange={(e) => {
              if (e.target.files) addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </label>

        {/* Cloud link: import as the main PDF, or attach as a download link. */}
        <div className="space-y-1.5">
          <Label htmlFor="note-link">{t("notes.upload.link_label")}</Label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              id="note-link"
              value={linkInput}
              onChange={(e) => setLinkInput(e.target.value)}
              placeholder="https://drive.google.com/file/d/..."
              className="h-11 flex-1"
            />
            <Button
              type="button"
              variant="outline"
              disabled={importing || !linkInput.trim() || isLive}
              onClick={() => void importLink()}
            >
              {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
              {t("notes.upload.import_pdf")}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={!linkInput.trim() || isLive}
              onClick={addLink}
            >
              <Link2 className="mr-2 h-4 w-4" aria-hidden />
              {t("notes.upload.add_link")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("notes.upload.link_hint")}</p>
        </div>

        {/* What will be uploaded */}
        <ul className="space-y-2">
          {pdfFile ? (
            <li className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-3">
                <FileText className="h-4 w-4 shrink-0 text-[color:var(--brand-link)]" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{pdfFile.name}</span>
                <span className="text-xs text-muted-foreground">{formatBytes(pdfFile.size)}</span>
                <span className="rounded bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">
                  {t("notes.upload.badge_main")}
                </span>
                <button
                  type="button"
                  aria-label={t("notes.upload.remove")}
                  onClick={() => {
                    setPdfFile(null);
                    setPreviewPicks(null);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {progressBar("main")}
            </li>
          ) : null}
          {images.length > 0 ? (
            <li className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-3">
                <ImageIcon
                  className="h-4 w-4 shrink-0 text-[color:var(--brand-link)]"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 text-sm font-medium">
                  {pdfFile
                    ? t("notes.upload.images_as_extras", { count: images.length })
                    : t("notes.upload.images_merged", { count: images.length })}
                </span>
                {merging ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
                ) : null}
                <button
                  type="button"
                  aria-label={t("notes.upload.remove")}
                  onClick={() => setImages([])}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              </div>
              {!pdfFile ? progressBar("main") : null}
            </li>
          ) : null}
          {remoteMainUrl && !mainLocal ? (
            <li className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
              <FileText className="h-4 w-4 shrink-0 text-[color:var(--brand-link)]" aria-hidden />
              <span className="flex-1">{t("notes.upload.stored_main")}</span>
              <span className="rounded bg-accent px-1.5 text-[11px] font-semibold text-accent-foreground">
                {t("notes.upload.badge_main")}
              </span>
            </li>
          ) : null}
          {apkgFile ? (
            <li className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm">
              <Paperclip className="h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{apkgFile.name}</span>
              {apkgTooLarge ? (
                <span className="text-xs text-destructive">{t("notes.form.file_too_large")}</span>
              ) : null}
              <button
                type="button"
                aria-label={t("notes.upload.remove")}
                onClick={() => setApkgFile(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </li>
          ) : null}
          {extras.map((item) => (
            <li key={item.key} className="rounded-xl border border-border p-3">
              <div className="flex items-center gap-3 text-sm">
                <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                <span className="text-xs text-muted-foreground">
                  {item.size ? formatBytes(item.size) : ""}
                </span>
                <span className="rounded border border-border px-1.5 text-[11px] font-semibold">
                  {t(`notes.format.${item.format ?? "file"}`)}
                </span>
                {!isLive ? (
                  <button
                    type="button"
                    aria-label={t("notes.upload.remove")}
                    onClick={() => removeExtra(item.key)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </div>
              {progressBar(item.key)}
            </li>
          ))}
          {links.map((link) => (
            <li
              key={link.key}
              className="flex items-center gap-3 rounded-xl border border-border p-3 text-sm"
            >
              <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="min-w-0 flex-1 truncate">{link.url}</span>
              <span className="rounded border border-border px-1.5 text-[11px] font-semibold">
                {t(`notes.format.${detectLinkProvider(link.url) ?? "link"}`)}
              </span>
              {!isLive ? (
                <button
                  type="button"
                  aria-label={t("notes.upload.remove")}
                  onClick={() => {
                    setLinks((prev) => prev.filter((l) => l.key !== link.key));
                    setExtrasDirty(true);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        {links.length > 0 && !isLive ? (
          <label className="mt-2 flex items-start gap-2 text-xs text-[color:var(--ink)]">
            <Checkbox
              className="mt-0.5"
              checked={linkAck}
              onCheckedChange={(c) => setLinkAck(c === true)}
            />
            <span>{t("materials_store.link_ack")}</span>
          </label>
        ) : null}
        {isLive ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden />
            {t("notes.upload.live_files_note")}
          </p>
        ) : (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden />
            {t("notes.upload.private_note")}
          </p>
        )}
      </section>

      {/* 2. AI detection -------------------------------------------------------- */}
      <section className="space-y-2 rounded-2xl border border-border bg-muted/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-bold">
              <Sparkles className="h-4 w-4 text-[color:var(--brand-link)]" aria-hidden />
              {t("notes.ai.title")}
            </p>
            <p className="text-xs text-muted-foreground">{t("notes.ai.hint")}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={aiBusy || (!mainSource && !firstDocExtra)}
            onClick={() => void runDetect(true)}
          >
            {aiBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : null}
            {aiBusy ? t("notes.ai.running") : t("notes.ai.detect")}
          </Button>
        </div>
        {aiNote ? <p className="text-xs font-medium text-success">{aiNote}</p> : null}
        {aiError ? (
          <p role="alert" className="text-xs font-medium text-destructive">
            {aiError}
          </p>
        ) : null}
      </section>

      {/* 3. Preview pages ----------------------------------------------------- */}
      {mainSource && !isLive ? (
        <section className="space-y-3">
          <div>
            <h2 className="text-base font-bold">{t("notes.preview_pick.title")}</h2>
            <p className="text-sm text-muted-foreground">{t("notes.preview_pick.hint")}</p>
          </div>
          <NotePreviewPicker
            source={mainSource}
            selected={previewPicks}
            onChange={(next) => {
              setPreviewPicks(next);
              setPicksDirty(true);
            }}
            onPageCount={setMainPageCount}
            onLoadFailed={refreshRemoteMainUrl}
          />
        </section>
      ) : null}

      {/* 4. Details ---------------------------------------------------------------- */}
      <section className="space-y-5">
        <h2 className="text-base font-bold">{t("notes.upload.step_details")}</h2>
        <div className="space-y-1.5">
          <Label htmlFor="note-title">{t("notes.form.field_title")}</Label>
          <Input
            id="note-title"
            value={title}
            maxLength={160}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("notes.form.title_placeholder")}
            className="h-11"
          />
          {violationNote(copyViolations.titleV)}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="note-summary">{t("notes.upload.field_summary")}</Label>
          <Input
            id="note-summary"
            value={summary}
            maxLength={280}
            onChange={(e) => setSummary(e.target.value)}
            placeholder={t("notes.upload.summary_placeholder")}
            className="h-11"
          />
          {violationNote(copyViolations.summaryV)}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="note-description">{t("notes.form.field_contents")}</Label>
          <textarea
            id="note-description"
            value={description}
            maxLength={4000}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            placeholder={t("notes.form.contents_placeholder")}
            className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-[0.95rem] focus-visible:border-[color:var(--ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
          />
          {violationNote(copyViolations.descV)}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="note-curriculum">{t("notes.form.field_curriculum")}</Label>
            <Select
              value={curriculum}
              disabled={isLive}
              onValueChange={(v) => {
                setCurriculum(v);
                setSubject("");
                setSubcategory("");
              }}
            >
              <SelectTrigger id="note-curriculum" className="w-full">
                <SelectValue placeholder={t("notes.form.curriculum_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {NOTE_CURRICULA.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry === "Other" ? t("notes.form.curriculum_other") : entry}
                  </SelectItem>
                ))}
                {curriculum && !isNoteCurriculum(curriculum) ? (
                  <SelectItem value={curriculum}>
                    {curriculum} ({t("notes.form.legacy_value")})
                  </SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="note-subject">{t("notes.form.field_subject")}</Label>
            <Select value={subject} onValueChange={setSubject} disabled={isLive}>
              <SelectTrigger id="note-subject" className="w-full">
                <SelectValue placeholder={t("notes.form.subject_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {subjectOptions.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
                {subject && !subjectOptions.includes(subject) ? (
                  <SelectItem value={subject}>
                    {subject} ({t("notes.form.legacy_value")})
                  </SelectItem>
                ) : null}
              </SelectContent>
            </Select>
          </div>
        </div>

        {subcategoryOptions.length > 0 ? (
          <div className="space-y-1.5">
            <Label>{t("notes.upload.field_subcategory")}</Label>
            <div className="flex flex-wrap gap-2" role="group">
              {subcategoryOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={subcategory === option.value}
                  onClick={() => setSubcategory(subcategory === option.value ? "" : option.value)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
                    subcategory === option.value
                      ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--surface-invert-fg)]"
                      : "border-border bg-card hover:bg-[color:var(--surface-subtle)]",
                  )}
                >
                  {t(option.labelKey)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-4 sm:grid-cols-2">
          {/* #556: Mock, Exemplar and Flashcards are content tags under the Note pill. */}
          <div className="space-y-1.5">
            <Label>{t("materials_store.content_tags")}</Label>
            <div className="flex flex-wrap gap-2">
              {MATERIAL_TYPES.filter((type) => type !== "notes").map((type) => (
                <button
                  key={type}
                  type="button"
                  disabled={isLive}
                  aria-pressed={materialType === type}
                  onClick={() => {
                    setMaterialType(materialType === type ? "notes" : type);
                    if (materialType === "exemplar" || type !== "exemplar") {
                      setGradeAchieved("");
                      setExemplarPermission(false);
                    }
                  }}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium disabled:opacity-60",
                    materialType === type
                      ? "border-[color:var(--ink)] bg-[color:var(--ink)]/5 text-[color:var(--ink)]"
                      : "border-border text-[color:var(--ink)]/70",
                  )}
                >
                  {t(`notes.form.type_${type}`)}
                </button>
              ))}
            </div>
            {materialType === "mock" && !isLive ? (
              <label className="flex items-start gap-2 pt-1 text-xs text-[color:var(--ink)]">
                <Checkbox
                  className="mt-0.5"
                  checked={legalOriginals}
                  onCheckedChange={(c) => setLegalOriginals(c === true)}
                />
                <span>{t("materials_store.mock_attest")}</span>
              </label>
            ) : null}
          </div>
          <CollectionPicker
            materialId={materialId ?? null}
            value={collectionId}
            onChange={setCollectionId}
          />
          <VariantPicker
            materialId={materialId ?? null}
            value={variant}
            onChange={setVariant}
          />
          <div className="space-y-1.5">
            <Label htmlFor="note-language">{t("notes.upload.field_language")}</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger id="note-language" className="w-full">
                <SelectValue placeholder={t("notes.upload.language_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_LANGUAGES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {t(`notes.language.${code}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="note-tags">{t("notes.upload.field_tags")}</Label>
            {/* #553 / #543: freestyle # tag chips with suggestions. */}
            <TagChipsInput
              id="note-tags"
              tags={tags}
              onChange={(next) => setTagsText(next.join(", "))}
              placeholder={t("notes.upload.tags_chip_placeholder")}
              suggestions={TAG_SUGGESTIONS}
            />
          </div>
        </div>

        {materialType === "exemplar" ? (
          <div className="space-y-3 rounded-2xl border border-border bg-muted/30 p-4 sm:p-5">
            <div className="space-y-1.5">
              <Label htmlFor="note-grade">{t("notes.form.field_grade")}</Label>
              <Input
                id="note-grade"
                value={gradeAchieved}
                maxLength={GRADE_ACHIEVED_MAX_LEN}
                onChange={(e) => setGradeAchieved(e.target.value)}
                placeholder={t("notes.form.grade_placeholder")}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">{t("notes.form.grade_hint")}</p>
              {violationNote(copyViolations.gradeV)}
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
              <Checkbox
                checked={exemplarPermission}
                onCheckedChange={(c) => setExemplarPermission(c === true)}
                className="mt-1"
              />
              <span>{t("notes.form.exemplar_permission")}</span>
            </label>
          </div>
        ) : null}
        {/* #543 CEO lock: short first paint; the extras live under More details. */}
        <details className="group rounded-2xl border border-border p-4 sm:p-5">
          <summary className="cursor-pointer list-none text-sm font-bold text-[color:var(--ink)] [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">+ </span>
            <span className="hidden group-open:inline">− </span>
            {t("notes.form.more_details")}
            <span className="ml-1 font-normal text-muted-foreground">
              {t("notes.form.more_details_hint")}
            </span>
          </summary>
          <div className="mt-4 space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="note-topic">{t("notes.form.field_topic")}</Label>
                <Input
                  id="note-topic"
                  value={topic}
                  maxLength={NOTE_TOPIC_MAX_LEN}
                  disabled={isLive}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder={t("notes.form.topic_placeholder")}
                  className="h-11"
                />
                {violationNote(copyViolations.topicV)}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="note-year">{t("notes.form.field_year")}</Label>
                <Input
                  id="note-year"
                  value={year}
                  maxLength={20}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="2026"
                  className="h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="note-word-count">{t("notes.form.field_word_count")}</Label>
                <Input
                  id="note-word-count"
                  type="number"
                  min={1}
                  step="1"
                  value={wordCount}
                  disabled={isLive}
                  onChange={(e) => setWordCount(e.target.value)}
                  placeholder="12000"
                  className="h-11"
                />
                <p className="text-xs text-muted-foreground">{t("notes.form.word_count_hint")}</p>
                {wordCountError ? (
                  <p className="text-xs text-destructive">{t("notes.form.word_count_invalid")}</p>
                ) : null}
              </div>
            </div>
            {/* #556 rich listing: trailer, highlights, syllabus, gallery. */}
            <div className="space-y-1.5">
              <Label htmlFor="note-trailer">{t("notes.rich.field_trailer")}</Label>
              <Input
                id="note-trailer"
                value={trailerUrl}
                onChange={(e) => setTrailerUrl(e.target.value)}
                placeholder={t("notes.rich.trailer_placeholder")}
                className="h-11"
              />
              {trailerUrl.trim() && !trailerEmbedUrl(trailerUrl) ? (
                <p className="text-xs text-destructive">{t("notes.rich.trailer_invalid")}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{t("notes.rich.trailer_hint")}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note-included">{t("notes.rich.field_included")}</Label>
              <Input
                id="note-included"
                value={includedText}
                onChange={(e) => setIncludedText(e.target.value)}
                placeholder={t("notes.rich.included_placeholder")}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="note-syllabus">{t("notes.rich.field_syllabus")}</Label>
              <textarea
                id="note-syllabus"
                value={syllabus}
                maxLength={SYLLABUS_MAX}
                onChange={(e) => setSyllabus(e.target.value)}
                rows={4}
                placeholder={t("notes.rich.syllabus_placeholder")}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-[0.95rem] focus-visible:border-[color:var(--ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
              />
            </div>
            <div className="space-y-2">
              <Label>{t("notes.rich.field_gallery")}</Label>
              <div className="flex flex-wrap gap-2">
                {galleryKept.map((path) => (
                  <div
                    key={path}
                    className="relative h-20 w-28 overflow-hidden rounded-md border border-border"
                  >
                    <img
                      src={materialCoverUrl(path) ?? ""}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label={t("notes.upload.remove")}
                      onClick={() => setGalleryKept((prev) => prev.filter((p) => p !== path))}
                      className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                ))}
                {galleryNew.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="relative flex h-20 w-28 items-center justify-center overflow-hidden rounded-md border border-dashed border-border px-1 text-center text-[11px]"
                  >
                    {file.name}
                    <button
                      type="button"
                      aria-label={t("notes.upload.remove")}
                      onClick={() => setGalleryNew((prev) => prev.filter((_, i) => i !== index))}
                      className="absolute right-1 top-1 rounded bg-black/60 p-0.5 text-white"
                    >
                      <X className="h-3 w-3" aria-hidden />
                    </button>
                  </div>
                ))}
                {galleryKept.length + galleryNew.length < MAX_GALLERY_IMAGES ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="h-20"
                    onClick={() => galleryInputRef.current?.click()}
                  >
                    <ImageIcon className="mr-2 h-4 w-4" aria-hidden />
                    {t("notes.rich.gallery_add")}
                  </Button>
                ) : null}
              </div>
              <input
                ref={galleryInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="sr-only"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []).filter(
                    (f) => f.size <= MAX_GALLERY_IMAGE_BYTES,
                  );
                  const room = MAX_GALLERY_IMAGES - galleryKept.length - galleryNew.length;
                  setGalleryNew((prev) => [...prev, ...picked.slice(0, Math.max(0, room))]);
                  e.target.value = "";
                }}
              />
              <p className="text-xs text-muted-foreground">{t("notes.rich.gallery_hint")}</p>
            </div>
          </div>
        </details>
      </section>

      {/* 5. Price ---------------------------------------------------------------------- */}
      <section className="space-y-3">
        <h2 className="text-base font-bold">{t("notes.upload.step_price")}</h2>
        <div className="space-y-1.5">
          <Label htmlFor="note-price">{t("notes.form.field_price")}</Label>
          <Input
            id="note-price"
            type="number"
            min={0}
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={t("notes.form.price_free_hint")}
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">
            {t("notes.form.price_free_note")} {t("notes_option_a.price_rule")}
          </p>
          {priceProblem === "below_minimum" ? (
            <p className="text-xs text-destructive">{t("notes_option_a.price_below_minimum")}</p>
          ) : priceProblem === "above_maximum" ? (
            <p className="text-xs text-destructive">{t("notes_option_a.price_above_maximum")}</p>
          ) : null}
        </div>
        <NotePriceGuidePanel
          materialType={materialType}
          curriculumTag={curriculum}
          subjectTag={subject}
          subcategory={subcategory}
          pageCount={mainPageCount}
          excludeId={materialId ?? null}
          priceHkd={Number.isNaN(priceNum) ? null : priceNum}
          onUsePrice={(value) => setPrice(String(value))}
        />
        {NOTES_OPTION_A_LIVE ? (
          <EarningsCalculator
            priceHkd={Number.isNaN(priceNum) ? 0 : priceNum}
            materialType={materialType}
          />
        ) : null}
      </section>

      {!isLive ? (
        <section className="space-y-3 rounded-2xl border border-border p-4">
          <p className="text-sm font-bold">{t("notes_option_a.declare_title")}</p>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
            <Checkbox
              checked={declareAge}
              onCheckedChange={(c) => setDeclareAge(c === true)}
              className="mt-1"
            />
            <span>{t("notes_option_a.declare_age")}</span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 text-sm leading-6">
            <Checkbox
              checked={declareOriginality}
              onCheckedChange={(c) => setDeclareOriginality(c === true)}
              className="mt-1"
            />
            <span>{t("notes_option_a.declare_originality")}</span>
          </label>
        </section>
      ) : null}

      {!isLive ? (
        <TermsGateCheckbox
          section="notes"
          checked={termsAccepted}
          onCheckedChange={setTermsAccepted}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        {!isLive ? (
          <Button type="button" variant="outline" disabled={saving} onClick={() => run("draft")}>
            {saving && saveMutation.variables === "draft" ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : null}
            {t("notes.form.save_draft")}
          </Button>
        ) : (
          <span />
        )}
        <Button
          type="submit"
          variant="solid"
          color="accent"
          disabled={saving}
          aria-disabled={missing.length > 0 || blockedByContact || undefined}
          className={cn("font-bold", (missing.length > 0 || blockedByContact) && "opacity-70")}
        >
          {saving && saveMutation.variables === "submit" ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {isLive ? t("notes.upload.save_live") : t("notes.form.submit_review")}
        </Button>
      </div>
      {missing.length > 0 && !blockedByContact && (
        <p
          id="note-missing-box"
          role="status"
          className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100"
        >
          {t("notes.form.missing_note", { fields: missing.join(", ") })}
        </p>
      )}
      {!isLive ? <p className="text-xs text-muted-foreground">{t("notes.auto.hint")}</p> : null}
      <p className="text-xs text-muted-foreground">
        {t("notes.upload.guide_prompt")}{" "}
        <Link to="/guide/notes" className="font-semibold text-[color:var(--brand-link)] underline">
          {t("notes.upload.guide_link")}
        </Link>
      </p>
      {bulkFiles ? (
        <BulkNotesDialog
          files={bulkFiles}
          sharedMeta={payload}
          upload={uploadToSignedUrl}
          onClose={() => setBulkFiles(null)}
        />
      ) : null}
    </form>
  );
}
