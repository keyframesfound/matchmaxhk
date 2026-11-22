import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Printer } from "lucide-react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { hktDayLabel } from "@/features/cases/case-schedule";
import { getCaseProgressReport } from "@/features/cases/progress-report.functions";

/**
 * Issue #796 §2.6 (was #742), AC-742-3: the printable A4 progress report.
 *
 * A document, not a dashboard: one white A4 sheet on the muted page, black on
 * white, hairlines only. Every figure comes from `getCaseProgressReport`, which
 * is learner-only and already scrubs uuids, emails and phones out of the
 * payload, so nothing internal can reach the sheet. `caseCode` is the only
 * identifier printed, and it is the public one.
 *
 * Print is the point: `@page { size: A4; margin: 0 }` plus a `no-print`
 * toolbar, so Print / Save as PDF yields the sheet edge to edge.
 */

const PRINT_CSS = `
@media print {
  @page { size: A4; margin: 0 }
  html, body { background: #fff !important }
  .no-print { display: none !important }
  .report-main { background: #fff !important; padding: 0 !important }
  .report-sheet {
    width: 210mm !important;
    max-width: 210mm !important;
    min-height: 296mm !important;
    margin: 0 !important;
    padding: 18mm !important;
    border: 0 !important;
  }
  * {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
`;

export const Route = createFileRoute("/_authenticated/account_/cases_/$caseId/report")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Progress report | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: ProgressReportPage,
});

function ProgressReportPage() {
  const { caseId } = Route.useParams();
  const { t, i18n } = useTranslation();

  const { data, isLoading } = useQuery({
    queryKey: ["sor", "case-progress-report", caseId],
    queryFn: () => getCaseProgressReport({ data: { caseId } }),
  });

  const issued = data ? hktDayLabel(data.issuedAtIso, i18n.language) : null;
  const period =
    data?.periodStartIso && data.periodEndIso
      ? `${hktDayLabel(data.periodStartIso, i18n.language)} – ${hktDayLabel(data.periodEndIso, i18n.language)}`
      : null;
  const masteryParts = data?.mastery ?? { mastered: 0, practicing: 0, weak: 0 };
  const masteryTotal = masteryParts.mastered + masteryParts.practicing + masteryParts.weak;

  return (
    <main className="report-main min-h-screen bg-muted py-8">
      <style>{PRINT_CSS}</style>

      <div className="no-print mx-auto mb-5 flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 sm:px-0">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4" aria-hidden />
            {t("progress_report.print")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("progress_report.print_hint")}</span>
        </div>
        <Link
          to="/account/cases/$caseId"
          params={{ caseId }}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          {t("nav.back")}
        </Link>
      </div>

      {isLoading ? (
        <article className="report-sheet mx-auto flex min-h-0 w-full max-w-[210mm] flex-col gap-4 bg-white p-6 text-black sm:min-h-[297mm] sm:p-[18mm]">
          <div className="h-4 w-32 bg-black/10" />
          <div className="h-7 w-64 bg-black/10" />
          <div className="mt-4 grid grid-cols-2 gap-6">
            <div className="h-10 bg-black/5" />
            <div className="h-10 bg-black/5" />
            <div className="h-10 bg-black/5" />
            <div className="h-10 bg-black/5" />
          </div>
        </article>
      ) : !data ? (
        <article className="report-sheet mx-auto flex min-h-0 w-full max-w-[210mm] items-center justify-center bg-white p-6 text-black sm:min-h-[297mm] sm:p-[18mm]">
          <p className="max-w-[32ch] text-center text-[11pt] leading-relaxed text-black/70">
            {t("progress_report.not_available")}
          </p>
        </article>
      ) : (
        <article className="report-sheet mx-auto flex min-h-0 w-full max-w-[210mm] flex-col bg-white p-6 text-black sm:min-h-[297mm] sm:p-[18mm]">
          <header className="flex items-start justify-between gap-8">
            <div>
              <p
                className="text-[15pt] font-bold tracking-[-0.02em] text-black"
                style={{ fontFamily: "var(--font-wordmark)" }}
              >
                MatchMax
              </p>
              <h1 className="mt-4 text-[24pt] font-bold leading-none tracking-[-0.03em] text-black">
                {t("progress_report.title")}
              </h1>
              <p className="mt-2 text-[9.5pt] font-medium tracking-[-0.01em] text-black/60">
                {data.caseCode}
              </p>
            </div>
            {issued ? (
              <p className="shrink-0 text-[9.5pt] text-black/70">
                {t("progress_report.issued", { date: issued })}
              </p>
            ) : null}
          </header>

          <dl className="mt-8 grid grid-cols-2 gap-x-10 gap-y-6">
            {data.studentName ? (
              <Field label={t("progress_report.student")}>{data.studentName}</Field>
            ) : null}
            {data.subject ? (
              <Field label={t("progress_report.subject")}>{data.subject}</Field>
            ) : null}
            {data.tutorName ? (
              <Field label={t("progress_report.tutor")}>{data.tutorName}</Field>
            ) : null}
            {period ? <Field label={t("progress_report.period")}>{period}</Field> : null}

            <Field label={t("progress_report.hours")}>
              <span className="tabular-nums">{data.verifiedHours} h</span>
              <span className="mt-1 block text-[9pt] text-black/60">
                {t("weekly_digest.lessons", { n: data.verifiedLessons })}
              </span>
            </Field>

            <Field label={t("progress_report.mastery")}>
              <span className="tabular-nums">
                {t("weekly_digest.mastery", {
                  mastered: masteryParts.mastered,
                  practicing: masteryParts.practicing,
                  weak: masteryParts.weak,
                })}
              </span>
              {masteryTotal > 0 ? (
                <span className="mt-2 flex h-1.5 w-full bg-black/10" aria-hidden>
                  <span
                    className="h-full bg-black"
                    style={{ width: `${(masteryParts.mastered / masteryTotal) * 100}%` }}
                  />
                  <span
                    className="h-full bg-black/45"
                    style={{ width: `${(masteryParts.practicing / masteryTotal) * 100}%` }}
                  />
                  <span
                    className="h-full bg-black/20"
                    style={{ width: `${(masteryParts.weak / masteryTotal) * 100}%` }}
                  />
                </span>
              ) : null}
            </Field>

            {data.focus.length > 0 ? (
              <Field label={t("weekly_digest.focus")} wide>
                <ul className="grid gap-x-10 sm:grid-cols-2">
                  {data.focus.map((topic) => (
                    <li
                      key={topic}
                      className="border-b border-black/10 py-1 text-[10.5pt] last:border-b-0"
                    >
                      {topic}
                    </li>
                  ))}
                </ul>
              </Field>
            ) : null}
          </dl>

          <footer className="mt-auto pt-12">
            <div className="flex flex-wrap items-baseline justify-between gap-3 border-t border-black/20 pt-3">
              <p className="max-w-[52ch] text-[10pt] leading-relaxed text-black/70">
                {t("progress_report.disclaimer")}
              </p>
              <p className="text-[10pt] text-black/70">matchmax.hk</p>
            </div>
          </footer>
        </article>
      )}
    </main>
  );
}

/** One label/value pair in the sheet: hairline above, 500 label, 400 value. */
function Field({
  label,
  children,
  wide = false,
}: {
  label: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={cn("border-t border-black/15 pt-2.5", wide && "col-span-2")}>
      <dt className="text-[9pt] font-medium tracking-[-0.01em] text-black/60">{label}</dt>
      <dd className="mt-1 text-[11pt] leading-snug text-black">{children}</dd>
    </div>
  );
}
