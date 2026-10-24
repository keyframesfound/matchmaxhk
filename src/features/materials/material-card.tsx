import { useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { BadgeCheck, BookOpen, Gift, Layers, ListVideo, MessageCircle, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import type { StudyMaterial } from "@/features/materials/queries";
import { getPublicListing } from "@/features/materials/listings.functions";

/**
 * Issues #131/#134 + #392: the SHOP card for the study-materials surfaces
 * (unified /tutors?view=materials directory + tutor profile section). The
 * #392 redesign is a big-cover expandable card: large 4:3 cover (flat
 * bordered placeholder with the kind pill when a listing has none), kind
 * pill, title, tutor code + verified badge, sold count, price, and a
 * working "Details ▾" accordion with the full description, tag chips, the
 * kind's "What's included" line (course → lesson count; folder → itemised
 * children each with its own single-item buy link), the sample preview and
 * the buy CTA. No shadows anywhere, border-delineated, flat surfaces.
 */

/** Covers live in the PUBLIC materials-previews bucket (gig precedent). */
export function materialCoverUrl(path: string | null): string | null {
  if (!path) return null;
  const { data } = supabase.storage.from("materials-previews").getPublicUrl(path);
  return data?.publicUrl ?? null;
}

const SHOP_KIND_FALLBACKS: Record<string, string> = {
  notes: "Note",
  mock: "Mock",
  exemplar: "Exemplar",
  flashcards: "Flashcards",
  gig: "Service",
  topic_folder: "Topic Folder",
  video_course: "Video Course",
  general_course: "General Course",
};

/** Kind pill label, scratch i18n under `shop.kind_*`, humanized fallback. */
export function shopKindLabel(type: string, t: TFunction): string {
  const label = t(`shop.kind_${type}`, { defaultValue: "" });
  if (label && label !== `shop.kind_${type}`) return label;
  return SHOP_KIND_FALLBACKS[type] ?? type.replace(/_/g, " ");
}

export function MaterialStars({ rating }: { rating: number | null }) {
  const { t } = useTranslation();
  if (rating === null || Number.isNaN(rating)) {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-[color:var(--ink)]">
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
      <span className="ml-1 text-xs font-medium text-[color:var(--ink)]">{rating.toFixed(1)}</span>
    </span>
  );
}

export function RetentionBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 dark:text-amber-400">
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
          <DialogTitle className="text-base font-medium text-[color:var(--ink)]">
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
  /** Issue #216: report button element for the note (optional). */
  reportAction?: ReactNode;
};

/** #392: kind payload the Details accordion renders (lazy from getPublicListing). */
export type ShopListingIncludes = {
  children?: Array<{
    id: string;
    slug: string | null;
    title: string;
    priceHkd: number;
    materialType: string;
    coverImagePath: string | null;
  }>;
  lessons?: Array<{
    id: string;
    position: number;
    title: string;
    videoProvider: string | null;
    hasPdf: boolean;
  }>;
};

export function StudyMaterialCard({
  material,
  tutorName,
  tutorCode,
  actions,
  showTutorLink = false,
  verifiedTutor = false,
  detailHref,
  includes,
}: {
  material: StudyMaterial;
  tutorName: string;
  tutorCode?: string;
  /** #131 legacy WhatsApp actions (tutor profile section). When omitted the
   * card's buy CTA links to the listing's own detail page. */
  actions?: MaterialCardAction;
  showTutorLink?: boolean;
  /** #314: the tutor holds the Verified badge, the line never implies an
   * examiner wrote the file, only that MatchMax verified the tutor. */
  verifiedTutor?: boolean;
  /** #392: the listing's detail page (/notes/<slug>), cover, title and the
   * buy CTA all route there in the unified directory. */
  detailHref?: string;
  /** #392: folder children / course lessons for the Details accordion. */
  includes?: ShopListingIncludes | null;
}) {
  const { t } = useTranslation();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const isFolder = material.material_type === "topic_folder";
  const isCourse =
    material.material_type === "video_course" || material.material_type === "general_course";
  const isFree = Number(material.price_hkd) === 0;
  const price = isFree ? t("notes.card.free") : formatMoney(Number(material.price_hkd));
  const href = detailHref ?? (material.slug ? `/notes/${material.slug}` : null);
  const coverUrl = materialCoverUrl(material.cover_image_path);
  const kindLabel = shopKindLabel(material.material_type, t);

  // Folder/course "What's included" loads lazily when the accordion opens —
  // the payload (children/lessons) lives behind the service-role public read,
  // not in the RLS marketplace query.
  const includesQuery = useQuery({
    queryKey: ["shop-includes", material.slug ?? material.id],
    queryFn: () => getPublicListing({ data: { slug: material.slug ?? material.id } }),
    enabled: (isFolder || isCourse) && detailsOpen,
  });
  const liveIncludes: ShopListingIncludes | null = includes
    ? includes
    : includesQuery.data
      ? {
          children: includesQuery.data.children ?? undefined,
          lessons: includesQuery.data.lessons ?? undefined,
        }
      : null;

  const courseworkMeta =
    material.document_type === "ia" ||
    material.document_type === "ee" ||
    material.document_type === "tok_essay"
      ? [
          material.exact_score_achieved
            ? t("materials.score_label", { score: material.exact_score_achieved })
            : null,
          material.includes_examiner_comments ? t("materials.examiner_comments_label") : null,
        ].filter((entry): entry is string => Boolean(entry))
      : [];

  // A child's "Buy single" routes to the child's own detail page, where the
  // real checkout flow (terms gate, proration) lives, cards never embed
  // checkout themselves.
  const buySingleHref = (childSlug: string | null, childId: string) =>
    `/notes/${childSlug ?? childId}`;

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-lg border border-border bg-[color:var(--surface)]">
      {/* Big cover, 4:3, object-cover; flat bordered placeholder with the
          kind pill when the listing has no image (never a shadow). */}
      {href ? (
        <a href={href} className="group block" aria-label={material.title}>
          <CoverBlock
            coverUrl={coverUrl}
            kindLabel={kindLabel}
            title={material.title}
            savingsBadge={isFolder && material.price_hkd > 0 ? t("shop.card.folder_badge") : null}
          />
        </a>
      ) : (
        <CoverBlock
          coverUrl={coverUrl}
          kindLabel={kindLabel}
          title={material.title}
          savingsBadge={isFolder && material.price_hkd > 0 ? t("shop.card.folder_badge") : null}
        />
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {href ? (
              <a href={href} className="group/title block">
                <h3 className="truncate text-base font-medium leading-snug text-[color:var(--ink)] group-hover/title:underline">
                  {material.title.length > 80
                    ? `${material.title.slice(0, 80).trimEnd()}…`
                    : material.title}
                </h3>
              </a>
            ) : (
              <h3 className="truncate text-base font-medium leading-snug text-[color:var(--ink)]">
                {material.title.length > 80
                  ? `${material.title.slice(0, 80).trimEnd()}…`
                  : material.title}
              </h3>
            )}
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-medium text-muted-foreground">
              {tutorCode ? <span>{tutorCode}</span> : null}
              {verifiedTutor ? (
                <span className="inline-flex items-center gap-1 font-medium text-emerald-700 dark:text-emerald-400">
                  <BadgeCheck className="h-3.5 w-3.5" aria-hidden />
                  {t("notes.card.verified_tutor")}
                </span>
              ) : null}
              {Number(material.sold_count) > 0 ? (
                <span>{t("shop.card.sold_count", { count: Number(material.sold_count) })}</span>
              ) : null}
            </p>
          </div>
          <p className="shrink-0 text-lg font-medium text-[color:var(--ink)]">{price}</p>
        </div>

        {material.admin_marketing_summary || material.description ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {material.admin_marketing_summary ?? material.description}
          </p>
        ) : null}

        {showTutorLink && tutorCode ? (
          <p className="text-xs text-muted-foreground">
            {t("materials.by_tutor")}{" "}
            <a
              href={`/tutors/${tutorCode}`}
              className="font-medium text-[color:var(--brand-link)] hover:underline"
            >
              {tutorName}
            </a>
          </p>
        ) : null}

        {/* Details ▾, Radix accordion (border-separated, no shadows). */}
        <Accordion
          type="single"
          collapsible
          className="mt-auto border-t border-border"
          value={detailsOpen ? "details" : ""}
          onValueChange={(value) => setDetailsOpen(value === "details")}
        >
          <AccordionItem value="details" className="border-b-0">
            <AccordionTrigger className="py-3 text-sm font-medium text-[color:var(--ink)] hover:no-underline">
              {t("shop.card.details_toggle")}
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pt-0">
              {material.description ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                  {material.description}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-1.5">
                {material.curriculum_tag ? <Chip>{material.curriculum_tag}</Chip> : null}
                {material.subject_tag ? <Chip>{material.subject_tag}</Chip> : null}
                {material.year_tag ? <Chip>{material.year_tag}</Chip> : null}
                {courseworkMeta.map((entry) => (
                  <Chip key={entry}>{entry}</Chip>
                ))}
              </div>

              {/* What's included, per kind. */}
              {isCourse && liveIncludes?.lessons ? (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-[color:var(--ink)]">
                    <ListVideo className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    {t("shop.card.lessons_included", { count: liveIncludes.lessons.length })}
                  </p>
                  <ul className="space-y-1">
                    {liveIncludes.lessons.map((lesson) => (
                      <li key={lesson.id} className="truncate text-xs text-muted-foreground">
                        {lesson.position}. {lesson.title}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {isFolder && liveIncludes?.children ? (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 text-sm font-medium text-[color:var(--ink)]">
                    <Layers className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    {t("shop.card.items_included", { count: liveIncludes.children.length })}
                  </p>
                  <ul className="space-y-1.5">
                    {liveIncludes.children.map((child) => (
                      <li
                        key={child.id}
                        className="flex items-center justify-between gap-2 rounded-md border border-border bg-muted/20 px-2.5 py-1.5"
                      >
                        <a
                          href={buySingleHref(child.slug, child.id)}
                          className="min-w-0 flex-1 truncate text-xs font-medium text-[color:var(--ink)] hover:text-[color:var(--brand-link)] hover:underline"
                        >
                          {child.title}
                        </a>
                        <span className="shrink-0 text-xs font-medium text-[color:var(--ink)]">
                          {Number(child.priceHkd) === 0
                            ? t("notes.card.free")
                            : formatMoney(Number(child.priceHkd))}
                        </span>
                        <a
                          href={buySingleHref(child.slug, child.id)}
                          className="shrink-0 rounded-md border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-subtle)]"
                        >
                          {t("shop.card.buy_single")}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {material.watermarked_preview_url ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="h-8 px-0 text-sm font-medium text-[color:var(--brand-link)] underline underline-offset-4"
                  onClick={() => setPreviewOpen(true)}
                >
                  {t("materials.read_preview")}
                </Button>
              ) : null}
            </AccordionContent>
          </AccordionItem>
        </Accordion>

        {/* Issue #216: report the note (copyright / fraud / …). */}
        {actions?.reportAction ? <div>{actions.reportAction}</div> : null}

        <div className="space-y-2 pt-1">
          {actions ? (
            <>
              <NoRefundNotice />
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  asChild
                  variant="solid"
                  color="blue"
                  className="h-10 flex-1 text-sm font-medium"
                >
                  <a href={actions.buyHref} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" aria-hidden />
                    {t("materials.buy_now")}
                  </a>
                </Button>
                <Button asChild variant="outline" className="h-10 flex-1 text-sm font-medium">
                  <a href={actions.bookHref}>
                    <BookOpen className="mr-2 h-4 w-4" aria-hidden />
                    {t("materials.book_lessons")}
                  </a>
                </Button>
              </div>
            </>
          ) : href ? (
            <Button
              asChild
              variant="solid"
              color="accent"
              className="h-10 w-full text-sm font-medium"
            >
              <a href={href}>{t("shop.card.view_and_buy")}</a>
            </Button>
          ) : null}
        </div>
      </div>

      {material.watermarked_preview_url ? (
        <MaterialPreviewDialog
          material={material}
          open={previewOpen}
          onOpenChange={setPreviewOpen}
        />
      ) : null}
    </article>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function CoverBlock({
  coverUrl,
  kindLabel,
  title,
  savingsBadge,
}: {
  coverUrl: string | null;
  kindLabel: string;
  title: string;
  savingsBadge: string | null;
}) {
  return (
    <div className="relative aspect-[4/3] w-full border-b border-border bg-muted/30">
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={(event) => {
            // A missing cover file degrades to the flat placeholder, never a
            // broken-image icon.
            event.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center" aria-hidden>
          <span className="select-none px-4 text-center text-sm font-medium text-muted-foreground/60">
            {title}
          </span>
        </div>
      )}
      <span className="absolute left-3 top-3 inline-flex items-center rounded-md border border-border bg-card px-2 py-0.5 text-xs font-medium text-[color:var(--ink)]">
        {kindLabel}
      </span>
      {savingsBadge ? (
        <span className="absolute right-3 top-3 inline-flex items-center rounded-md border border-emerald-600/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-400">
          {savingsBadge}
        </span>
      ) : null}
    </div>
  );
}
