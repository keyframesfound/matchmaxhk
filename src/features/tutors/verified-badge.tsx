import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

/**
 * Issue #575 §4b — the MatchMax Verified badge (CEO 2026-11-04 lock).
 *
 * Surfaces: TutorCard (Explore / listing / Similar) AND the public tutor
 * profile header — same mark, same behaviour. Mac hover / phone first tap
 * shows the "Verified tutor" tip (native title); a further click opens the
 * short Verify explainer covering what staff checked vs what is NEVER
 * public (HKID / full transcripts stay staff-only). The badge never opens
 * raw private verification files.
 *
 * V1 mark: the azure BadgeCheck disc; the interim M-seal asset
 * (public/badges/matchmax-verified-badge-interim-v1.jpg) stays in the repo
 * and can replace the icon without any API change.
 */
export function VerifiedBadge({ className = "h-5 w-5" }: { className?: string }) {
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
        title={t("tutor_card.verified_tip")}
        aria-label={t("tutor_card.verified_tip")}
      >
        <BadgeCheck
          className={`${className} fill-[#1d9bf0] text-white dark:text-[#0b2230]`}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle>{t("tutor_card.verified_tip")}</DialogTitle>
          <DialogDescription className="sr-only">{t("tutor_card.verified_tip")}</DialogDescription>
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">{t("tutor_card.verified_explain_checked")}</p>
            <p className="text-muted-foreground">{t("tutor_card.verified_explain_private")}</p>
            <p className="text-muted-foreground">
              {t("tutor_card.verified_explain_proofs")}{" "}
              <span className="font-medium text-[color:var(--ink)]">
                {t("tutor_card.verified_explain_proofs_hint")}
              </span>
            </p>
            <Button type="button" size="sm" onClick={() => setOpen(false)}>
              {t("tutor_card.verified_explain_close")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
