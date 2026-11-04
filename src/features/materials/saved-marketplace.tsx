import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/features/auth/useAuth";
import { NoteBrowseCard } from "@/features/materials/note-browse-card";
import { getMySavedNoteIds, setNoteSaved } from "@/features/materials/note-engagement.functions";
import { SAVED_NOTES_QUERY_KEY } from "@/features/materials/note-engagement";
import { fetchMarketplaceMaterials, fetchMaterialRatings } from "@/features/materials/queries";

/**
 * #610 CEO lock (2026-11-03): the Marketplace tab of the one Saved surface.
 * Saved Notes / materials in the Carousell 2-column grid (photo, title,
 * price, seller), same hearts as the Marketplace. Bought files stay under
 * Account → Bought (#293), this is the wishlist only.
 */
export function useSavedMarketplaceItems() {
  const { user } = useAuth();
  const savedQuery = useQuery({
    queryKey: [...SAVED_NOTES_QUERY_KEY, user?.id],
    queryFn: () => getMySavedNoteIds(),
    enabled: Boolean(user),
    staleTime: 60_000,
  });
  const materialsQuery = useQuery({
    queryKey: ["materials", "marketplace"],
    queryFn: fetchMarketplaceMaterials,
    enabled: Boolean(user) && (savedQuery.data?.length ?? 0) > 0,
  });
  const ids = savedQuery.data ?? [];
  const order = new Map(ids.map((id, index) => [id, index]));
  const items = (materialsQuery.data ?? [])
    .filter((m) => order.has(m.id))
    .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  return {
    items,
    savedCount: ids.length,
    isLoading: savedQuery.isLoading || (ids.length > 0 && materialsQuery.isLoading),
  };
}

export function SavedMarketplaceGrid() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { items, isLoading } = useSavedMarketplaceItems();
  const ratingsQuery = useQuery({
    queryKey: ["materials", "ratings"],
    queryFn: fetchMaterialRatings,
    staleTime: 5 * 60_000,
  });
  const ratings = ratingsQuery.data;

  const unsave = async (id: string) => {
    try {
      await setNoteSaved({ data: { materialId: id, saved: false } });
      await queryClient.invalidateQueries({ queryKey: SAVED_NOTES_QUERY_KEY });
      toast.success(t("notes.engage.unsaved"));
    } catch {
      toast.error(t("notes.engage.save_failed"));
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    );
  }
  if (items.length === 0) {
    return (
      <div className="p-12 text-center">
        <Heart className="mx-auto h-8 w-8 text-[color:var(--muted-foreground)]" aria-hidden />
        <p className="mt-4 text-lg font-bold text-[color:var(--ink)]">
          {t("saved.marketplace_empty_title")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{t("saved.marketplace_empty_body")}</p>
        <Button asChild variant="outline" className="mt-5">
          <Link to="/tutors" search={{ view: "materials" }}>
            {t("saved.browse_marketplace")}
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((material) => (
        <NoteBrowseCard
          key={material.id}
          material={material}
          rating={ratings?.get(material.id) ?? null}
          saved
          onToggleSave={() => void unsave(material.id)}
        />
      ))}
    </div>
  );
}
