import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BadgeCheck, UserRoundSearch } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import { getMyParentCases } from "@/features/cases/parent.functions";
import { fetchTutorByCode } from "@/features/tutors/queries";
import { getTutorBaseRate, getTutorInquiryAction } from "@/features/tutors/tutor-display";
import { decideNoteUpsell } from "@/features/materials/note-tutor-upsell";

/**
 * #731: "Request this tutor for 1-on-1" under a Marketplace note's buy
 * button, secondary to checkout. It hands off to the normal Case Request
 * (#049 / #751) with the author's code, curriculum and subject; no phone
 * number is exposed and no direct chat opens.
 */
export function NoteTutorUpsellCard({
  tutorCode,
  tutorName,
  isOwner,
  isCommunitySeller,
  curriculum,
  subject,
}: {
  tutorCode: string | null;
  tutorName: string;
  isOwner: boolean;
  isCommunitySeller: boolean;
  curriculum: string | null;
  subject: string | null;
}) {
  const { t, i18n } = useTranslation();
  const { user } = useAuth();
  const enabled = Boolean(tutorCode) && !isOwner && !isCommunitySeller;
  const tutorQuery = useQuery({
    queryKey: ["tutors", "by-code", tutorCode],
    queryFn: () => fetchTutorByCode(tutorCode as string),
    enabled,
    staleTime: 5 * 60_000,
  });
  const casesQuery = useQuery({
    queryKey: ["sor", "parent-cases"],
    queryFn: getMyParentCases,
    enabled: enabled && Boolean(user),
    staleTime: 60_000,
  });

  const tutor = tutorQuery.data ?? null;
  if (!enabled || !tutor || (user && casesQuery.isLoading)) return null;

  const inquiry = getTutorInquiryAction(tutor, undefined, i18n.language);
  const decision = decideNoteUpsell({
    isOwner,
    isCommunitySeller,
    tutorCode,
    tutorTakingStudents: inquiry.kind === "request" || inquiry.kind === "pre_book",
    noteSubject: subject,
    viewerCases: (casesQuery.data ?? []).map((c) => ({
      subject: c.subject,
      tutorCode: c.tutor_code,
      sorStatus: c.sor_status,
    })),
  });
  if (decision === "hidden") return null;

  const verified = (tutor.approved_grade_labels ?? []).length > 0;
  if (decision === "current_tutor") {
    return (
      <p className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-3 py-1 text-sm font-semibold text-[color:var(--ink)]">
        <BadgeCheck className="h-4 w-4 text-[color:var(--brand-link)]" aria-hidden />
        {t("note_upsell.current_tutor")}
      </p>
    );
  }

  const rate = getTutorBaseRate(tutor);
  return (
    <div className="space-y-2 rounded-xl border border-border p-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--ink)]">
        {tutorName}
        {verified ? (
          <BadgeCheck
            className="h-4 w-4 text-[color:var(--brand-link)]"
            aria-label={t("note_upsell.verified")}
          />
        ) : null}
      </p>
      <p className="text-xs text-muted-foreground">
        {rate > 0 ? t("note_upsell.subtext", { rate }) : t("note_upsell.subtext_no_rate")}
      </p>
      <Button asChild variant="solid" color="blue" className="w-full font-bold">
        <Link
          to="/tutor-requests"
          search={{
            post: true,
            tutor: tutorCode ?? undefined,
            req_curriculum: curriculum || undefined,
            req_subject: subject || undefined,
          }}
        >
          <UserRoundSearch className="mr-2 h-4 w-4" aria-hidden />
          {t("note_upsell.cta")}
        </Link>
      </Button>
    </div>
  );
}
