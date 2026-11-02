import { extendedPreviewPageLimit } from "@/features/materials/lifecycle";

/**
 * Notes upload v2: which pages of the main PDF go into the public,
 * watermarked preview. The seller may pick pages (thumbnails in the upload
 * form); without a pick the preview is the first ~30% (cap 12). Either way
 * the preview NEVER contains the whole document. Pure; unit-tested.
 */

export const MAX_PREVIEW_PAGES = 12;

/** Most pages a preview of `pageCount` pages may show (never all of them). */
export function maxPreviewPagesFor(pageCount: number): number {
  const total = Math.max(1, Math.floor(pageCount));
  if (total === 1) return 1; // single page: the watermark is the protection
  return Math.max(1, Math.min(MAX_PREVIEW_PAGES, total - 1, Math.ceil(total * 0.5)));
}

/** Default preview: the first ~30% of pages, clamped by maxPreviewPagesFor. */
export function defaultPreviewIndices(pageCount: number): number[] {
  const total = Math.max(1, Math.floor(pageCount));
  const count = Math.min(extendedPreviewPageLimit(total), maxPreviewPagesFor(total));
  return Array.from({ length: count }, (_, i) => i);
}

/**
 * Clean a seller's pick: in-range, unique, sorted, capped. Empty or invalid
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
