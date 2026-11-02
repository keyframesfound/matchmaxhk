import { extendedPreviewPageLimit } from "@/features/materials/lifecycle";

/**
 * Notes upload v2: which pages of the main PDF go into the public,
 * watermarked preview. Owner request (2026-11-02): no page cap, the seller
 * picks any pages (thumbnails in the upload form). Without a pick the
 * preview is the first ~30% of pages. Pure; unit-tested.
 */

/** Most pages a preview of `pageCount` pages may show: every page. */
export function maxPreviewPagesFor(pageCount: number): number {
  return Math.max(1, Math.floor(pageCount));
}

/** Default preview size cap when the seller has not picked pages. */
export const DEFAULT_PREVIEW_PAGES_CAP = 12;

/** Default preview: the first ~30% of pages, clamped by maxPreviewPagesFor. */
export function defaultPreviewIndices(pageCount: number): number[] {
  const total = Math.max(1, Math.floor(pageCount));
  const count = Math.min(
    extendedPreviewPageLimit(total),
    DEFAULT_PREVIEW_PAGES_CAP,
    total > 1 ? total - 1 : 1,
  );
  return Array.from({ length: count }, (_, i) => i);
}

/**
 * Clean a seller's pick: in-range, unique, sorted. Empty or invalid
 * input falls back to the default.
 */
export function sanitizePreviewIndices(
  picked: readonly number[] | null | undefined,
  pageCount: number,
): number[] {
  const total = Math.max(1, Math.floor(pageCount));
  if (!picked || picked.length === 0) return defaultPreviewIndices(total);
  const unique = Array.from(
    new Set(picked.filter((i) => Number.isInteger(i) && i >= 0 && i < total)),
  ).sort((a, b) => a - b);
  if (unique.length === 0) return defaultPreviewIndices(total);
  return unique.slice(0, maxPreviewPagesFor(total));
}
