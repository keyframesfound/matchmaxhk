import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { canonicalUrl, localeLinks } from "@/features/i18n/seo";
import { hourlyRangeLabel } from "@/features/tutors/availability-grid-model";
import { PageContainer } from "@/components/layout/PageContainer";
import { PublicPage } from "@/components/layout/PublicPage";
import { CaseRequestForm } from "@/features/cases/CaseRequestForm";
import { hasPendingCompleteParam, stripPendingCompleteParam } from "@/lib/pending-submit";

/**
 * #759 Part 1 (was #732): the public, guest-fillable Case Request form
 * (#049 / #751). Unauthenticated parents open and complete the whole form —
 * zero login wall (the /tutor-requests?post=true auth gate was the superseded
 * Google-first flow) — and Google OAuth runs only on Submit via the
 * matchmax_pending_submission_v1 handoff. Signed-in visitors submit directly,
 * no OAuth hop.
 *
 * Pre-fill contract carried over from #709 / #731 / #768: `tutor` (author's
 * public code, MM-T###), `req_curriculum` / `req_subject` (short plain
 * labels from a note), `req_time` (grid day-hour from an Open cell). The
 * legacy `post` param is accepted and ignored so old links keep working.
 */
export const Route = createFileRoute("/case-request")({
  validateSearch: (search: Record<string, unknown>) => {
    const result: {
      post?: boolean;
      tutor?: string;
      req_curriculum?: string;
      req_subject?: string;
      req_time?: string;
      complete_pending_submit?: boolean;
    } = {};
    if (search.post === "1" || search.post === true || search.post === "true") result.post = true;
    // Keep the public tutor code only (MM-T### per lib/tutor-code.ts — no
    // free-form data rides the URL).
    if (typeof search.tutor === "string" && /^MM-T\d{1,6}$/i.test(search.tutor.trim()))
      result.tutor = search.tutor.trim().toUpperCase();
    // #731: short plain labels only (curriculum / subject from a note).
    if (typeof search.req_curriculum === "string" && search.req_curriculum.trim())
      result.req_curriculum = search.req_curriculum.trim().slice(0, 40);
    if (typeof search.req_subject === "string" && search.req_subject.trim())
      result.req_subject = search.req_subject.trim().slice(0, 60);
    // #768: Open-cell tap pre-fill — strictly a grid day code + HKT hour.
    if (typeof search.req_time === "string") {
      const match = /^(mon|tue|wed|thu|fri|sat|sun)-(\d{1,2})$/i.exec(search.req_time.trim());
      const hour = match ? Number(match[2]) : -1;
      if (match && hour >= 6 && hour <= 23) {
        result.req_time = `${match[1].toLowerCase()}-${hour}`;
      }
    }
    if (hasPendingCompleteParam(search)) result.complete_pending_submit = true;
    return result;
  },
  ssr: false,
  head: () => ({
    meta: [
      { title: "Request a Tutor — Free Case Request | MatchMax" },
      {
        name: "description",
        content:
          "Tell us what your child needs — subjects, budget and schedule — and MatchMax matches a vetted Hong Kong tutor. Free for parents, no account needed to apply.",
      },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: "Request a Tutor — Free Case Request | MatchMax" },
      {
        property: "og:description",
        content:
          "Tell us what your child needs — subjects, budget and schedule — and MatchMax matches a vetted Hong Kong tutor. Free for parents, no account needed to apply.",
      },
      { property: "og:url", content: canonicalUrl("/case-request") },
    ],
    links: [
      { rel: "canonical", href: canonicalUrl("/case-request") },
      ...localeLinks("/case-request"),
    ],
  }),
  component: CaseRequestPage,
});

function CaseRequestPage() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  // The completion marker only matters for the first hydration pass; strip it
  // from the address bar afterwards so a refresh never re-triggers the flow.
  useEffect(() => {
    if (search.complete_pending_submit) stripPendingCompleteParam();
  }, [search.complete_pending_submit]);
  // Same note pre-fill shape the board passes (#709 + #768).
  const prefillNote =
    [
      search.tutor ? t("case_request.notes_tutor_prefill", { code: search.tutor }) : undefined,
      search.req_time
        ? t("case_request.notes_time_prefill", {
            slot: `${t(`profile.grid_day_${search.req_time.split("-")[0]}`)} ${hourlyRangeLabel(
              Number(search.req_time.split("-")[1]),
            )}`,
          })
        : undefined,
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <PublicPage>
      <section className="border-b border-border bg-[color:var(--surface-header)]">
        <PageContainer width="default" className="py-10 sm:py-12">
          <h1 className="text-2xl font-bold tracking-tight text-[color:var(--ink)] sm:text-3xl">
            Requesting a tutor that meets your requirements?
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Fill in this form and tutors who&rsquo;re qualified and interested can apply for your
            case! No account needed to fill it in — you sign in with Google when you submit and your
            answers carry over automatically.
          </p>
        </PageContainer>
      </section>
      <PageContainer width="default" className="py-10 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <CaseRequestForm
            idPrefix="cr"
            sourceIssue={search.tutor ? "#731" : "#049"}
            tutorCode={search.tutor ?? null}
            completePending={search.complete_pending_submit === true}
            prefillNote={prefillNote}
            prefillStudy={
              search.req_curriculum || search.req_subject
                ? {
                    curriculum: search.req_curriculum ?? null,
                    subjects: search.req_subject ? [search.req_subject] : [],
                  }
                : undefined
            }
          />
        </div>
      </PageContainer>
    </PublicPage>
  );
}
