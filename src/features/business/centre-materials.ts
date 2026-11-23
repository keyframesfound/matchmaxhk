/**
 * #815 §2.4: pure rules for centre-published study materials.
 *
 * A material is "published as this Centre" when the seller attached an
 * organisation to the listing. Attribution only: checkout, fees and payouts
 * stay on the #784 rails and the seller account, so nothing here touches
 * money. A card must be live (published), a digital file (not the parked
 * class cart) and actually attributed to an organisation.
 */

export type CentreMaterialRow = {
  id: string;
  slug: string | null;
  title: string;
  price_hkd: number | string;
  material_type: string | null;
  subject_tag: string | null;
  curriculum_tag: string | null;
  status: string;
  listing_kind: string;
  organization_id: string | null;
  sold_count?: number | null;
  view_count?: number | null;
};

export type CentreMaterialCard = {
  id: string;
  slug: string;
  title: string;
  priceHkd: number;
  materialType: string | null;
  subject: string | null;
  curriculum: string | null;
  soldCount: number;
};

export function isListableCentreMaterial(row: CentreMaterialRow): boolean {
  return (
    row.status === "published" &&
    row.listing_kind === "digital_file" &&
    Boolean(row.organization_id)
  );
}

export function toCentreMaterialCard(row: CentreMaterialRow): CentreMaterialCard {
  const price = Number(row.price_hkd);
  return {
    id: row.id,
    slug: row.slug?.trim() || row.id,
    title: row.title,
    priceHkd: Number.isFinite(price) && price >= 0 ? price : 0,
    materialType: row.material_type ?? null,
    subject: row.subject_tag ?? null,
    curriculum: row.curriculum_tag ?? null,
    soldCount: Number(row.sold_count ?? 0),
  };
}

export function centreMaterialCards(rows: CentreMaterialRow[]): CentreMaterialCard[] {
  return rows
    .filter(isListableCentreMaterial)
    .map(toCentreMaterialCard)
    .sort((a, b) => b.soldCount - a.soldCount || a.title.localeCompare(b.title));
}
