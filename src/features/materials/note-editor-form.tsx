import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findContactViolations } from "@/lib/contact-filter";
import { MIN_PRICE_HKD } from "@/features/materials/lifecycle";
import {
  saveNoteDraft,
  submitNoteForReview,
  type MyMaterialsRow,
} from "@/features/materials/note-drafts.functions";

/**
 * P8 (#288) / P9 (#289): the draft-or-submit note form, shared by
 * /account/notes/new and /account/notes/$id/edit. Any subset saves as a
 * draft; submit enforces the required fields (title, price, PDF) and the
 * HK$30 floor, and runs the contact filter client-side so the tutor sees
 * which sentence failed before the server rejects it.
 */

const DOC_TYPES = ["custom_notes", "ia", "ee", "tok_essay", "mock_exam"] as const;

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

export function NoteEditorForm({ existing }: { existing?: MyMaterialsRow | null }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<string>(
    existing && existing.priceHkd > 0 ? String(existing.priceHkd) : "",
  );
  const [curriculum, setCurriculum] = useState("");
  const [subject, setSubject] = useState("");
  const [documentType, setDocumentType] = useState<(typeof DOC_TYPES)[number]>("custom_notes");
  const [year, setYear] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const copyViolations = useMemo(() => {
    const titleV = findContactViolations(title);
    const descV = findContactViolations(description);
    return { titleV, descV };
  }, [title, description]);

  const done = () => {
    window.location.assign("/account");
  };

  const draftMutation = useMutation({
    mutationFn: async () => {
      const base64 = file ? await fileToBase64(file) : undefined;
      return saveNoteDraft({
        data: {
          materialId: existing?.id,
          title: title.trim() || undefined,
          description: description.trim() || undefined,
          priceHkd: price ? Number(price) : undefined,
          curriculumTag: curriculum.trim() || undefined,
          subjectTag: subject.trim() || undefined,
          documentType,
          yearTag: year.trim() || undefined,
        },
      });
    },
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
          title: title.trim(),
          description: description.trim() || undefined,
          priceHkd: Number(price),
          curriculumTag: curriculum.trim() || undefined,
          subjectTag: subject.trim() || undefined,
          documentType,
          yearTag: year.trim() || undefined,
          base64Data: base64,
          fileName: file?.name,
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
  if (!price || Number(price) < MIN_PRICE_HKD)
    missing.push(`${t("notes.form.field_price")} (min HK$${MIN_PRICE_HKD})`);
  if (!file && !existing?.previewUrl) missing.push(t("notes.form.field_pdf"));

  const blockedByContact = copyViolations.titleV.length > 0 || copyViolations.descV.length > 0;

  const run = (kind: "draft" | "submit") => {
    setSaving(true);
    if (kind === "draft") draftMutation.mutate();
    else submitMutation.mutate();
  };

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
        {copyViolations.titleV.length > 0 && (
          <p className="text-xs text-[#B42318]">
            {t("notes.form.contact_block", {
              match: copyViolations.titleV
                .map((v) => v.match)
                .slice(0, 2)
                .join(", "),
            })}
          </p>
        )}
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
        {copyViolations.descV.length > 0 && (
          <p className="text-xs text-[#B42318]">
            {t("notes.form.contact_block", {
              match: copyViolations.descV
                .map((v) => v.match)
                .slice(0, 2)
                .join(", "),
            })}
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="note-price">{t("notes.form.field_price")}</Label>
          <Input
            id="note-price"
            type="number"
            min={MIN_PRICE_HKD}
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder={`HK$ (min ${MIN_PRICE_HKD})`}
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note-type">{t("notes.form.field_type")}</Label>
          <select
            id="note-type"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as (typeof DOC_TYPES)[number])}
            className="h-11 w-full rounded-md border border-input bg-transparent px-3 text-[0.95rem]"
          >
            {DOC_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`materials.doc_type_${type}`)}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note-curriculum">{t("notes.form.field_curriculum")}</Label>
          <Input
            id="note-curriculum"
            value={curriculum}
            maxLength={160}
            onChange={(e) => setCurriculum(e.target.value)}
            placeholder="IB / DSE / A-Level"
            className="h-11"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="note-subject">{t("notes.form.field_subject")}</Label>
          <Input
            id="note-subject"
            value={subject}
            maxLength={160}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Physics"
            className="h-11"
          />
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
          <Label htmlFor="note-pdf">
            {existing?.previewUrl ? t("notes.form.replace_pdf") : t("notes.form.field_pdf")}
          </Label>
          <Input
            id="note-pdf"
            type="file"
            accept="application/pdf"
            className="h-11 cursor-pointer"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden />
            {t("notes.form.pdf_hint")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <Button type="button" variant="outline" disabled={saving} onClick={() => run("draft")}>
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
          disabled={saving || blockedByContact || missing.length > 0}
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
