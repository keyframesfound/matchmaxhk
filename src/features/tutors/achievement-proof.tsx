import { useState } from "react";
import { Camera } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { materialCoverUrl } from "@/features/materials/material-card";

/**
 * Issue #575 — a public photo proof next to an achievement: a 40px rounded
 * thumbnail (or the "Photo" pill when the image is missing) that opens the
 * full image in a lightbox. The tutor chose to publish this photo; private
 * verification files never appear here.
 */
export function AchievementProof({ path, label }: { path: string; label: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const url = materialCoverUrl(path);
  if (!url) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group mt-1.5 inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-[color:var(--ink)] transition-colors hover:border-[color:var(--brand-link)]"
        aria-label={t("tutor_card.proof_open")}
      >
        <img src={url} alt="" className="h-6 w-6 rounded-full object-cover" loading="lazy" />
        <Camera className="h-3 w-3 text-[color:var(--brand-link)]" aria-hidden="true" />
        {t("tutor_card.proof_pill")}
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogTitle>{label}</DialogTitle>
          <img src={url} alt={label} className="max-h-[70vh] w-full rounded-xl object-contain" />
          <p className="text-xs text-muted-foreground">{t("tutor_card.proof_caption")}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
