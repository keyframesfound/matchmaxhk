import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarClock, Wallet } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Skeleton } from "@/components/ui/skeleton";
import { getMyParentCases, type ParentCaseListItem } from "@/features/cases/parent.functions";
import { MatchStageChip } from "@/features/cases/parent/match-status-card";

export const Route = createFileRoute("/_authenticated/account/cases")({
  ssr: false,
  head: () => ({
    meta: [{ title: "My cases | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: ParentCasesPage,
});

function feePill(item: ParentCaseListItem, t: ReturnType<typeof useTranslation>["t"]) {
  if (!item.fee_status) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--foreground)]/[0.06] px-3 py-1 text-xs text-muted-foreground">
      <Wallet className="h-3 w-3" aria-hidden="true" />
      {t(`sor.fee_status_${item.fee_status}`)}
      {item.fee_amount_hkd !== null ? ` · HK$${Number(item.fee_amount_hkd).toFixed(0)}` : ""}
    </span>
  );
}

function ParentCasesPage() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["sor", "parent-cases"],
    queryFn: getMyParentCases,
  });

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <SiteHeader />
      <PageContainer>
        <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--ink)]">
          {t("sor.parent_cases_title")}
        </h1>

        <div className="mt-6 space-y-3">
          {isLoading && [0, 1].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}

          {!isLoading && (data?.length ?? 0) === 0 && (
            <p className="rounded-xl border border-[color:var(--ink)]/10 p-6 text-sm text-muted-foreground">
              {t("sor.parent_cases_empty")}
            </p>
          )}

          {data?.map((c) => (
            <Link
              key={c.id}
              to="/account/cases/$caseId"
              params={{ caseId: c.id }}
              className="block rounded-xl border border-[color:var(--ink)]/10 p-4 transition-colors hover:bg-[color:var(--foreground)]/[0.03]"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--ink)]">
                    {c.case_code} · {c.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.subject ?? ""}
                    {c.exam_system ? ` · ${c.exam_system}` : ""}
                    {c.tutor_code ? ` · ${t("sor.parent_tutor")} ${c.tutor_code}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {c.next_lesson_at && (
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="h-3 w-3" aria-hidden="true" />
                      {format(new Date(c.next_lesson_at), "EEE d MMM HH:mm")}
                    </span>
                  )}
                  {feePill(c, t)}
                  <MatchStageChip
                    status={c.status}
                    matchedTutorId={c.matched_tutor_id}
                    sorStatus={c.sor_status}
                  />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </PageContainer>
      <SiteFooter />
    </div>
  );
}
