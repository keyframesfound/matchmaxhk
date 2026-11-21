// Issue #768 (Part 2 §3.A / §5 AC #4): a public note / course card shows at most
// ONE muted social-proof line — never a raw "0 sold". Thresholds are strict and
// live here so they stay unit-tested; the card feeds them through its optional
// `socialProof` prop. Precedence: sold wins over saved. When neither clears its
// threshold the card falls back to "New release".

export const MATERIAL_SOCIAL_PROOF_MIN = 3;

export type MaterialSocialProofInput = {
  /** Delivered order count (digital_materials.sold_count). */
  salesCount?: number | null;
  /** Distinct accounts that saved the listing (get_material_public_counts). */
  savesCount?: number | null;
};

export type MaterialCardSocialProof = {
  /** Render only when !== null. */
  sold: number | null;
  /** Render only when !== null (and no sold line wins). */
  saved: number | null;
  /** Render only when true (neither line above is shown). */
  isNew: boolean;
};

/** Non-finite / negative / missing inputs are treated as 0. */
function toCount(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return 0;
  return value;
}

export function selectMaterialCardSocialProof(
  input?: MaterialSocialProofInput | null,
): MaterialCardSocialProof {
  const salesCount = toCount(input?.salesCount);
  const savesCount = toCount(input?.savesCount);

  // Sold wins; saved only fills the gap when the sold line is absent.
  const sold = salesCount >= MATERIAL_SOCIAL_PROOF_MIN ? salesCount : null;
  const saved = sold === null && savesCount >= MATERIAL_SOCIAL_PROOF_MIN ? savesCount : null;

  return { sold, saved, isNew: sold === null && saved === null };
}
