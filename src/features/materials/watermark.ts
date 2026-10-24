import { PDFDocument, rgb, StandardFonts, degrees } from "pdf-lib";

/**
 * Issues #131/#133: backend watermarking for the study-materials marketplace.
 *
 * Takes the uploaded PDF bytes, copies the first `pageLimit` pages into a new
 * document, and overlays a tiled diagonal "PREVIEW COPY - MATCHMAX.HK"
 * semi-transparent watermark on every page. The result is uploaded to the
 * PUBLIC previews bucket; the original never leaves the private bucket.
 *
 * Plain PDF processing via pdf-lib — no AI services involved.
 */

export const WATERMARK_TEXT = "PREVIEW COPY - MATCHMAX.HK";
export const PREVIEW_PAGE_LIMIT = 5;

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
  options: { pageLimit?: number } = {},
): Promise<WatermarkResult> {
  const pageLimit = options.pageLimit ?? PREVIEW_PAGE_LIMIT;

  const source = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const preview = await PDFDocument.create();
  const copiedIndices = source.getPageIndices().slice(0, pageLimit);
  const copiedPages = await preview.copyPages(source, copiedIndices);

  const font = await preview.embedFont(StandardFonts.HelveticaBold);

  for (const page of copiedPages) {
    preview.addPage(page);
    const { width, height } = page.getSize();
    const fontSize = Math.max(18, Math.min(36, width / 18));

    // Tile the watermark across the page on a diagonal grid.
    const stepX = width / 2;
    const stepY = height / 4;
    for (let row = 0; row < 4; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        const x = col * stepX + stepX / 2 - fontSize * 2;
        const y = row * stepY + stepY / 2;
        page.drawText(WATERMARK_TEXT, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(0.35, 0.45, 0.6),
          opacity: 0.22,
          rotate: degrees(30),
        });
      }
    }
  }

  const bytes = await preview.save();
  return { bytes, pageCount: copiedPages.length };
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
