import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, CircleDashed } from "lucide-react";
import { useTranslation } from "react-i18next";

import { getCaseBilling } from "@/features/cases/case-billing.functions";
import { formatHktDateTime } from "@/features/rosters/roster-logic";
import { formatMoney } from "@/lib/money";

/**
 * #785 AC-735-1: the #760 admin-fee settlement, read-only inside Case
 * Manager so the tutor sees the same state the tutor dashboard and the desk
 * already show. Every figure is the stored `case_fee_milestones` snapshot
 * (written by the attendance sync from the fee engines) — nothing is
 * recalculated here. The proof chip comes from the case's current
 * `case_fees` row via settlementCardState.
 *
 * #756 lock: tutor-side only. The parent/student view never renders this, and
 * `getCaseBilling` no longer sends the ledger to a parent, so there is no role
 * branch to get wrong here.
 */
export function SettlementPanel({ caseId }: { caseId: string }) {
  const { t, i18n } = useTranslation();
  // Shares the tab's query key, so this section costs no extra request.
  const { data } = useQuery({
    queryKey: ["case-billing", caseId],
    queryFn: () => getCaseBilling({ data: { caseId } }),
  });

  const milestones = data?.milestones ?? [];
  if (milestones.length === 0) return null;

  const settlement = data?.settlement ?? null;
  const known = milestones.flatMap((m) => (m.amountHkd === null ? [] : [m.amountHkd]));
  const total = known.length === milestones.length ? known.reduce((sum, n) => sum + n, 0) : null;
  const note = data?.isShortCase
    ? "billing.settlement_note_short"
    : "billing.settlement_note_tutor";

  return (
    <section className="space-y-2 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("billing.settlement_title")}</h3>
        {settlement ? (
          <span
            className={`rounded-full px-2.5 py-1 text-xs font-medium ${
              settlement === "settled"
                ? "bg-emerald-500/10 text-emerald-700"
                : settlement === "rejected"
                  ? "bg-destructive/10 text-destructive"
                  : "bg-amber-500/10 text-amber-700"
            }`}
          >
            {t(`billing.settlement_state_${settlement}`)}
          </span>
        ) : null}
      </div>
      <ul className="divide-y divide-border text-sm">
        {milestones.map((m) => (
          <li key={m.kind} className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5">
            {m.status === "delivered" ? (
              <BadgeCheck className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
            ) : (
              <CircleDashed className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            )}
            <span className="font-medium">{t(`rosters.milestone_${m.kind}`)}</span>
            <span className="font-mono text-xs text-muted-foreground">
              {m.amountHkd === null ? "—" : formatMoney(m.amountHkd)}
            </span>
            <span className="text-xs text-muted-foreground">
              {t(`billing.settlement_milestone_${m.status}`)}
            </span>
            {m.status === "delivered" && m.deliveredAt ? (
              <span className="text-xs text-muted-foreground">
                · {formatHktDateTime(m.deliveredAt, i18n.language)}
              </span>
            ) : null}
            {m.status === "delivered" && m.deliveredSource ? (
              <span className="text-xs text-muted-foreground">
                · {t(`billing.settlement_source_${m.deliveredSource}`)}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {total === null ? (
        <p className="text-xs text-muted-foreground">{t("billing.settlement_total_missing")}</p>
      ) : (
        <p className="text-sm font-semibold">
          {t("billing.settlement_total", { total: formatMoney(total) })}
        </p>
      )}
      <p className="text-xs text-muted-foreground">{t(note)}</p>
    </section>
  );
}
