import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { ConsolePanel } from "@/components/ui/console-panel";
import { cn } from "@/lib/utils";
import { getEarningsDashboard } from "@/features/cases/earnings.functions";
import { setTuitionStatus } from "@/features/cases/tuition.functions";
import type { EarningsLesson, EarningsResult, EarningsTotals } from "@/features/cases/earnings";

/**
 * Issue #461 Phase A — tutor earnings strip on /dashboard: Realized,
 * Pipeline, Forecast (tutor's net, after the admin fee) and the admin fee
 * owed to MatchMax, for this week or month in HKT.
 */

type RangeKind = "week" | "month";

const RANGES: readonly RangeKind[] = ["week", "month"];

function hkd(amount: number): string {
  return `HK$${Math.round(amount).toLocaleString("en-HK")}`;
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-[color:var(--ink)]">{value}</dd>
      {hint ? <dd className="text-[11px] text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

function Figures({ totals }: { totals: EarningsTotals }) {
  const { t } = useTranslation();
  return (
    <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
      <Figure
        label={t("sor.tutor_earnings_realized")}
        value={hkd(totals.realizedHkd)}
        hint={t("sor.tutor_earnings_hours", { n: totals.realizedHours })}
      />
      <Figure label={t("sor.tutor_earnings_pipeline")} value={hkd(totals.pipelineHkd)} />
      <Figure label={t("sor.tutor_earnings_forecast")} value={hkd(totals.forecastHkd)} />
      <Figure label={t("sor.tutor_earnings_admin")} value={hkd(totals.adminHkd)} />
      <Figure
        label={t("sor.tutor_earnings_unpaid")}
        value={hkd(totals.unpaidTuitionHkd)}
        hint={t("sor.tutor_earnings_unpaid_hint")}
      />
    </dl>
  );
}

/** #461 3b: realized lessons with a paid / unpaid toggle (tutor-only write). */
function TuitionList({ result }: { result: EarningsResult }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const toggle = useMutation({
    mutationFn: (l: EarningsLesson) =>
      setTuitionStatus({
        data: { source: l.source, id: l.id, status: l.tuitionUnpaid ? "paid" : "unpaid" },
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sor", "earnings"] }),
    onError: (e) =>
      toast.error(t(`sor.tutor_earnings_err_${e.message}`, { defaultValue: e.message })),
  });
  const realized = result.cases.flatMap((c) =>
    c.lessons.filter((l) => l.bucket === "realized").map((l) => ({ c, l })),
  );
  if (realized.length === 0) return null;
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-xs font-semibold text-[color:var(--brand-link)]">
        {t("sor.tutor_earnings_tuition_list")}
      </summary>
      <ul className="mt-2 space-y-1.5">
        {realized.map(({ c, l }) => (
          <li key={l.id} className="flex flex-wrap items-center justify-between gap-2">
            <span className="tabular-nums text-xs text-[color:var(--ink)]">
              {format(new Date(l.startsAt), "d MMM")} · {c.studentLabel} · {hkd(l.grossHkd)}
              {l.tuitionUnpaid ? ` · ${t("sor.tutor_earnings_unpaid_tag")}` : ""}
            </span>
            <Button
              size="sm"
              variant="outline"
              disabled={toggle.isPending}
              onClick={() => toggle.mutate(l)}
            >
              {l.tuitionUnpaid
                ? t("sor.tutor_earnings_mark_paid")
                : t("sor.tutor_earnings_mark_unpaid")}
            </Button>
          </li>
        ))}
      </ul>
    </details>
  );
}

export function EarningsPanel() {
  const { t } = useTranslation();
  const [range, setRange] = useState<RangeKind>("month");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["sor", "earnings", range],
    queryFn: () => getEarningsDashboard({ data: { range } }),
  });
  const rows = (data?.cases ?? []).filter((c) => c.lessons.length > 0);

  return (
    <ConsolePanel padding="none" aria-labelledby="tutor-earnings-heading">
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-4">
        <h2 id="tutor-earnings-heading" className="text-sm font-semibold text-[color:var(--ink)]">
          {t("sor.tutor_earnings_title")}
        </h2>
        <div role="group" aria-label={t("sor.tutor_earnings_range")} className="flex gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                range === r
                  ? "border-[color:var(--ink)] text-[color:var(--ink)]"
                  : "border-[color:var(--ink)]/10 text-muted-foreground",
              )}
            >
              {t(`sor.tutor_earnings_range_${r}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {isLoading ? (
          <p className="text-sm text-muted-foreground">{t("sor.loading")}</p>
        ) : isError || !data ? (
          <p className="text-sm text-muted-foreground">{t("sor.tutor_earnings_error")}</p>
        ) : (
          <>
            <Figures totals={data.totals} />
            {rows.length > 0 ? (
              <ul className="mt-4 space-y-1.5 border-t border-[color:var(--ink)]/10 pt-3">
                {rows.map((c) => (
                  <li
                    key={c.caseId}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
                  >
                    <span className="text-[color:var(--ink)]">
                      {c.caseCode} · {c.studentLabel}
                    </span>
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {t("sor.tutor_earnings_row", {
                        realized: hkd(c.totals.realizedHkd),
                        pipeline: hkd(c.totals.pipelineHkd),
                        admin: hkd(c.totals.adminHkd),
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">{t("sor.tutor_earnings_empty")}</p>
            )}
            <TuitionList result={data} />
            {data.casesMissingRate > 0 ? (
              <p className="mt-3 text-xs text-muted-foreground">
                {t("sor.tutor_earnings_missing_rate", { n: data.casesMissingRate })}
              </p>
            ) : null}
          </>
        )}
        <p className="mt-3 text-xs text-muted-foreground">{t("sor.tutor_earnings_note")}</p>
      </div>
    </ConsolePanel>
  );
}
