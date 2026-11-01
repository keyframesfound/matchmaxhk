import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Scale, Share2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { shareOrCopy } from "@/lib/share";
import { SaveNoteButton } from "@/features/materials/note-engagement";
import { formatMaterialTypeLabel, type MarketplaceMaterial } from "@/features/materials/queries";

/**
 * #556 card action bar (same neutral bar as tutor / case cards):
 * Compare (up to 3) · Share · Save, plus the shop's compare dialog.
 */

export const MAX_COMPARE = 3;

export function ShopCardActions({
  material,
  compared,
  onToggleCompare,
  onRequireAuth,
}: {
  material: MarketplaceMaterial;
  compared: boolean;
  onToggleCompare: () => void;
  onRequireAuth: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-pressed={compared}
        onClick={onToggleCompare}
        className={cn(compared && "text-[color:var(--brand-link)]")}
      >
        <Scale className="mr-1.5 h-4 w-4" aria-hidden />
        {t("notes.engage.add_to_compare")}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() =>
          void shareOrCopy(
            {
              title: material.title,
              text: material.summary ?? material.title,
              url: `${window.location.origin}/notes/${material.slug ?? material.id}`,
            },
            t("notes.engage.link_copied"),
            t("notes.engage.share_failed"),
          )
        }
      >
        <Share2 className="mr-1.5 h-4 w-4" aria-hidden />
        {t("notes.engage.share")}
      </Button>
      <SaveNoteButton materialId={material.id} onRequireAuth={onRequireAuth} className="ml-auto" />
    </div>
  );
}

export function ShopCompareDialog({
  open,
  onOpenChange,
  items,
  ratings,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: MarketplaceMaterial[];
  ratings: Map<string, { average: number | null; count: number }>;
}) {
  const { t } = useTranslation();
  const rows: [string, (m: MarketplaceMaterial) => string][] = [
    ["price", (m) => (Number(m.price_hkd) === 0 ? t("notes.card.free") : `HK$${m.price_hkd}`)],
    ["type", (m) => formatMaterialTypeLabel(m.material_type, t)],
    ["curriculum", (m) => m.curriculum_tag || "-"],
    ["subject", (m) => m.subject_tag ?? "-"],
    ["category", (m) => (m.subcategory ? t(`notes.subcategory.${m.subcategory}`) : "-")],
    ["pages", (m) => (m.page_count != null ? String(m.page_count) : "-")],
    ["language", (m) => (m.content_language ? t(`notes.language.${m.content_language}`) : "-")],
    [
      "rating",
      (m) => {
        const r = ratings.get(m.id);
        return r && r.count > 0 && r.average != null
          ? `★ ${r.average.toFixed(1)} (${r.count})`
          : "-";
      },
    ],
    ["sold", (m) => String(m.sold_count)],
    ["tutor", (m) => m.tutor_display_name],
  ];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{t("notes.engage.compare_title")}</DialogTitle>
          <DialogDescription>{t("notes.engage.compare_shop_description")}</DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="w-28 py-2 pr-3" />
                {items.map((m) => (
                  <th key={m.id} className="py-2 pr-3 align-top font-semibold">
                    <Link
                      to="/notes/$slug"
                      params={{ slug: m.slug ?? m.id }}
                      className="text-[color:var(--brand-link)] hover:underline"
                    >
                      {m.title}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([key, value]) => (
                <tr key={key} className="border-b border-border last:border-0">
                  <th className="py-2 pr-3 align-top text-xs font-semibold text-muted-foreground">
                    {t(`notes.engage.compare_${key}`)}
                  </th>
                  {items.map((m) => (
                    <td key={m.id} className="py-2 pr-3 align-top">
                      {value(m)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
