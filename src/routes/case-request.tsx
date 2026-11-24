import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

import { canonicalUrl, currentSeoLocale, localeLinks, localizedMeta } from "@/features/i18n/seo";
import { hourlyRangeLabel } from "@/features/tutors/availability-grid-model";
import { caseRequestMode } from "@/features/tutors/tutor-display";
import { PageContainer } from "@/components/layout/PageContainer";
import { PublicPage } from "@/components/layout/PublicPage";
import { CaseRequestForm } from "@/features/cases/CaseRequestForm";
import { isReferralSlug } from "@/features/cases/overflow-lane";
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
      /** #751: the lesson mode the parent already filtered on. */
      req_mode?: "online" | "in_person" | "both";
      complete_pending_submit?: boolean;
      /** #815 §2.11 lane B: the referring Partner Centre's public slug. */
      org?: string;
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
    // #751: lesson mode from /tutors or a tutor profile. "either" is the
    // browse filter's spelling of "no preference" and maps to the form's
    // "both"; anything else is ignored rather than guessed.
    if (typeof search.req_mode === "string") {
      const mode = caseRequestMode(search.req_mode.trim().toLowerCase());
      if (mode) result.req_mode = mode;
    }
    if (hasPendingCompleteParam(search)) result.complete_pending_submit = true;
    // #815 §2.11 lane B: an org referral link records the referrer, nothing
    // else — the slug is validated here and resolved server-side on submit.
    if (isReferralSlug(search.org)) result.org = search.org;
    return result;
  },
  ssr: false,
  head: () => {
    const locale = currentSeoLocale();
    return {
      meta: [
        ...localizedMeta(locale, {
          title: {
            en: "Request a tutor, free case request | MatchMax",
            "zh-HK": "搵導師，免費出需求 | MatchMax",
            "zh-CN": "找导师，免费发布需求 | MatchMax",
          },
          description: {
            en: "Tell us what your child needs: subjects, budget and schedule. MatchMax matches a vetted Hong Kong tutor. Free for parents, no account needed to apply.",
            "zh-HK":
              "話畀我哋知你小朋友需要咩：科目、預算同時段，MatchMax 會配對合適嘅香港導師。家長免費，申請唔需要帳戶。",
            "zh-CN":
              "告诉我们你的孩子需要什么：科目、预算和时间，MatchMax 会配对合适的香港导师。家长免费，申请不需要账户。",
          },
        }),
        { name: "robots", content: "noindex, follow" },
        { property: "og:url", content: canonicalUrl("/case-request") },
      ],
      links: [
        { rel: "canonical", href: canonicalUrl("/case-request") },
        ...localeLinks("/case-request"),
      ],
    };
  },
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
            {t("tutor_requests.hero_title")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t("tutor_requests.case_request_body")}
          </p>
        </PageContainer>
      </section>
      <PageContainer width="default" className="py-10 sm:py-12">
        <div className="mx-auto max-w-2xl">
          <CaseRequestForm
            idPrefix="cr"
            sourceIssue={search.tutor ? "#731" : "#049"}
            tutorCode={search.tutor ?? null}
            referredByOrgSlug={search.org ?? null}
            completePending={search.complete_pending_submit === true}
            prefillNote={prefillNote}
            prefillMode={search.req_mode ?? null}
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
