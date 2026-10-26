import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Checkbox } from "@/components/ui/checkbox";

/**
 * Issue #429: the SHOP acknowledgment checkbox on the buy card (digital
 * goods; disputes only for a defective / materially-different file; the
 * dispute window = the escrow hold period; no accuracy or grade warranty).
 * Client half only: startCheckout re-validates server-side (zod literal
 * true) and persists shop_terms_version + shop_terms_accepted_at on the
 * ORDER ROW. The full escrow rules live at /legal/notes-terms.
 */
export function ShopTermsCheckbox({
  checked,
  invalid = false,
  onCheckedChange,
}: {
  checked: boolean;
  invalid?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-1.5">
      <label className="flex gap-3 text-sm text-muted-foreground">
        <Checkbox
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          aria-invalid={invalid || undefined}
          className={invalid ? "border-destructive" : undefined}
        />
        <span>
          {t("notes.shop_terms_ack")}{" "}
          <Link
            className="font-semibold text-[color:var(--brand-link)] underline underline-offset-4"
            to="/legal/notes-terms"
            target="_blank"
          >
            {t("notes.shop_terms_read")}
          </Link>
          {invalid ? (
            <span className="ml-2 align-middle text-xs font-medium text-destructive">
              {t("terms.gate.required")}
            </span>
          ) : null}
        </span>
      </label>
    </div>
  );
}
