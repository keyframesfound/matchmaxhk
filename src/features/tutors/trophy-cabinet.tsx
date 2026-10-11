import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * Issue #97: Trophy Cabinet — responsive public gallery of the tutor's
 * optional award/portfolio photos. Rendered ONLY when portfolio_images is
 * non-empty (issue's conditional-rendering requirement: no blank spaces or
 * broken UI for tutors who skip it). Click opens a full-size lightbox.
 */
export function TrophyCabinet({ images }: { images: string[] }) {
  const { t } = useTranslation();
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (images.length === 0) return null;

  return (
    <div>
      <div
        className={cn(
          "grid gap-2",
          images.length === 1 ? "grid-cols-1" : "grid-cols-2 sm:grid-cols-3",
        )}
      >
        {images.map((url, index) => (
          <button
            key={`${index}-${url}`}
            type="button"
            onClick={() => setOpenIndex(index)}
            className="group relative overflow-hidden rounded-sm border border-border bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
            aria-label={t("profile.trophy_open_aria", { index: index + 1 })}
          >
            <img
              src={url}
              alt={t("profile.trophy_alt", { index: index + 1 })}
              loading="lazy"
              decoding="async"
              className="h-32 w-full object-cover transition-transform duration-200 group-hover:scale-[1.03] sm:h-40"
            />
          </button>
        ))}
      </div>

      <Dialog open={openIndex !== null} onOpenChange={(open) => !open && setOpenIndex(null)}>
        <DialogContent className="max-h-[90vh] w-full max-w-3xl overflow-hidden p-0 sm:max-w-3xl">
          <DialogTitle className="sr-only">
            {t("profile.trophy_alt", { index: (openIndex ?? 0) + 1 })}
          </DialogTitle>
          {openIndex !== null && images[openIndex] ? (
            <img
              src={images[openIndex]}
              alt={t("profile.trophy_alt", { index: openIndex + 1 })}
              className="max-h-[90vh] w-full object-contain"
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
