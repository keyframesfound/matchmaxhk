import { Lock, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ParentContactView } from "@/features/trust/trust";

/**
 * #783 §2.5 (was #255) "Contact after the fee, not a chat". Shows the other
 * party's phone on this case once the admin fee is paid, with the note that
 * later lessons are arranged between them. Before that, it says when the
 * phone will appear. MatchMax hosts no inbox in V1; copying is not blocked.
 */
export function CaseContactLine({
  contact,
  counterparty,
}: {
  contact: ParentContactView;
  counterparty: "parent" | "tutor";
}) {
  const { t } = useTranslation();
  if (contact.reason === "NOT_MATCHED" || contact.reason === "CASE_CLOSED") return null;

  const label =
    counterparty === "parent" ? t("case_contact.parent_label") : t("case_contact.tutor_label");

  if (contact.revealed && contact.phone) {
    return (
      <div className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-950">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Phone className="h-4 w-4 shrink-0" aria-hidden />
          <span className="font-medium">{label}</span>
          {contact.name ? <span>{contact.name}</span> : null}
          <a className="font-semibold underline" href={`tel:${contact.phone.replace(/\s+/g, "")}`}>
            {contact.phone}
          </a>
        </p>
        <p className="mt-1 text-xs">{t("case_contact.after_fee_note")}</p>
      </div>
    );
  }

  return (
    <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
      <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
      <span>
        {contact.reason === "RISK_HOLD"
          ? t("case_contact.held")
          : contact.revealed
            ? t("case_contact.no_phone")
            : t("case_contact.locked")}
      </span>
    </p>
  );
}
