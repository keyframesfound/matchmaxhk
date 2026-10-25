import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";

import { CRISP_PREVIEW_PAGES } from "@/features/materials/lifecycle";

/**
 * Clastify-style preview viewer (Ryan, 2026-10-11): the public note page
 * renders the watermarked preview PDF in the browser; the first 3 pages are
 * crisp, everything after is blurred under a lock panel. The blur is CSS in
 * the DOM, the served file itself is already watermarked, so a scraped
 * "clean" copy does not exist anywhere public.
 *
 * pdfjs is loaded lazily on this route only (it is the heaviest dep in the
 * app) and renders at a fixed 900px-width scale, pages are laid out in a
 * single column like the reference site.
 */

const FALLBACK_WORKER = "pdfjs-dist/build/pdf.worker.min.mjs";

export function NotePreviewViewer({
  previewUrl,
  previewPages,
  pageCount,
  ctaLabel,
  lockedLabel,
}: {
  previewUrl: string;
  previewPages: number | null;
  pageCount: number | null;
  ctaLabel: string;
  lockedLabel: string;
}) {
  const { t } = useTranslation();
  void t;
  const containerRef = useRef<HTMLDivElement>(null);
  const [pageCountState, setPageCountState] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!previewUrl) return;
    let cancelled = false;
    const canvases: HTMLCanvasElement[] = [];

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist");
        const workerUrl = new URL(FALLBACK_WORKER, import.meta.url).href;
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        const doc = await pdfjs.getDocument({ url: previewUrl }).promise;
        if (cancelled) return;
        setPageCountState(doc.numPages);
        const total = doc.numPages;
        const container = containerRef.current;
        if (!container) return;
        const targetWidth = Math.min(720, container.clientWidth || 720);

        for (let i = 1; i <= total; i += 1) {
          const page = await doc.getPage(i);
          const base = page.getViewport({ scale: 1 });
          const scale = targetWidth / base.width;
          const viewport = page.getViewport({ scale });
          const canvas = document.createElement("canvas");
          canvas.width = Math.floor(viewport.width);
          canvas.height = Math.floor(viewport.height);
          canvas.className = "mx-auto block w-full rounded-lg border border-border bg-white";
          canvas.dataset.pageIndex = String(i - 1);
          const ctx = canvas.getContext("2d");
          if (!ctx) return;
          await page.render({ canvas, canvasContext: ctx, viewport } as never).promise;
          if (cancelled) {
            canvas.remove();
            return;
          }
          canvases.push(canvas);
          container.appendChild(canvas);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();

    return () => {
      cancelled = true;
      for (const canvas of canvases) canvas.remove();
    };
  }, [previewUrl]);

  const total = previewPages ?? pageCount ?? pageCountState ?? 0;
  const crisp = Math.min(CRISP_PREVIEW_PAGES, total);

  if (failed || !previewUrl) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card text-sm text-muted-foreground">
        {t("notes.preview_unavailable")}
      </div>
    );
  }

  return (
    <div className="relative" data-testid="note-preview-viewer">
      {/* Pages render into this div; blur is applied per canvas index via CSS */}
      <style>{`
        [data-testid="note-preview-viewer"] canvas[data-page-index="${crisp}"],
        [data-testid="note-preview-viewer"] canvas[data-page-index="${crisp}"] ~ canvas {
          filter: blur(9px);
          pointer-events: none;
          user-select: none;
        }
      `}</style>
      <div ref={containerRef} className="space-y-4" aria-label={t("notes.preview_aria")} />
      {/* Lock overlay rides at the top of the blurred region */}
      {total > crisp && (
        <div
          className="pointer-events-none absolute inset-x-0 flex items-center justify-center"
          style={{ top: `min(90%, ${(crisp / Math.max(total, 1)) * 100}%)` }}
        >
          <div className="pointer-events-auto flex max-w-sm items-center gap-3 rounded-xl border border-border bg-[color:var(--surface)]/95 p-4 backdrop-blur-sm">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent">
              <Lock className="h-5 w-5 text-accent-foreground" aria-hidden />
            </span>
            <div>
              <p className="text-sm font-bold">{lockedLabel}</p>
              <p className="text-xs text-muted-foreground">
                {t("notes.pages_locked", { count: total - crisp })}
              </p>
            </div>
            <a
              href="#buy"
              className="ml-2 shrink-0 rounded-md bg-[color:var(--btn-accent)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#1A8CD8]"
            >
              {ctaLabel}
            </a>
          </div>
        </div>
      )}
      {pageCountState === 0 && !failed && (
        <div className="flex h-64 items-center justify-center rounded-xl border border-border bg-card">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-[color:var(--btn-accent)]" />
        </div>
      )}
    </div>
  );
}
