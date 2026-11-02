import { PDFDocument, rgb, StandardFonts, degrees, type PDFImage, type PDFPage } from "pdf-lib";

import {
  LOGO_OPACITY_DELIVERED,
  LOGO_OPACITY_PREVIEW,
  LOGO_WATERMARK_ASPECT,
  logoWatermarkBytes,
} from "@/features/materials/logo-watermark";

/**
 * Owner request (2026-11-02): ONE watermark style everywhere, the MatchMax
 * logo (icon + name, greyscale) repeated on a diagonal grid. Light enough
 * to keep the page readable.
 */
export function drawLogoWatermark(page: PDFPage, logo: PDFImage, opacity: number) {
  const { width, height } = page.getSize();
  const logoWidth = Math.max(90, Math.min(160, width * 0.24));
  const logoHeight = logoWidth / LOGO_WATERMARK_ASPECT;
  const stepX = logoWidth * 1.7;
  const stepY = logoHeight * 4.2;
  const angle = degrees(30);
  // Overscan so the rotated rows still cover the corners.
  for (let y = -height * 0.5, row = 0; y < height * 1.2; y += stepY, row += 1) {
    const offset = (row % 2) * (stepX / 2);
    for (let x = -width * 0.5 + offset; x < width * 1.1; x += stepX) {
      page.drawImage(logo, { x, y, width: logoWidth, height: logoHeight, opacity, rotate: angle });
    }
  }
}

/**
 * Issues #131/#133: backend watermarking for the study-materials marketplace.
 *
 * Takes the uploaded PDF bytes, copies the first `pageLimit` pages into a new
 * document, and overlays a tiled diagonal "PREVIEW COPY - MATCHMAX.HK"
 * semi-transparent watermark on every page. The result is uploaded to the
 * PUBLIC previews bucket; the original never leaves the private bucket.
 *
 * Plain PDF processing via pdf-lib, no AI services involved.
 */

export const WATERMARK_TEXT = "PREVIEW COPY - MATCHMAX.HK";
export const PREVIEW_PAGE_LIMIT = 5;

/** #392: lesson-PDF stamp, short, tiled over the FULL document. */
export const FULL_WATERMARK_TEXT = "matchmax.hk";

/** Result of watermarking: preview bytes plus the page count stamped. */
export type WatermarkResult = {
  bytes: Uint8Array;
  pageCount: number;
};

/**
 * Stamp the first 3–5 pages of `pdfBytes` with a semi-transparent
 * "PREVIEW COPY - MATCHMAX.HK" watermark (tiled diagonally so a cropped
 * corner can't recover a clean page).
 */
export async function watermarkPdfPreview(
  pdfBytes: Uint8Array | ArrayBuffer,
  options: { pageLimit?: number; pageIndices?: readonly number[] } = {},
): Promise<WatermarkResult> {
  const pageLimit = options.pageLimit ?? PREVIEW_PAGE_LIMIT;

  const source = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const preview = await PDFDocument.create();
  // Notes upload v2: a seller-picked page set (already sanitized by
  // preview-pages.ts, never the whole document) wins over "first N pages".
  const total = source.getPageCount();
  const picked = (options.pageIndices ?? []).filter(
    (i) => Number.isInteger(i) && i >= 0 && i < total,
  );
  const copiedIndices =
    picked.length > 0 ? picked.slice(0, pageLimit) : source.getPageIndices().slice(0, pageLimit);
  const copiedPages = await preview.copyPages(source, copiedIndices);

  const logo = await preview.embedPng(logoWatermarkBytes());

  for (const page of copiedPages) {
    preview.addPage(page);
    drawLogoWatermark(page, logo, LOGO_OPACITY_PREVIEW);
  }

  const bytes = await preview.save();
  return { bytes, pageCount: copiedPages.length };
}

/**
 * #392 course lesson PDFs: stamp the FULL document (every page, unlike the
 * preview pipeline which copies only the first pages) with the tiled
 * diagonal "matchmax.hk" mark. The watermarked copy is what buyers get;
 * the clean original stays private next to it under the same stamp.
 */
export async function watermarkFullPdf(pdfBytes: Uint8Array | ArrayBuffer): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const logo = await doc.embedPng(logoWatermarkBytes());
  for (const page of doc.getPages()) drawLogoWatermark(page, logo, LOGO_OPACITY_DELIVERED);
  return doc.save();
}

/**
 * Build a PDF buffer for verifying the pipeline end-to-end (tests/local
 * verification) without shipping a fixture file.
 */
export async function createSamplePdf(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pageCount; i += 1) {
    const page = doc.addPage([595, 842]);
    page.drawText(`Sample page ${i + 1}`, {
      x: 72,
      y: 770,
      size: 18,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
  }
  return doc.save();
}
