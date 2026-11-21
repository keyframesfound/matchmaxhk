import { useTranslation } from "react-i18next";

import { cn } from "@/lib/utils";
import {
  selectMaterialCardSocialProof,
  type MaterialSocialProofInput,
} from "@/features/materials/material-social-proof";

/**
 * Issue #768 AC #4: the one muted social-proof line every note/course card
 * shows — "{N} sold" at 3+ sales, else "{N} saved" at 3+ saves, else
 * "New release". Never a badge, never "0 sold".
 *
 * Kept as a single component so the three card variants (browse, shop, home)
 * cannot drift into different thresholds or wording.
 */
export function MaterialSocialProofLine({
  input,
  className,
}: {
  input?: MaterialSocialProofInput | null;
  className?: string;
}) {
  const { t } = useTranslation();
  const proof = selectMaterialCardSocialProof(input);
  const text =
    proof.sold !== null
      ? t("notes.card_sold", { count: proof.sold })
      : proof.saved !== null
        ? t("notes.card_saved", { count: proof.saved })
        : t("notes.card_new");
  return <p className={cn("text-xs text-muted-foreground", className)}>{text}</p>;
}
