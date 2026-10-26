import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import i18n from "@/features/i18n/config";
import { FileText, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  confirmEngagementSummary,
  getEngagementSummary,
  reportEngagementChange,
  resolveEngagementChange,
} from "@/features/cases/engagement.functions";

/**
 * Issue #412 F, the 1-page Engagement Summary card shared by the parent,
 * tutor, org, and admin surfaces. Both parties 1-click confirm the exact
 * version before contact details / lesson commencement are finalised, and
 * either party can report a material change (re-holds the case).
 */
export function EngagementSummaryCard({
  caseId,
  party,
  staff = false,
}: {
  caseId: string;
  party: "tutor" | "customer";
  /** Admin surface: shows resolve actions for open change reports. */
  staff?: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const summaryFn = useServerFn(getEngagementSummary);
  const confirmFn = useServerFn(confirmEngagementSummary);
  const reportFn = useServerFn(reportEngagementChange);
  const resolveFn = useServerFn(resolveEngagementChange);
  const [reporting, setReporting] = useState(false);
  const [reportNote, setReportNote] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["engagement-summary", caseId],
    queryFn: () => summaryFn({ data: { caseId } }),
  });

  const confirm = useMutation({
    mutationFn: () => confirmFn({ data: { caseId, party } }),
    onSuccess: () => {
      toast.success(t("engagement.summary.confirm_saved"));
      void queryClient.invalidateQueries({ queryKey: ["engagement-summary", caseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const report = useMutation({
    mutationFn: () => reportFn({ data: { caseId, role: party, description: reportNote.trim() } }),
    onSuccess: () => {
      toast.success(t("engagement.summary.report_sent"));
      setReporting(false);
      setReportNote("");
      void queryClient.invalidateQueries({ queryKey: ["engagement-summary", caseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolve = useMutation({
    mutationFn: (reportId: string) => resolveFn({ data: { reportId } }),
    onSuccess: () => {
      toast.success("Change report resolved");
      void queryClient.invalidateQueries({ queryKey: ["engagement-summary", caseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) return null;
  const summary = data?.summary;
  // Nothing to show until the case reaches the engagement stage.
  if (!summary) return null;
  const p = summary.payload;
  const myConfirmed = party === "tutor" ? summary.tutorConfirmedAt : summary.customerConfirmedAt;
  const theirConfirmed = party === "tutor" ? summary.customerConfirmedAt : summary.tutorConfirmedAt;

  return (
    <section className="rounded-xl border border-border bg-[color:var(--surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base font-bold text-[color:var(--ink)]">
          <FileText className="h-4 w-4 text-[color:var(--brand-link)]" aria-hidden="true" />
          {t("engagement.summary.title")}
        </h2>
        <span className="text-xs text-muted-foreground">
          {t("engagement.summary.version", { version: summary.version })}
        </span>
      </div>

      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        {(
          [
            ["engagement.summary.customer", p.customerLegalName],
            ["engagement.summary.educator", p.educatorName],
            ["engagement.summary.rate", p.rateStructure],
            ["engagement.summary.payer", p.payer],
            ["engagement.summary.fee_line", p.matchmaxFeeLine],
            ["engagement.summary.autonomy", p.autonomyNote],
          ] as const
        )
          .filter(([, value]) => Boolean(value))
          .map(([key, value]) => (
            <div key={key} className="min-w-0">
              <dt className="text-[11px] font-medium text-muted-foreground">{t(key)}</dt>
              <dd className="text-sm font-medium text-[color:var(--ink)]">{value}</dd>
            </div>
          ))}
        <div className="sm:col-span-2">
          <dt className="text-[11px] font-medium text-muted-foreground">
            {t("engagement.summary.scope")}
          </dt>
          <dd className="text-sm font-medium text-[color:var(--ink)]">{p.scope}</dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-[11px] font-medium text-muted-foreground">
            {t("engagement.summary.payment")}
          </dt>
          <dd className="text-sm font-medium text-[color:var(--ink)]">{p.paymentSchedule}</dd>
        </div>
      </dl>

      {/* Confirmation state + 1-click confirm of THIS version. */}
      <div className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={
              summary.customerConfirmedAt
                ? "inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400"
                : "text-muted-foreground"
            }
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t("engagement.summary.confirmed_customer")}
            {summary.customerConfirmedAt
              ? ` · ${new Date(summary.customerConfirmedAt).toLocaleDateString(i18n.language === "zh-HK" ? "zh-HK" : "en-HK")}`
              : ` · ${t("engagement.summary.not_yet")}`}
          </span>
          <span
            className={
              summary.tutorConfirmedAt
                ? "inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400"
                : "text-muted-foreground"
            }
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t("engagement.summary.confirmed_tutor")}
            {summary.tutorConfirmedAt
              ? ` · ${new Date(summary.tutorConfirmedAt).toLocaleDateString(i18n.language === "zh-HK" ? "zh-HK" : "en-HK")}`
              : ` · ${t("engagement.summary.not_yet")}`}
          </span>
        </div>
        {summary.customerConfirmedAt && summary.tutorConfirmedAt ? (
          <p className="font-medium text-emerald-700 dark:text-emerald-400">
            {t("engagement.summary.both_confirmed")}
          </p>
        ) : !myConfirmed ? (
          <div>
            <Button
              type="button"
              size="sm"
              variant="solid"
              color="blue"
              disabled={confirm.isPending}
              onClick={() => confirm.mutate()}
            >
              {confirm.isPending
                ? t("engagement.summary.confirming")
                : t("engagement.summary.confirm")}
            </Button>
          </div>
        ) : null}

        {/* Report a material change, re-holds the case for re-screening. */}
        {reporting ? (
          <div className="space-y-2">
            <Textarea
              rows={3}
              maxLength={500}
              placeholder={t("engagement.summary.report_placeholder")}
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="solid"
                disabled={reportNote.trim().length < 10 || report.isPending}
                onClick={() => report.mutate()}
              >
                {report.isPending
                  ? t("engagement.summary.report_sending")
                  : t("engagement.summary.report_submit")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setReporting(false)}>
                {t("engagement.summary.report_cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="text-xs font-semibold text-[color:var(--brand-link)] hover:underline"
            onClick={() => setReporting(true)}
          >
            {t("engagement.summary.report_title")}
          </button>
        )}

        {/* Open change reports (staff can resolve). */}
        {summary.openChangeReports.length > 0 ? (
          <div className="space-y-1.5 rounded-md bg-purple-500/[0.06] px-3 py-2">
            <p className="text-[11px] font-bold text-purple-700 dark:text-purple-400">
              {t("engagement.summary.open_reports", { count: summary.openChangeReports.length })}
            </p>
            {summary.openChangeReports.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-2">
                <p className="min-w-0 text-xs text-[color:var(--ink)]">“{r.description}”</p>
                {staff ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 shrink-0 text-xs"
                    disabled={resolve.isPending}
                    onClick={() => resolve.mutate(r.id)}
                  >
                    {t("engagement.summary.resolve")}
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
