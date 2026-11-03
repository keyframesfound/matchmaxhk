import { extractOfficeBlocks } from "@/features/materials/office-text";
import { mergeImagesToPdf } from "@/features/materials/note-file-tools";

/**
 * Owner request (2026-11-03): Word / PowerPoint notes get real preview
 * pages. The browser turns the document's text into simple pages (one per
 * slide, or flowing A4 pages for documents), drawn on a canvas so Chinese
 * text renders with the system fonts, then joins them into one PDF. That
 * PDF becomes the note's PDF version: the seller picks preview pages from
 * it like any PDF, it gets the same watermark, and buyers receive it next to
 * the original file. Layout, pictures and fonts of the original are not
 * reproduced; the preview says so in its footer.
 */

const FONT_STACK = 'Inter, "Noto Sans TC", "PingFang TC", "Microsoft JhengHei", Arial, sans-serif';
const MAX_PAGES = 60;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  // Character-level wrapping works for CJK (no spaces) and Latin alike;
  // Latin words are kept whole when they fit.
  const tokens = text.match(/[A-Za-z0-9'’.,:;!?()-]+\s*|\s+|./gu) ?? [];
  for (const token of tokens) {
    const next = line + token;
    if (ctx.measureText(next).width > maxWidth && line.trim()) {
      lines.push(line.trimEnd());
      line = token.trimStart();
    } else {
      line = next;
    }
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}

async function canvasToFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("Could not draw the preview page.");
  return new File([blob], name, { type: "image/jpeg" });
}

function newPage(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.textBaseline = "top";
  return { canvas, ctx };
}

function footer(ctx: CanvasRenderingContext2D, width: number, height: number, label: string) {
  ctx.fillStyle = "#8a97ab";
  ctx.font = `500 20px ${FONT_STACK}`;
  ctx.fillText(label, 60, height - 50, width - 120);
}

/** Build the PDF version of a Word / PowerPoint file, or null if unreadable. */
export async function buildOfficePreviewPdf(file: File, footerLabel: string): Promise<File | null> {
  const { slides, blocks } = await extractOfficeBlocks(file);
  if (blocks.join("").replace(/\s+/g, "").length < 20) return null;
  const pages: File[] = [];

  if (slides) {
    // 16:9 slide pages, slide title (first line) larger.
    const W = 1600;
    const H = 900;
    for (let i = 0; i < blocks.length && pages.length < MAX_PAGES; i += 1) {
      const { canvas, ctx } = newPage(W, H);
      ctx.fillStyle = "#1f3a68";
      ctx.fillRect(0, 0, W, 10);
      const [first = "", ...rest] = blocks[i].split(/\n+/).filter((l) => l.trim());
      ctx.fillStyle = "#0f1b2d";
      ctx.font = `700 52px ${FONT_STACK}`;
      let y = 70;
      for (const l of wrap(ctx, first, W - 160).slice(0, 2)) {
        ctx.fillText(l, 80, y);
        y += 66;
      }
      y += 20;
      ctx.font = `400 34px ${FONT_STACK}`;
      ctx.fillStyle = "#26324a";
      outer: for (const para of rest) {
        for (const l of wrap(ctx, `• ${para}`, W - 180)) {
          if (y > H - 110) break outer;
          ctx.fillText(l, 90, y);
          y += 46;
        }
        y += 8;
      }
      footer(ctx, W, H, `${footerLabel} · ${i + 1}`);
      pages.push(await canvasToFile(canvas, `slide-${i + 1}.jpg`));
    }
  } else {
    // A4 pages (1240 x 1754 = 150 dpi), paragraphs flow across pages.
    const W = 1240;
    const H = 1754;
    const lineHeight = 42;
    let page = newPage(W, H);
    let y = 90;
    page.ctx.font = `400 28px ${FONT_STACK}`;
    page.ctx.fillStyle = "#1b2436";
    const flush = async () => {
      footer(page.ctx, W, H, `${footerLabel} · ${pages.length + 1}`);
      pages.push(await canvasToFile(page.canvas, `page-${pages.length + 1}.jpg`));
      page = newPage(W, H);
      page.ctx.font = `400 28px ${FONT_STACK}`;
      page.ctx.fillStyle = "#1b2436";
      y = 90;
    };
    for (const para of blocks) {
      for (const l of wrap(page.ctx, para, W - 180)) {
        if (y > H - 140) {
          await flush();
          if (pages.length >= MAX_PAGES) break;
        }
        page.ctx.fillText(l, 90, y);
        y += lineHeight;
      }
      if (pages.length >= MAX_PAGES) break;
      y += 16;
    }
    if (pages.length < MAX_PAGES && y > 90) await flush();
  }

  if (pages.length === 0) return null;
  const base = file.name.replace(/\.[^.]+$/, "");
  return mergeImagesToPdf(pages, `${base} (PDF version).pdf`);
}
