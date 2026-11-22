import { useState } from "react";
import { HeartHandshake } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * #794 AC-400-1 — Community Champion.
 *
 * A pro-bono mark that sits beside the Verified disc on the TutorCard and the
 * public profile, deliberately in Sky (#8ecdf8) rather than the Verified
 * azure (#1d9bf0) so it reads as a companion, not a second verification. The
 * data is `tutors.community_champion_at`, which only a DB trigger can set: a
 * pro-bono case of that tutor reaching `closed` with a completed lesson. There
 * is no owner-editable flag, so it cannot be self-claimed.
 *
 * Same interaction as VerifiedBadge: hover shows the one-line tip, a click
 * opens a short explainer rather than navigating anywhere.
 */
export function ChampionBadge({ className = "h-5 w-5" }: { className?: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        className="inline-flex max-w-full cursor-pointer items-center justify-center"
        title={t("tutor_card.champion_tip")}
        aria-label={t("tutor_card.champion_tip")}
      >
        <HeartHandshake
          className={`${className} fill-[#8ecdf8] text-white dark:text-[#0b2230]`}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{t("tutor_card.champion_title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("tutor_card.champion_explain")}
          </DialogDescription>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{t("tutor_card.champion_explain")}</p>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              {t("tutor_card.champion_close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
