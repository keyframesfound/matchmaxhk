import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { openPdf, renderPage } from "@/features/materials/note-file-tools";
import { defaultPreviewIndices, maxPreviewPagesFor } from "@/features/materials/preview-pages";

/**
 * Notes upload v2: the seller picks which pages buyers may preview. Pages
 * render as small thumbnails (pdfjs, client-side); the cap is ~12 pages and
 * never the whole document. The server re-sanitizes the pick and stamps a
 * visible tiled watermark on every preview page.
 */

const MAX_THUMBS = 80;

export function NotePreviewPicker({
  source,
  selected,
  onChange,
  onPageCount,
  onLoadFailed,
}: {
  source: File | string | null;
  selected: number[] | null;
  onChange: (indices: number[]) => void;
  onPageCount?: (count: number) => void;
  /** GLM review fix: remote (signed-URL) sources expire after ~15 min; the
   * parent refetches a fresh URL, and the new source identity re-runs this
   * effect. Only called for string sources. */
  onLoadFailed?: (source: string) => void;
}) {
  const { t } = useTranslation();
  const [thumbs, setThumbs] = useState<string[]>([]);
  const [pageCount, setPageCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!source) {
      setThumbs([]);
      setPageCount(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    setThumbs([]);
    (async () => {
      try {
        const doc = await openPdf(source);
        if (cancelled) return;
        setPageCount(doc.numPages);
        onPageCount?.(doc.numPages);
        const limit = Math.min(doc.numPages, MAX_THUMBS);
        for (let i = 1; i <= limit; i += 1) {
          const url = await renderPage(doc, i, 140, "image/jpeg", 0.6);
          if (cancelled) return;
          setThumbs((prev) => [...prev, url]);
        }
        await doc.destroy();
      } catch {
        if (!cancelled) {
          setFailed(true);
          if (typeof source === "string") onLoadFailed?.(source);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // onPageCount/onLoadFailed are stable setters from the parent.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source]);

  if (!source) return null;
  if (failed) {
    return <p className="text-xs text-destructive">{t("notes.preview_pick.failed")}</p>;
  }

  const max = pageCount > 0 ? maxPreviewPagesFor(pageCount) : 0;
  const current = selected ?? (pageCount > 0 ? defaultPreviewIndices(pageCount) : []);

  const toggle = (index: number) => {
    if (current.includes(index)) {
      onChange(current.filter((i) => i !== index));
    } else if (current.length < max) {
      onChange([...current, index].sort((a, b) => a - b));
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("notes.preview_pick.counter", { count: current.length, max, total: pageCount })}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={pageCount === 0}
          onClick={() => onChange(defaultPreviewIndices(pageCount))}
        >
          {t("notes.preview_pick.reset")}
        </Button>
      </div>
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
        {thumbs.map((url, index) => {
          const isOn = current.includes(index);
          const blocked = !isOn && current.length >= max;
          return (
            <button
              key={index}
              type="button"
              onClick={() => toggle(index)}
              disabled={blocked}
              aria-pressed={isOn}
              aria-label={t("notes.preview_pick.page_aria", { page: index + 1 })}
              className={cn(
                "relative overflow-hidden rounded-lg border-2 bg-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
                isOn ? "border-[color:var(--brand-link)]" : "border-border",
                blocked && "opacity-50",
              )}
            >
              <img src={url} alt="" className="block w-full" />
              <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[11px] font-semibold text-white">
                {index + 1}
              </span>
              {isOn ? (
                <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--brand-link)] text-white">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </span>
              ) : null}
            </button>
          );
        })}
        {loading ? (
          <div className="flex aspect-[3/4] items-center justify-center rounded-lg border border-border">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
          </div>
        ) : null}
      </div>
      {pageCount > MAX_THUMBS ? (
        <p className="text-xs text-muted-foreground">
          {t("notes.preview_pick.more_pages", { count: MAX_THUMBS })}
        </p>
      ) : null}
      <p className="text-xs text-muted-foreground">{t("notes.preview_pick.watermark_note")}</p>
    </div>
  );
}
