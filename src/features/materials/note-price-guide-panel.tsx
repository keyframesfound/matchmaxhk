import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getNotePriceGuide } from "@/features/materials/price-guide.functions";
import { barPosition, priceVerdict, type PriceVerdict } from "@/features/materials/price-guide";

/**
 * Notes upload v2: Carousell-style price helper under the price field. A
 * min..max bar with the suggested range shaded, the seller's price as a
 * marker, a one-word verdict and links to the comparable listings.
 */

const VERDICT_TONE: Record<PriceVerdict, string> = {
  too_low: "text-[#b45309]",
  low: "text-[color:var(--brand-link)]",
  competitive: "text-success",
  high: "text-[#b45309]",
  too_high: "text-destructive",
};

export function NotePriceGuidePanel({
  materialType,
  curriculumTag,
  subjectTag,
  subcategory,
  pageCount,
  excludeId,
  priceHkd,
  onUsePrice,
}: {
  materialType: "notes" | "mock" | "exemplar" | "flashcards";
  curriculumTag: string;
  subjectTag: string;
  subcategory: string;
  pageCount: number | null;
  excludeId?: string | null;
  priceHkd: number | null;
  onUsePrice: (price: number) => void;
}) {
  const { t } = useTranslation();
  const query = useQuery({
    queryKey: [
      "notes",
      "price-guide",
      materialType,
      curriculumTag,
      subjectTag,
      subcategory,
      pageCount,
    ],
    queryFn: () =>
      getNotePriceGuide({
        data: {
          materialType,
          curriculumTag: curriculumTag || null,
          subjectTag: subjectTag || null,
          subcategory: subcategory || null,
          pageCount,
          excludeId: excludeId ?? null,
        },
      }),
    staleTime: 60_000,
  });

  const guide = query.data;
  if (!guide) {
    return query.isLoading ? (
      <div className="h-24 animate-pulse rounded-xl border border-border bg-muted/30" />
    ) : null;
  }

  const verdict = priceHkd != null ? priceVerdict(priceHkd, guide) : null;
  const lowPos = barPosition(guide.low, guide);
  const highPos = barPosition(guide.high, guide);
  const markerPos = priceHkd != null && priceHkd > 0 ? barPosition(priceHkd, guide) : null;

  return (
    <div className="space-y-3 rounded-xl border border-border bg-muted/20 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">{t("notes.price_guide.title")}</p>
        <p className="text-xs text-muted-foreground">
          {guide.tier === "baseline"
            ? t("notes.price_guide.basis_baseline")
            : t("notes.price_guide.basis_market", {
                count: guide.sampleSize,
                tier: t(`notes.price_guide.tier_${guide.tier}`),
              })}
        </p>
      </div>

      <p className="text-lg font-bold">
        {t("notes.price_guide.range", { low: guide.low, high: guide.high })}
        <span className="ml-2 text-sm font-medium text-muted-foreground">
          {t("notes.price_guide.typical", { mid: guide.mid })}
        </span>
      </p>

      <div className="relative h-3 rounded-full bg-border/60" aria-hidden>
        <div
          className="absolute inset-y-0 rounded-full bg-success/40"
          style={{ left: `${lowPos}%`, width: `${Math.max(2, highPos - lowPos)}%` }}
        />
        {markerPos != null ? (
          <div
            className="absolute -top-1 h-5 w-1.5 -translate-x-1/2 rounded-full bg-[color:var(--ink)]"
            style={{ left: `${markerPos}%` }}
          />
        ) : null}
      </div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>HK${guide.min}</span>
        <span>HK${guide.max}</span>
      </div>

      {verdict ? (
        <p className={cn("text-sm font-semibold", VERDICT_TONE[verdict])}>
          {t(`notes.price_guide.verdict_${verdict}`)}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">{t("notes.price_guide.enter_price")}</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => onUsePrice(guide.mid)}>
          {t("notes.price_guide.use_typical", { mid: guide.mid })}
        </Button>
      </div>

      {guide.comparables.length > 0 ? (
        <div className="space-y-1.5 border-t border-border pt-3">
          <p className="text-xs font-semibold text-muted-foreground">
            {t("notes.price_guide.comparables")}
          </p>
          <ul className="space-y-1">
            {guide.comparables.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                <a
                  href={`/notes/${item.slug ?? item.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-1 text-[color:var(--brand-link)] hover:underline"
                >
                  <span className="truncate">{item.title}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" aria-hidden />
                </a>
                <span className="shrink-0 font-semibold">HK${item.priceHkd}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <p className="text-[11px] text-muted-foreground">{t("notes.price_guide.disclaimer")}</p>
    </div>
  );
}
