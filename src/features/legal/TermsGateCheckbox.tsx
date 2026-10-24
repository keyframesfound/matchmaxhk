import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Checkbox } from "@/components/ui/checkbox";

/**
 * Issue #214: the one terms-gate checkbox shared by the four gated surfaces —
 * signup / referral_signup (/join), note_upload (note form) and checkout
 * (buy card). Renders the acceptance label with a link into the relevant
 * /tos section (anchor ids live on that page). It is only the CLIENT half of
 * the gate: the surface that gets recorded and the terms_acceptances row are
 * written by the server fn that owns the gate, which independently validates
 * the checkbox (fail-closed) — see features/legal/terms-acceptance.server.ts.
 */

export type TermsGateSection = "matching" | "notes";

type TermsGateCheckboxProps = {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Which new ToS part the surface gates on — drives the label + anchor. */
  section?: TermsGateSection;
  /** Shows the "Required" flag, matching the forms' field-error pattern. */
  invalid?: boolean;
};

const SECTION_ANCHORS: Record<TermsGateSection, string> = {
  matching: "tos-matching",
  notes: "tos-notes",
};

export function TermsGateCheckbox({
  checked,
  invalid = false,
  onCheckedChange,
  section = "matching",
}: TermsGateCheckboxProps) {
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
          {t("terms.gate.label", {
            section: t(`terms.gate.section_${section}`),
          })}{" "}
          <Link
            className="font-semibold text-[color:var(--brand-link)] underline underline-offset-4"
            to="/tos"
            hash={SECTION_ANCHORS[section]}
            target="_blank"
          >
            {t("terms.gate.read")}
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
