import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FileText, Heart, Star } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/money";
import { materialCoverUrl, shopKindLabel } from "@/features/materials/material-card";
import type { MarketplaceMaterial } from "@/features/materials/queries";

/**
 * #557 / #543 CEO lock (2026-11-02): the compact, photo-first browse card,
 * "exactly like" a Carousell listing. Photo, title (2 lines), HK$ price and
 * the seller's display name underneath, with an optional heart. Used by the
 * Notes market grid (2 columns on mobile) and the home Study notes row.
 * The detail page (/notes/<slug>) keeps the rich layout.
 */
export function NoteBrowseCard({
  material,
  rating,
  saved,
  onToggleSave,
  className,
}: {
  material: MarketplaceMaterial;
  rating?: { average: number | null; count: number } | null;
  saved?: boolean;
  /** Omit to hide the heart (e.g. signed-out home row). */
  onToggleSave?: () => void;
  className?: string;
}) {
  const { t } = useTranslation();
  const photoPath = material.cover_image_path ?? material.preview_image_paths?.[0] ?? null;
  const photoUrl = materialCoverUrl(photoPath);
  const isFree = Number(material.price_hkd) === 0;
  const price = isFree ? t("notes.card.free") : formatMoney(Number(material.price_hkd));
  const seller = material.tutor_display_name?.trim() || material.tutor_code;
  const slug = material.slug ?? material.id;

  return (
    <article className={cn("group relative min-w-0", className)}>
      <Link
        to="/notes/$slug"
        params={{ slug }}
        className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
      >
        <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-[color:var(--surface-subtle)]">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center">
              <FileText
                className="h-9 w-9 text-[color:var(--brand-link)]"
                strokeWidth={1.5}
                aria-hidden
              />
              <span className="line-clamp-2 text-xs font-semibold text-muted-foreground">
                {[material.curriculum_tag, material.subject_tag].filter(Boolean).join(" · ")}
              </span>
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-bold text-[color:var(--ink)]">
            {shopKindLabel(material.material_type, t)}
          </span>
        </div>
        <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-[color:var(--ink)]">
          {material.title}
        </h3>
        <p className="mt-1 flex items-baseline gap-1.5 text-sm">
          <span className="font-bold text-[color:var(--ink)]">{price}</span>
          {rating?.average != null && rating.count > 0 ? (
            <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
              <Star className="h-3 w-3 fill-current" aria-hidden />
              {rating.average.toFixed(1)}
            </span>
          ) : null}
        </p>
        <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-subtle)] text-[10px] font-bold text-[color:var(--ink)]"
          >
            {seller.slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate">{seller}</span>
        </p>
      </Link>
      {onToggleSave ? (
        <button
          type="button"
          aria-pressed={saved}
          aria-label={saved ? t("notes.engage.saved_label") : t("notes.engage.save")}
          onClick={onToggleSave}
          className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-card/90 text-[color:var(--ink)] transition-colors hover:bg-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
        >
          <Heart className={cn("h-4 w-4", saved && "fill-current text-rose-500")} aria-hidden />
        </button>
      ) : null}
    </article>
  );
}
