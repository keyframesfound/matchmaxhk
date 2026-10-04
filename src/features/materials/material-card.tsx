import { useState } from "react";
import { useTranslation } from "react-i18next";
import { BookOpen, Gift, MessageCircle, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { StudyMaterial } from "@/features/materials/queries";

/**
 * Issues #131/#134: shared display pieces for the study-materials marketplace
 * (profile section + /study-materials directory). No shadows, border-defined
 * surfaces only; copy is i18n'd in both locales with the legal/issue copy
 * kept verbatim.
 */

export function MaterialStars({ rating }: { rating: number | null }) {
  const { t } = useTranslation();
  if (rating === null || Number.isNaN(rating)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-semibold text-[color:var(--ink)]">
        {t("materials.new_listing_badge")}
      </span>
    );
  }
  const rounded = Math.round(rating);
  return (
    <span
      className="inline-flex items-center gap-0.5"
      aria-label={t("materials.stars_aria", { rating: rating.toFixed(1) })}
    >
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "h-4 w-4",
            star <= rounded ? "fill-amber-400 text-amber-500" : "text-muted-foreground/40",
          )}
          aria-hidden
        />
      ))}
      <span className="ml-1 text-xs font-bold text-[color:var(--ink)]">{rating.toFixed(1)}</span>
    </span>
  );
}

export function RetentionBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
      <Gift className="h-3.5 w-3.5" aria-hidden />
      {t("materials.retention_badge")}
    </span>
  );
}

export function NoRefundNotice() {
  const { t } = useTranslation();
  return (
    <p className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
      {t("materials.no_refund_notice")}
    </p>
  );
}

export function MaterialPreviewDialog({
  material,
  open,
  onOpenChange,
}: {
  material: Pick<StudyMaterial, "title" | "watermarked_preview_url">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] w-full max-w-3xl flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-base font-bold text-[color:var(--ink)]">
            {material.title}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t("materials.preview_description")}
          </DialogDescription>
        </DialogHeader>
        {material.watermarked_preview_url ? (
          <iframe
            src={material.watermarked_preview_url}
            title={t("materials.preview_frame_aria", { title: material.title })}
            className="min-h-0 w-full flex-1 bg-muted/20"
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-6 text-sm text-muted-foreground">
            {t("materials.preview_unavailable")}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export type MaterialCardAction = {
  buyHref: string;
  bookHref: string;
};

export function StudyMaterialCard({
  material,
  tutorName,
  tutorCode,
  actions,
  showTutorLink = false,
}: {
  material: StudyMaterial;
  tutorName: string;
  tutorCode?: string;
  actions: MaterialCardAction;
  showTutorLink?: boolean;
}) {
  const { t } = useTranslation();
  const [previewOpen, setPreviewOpen] = useState(false);
  const courseworkMeta =
    material.document_type === "ia" || material.document_type === "ee" || material.document_type === "tok_essay"
      ? [
          material.exact_score_achieved
            ? t("materials.score_label", { score: material.exact_score_achieved })
            : null,
          material.includes_examiner_comments ? t("materials.examiner_comments_label") : null,
        ].filter((entry): entry is string => Boolean(entry))
      : [];

  return (
    <article className="flex h-full flex-col gap-3 rounded-lg border border-border bg-[color:var(--surface)] p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold leading-snug text-[color:var(--ink)]">
            {material.title}
          </h3>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">
            {t(`materials.doc_type_${material.document_type}`)}
            {material.curriculum_tag ? ` · ${material.curriculum_tag}` : ""}
            {material.subject_tag ? ` · ${material.subject_tag}` : ""}
            {material.year_tag ? ` · ${material.year_tag}` : ""}
          </p>
        </div>
        <p className="shrink-0 text-lg font-bold text-[color:var(--ink)]">
          ${Number(material.price_hkd).toFixed(0)}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <MaterialStars rating={material.admin_star_rating} />
        <RetentionBadge />
      </div>

      {material.admin_marketing_summary ? (
        <p className="text-sm leading-relaxed text-muted-foreground">
          {material.admin_marketing_summary}
        </p>
      ) : material.description ? (
        <p className="line-clamp-3 text-sm leading-relaxed text-muted-foreground">
          {material.description}
        </p>
      ) : null}

      {courseworkMeta.length > 0 ? (
        <ul className="space-y-1">
          {courseworkMeta.map((entry) => (
            <li key={entry} className="text-xs font-semibold text-[color:var(--ink)]">
              · {entry}
            </li>
          ))}
        </ul>
      ) : null}

      {showTutorLink && tutorCode ? (
        <p className="text-xs text-muted-foreground">
          {t("materials.by_tutor")}{" "}
          <a
            href={`/tutors/${tutorCode}`}
            className="font-bold text-[color:var(--brand-link)] hover:underline"
          >
            {tutorName}
          </a>
        </p>
      ) : null}

      <div className="mt-auto space-y-2 pt-1">
        <NoRefundNotice />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="solid" color="blue" className="h-10 flex-1 text-sm font-bold">
            <a href={actions.buyHref} target="_blank" rel="noopener noreferrer">
              <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
              {t("materials.buy_now")}
            </a>
          </Button>
          <Button asChild variant="outline" className="h-10 flex-1 text-sm font-bold">
            <a href={actions.bookHref}>
              <BookOpen className="mr-2 h-4 w-4" aria-hidden />
              {t("materials.book_lessons")}
            </a>
          </Button>
        </div>
        {material.watermarked_preview_url ? (
          <Button
            type="button"
            variant="ghost"
            className="h-9 w-full text-sm font-bold text-[color:var(--brand-link)] underline underline-offset-4"
            onClick={() => setPreviewOpen(true)}
          >
            {t("materials.read_preview")}
          </Button>
        ) : null}
      </div>

      <MaterialPreviewDialog
        material={material}
        open={previewOpen}
        onOpenChange={setPreviewOpen}
      />
    </article>
  );
}
