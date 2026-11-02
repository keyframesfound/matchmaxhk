/**
 * Notes upload v2: browser-only file helpers for the upload form.
 *  - pdfjs text extraction + page rendering (thumbnails, AI page images);
 *  - merging photos / scans into one PDF with pdf-lib;
 *  - direct-to-Storage uploads through signed upload URLs with progress.
 * Every heavy dependency is imported lazily so the shop pages stay light.
 */

// Bundled by Vite (?url emits the hashed asset), same as note-preview-viewer:
// a bare "pdfjs-dist/build/pdf.worker.min.mjs" path 404s on prod (#569).
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

import { LOGO_WATERMARK_DATA_URL } from "@/features/materials/logo-watermark";

/**
 * pdfjs needs its font, CMap (CJK text), ICC and wasm (JPEG 2000 / colour
 * profiles) data to render many real-world PDFs; without them rendering
 * throws and the page thumbnails fail. vite.config.ts copies them from the
 * installed pdfjs-dist into /pdfjs on our own origin at build time, so they
 * always match the bundled pdfjs version.
 */
export function pdfjsAssetOptions() {
  const base = "/pdfjs";
  return {
    cMapUrl: `${base}/cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${base}/standard_fonts/`,
    wasmUrl: `${base}/wasm/`,
    iccUrl: `${base}/iccs/`,
  };
}

type PdfSource = File | Blob | string;

type PdfDoc = {
  numPages: number;
  getPage: (n: number) => Promise<{
    getViewport: (o: { scale: number }) => { width: number; height: number };
    render: (o: unknown) => { promise: Promise<void> };
    getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
    cleanup?: () => void;
  }>;
  destroy: () => Promise<void>;
};

export async function openPdf(source: PdfSource): Promise<PdfDoc> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
  const params =
    typeof source === "string"
      ? { url: source }
      : { data: new Uint8Array(await source.arrayBuffer()) };
  return (await pdfjs.getDocument({ ...pdfjsAssetOptions(), ...params })
    .promise) as unknown as PdfDoc;
}

/** Plain text of the first pages (stops at maxChars). */
export async function extractPdfText(doc: PdfDoc, maxChars = 24_000, maxPages = 40) {
  let text = "";
  const pages = Math.min(doc.numPages, maxPages);
  for (let i = 1; i <= pages && text.length < maxChars; i += 1) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += `${content.items.map((item) => item.str ?? "").join(" ")}\n`;
  }
  return text.slice(0, maxChars);
}

/** Render one page to a data URL at `width` CSS pixels. */
export async function renderPage(
  doc: PdfDoc,
  pageNumber: number,
  width: number,
  type: "image/jpeg" | "image/png" = "image/jpeg",
  quality = 0.7,
): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  page.cleanup?.();
  return canvas.toDataURL(type, quality);
}

// ---------------------------------------------------------------------------
// Images -> one PDF
// ---------------------------------------------------------------------------

async function imageToJpegBytes(file: File): Promise<{ bytes: Uint8Array; w: number; h: number }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () =>
        reject(new Error(`"${file.name}" could not be read. Convert HEIC photos to JPG first.`));
      el.src = url;
    });
    // Cap the long edge at 2000px: sharp enough to read, small enough to ship.
    const scale = Math.min(1, 2000 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) throw new Error(`"${file.name}" could not be converted.`);
    return { bytes: new Uint8Array(await blob.arrayBuffer()), w, h };
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Merge photos / scans (in order) into one A4-width PDF file. */
export async function mergeImagesToPdf(files: File[], fileName = "photos.pdf"): Promise<File> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  for (const file of files) {
    const { bytes, w, h } = await imageToJpegBytes(file);
    const image = await doc.embedJpg(bytes);
    // A4 width (595pt), height follows the photo's aspect ratio.
    const pageWidth = 595;
    const pageHeight = Math.round((h / w) * pageWidth);
    const page = doc.addPage([pageWidth, pageHeight]);
    page.drawImage(image, { x: 0, y: 0, width: pageWidth, height: pageHeight });
  }
  const out = await doc.save();
  return new File([out as BlobPart], fileName, { type: "application/pdf" });
}

// ---------------------------------------------------------------------------
// Direct uploads (signed upload URL, XHR for progress)
// ---------------------------------------------------------------------------

/**
 * PUT a file to a Supabase signed upload URL, reporting 0..1 progress.
 * Mirrors storage-js uploadToSignedUrl (multipart body, x-upsert false).
 */
export function uploadToSignedUrl(
  signedUrl: string,
  file: File,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
      } else {
        let message = `Upload failed (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText) as { message?: string; error?: string };
          message = body.message || body.error || message;
        } catch {
          // keep the status message
        }
        reject(new Error(message));
      }
    };
    xhr.onerror = () => reject(new Error("Network error during upload."));
    const form = new FormData();
    form.append("cacheControl", "3600");
    form.append("", file);
    xhr.send(form);
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsDataURL(file);
  });
}

/**
 * #556 gallery: stamp a tiled "MatchMax Preview" watermark onto an image in
 * the browser before it is uploaded to the public previews bucket (the note
 * page adds the floating watermark on top). Output: JPEG, long edge 1600px.
 */
export async function watermarkImageFile(file: File, label = "MatchMax Preview"): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error(`"${file.name}" could not be read.`));
      el.src = url;
    });
    const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas unavailable");
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const size = Math.max(16, Math.round(w / 28));
    ctx.font = `700 ${size}px Inter, Arial, sans-serif`;
    ctx.fillStyle = "rgba(70, 90, 120, 0.22)";
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 7);
    for (let y = -h; y < h; y += size * 5) {
      for (let x = -w; x < w; x += size * 14) ctx.fillText(label, x, y);
    }
    ctx.restore();
    await drawLogoOnCanvas(ctx, w, h, 0.15);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.85),
    );
    if (!blob) throw new Error(`"${file.name}" could not be converted.`);
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Owner request: the greyscale MatchMax logo, centred, on gallery images. */
async function drawLogoOnCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  alpha: number,
) {
  const logo = await new Promise<HTMLImageElement | null>((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(null);
    el.src = LOGO_WATERMARK_DATA_URL;
  });
  if (!logo) return;
  const logoWidth = Math.min(w * 0.55, 900);
  const logoHeight = (logoWidth * logo.naturalHeight) / logo.naturalWidth;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(logo, (w - logoWidth) / 2, (h - logoHeight) / 2, logoWidth, logoHeight);
  ctx.restore();
}
