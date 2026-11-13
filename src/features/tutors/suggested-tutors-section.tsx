import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";

import { useAuth } from "@/features/auth/useAuth";
import { listMyChildren } from "@/features/children/children.functions";
import { CHILDREN_QUERY_KEY } from "@/features/children/my-children-section";
import {
  learnerCurriculumLabel,
  learnerFunnelLevel,
  normalizeLearnerCurriculum,
  readRecentSearchSignals,
  useLearnerContext,
  type RecentSearchSignals,
} from "@/features/children/learner-context";
import { getMyParentCases } from "@/features/cases/parent.functions";
import type { Tutor } from "@/features/tutors/queries";
import { getTutorInquiryAction } from "@/features/tutors/tutor-display";
import {
  buildSuggestionTargets,
  suggestTutors,
  type SuggestionTarget,
} from "@/features/tutors/suggested-tutors";

/** SoR states where a subject counts as actively matched (trial onwards). */
const ACTIVE_SOR = new Set([
  "introduced",
  "lesson_1_scheduled",
  "lesson_1_done",
  "lesson_2_scheduled",
  "lesson_2_done",
  "fee_invoiced",
  "fee_paid",
  "active",
]);

/**
 * #716: "Suggested for you" row on the landing page for signed-in parents
 * and students. Hidden for guests and whenever there is nothing honest to
 * suggest (no empty box). Cards reuse the landing card via `renderCard`.
 */
export function SuggestedTutorsSection({
  tutors,
  renderCard,
}: {
  tutors: Tutor[];
  renderCard: (tutor: Tutor) => ReactNode;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const learner = useLearnerContext();
  const [recent, setRecent] = useState<RecentSearchSignals | null>(null);
  useEffect(() => setRecent(readRecentSearchSignals()), []);

  const childrenQuery = useQuery({
    queryKey: CHILDREN_QUERY_KEY,
    queryFn: () => listMyChildren(),
    enabled: Boolean(user),
    staleTime: 60_000,
  });
  const casesQuery = useQuery({
    queryKey: ["sor", "parent-cases"],
    queryFn: getMyParentCases,
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  const picks = useMemo(() => {
    if (!user || casesQuery.isLoading) return [];
    const interests: Parameters<typeof buildSuggestionTargets>[0]["interests"] = [];
    if (learner) {
      interests.push({
        curriculum: learner.curriculum,
        subjects: learner.subjects,
        learnerName: learner.name,
        level: learnerFunnelLevel(learner.level),
      });
    }
    for (const child of childrenQuery.data ?? []) {
      interests.push({
        curriculum: normalizeLearnerCurriculum(child.curriculum),
        subjects: child.subjects ?? [],
        learnerName: child.nickname,
        level: learnerFunnelLevel(child.level),
      });
    }
    if (recent) interests.push({ curriculum: recent.curriculum, subjects: recent.subjects });
    const excludedSubjects = (casesQuery.data ?? [])
      .filter((c) => ACTIVE_SOR.has(c.sor_status ?? "") && c.subject)
      .map((c) => c.subject as string);
    const targets = buildSuggestionTargets({ interests, excludedSubjects });
    return suggestTutors(tutors, targets, (tutor) => {
      const kind = getTutorInquiryAction(tutor, undefined, "en").kind;
      return kind === "request" || kind === "pre_book";
    });
  }, [user, learner, recent, childrenQuery.data, casesQuery.data, casesQuery.isLoading, tutors]);

  if (!user || picks.length < 2) return null;

  const reason = (target: SuggestionTarget) => {
    const curriculum = learnerCurriculumLabel(target.curriculum);
    if (target.kind === "complementary") {
      return curriculum
        ? t("suggested.reason_complementary", { curriculum })
        : t("suggested.reason_complementary_plain");
    }
    return t("suggested.reason_search", {
      value: [curriculum, target.subject].filter(Boolean).join(" "),
    });
  };

  return (
    <section aria-labelledby="mm-suggested-heading">
      <div className="mb-4">
        <h2
          id="mm-suggested-heading"
          className="flex items-center gap-2 text-2xl font-bold tracking-tight text-[color:var(--ink)] md:text-3xl"
        >
          <Sparkles className="h-5 w-5 text-[color:var(--brand-link)]" aria-hidden="true" />
          {t("suggested.title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("suggested.subtitle")}</p>
      </div>
      <div className="-mx-4 rail-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pt-1 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 lg:grid-cols-3">
        {picks.map(({ tutor, target }) => (
          <div
            key={tutor.id}
            className="flex w-[min(80vw,380px)] shrink-0 snap-start flex-col gap-2 md:w-auto"
          >
            <span className="inline-flex w-fit max-w-full items-center rounded-full border border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/10 px-2.5 py-0.5 text-xs font-semibold text-[color:var(--ink)]">
              <span className="truncate">
                {target.learnerName
                  ? t("suggested.for_learner", { name: target.learnerName, reason: reason(target) })
                  : reason(target)}
              </span>
            </span>
            {renderCard(tutor)}
          </div>
        ))}
      </div>
    </section>
  );
}
