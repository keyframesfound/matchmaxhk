import { useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, Lock } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { findContactViolations } from "@/lib/contact-filter";
import {
  DEFAULT_TURNAROUND_HOURS,
  GIG_CATEGORIES,
  GIG_DELIVERY_TYPES,
  GIG_DESCRIPTION_MAX_LEN,
  GIG_MIN_PRICE_HKD,
  GIG_TITLE_MAX_LEN,
  GIG_TURNAROUND_NOTE_MAX_LEN,
  TURNAROUND_PRESETS,
  gigCategoryLabelKey,
  gigDeliveryLabelKey,
} from "@/features/gigs/gig";
import {
  MAX_GIG_COVER_BYTES,
  createGigDraft,
  submitGig,
  updateGigDraft,
  uploadGigCover,
  type MyGigRow,
} from "@/features/gigs/gig-drafts.functions";
import { NOTE_CURRICULA } from "@/features/materials/lifecycle";
import { getSubjectOptionsForCategory } from "@/features/tutors/subjects";
import { fileToBase64 } from "@/features/gigs/gig-files";

/* Radix Select items can't hold an empty value, so the optional "any"
 * curriculum/subject choices ride this sentinel and map back to "". */
const GIG_ANY_VALUE = "__any__";

/**
 * #326/#327: the draft-or-submit gig form, shared by
 * /account/services/new and /account/services/$materialId/edit. Mirrors
 * the note-editor-form anatomy: any subset saves as a draft; submit
 * enforces title/description/price/category/delivery type/cover and (for
 * document review) the academic-integrity checkbox. The cover rides a
 * separate upload fn, the draft is saved first so the image has an owner.
 */

const isNoteCurriculum = (value: string): value is (typeof NOTE_CURRICULA)[number] =>
  (NOTE_CURRICULA as readonly string[]).includes(value);

export function GigEditorForm({ existing }: { existing?: MyGigRow | null }) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(existing?.title ?? "");
  // Hydrate the stored description on edit (grok review 2026-10-17): the
  // submit gate requires a non-empty description, so an always-"" textarea
  // left Submit for review permanently disabled until the tutor retyped
  // the whole text blind.
  const [description, setDescription] = useState(existing?.description ?? "");
  const [price, setPrice] = useState<string>(existing ? String(existing.priceHkd ?? "") : "");
  const [category, setCategory] = useState<string>(existing?.category ?? "");
  const [deliveryType, setDeliveryType] = useState<string>(existing?.deliveryType ?? "");
  const [turnaroundHours, setTurnaroundHours] = useState<number>(
    existing?.turnaroundHours ?? DEFAULT_TURNAROUND_HOURS,
  );
  const [turnaroundNote, setTurnaroundNote] = useState(existing?.turnaroundNote ?? "");
  const [curriculum, setCurriculum] = useState<string>(existing?.curriculumTag ?? "");
  const [subject, setSubject] = useState<string>(existing?.subjectTag ?? "");
  // document_review integrity: a stored timestamp renders as confirmed.
  const [integrityConfirmed, setIntegrityConfirmed] = useState(
    existing?.integrityConfirmed === true,
  );
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const subjectOptions = useMemo(
    () => getSubjectOptionsForCategory(curriculum || undefined),
    [curriculum],
  );

  const copyViolations = useMemo(() => {
    const titleV = findContactViolations(title);
    const descV = findContactViolations(description);
    const noteV = findContactViolations(turnaroundNote);
    return { titleV, descV, noteV };
  }, [title, description, turnaroundNote]);

  const done = () => {
    window.location.assign("/account");
  };

  const payload = () => ({
    title: title.trim(),
    description: description.trim() || undefined,
    priceHkd: price.trim() === "" ? undefined : Number(price),
    category: category || undefined,
    deliveryType: deliveryType || undefined,
    turnaroundNote: turnaroundNote.trim() || null,
    turnaroundHours,
    curriculumTag: isNoteCurriculum(curriculum) ? curriculum : undefined,
    subjectTag: subject.trim() || null,
    integrityConfirmed: category === "document_review" ? integrityConfirmed : undefined,
  });

  const saveGigId = async (): Promise<string> => {
    const gigId = existing?.id
      ? (await updateGigDraft({ data: { gigId: existing.id, ...payload() } })).gigId
      : (await createGigDraft({ data: payload() })).gigId;
    if (coverFile) {
      const base64 = await fileToBase64(coverFile);
      await uploadGigCover({ data: { gigId, fileName: coverFile.name, base64Data: base64 } });
    }
    return gigId;
  };

  const draftMutation = useMutation({
    mutationFn: () => saveGigId(),
    onSuccess: () => {
      toast.success(t("gigs.form.draft_saved"));
      done();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("gigs.form.save_failed")),
    onSettled: () => setSaving(false),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      const gigId = await saveGigId();
      return submitGig({ data: { gigId, ...payload() } });
    },
    onSuccess: () => {
      toast.success(t("gigs.form.submitted"));
      done();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("gigs.form.submit_failed")),
    onSettled: () => setSaving(false),
  });

  const missing: string[] = [];
  if (title.trim().length < 3) missing.push(t("gigs.form.field_title"));
  if (!description.trim()) missing.push(t("gigs.form.field_description"));
  const priceNum = price.trim() === "" ? Number.NaN : Number(price);
  if (Number.isNaN(priceNum) || !Number.isInteger(priceNum) || priceNum < GIG_MIN_PRICE_HKD) {
    missing.push(t("gigs.form.field_price"));
  }
  if (!category) missing.push(t("gigs.form.field_category"));
  if (!deliveryType) missing.push(t("gigs.form.field_delivery"));
  if (!coverFile && !existing?.coverUrl) missing.push(t("gigs.form.field_cover"));
  if (category === "document_review" && !integrityConfirmed) {
    missing.push(t("gigs.form.integrity_missing"));
  }

  const coverTooLarge = coverFile != null && coverFile.size > MAX_GIG_COVER_BYTES;
  const blockedByContact =
    copyViolations.titleV.length > 0 ||
    copyViolations.descV.length > 0 ||
    copyViolations.noteV.length > 0;

  const run = (kind: "draft" | "submit") => {
    if (coverTooLarge) return;
    setSaving(true);
    if (kind === "draft") draftMutation.mutate();
    else submitMutation.mutate();
  };

  const violationNote = (violations: { match: string }[]) =>
    violations.length > 0 ? (
      <p className="text-xs text-destructive">
        {t("gigs.form.contact_block", {
          match: violations
            .map((v) => v.match)
            .slice(0, 2)
            .join(", "),
        })}
      </p>
    ) : null;

  const showJoinHint = deliveryType === "session_confirm" || deliveryType === "package_handoff";

  return (
    <form
      className="space-y-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!blockedByContact && missing.length === 0) run("submit");
      }}
    >
      <div className="space-y-1.5">
        <Label htmlFor="gig-title">{t("gigs.form.field_title")}</Label>
        <Input
          id="gig-title"
          value={title}
          maxLength={GIG_TITLE_MAX_LEN}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t("gigs.form.title_placeholder")}
          className="h-11"
        />
        {violationNote(copyViolations.titleV)}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="gig-description">{t("gigs.form.field_description")}</Label>
        <textarea
          id="gig-description"
          value={description}
          maxLength={GIG_DESCRIPTION_MAX_LEN}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder={t("gigs.form.description_placeholder")}
          className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-[0.95rem] focus-visible:border-[color:var(--ring)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
        />
        {violationNote(copyViolations.descV)}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="gig-price">{t("gigs.form.field_price")}</Label>
          <Input
            id="gig-price"
            type="number"
            min={GIG_MIN_PRICE_HKD}
            step="1"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="250"
            className="h-11"
          />
          <p className="text-xs text-muted-foreground">{t("gigs.form.price_note")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gig-category">{t("gigs.form.field_category")}</Label>
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              if (v !== "document_review") setIntegrityConfirmed(false);
            }}
          >
            <SelectTrigger id="gig-category" className="w-full">
              <SelectValue placeholder={t("gigs.form.category_placeholder")} />
            </SelectTrigger>
            <SelectContent>
              {GIG_CATEGORIES.map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {t(gigCategoryLabelKey(entry))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gig-delivery">{t("gigs.form.field_delivery")}</Label>
          <Select value={deliveryType} onValueChange={setDeliveryType}>
            <SelectTrigger id="gig-delivery" className="w-full">
              <SelectValue placeholder={t("gigs.form.field_delivery")} />
            </SelectTrigger>
            <SelectContent>
              {GIG_DELIVERY_TYPES.map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {t(gigDeliveryLabelKey(entry))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gig-turnaround">{t("gigs.form.field_turnaround")}</Label>
          <Select
            value={String(turnaroundHours)}
            onValueChange={(v) => setTurnaroundHours(Number(v))}
          >
            <SelectTrigger id="gig-turnaround" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TURNAROUND_PRESETS.map((preset) => (
                <SelectItem key={preset.hours} value={String(preset.hours)}>
                  {t("gigs.form.turnaround_hours", { hours: preset.hours })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{t("gigs.form.turnaround_hint")}</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gig-turnaround-note">{t("gigs.form.field_turnaround_note")}</Label>
          <Input
            id="gig-turnaround-note"
            value={turnaroundNote}
            maxLength={GIG_TURNAROUND_NOTE_MAX_LEN}
            onChange={(e) => setTurnaroundNote(e.target.value)}
            placeholder={t("gigs.form.turnaround_note_placeholder")}
            className="h-11"
          />
          {violationNote(copyViolations.noteV)}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gig-curriculum">{t("gigs.form.field_curriculum")}</Label>
          <Select
            value={curriculum === "" ? GIG_ANY_VALUE : curriculum}
            onValueChange={(v) => {
              setCurriculum(v === GIG_ANY_VALUE ? "" : v);
              setSubject("");
            }}
          >
            <SelectTrigger id="gig-curriculum" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GIG_ANY_VALUE}>{t("gigs.form.curriculum_placeholder")}</SelectItem>
              {NOTE_CURRICULA.map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {entry}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="gig-subject">{t("gigs.form.field_subject")}</Label>
          <Select
            value={subject === "" ? GIG_ANY_VALUE : subject}
            onValueChange={(v) => setSubject(v === GIG_ANY_VALUE ? "" : v)}
          >
            <SelectTrigger id="gig-subject" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={GIG_ANY_VALUE}>{t("gigs.form.subject_placeholder")}</SelectItem>
              {subjectOptions.map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {entry}
                </SelectItem>
              ))}
              {subject && !subjectOptions.includes(subject) ? (
                <SelectItem value={subject}>
                  {subject} ({t("gigs.form.legacy_value")})
                </SelectItem>
              ) : null}
            </SelectContent>
          </Select>
        </div>
      </div>

      {showJoinHint ? (
        <p className="rounded-xl border border-border bg-muted/30 p-3 text-xs leading-5 text-muted-foreground">
          {t("gigs.form.delivery_join_hint")}
        </p>
      ) : null}

      {category === "document_review" ? (
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border bg-muted/30 p-4 text-sm leading-6 sm:p-5">
          <Checkbox
            checked={integrityConfirmed}
            onCheckedChange={(c) => setIntegrityConfirmed(c === true)}
            className="mt-1"
          />
          <span>{t("gigs.form.integrity_label")}</span>
        </label>
      ) : null}

      <div className="space-y-1.5">
        <Label htmlFor="gig-cover">
          {coverFile || existing?.coverUrl
            ? t("gigs.form.replace_cover")
            : t("gigs.form.field_cover")}
        </Label>
        <Input
          id="gig-cover"
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="h-11 cursor-pointer"
          onChange={(e) => {
            if (coverPreview) URL.revokeObjectURL(coverPreview);
            const next = e.target.files?.[0] ?? null;
            setCoverFile(next);
            setCoverPreview(next ? URL.createObjectURL(next) : null);
          }}
        />
        {coverPreview ? (
          <img
            src={coverPreview}
            alt=""
            className="h-32 w-48 rounded-lg border border-border object-cover"
          />
        ) : existing?.coverUrl ? (
          <img
            src={existing.coverUrl}
            alt=""
            className="h-32 w-48 rounded-lg border border-border object-cover"
            loading="lazy"
          />
        ) : null}
        {coverTooLarge ? (
          <p className="text-xs text-destructive">{t("gigs.form.cover_too_large")}</p>
        ) : (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Lock className="h-3 w-3" aria-hidden />
            {t("gigs.form.cover_hint")}
          </p>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5">
        <Button
          type="button"
          variant="outline"
          disabled={saving || coverTooLarge}
          onClick={() => run("draft")}
        >
          {saving && draftMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {t("gigs.form.save_draft")}
        </Button>
        <Button
          type="submit"
          variant="solid"
          color="accent"
          className="font-bold"
          disabled={saving || blockedByContact || missing.length > 0 || coverTooLarge}
        >
          {saving && submitMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
          ) : null}
          {t("gigs.form.submit_review")}
        </Button>
      </div>
      {missing.length > 0 && !blockedByContact && (
        <p className="text-xs text-muted-foreground">
          {t("gigs.form.missing_note", { fields: missing.join(", ") })}
        </p>
      )}
    </form>
  );
}
