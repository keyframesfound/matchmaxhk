import { useState } from "react";
import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import { materialCoverUrl } from "@/features/materials/material-card";
import { trailerEmbedUrl } from "@/features/materials/note-taxonomy";
import type { PublicNote } from "@/features/materials/notes.functions";

/**
 * #556 rich product page blocks: preview gallery (1-5 images, floating
 * watermark) with an optional YouTube / Vimeo trailer, and the structured
 * "What's included" chips + syllabus outline.
 */

export function NoteGallery({ note }: { note: PublicNote }) {
  const { t } = useTranslation();
  const images = note.previewImagePaths
    .map((path) => materialCoverUrl(path))
    .filter((url): url is string => Boolean(url));
  const trailer = trailerEmbedUrl(note.trailerVideoUrl);
  const slides = [
    ...(trailer ? [{ kind: "video" as const, src: trailer }] : []),
    ...images.map((src) => ({ kind: "image" as const, src })),
  ];
  const [active, setActive] = useState(0);
  if (slides.length === 0) return null;
  const current = slides[Math.min(active, slides.length - 1)];

  return (
    <section className="space-y-3" aria-label={t("notes.rich.gallery_aria")}>
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-muted/20">
        {current.kind === "video" ? (
          <iframe
            src={current.src}
            title={t("notes.rich.trailer_title")}
            loading="lazy"
            allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          <>
            <img src={current.src} alt="" className="h-full w-full object-contain" />
          </>
        )}
      </div>
      {slides.length > 1 ? (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {slides.map((slide, index) => (
            <button
              key={slide.src}
              type="button"
              onClick={() => setActive(index)}
              aria-pressed={index === active}
              aria-label={t("notes.rich.slide_aria", { n: index + 1 })}
              className={cn(
                "h-16 w-24 shrink-0 overflow-hidden rounded-md border-2 bg-muted/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
                index === active ? "border-[color:var(--brand-link)]" : "border-border",
              )}
            >
              {slide.kind === "image" ? (
                <img src={slide.src} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-xs font-semibold">
                  {t("notes.rich.trailer_short")}
                </span>
              )}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function NoteIncludedAndSyllabus({ note }: { note: PublicNote }) {
  const { t } = useTranslation();
  if (note.whatsIncluded.length === 0 && !note.syllabusOutline) return null;
  return (
    <section className="space-y-3">
      {note.whatsIncluded.length > 0 ? (
        <div className="space-y-2">
          <h2 className="text-lg font-bold">{t("notes.rich.included_title")}</h2>
          <div className="flex flex-wrap gap-2">
            {note.whatsIncluded.map((item) => (
              <span
                key={item}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      ) : null}
      {note.syllabusOutline ? (
        <div className="space-y-2">
          <h2 className="text-lg font-bold">{t("notes.rich.syllabus_title")}</h2>
          <p className="whitespace-pre-line rounded-xl border border-border bg-card p-4 text-sm leading-relaxed">
            {note.syllabusOutline}
          </p>
        </div>
      ) : null}
    </section>
  );
}
