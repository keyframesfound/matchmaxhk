import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  saveNoteDraft,
  submitNoteForReview,
  type MyMaterialsRow,
} from "@/features/materials/note-drafts.functions";

/**
 * P8 (#288) / P9 (#289) / #313 / #314 / #136: the draft-or-submit note form,
 * shared by /account/notes/new and /account/notes/$id/edit. Any subset saves
 * as a draft; submit enforces the required fields (title, price, file,
 * curriculum, subject, type) and the ban list via the contact filter, runs
 * it client-side (title, description, topic, grade achieved) so the tutor
 * sees which sentence failed before the server rejects it, gates exemplars
 * on the written-permission checkbox, allows HK$0 (free pack), and takes an
 * OPTIONAL approximate word count (positive integer when present). A
 * flashcards file may be a PDF or an .apkg deck (max 20MB — the repo upload
 * cap wins over the issue's 40MB); decks get no in-browser preview.
 */

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

const isNoteCurriculum = (value: string): value is (typeof NOTE_CURRICULA)[number] =>
  (NOTE_CURRICULA as readonly string[]).includes(value);

const isMaterialType = (value: string): value is MaterialType =>
  (MATERIAL_TYPES as readonly string[]).includes(value);

export function NoteEditorForm({ existing }: { existing?: MyMaterialsRow | null }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<string>(existing ? String(existing.priceHkd ?? 0) : "");
  const [curriculum, setCurriculum] = useState<string>(existing?.curriculumTag ?? "");
  const [subject, setSubject] = useState(existing?.subjectTag ?? "");
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
  const [year, setYear] = useState("");
  const [wordCount, setWordCount] = useState(
    existing?.wordCount != null ? String(existing.wordCount) : "",
  );
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  // Issue #214: the notes-terms gate — required for SUBMIT (drafts save
  // without it); the server fn re-validates and records the acceptance row.
  const [termsAccepted, setTermsAccepted] = useState(false);

  const subjectOptions = useMemo(
    () => getSubjectOptionsForCategory(curriculum || undefined),
    [curriculum],
  );

  const copyViolations = useMemo(() => {
    const titleV = findContactViolations(title);
    const descV = findContactViolations(description);
    const topicV = findContactViolations(topic);
    const gradeV = findContactViolations(gradeAchieved);
    return { titleV, descV, topicV, gradeV };
  }, [title, description, topic, gradeAchieved]);

  const done = () => {
    window.location.assign("/account");
  };

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
  });

  const draftMutation = useMutation({
    mutationFn: async () =>
      saveNoteDraft({
        data: {
          materialId: existing?.id,
          ...payload(),
        },
      }),
    onSuccess: () => {
      toast.success(t("notes.form.draft_saved"));
      done();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("notes.form.save_failed")),
    onSettled: () => setSaving(false),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const base64 = file ? await fileToBase64(file) : undefined;
      return submitNoteForReview({
        data: {
          materialId: existing?.id,
          ...payload(),
          base64Data: base64,
          fileName: file?.name,
          // Issue #214: only reachable with the terms gate checked (it sits
          // in the `missing` list below), but the server re-validates it.
          legalAgreed: true,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("notes.form.submitted"));
      done();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("notes.form.submit_failed")),
    onSettled: () => setSaving(false),
  });

  const missing: string[] = [];
  if (title.trim().length < 3) missing.push(t("notes.form.field_title"));
  const priceNum = price.trim() === "" ? Number.NaN : Number(price);
  if (Number.isNaN(priceNum) || priceNum < 0) missing.push(t("notes.form.field_price"));
  if (!file && !existing?.previewUrl) missing.push(t("notes.form.field_pdf"));
  if (!curriculum) missing.push(t("notes.form.field_curriculum"));
  if (!subject.trim()) missing.push(t("notes.form.field_subject"));
  if (materialType === "exemplar" && !exemplarPermission)
    missing.push(t("notes.form.exemplar_permission_short"));
  // Issue #214: submit (not draft) is also the notes-terms acceptance click.
  if (!termsAccepted) missing.push(t("terms.gate.missing"));

  // #136: the approximate word count is OPTIONAL — empty never blocks
  // publish — but a present value must be a positive whole number.
  const wordCountError = validateWordCount(wordCount.trim() === "" ? null : Number(wordCount));
  // A present-but-invalid file is also a hard block (#314): only PDFs and,
  // for flashcards, .apkg decks are accepted, and the repo upload cap is
  // 20MB (the issue's 40MB loses to the Workers body limit).
  const fileTooLarge = file != null && file.size > MAX_APKG_BYTES;

  const blockedByContact =
    copyViolations.titleV.length > 0 ||
    copyViolations.descV.length > 0 ||
    copyViolations.topicV.length > 0 ||
    copyViolations.gradeV.length > 0;

  const run = (kind: "draft" | "submit") => {
    if (wordCountError || fileTooLarge) return;
    setSaving(true);
    if (kind === "draft") draftMutation.mutate();
    else submitMutation.mutate();
  };

  const violationNote = (violations: { match: string }[]) =>
    violations.length > 0 ? (
      <p className="text-xs text-[#B42318]">
        {t("notes.form.contact_block", {
          match: violations
            .map((v) => v.match)
            .slice(0, 2)
            .join(", "),
        })}
      </p>
    ) : null;

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!blockedByContact && missing.length === 0) run("submit");
      }}
    >
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
        <Label htmlFor="note-description">{t("notes.form.field_contents")}</Label>
        <textarea
          id="note-description"
          value={description}
          maxLength={4000}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder={t("notes.form.contents_placeholder")}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-[0.95rem] focus-visible:border-[color:var(--ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40"
        />
        {violationNote(copyViolations.descV)}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="note-curriculum">{t("notes.form.field_curriculum")}</Label>
          <select
            id="note-curriculum"
            value={curriculum}
            onChange={(e) => {
              setCurriculum(e.target.value);
              setSubject("");
            }}
            className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-[0.95rem]"
          >
            <option value="" disabled>
              {t("notes.form.curriculum_placeholder")}
            </option>
            {NOTE_CURRICULA.map((entry) => (
              <option key={entry} value={entry}>
                {entry === "Other" ? t("notes.form.curriculum_other") : entry}
              </option>
            ))}
            {/* #313 review fix: legacy free-text values stay visible so the
                owner can migrate them onto the canonical list. */}
            {curriculum && !isNoteCurriculum(curriculum) ? (
              <option value={curriculum}>
                {curriculum} ({t("notes.form.legacy_value")})
              </option>
            ) : null}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note-subject">{t("notes.form.field_subject")}</Label>
          <select
            id="note-subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-[0.95rem]"
          >
            <option value="" disabled>
              {t("notes.form.subject_placeholder")}
            </option>
            {subjectOptions.map((entry) => (
              <option key={entry} value={entry}>
                {entry}
              </option>
            ))}
            {/* #313 review fix: a stored subject outside the current
                curriculum's list still renders instead of a blank select. */}
            {subject && !subjectOptions.includes(subject) ? (
              <option value={subject}>
                {subject} ({t("notes.form.legacy_value")})
              </option>
            ) : null}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note-type">{t("notes.form.field_type")}</Label>
          <select
            id="note-type"
            value={materialType}
            onChange={(e) => {
              if (isMaterialType(e.target.value)) {
                setMaterialType(e.target.value);
                if (e.target.value !== "exemplar") {
                  setGradeAchieved("");
                  setExemplarPermission(false);
                }
              }
            }}
            className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-[0.95rem]"
          >
            {MATERIAL_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`notes.form.type_${type}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note-topic">{t("notes.form.field_topic")}</Label>
          <Input
            id="note-topic"
            value={topic}
            maxLength={NOTE_TOPIC_MAX_LEN}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={t("notes.form.topic_placeholder")}
            className="h-11"
          />
          {violationNote(copyViolations.topicV)}
        </div>
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
          <p className="text-xs text-muted-foreground">{t("notes.form.price_free_note")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note-word-count">{t("notes.form.field_word_count")}</Label>
          <Input
            id="note-word-count"
            type="number"
            min={1}
            step="1"
            value={wordCount}
            onChange={(e) => setWordCount(e.target.value)}
            placeholder="12000"
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">{t("notes.form.word_count_hint")}</p>
          {wordCountError ? (
            <p className="text-xs text-[#B42318]">{t("notes.form.word_count_invalid")}</p>
          ) : null}
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
            <input
              type="checkbox"
              checked={exemplarPermission}
              onChange={(e) => setExemplarPermission(e.target.checked)}
              className="mt-1 h-4 w-4 shrink-0"
            />
            <span>{t("notes.form.exemplar_permission")}</span>
          </label>
        </div>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="note-pdf">
          {materialType === "flashcards"
            ? t("notes.form.field_file_flashcards")
            : existing?.previewUrl
              ? t("notes.form.replace_pdf")
              : t("notes.form.field_pdf")}
        </Label>
        <Input
          id="note-pdf"
          type="file"
          accept={materialType === "flashcards" ? "application/pdf,.pdf,.apkg" : "application/pdf"}
          className="h-11 cursor-pointer"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        {fileTooLarge ? (
          <p className="text-xs text-[#B42318]">{t("notes.form.file_too_large")}</p>
        ) : materialType === "flashcards" ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden />
            {t("notes.form.file_hint_flashcards")}
          </p>
        ) : (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden />
            {t("notes.form.pdf_hint")}
          </p>
        )}
      </div>

      {/* Issue #214: the notes-terms gate — required to submit for review;
          drafts save without it. Links the notes section of the ToS. */}
      <TermsGateCheckbox
        section="notes"
        checked={termsAccepted}
        onCheckedChange={setTermsAccepted}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <Button
          type="button"
          variant="outline"
          disabled={saving || Boolean(wordCountError) || fileTooLarge}
          onClick={() => run("draft")}
        >
          {saving && draftMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {t("notes.form.save_draft")}
        </Button>
        <Button
          type="submit"
          variant="solid"
          color="accent"
          className="font-bold"
          disabled={
            saving ||
            blockedByContact ||
            missing.length > 0 ||
            Boolean(wordCountError) ||
            fileTooLarge
          }
        >
          {saving && submitMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {t("notes.form.submit_review")}
        </Button>
      </div>
      {missing.length > 0 && !blockedByContact && (
        <p className="text-xs text-muted-foreground">
          {t("notes.form.missing_note", { fields: missing.join(", ") })}
        </p>
      )}
    </form>
  );
}
