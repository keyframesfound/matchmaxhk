import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Award,
  BookOpen,
  CalendarDays,
  Clock,
  Coins,
  Globe,
  GraduationCap,
  Languages,
  Layers,
  LineChart,
  Lock,
  MapPin,
  MessageCircle,
  School,
  Share2,
  Sparkles,
  Trophy,
  User,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkdownText } from "@/components/ui/markdown-text";
import { AvailabilityGrid } from "@/features/tutors/availability-grid";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import { TutorAuthoredNotes } from "@/features/materials/home-notes-row";
import { fetchMaterialsForTutor } from "@/features/materials/queries";
import { TutorMaterialsSection } from "@/features/materials/tutor-materials-section";
import { InlineReportLink, ReportMenuButton } from "@/features/reports/report-button";
import { TutorReviews } from "@/features/tutors/tutor-reviews";
import { TrophyCabinet } from "@/features/tutors/trophy-cabinet";
import { getSystem, type ExamResult } from "@/features/tutors/examSystems";
import {
  fetchPublishedTutors,
  fetchTutorReviews,
  getTutorGenderLabel,
  getTutorLessonModeLabel,
  getTutorStationsText,
  type Tutor,
} from "@/features/tutors/queries";
import { TutorSaveButton } from "@/features/tutors/saved-tutors";
import {
  countAvailableCells,
  parseAvailabilityGrid,
} from "@/features/tutors/availability-grid-model";
import {
  formatAvailabilityDate,
  getTutorAvailabilityReadiness,
  getTutorInquiryAction,
  getTutorPriceDisplay,
  getTutorStatusLabelKey,
  getTutorSubjectGroups,
} from "@/features/tutors/tutor-display";
import { shareOrCopy } from "@/lib/share";
import { supabase } from "@/integrations/supabase/client";

/**
 * Issue #104: the public profile view rendered inside the Preview-as-Parent
 * sandbox. This mirrors tutors.$tutorCode.tsx section-for-section against the
 * SAME public data sources (fetchTutorByCode / fetchTutorReviews /
 * fetchMaterialsForTutor / fetchPublishedTutors — public shapes only, no
 * contact fields). Two deliberate differences from the public page: the report
 * affordances receive `isOwn` (#294 remainder — the owner cannot report
 * themselves), and page chrome (header/footer/SEO/claim banner/back button)
 * belongs to the preview route, not to a parent's profile.
 *
 * TODO(integrator): extract these section components out of
 * tutors.$tutorCode.tsx into a shared module so this file re-uses them
 * directly instead of mirroring the markup (the route file is outside this
 * batch's file ownership).
 */

/** Issue #23 header format: "HKU (Bachelor of Engineering in Computer
 * Engineering)" / just the institution when no degree is stored. */
function formatInstitutionDegree(institution: string | null, degree: string | null) {
  const school = institution?.trim() ?? "";
  const programme = degree?.trim() ?? "";
  if (school && programme) return `${school} (${programme})`;
  return school || programme;
}

function ProfileSection({
  icon: Icon,
  title,
  children,
  iconClassName = "text-[color:var(--muted-foreground)]",
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  iconClassName?: string;
}) {
  return (
    <section className="border-b border-border px-5 py-5 last:border-b-0 sm:px-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-[color:var(--foreground)]/15 bg-[color:var(--foreground)]/[0.04]">
          <Icon className={`h-4 w-4 ${iconClassName}`} strokeWidth={2.1} />
        </span>
        <h2 className="text-base font-bold tracking-tight text-[color:var(--ink)] sm:text-lg">
          {title}
        </h2>
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

function LessonDetailRow({
  icon: Icon,
  label,
  value,
  iconClassName,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  iconClassName: string;
}) {
  return (
    <li className="flex items-start gap-3">
      <Icon
        aria-hidden="true"
        className={`mt-0.5 h-5 w-5 shrink-0 ${iconClassName}`}
        strokeWidth={2.35}
      />
      <p className="text-sm leading-relaxed sm:text-base">
        <span className="font-bold text-[color:var(--ink)]">{label}:</span>{" "}
        <span className="text-muted-foreground">{value}</span>
      </p>
    </li>
  );
}

function formatExamSystemLabel(system: string) {
  const normalized = system.trim().toLowerCase();

  if (normalized === "ib" || normalized === "ibdp") return "IBDP";
  if (normalized === "dse" || normalized === "hkdse") return "HKDSE";
  if (normalized === "alevel" || normalized === "a-level" || normalized === "gce a-level")
    return "GCE A-Level";
  if (normalized === "igcse" || normalized === "gcse") return "IGCSE / GCSE";
  if (normalized === "ap") return "AP";
  if (normalized === "sat") return "SAT";
  if (normalized === "ielts") return "IELTS";
  if (normalized === "isat") return "ISAT";
  if (normalized === "ucat") return "UCAT";
  if (normalized === "primary") return "Primary School";
  if (normalized === "junior secondary") return "Junior Secondary";
  if (normalized === "admissions") return "University Admissions & Test Prep";

  const systemName = system.trim();
  return (getSystem(normalized)?.label ?? systemName) || "Exam system";
}

function AcademicQualification({ result }: { result: ExamResult }) {
  const label = formatExamSystemLabel(result.system);
  const normalizedSystem = result.system.trim().toLowerCase();
  const gradeNoun =
    normalizedSystem === "ielts"
      ? "Band"
      : normalizedSystem === "isat" || normalizedSystem === "ucat"
        ? "Score"
        : "Grade";
  const subjects = result.subjects.filter((entry) => entry.subject.trim());

  if (subjects.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-[color:var(--ink)]">{label}</p>
      <ul className="space-y-1.5">
        {subjects.map((entry, subjectIndex) => {
          const papers = (entry.papers ?? []).filter((p) => p.label.trim() && p.score.trim());
          return (
            <li
              key={`${entry.subject}-${subjectIndex}`}
              className="border-l-2 border-[color:var(--brand-link)] pl-3"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-[color:var(--ink)]">{entry.subject}</span>
                {entry.grade.trim() ? (
                  <span className="text-sm font-bold text-[color:var(--brand-link)]">
                    – {gradeNoun}{" "}
                    {entry.grade
                      // Issue #206: hide the intake-era "(legacy)" suffix.
                      .replace(/\s*\(legacy\)\s*$/i, "")
                      .replace(/^(grade|band)\s+/i, "")}
                  </span>
                ) : null}
              </div>
              {papers.length > 0 ? (
                <p className="mt-0.5 text-xs font-semibold text-[color:var(--brand-link)]">
                  {papers.map((paper, paperIndex) => (
                    <span key={`${paper.label}-${paperIndex}`}>
                      {paperIndex > 0 ? <strong> · </strong> : null}
                      {paper.label}: {paper.score}
                    </span>
                  ))}
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RateValue({ rate }: { rate: number }) {
  const { t } = useTranslation();
  return (
    <span className="shrink-0 text-sm font-bold text-[color:var(--ink)]">
      ${rate}
      <span className="ml-0.5 text-xs font-medium text-muted-foreground">
        {t("featured.per_hour")}
      </span>
    </span>
  );
}

export function PublicProfileView({ tutor, isOwn }: { tutor: Tutor; isOwn: boolean }) {
  const { t: translate, i18n } = useTranslation();
  const navigate = useNavigate();

  const { data: whatsappNumber } = useQuery({
    queryKey: ["settings", "whatsapp_number"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "whatsapp_number")
        .maybeSingle();
      if (error) throw error;
      return typeof data?.value === "string" ? data.value : "";
    },
  });

  // Same public queries (and cache keys) as the public profile page.
  const { data: reviews = [] } = useQuery({
    queryKey: ["tutor", "reviews", tutor.id],
    queryFn: () => fetchTutorReviews(tutor.id),
  });

  const { data: materials = [] } = useQuery({
    queryKey: ["tutor", "materials", tutor.id],
    queryFn: () => fetchMaterialsForTutor(tutor.id),
  });

  const { data: allPublished = [] } = useQuery({
    queryKey: ["tutors", "published"],
    queryFn: fetchPublishedTutors,
  });

  const suggestedTutors = useMemo(() => {
    const currentSubjects = new Set(
      (tutor.subjects ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean),
    );
    return allPublished
      .filter((candidate) => candidate.id !== tutor.id)
      .map((candidate) => {
        const sharedSubjects = (candidate.subjects ?? []).filter((s) =>
          currentSubjects.has(s.trim().toLowerCase()),
        ).length;
        const sharedStations = (candidate.stations ?? []).filter((station) =>
          (tutor.stations ?? []).includes(station),
        ).length;
        return { tutor: candidate, score: sharedSubjects * 2 + sharedStations };
      })
      .sort(
        (a, b) =>
          b.score - a.score || (b.tutor.experience_years ?? 0) - (a.tutor.experience_years ?? 0),
      )
      .slice(0, 3)
      .map((entry) => entry.tutor);
  }, [allPublished, tutor]);

  const waDigits = (whatsappNumber ?? "").replace(/[^\d]/g, "");
  const inquiry = getTutorInquiryAction(tutor, whatsappNumber, i18n.language);
  const waUrl = waDigits ? inquiry.href : "";
  const availabilityReadiness = getTutorAvailabilityReadiness(tutor);
  const preferredTimeWindows = tutor.preferred_time_windows ?? [];
  // Issue #116: self-serve weekly grid has at least one non-unavailable cell.
  const hasAvailabilityGrid =
    countAvailableCells(parseAvailabilityGrid(tutor.availability_grid)) > 0;
  const genderLabel = getTutorGenderLabel(tutor.gender);
  const statusKey = getTutorStatusLabelKey(tutor.tutor_status);
  const subjectGroups = getTutorSubjectGroups(tutor).map((group) => {
    const systemLabel = formatExamSystemLabel(group.systemId);
    const subjects = group.subjects.filter(
      (subject) => subject.trim().toLowerCase() !== systemLabel.trim().toLowerCase(),
    );
    return {
      ...group,
      systemLabel,
      // A taught subject may be the system label itself (e.g. "IELTS");
      // render it once instead of "IELTS: IELTS".
      subjects: subjects.length > 0 ? subjects : [systemLabel],
    };
  });
  const examResults = (tutor.exam_results ?? []).filter((result) =>
    result.subjects.some((entry) => entry.subject.trim()),
  );
  const profileBio = tutor.qualifications_summary?.trim() ?? "";
  const selfIntroduction = tutor.self_introduction?.trim() ?? "";
  const lessonLocation = (() => {
    const area = getTutorStationsText(tutor);
    return area ? `Hong Kong — ${area}` : "Hong Kong";
  })();
  const tutorLanguages = (tutor.languages ?? []).filter(Boolean);
  const lessonLanguages =
    tutorLanguages.length > 0 ? tutorLanguages.join(", ") : translate("profile.not_specified");
  const price = getTutorPriceDisplay(tutor);
  const extraRateRows = (tutor.rate_rows ?? []).filter(
    (row) => row.label.trim() && Number.isFinite(row.rate),
  );
  const hasRatesBlock =
    tutor.online_rate !== null || tutor.inperson_rate !== null || extraRateRows.length > 0;
  const lessonFormat = (getTutorLessonModeLabel(tutor.lesson_mode) ?? "To be confirmed").replace(
    / tutoring$/,
    "",
  );

  const [isSharing, setIsSharing] = useState(false);
  const handleShare = () => {
    setIsSharing(true);
    void shareOrCopy(
      {
        title: `Tutor ${tutor.tutor_code} | MatchMax`,
        text:
          price.baseRate > 0
            ? `Check out tutor ${tutor.tutor_code} on MatchMax — $${price.baseRate} up/hr.`
            : `Check out tutor ${tutor.tutor_code} on MatchMax.`,
        url: `${window.location.origin}/tutors/${tutor.tutor_code}`,
      },
      translate("profile.link_copied"),
    ).finally(() => setIsSharing(false));
  };

  return (
    <>
      {/* Profile hero — identical to the public page's header block. */}
      <section className="border-b border-border bg-muted/30 py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
            <div className="relative shrink-0 self-start">
              {tutor.photo_url ? (
                <img
                  src={tutor.photo_url}
                  alt={tutor.tutor_code}
                  className="h-16 w-16 rounded-full object-cover sm:h-20 sm:w-20"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[color:var(--foreground)]/15 bg-[color:var(--foreground)]/[0.04] text-xl font-semibold text-[color:var(--muted-foreground)] sm:h-20 sm:w-20 sm:text-2xl">
                  {tutor.tutor_code?.slice(0, 2).toUpperCase() || "TP"}
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-bold text-[color:var(--ink)] sm:text-2xl">
                  {tutor.tutor_code}
                  {genderLabel ? (
                    <>
                      <strong> • </strong>
                      {genderLabel}
                    </>
                  ) : null}
                </h1>
                {statusKey ? (
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-semibold text-[color:var(--ink)]">
                    <UserRound
                      className="h-3 w-3 text-[color:var(--brand-link)]"
                      aria-hidden="true"
                    />
                    {translate(statusKey)}
                  </span>
                ) : null}
              </div>
              {tutor.academic_headline || tutor.undergrad_university || tutor.secondary_school ? (
                <div className="mt-2 space-y-1 text-base font-semibold leading-snug text-[color:var(--ink)] sm:text-lg">
                  {tutor.academic_headline ? (
                    <p className="break-words">{tutor.academic_headline}</p>
                  ) : null}
                  {tutor.has_postgrad && (tutor.postgrad_university || tutor.postgrad_degree) ? (
                    <p className="flex items-start gap-1.5">
                      <GraduationCap
                        className="mt-1 h-4 w-4 shrink-0 text-[color:var(--brand-link)]"
                        aria-hidden="true"
                      />
                      <span className="break-words">
                        {translate("profile.education_postgraduate")}:{" "}
                        {formatInstitutionDegree(tutor.postgrad_university, tutor.postgrad_degree)}
                      </span>
                    </p>
                  ) : null}
                  {tutor.undergrad_university || tutor.undergrad_degree ? (
                    <p className="flex items-start gap-1.5">
                      <GraduationCap
                        className="mt-1 h-4 w-4 shrink-0 text-[color:var(--brand-link)]"
                        aria-hidden="true"
                      />
                      <span className="break-words">
                        {translate("profile.education_undergraduate")}:{" "}
                        {formatInstitutionDegree(
                          tutor.undergrad_university,
                          tutor.undergrad_degree,
                        )}
                      </span>
                    </p>
                  ) : null}
                  {tutor.secondary_school ? (
                    <p className="flex items-start gap-1.5">
                      <School
                        className="mt-1 h-4 w-4 shrink-0 text-[color:var(--brand-link)]"
                        aria-hidden="true"
                      />
                      <span className="break-words">
                        {translate("profile.education_secondary")}: {tutor.secondary_school}
                      </span>
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="w-full sm:w-auto sm:text-right">
              <div className="flex items-center justify-start gap-1.5 sm:justify-end">
                {price.baseRate > 0 ? (
                  <p className="text-3xl font-bold text-[color:var(--ink)]">
                    ${price.baseRate}
                    <span className="ml-1 text-sm font-semibold text-muted-foreground">
                      {translate("tutor_card.price_up")}
                      {translate("featured.per_hour")}
                    </span>
                  </p>
                ) : null}
                <TutorSaveButton tutorId={tutor.id} compact />
                {/* #294 remainder: the visitor's flag control — owner-guarded here. */}
                <ReportMenuButton
                  isOwn={isOwn}
                  menuLabel={translate("report.menu_label_profile")}
                  targets={[
                    {
                      targetType: "tutor_card",
                      targetId: tutor.id,
                      label: translate("report.item_card"),
                    },
                    ...(tutor.photo_url
                      ? [
                          {
                            targetType: "tutor_photo" as const,
                            targetId: tutor.id,
                            label: translate("report.item_photo"),
                          },
                        ]
                      : []),
                  ]}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  aria-label="Share this tutor profile"
                  disabled={isSharing}
                  onClick={() => void handleShare()}
                >
                  <Share2 className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
              {availabilityReadiness === "pre_booking" && tutor.earliest_start_date ? (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                  <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                  {translate("tutor_card.available_from", {
                    date: formatAvailabilityDate(tutor.earliest_start_date, i18n.language),
                  })}
                </p>
              ) : null}
              {inquiry.kind === "waitlist" ? (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[color:var(--ink)]/[0.06] px-2.5 py-1 text-xs font-semibold text-[color:var(--ink)]">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  {translate("profile.fully_booked")}
                </p>
              ) : null}
              {inquiry.kind !== "waitlist" && preferredTimeWindows.length > 0 ? (
                <div className="mt-3 space-y-1.5">
                  <p className="inline-flex flex-wrap items-center gap-1.5 text-xs font-semibold text-[color:var(--ink)]">
                    <Clock
                      className="h-3.5 w-3.5 text-[color:var(--brand-link)]"
                      aria-hidden="true"
                    />
                    {translate("profile.prefers_prefix")}
                    {preferredTimeWindows
                      .map((window) => translate(`profile.time_window_${window}`))
                      .join(" · ")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {translate("profile.time_window_disclaimer")}
                  </p>
                </div>
              ) : null}
              {inquiry.kind === "status" ? (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-[color:var(--ink)]/[0.06] px-2.5 py-1 text-xs font-semibold text-[color:var(--ink)]">
                  <Lock className="h-3.5 w-3.5" aria-hidden="true" />
                  {inquiry.label}
                </p>
              ) : waUrl ? (
                <Button
                  asChild
                  variant="solid"
                  color="blue"
                  className="mt-3 w-full rounded-sm font-bold sm:w-auto"
                >
                  <a href={waUrl} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-2 h-4 w-4" /> {inquiry.label}
                  </a>
                </Button>
              ) : (
                <Button
                  asChild
                  variant="solid"
                  color="blue"
                  className="mt-3 w-full font-bold sm:w-auto"
                >
                  <Link to="/tutor-requests" search={{ post: true }}>
                    <MessageCircle className="mr-2 h-4 w-4" /> Request via our team
                  </Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="py-8 sm:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div>
            {examResults.length > 0 ? (
              <ProfileSection icon={LineChart} title={translate("profile.section_academic")}>
                <div className="space-y-4">
                  {examResults.map((result, index) => (
                    <AcademicQualification key={`${result.system}-${index}`} result={result} />
                  ))}
                </div>
              </ProfileSection>
            ) : null}

            {profileBio || tutor.achievements.length > 0 ? (
              <ProfileSection icon={Award} title={translate("profile.section_achievements")}>
                <div className="space-y-4">
                  {profileBio ? (
                    <MarkdownText className="text-[color:var(--ink)]">{profileBio}</MarkdownText>
                  ) : null}
                  {tutor.achievements.length > 0 ? (
                    <ul className="space-y-2.5">
                      {tutor.achievements.map((achievement, index) => (
                        <li key={`${achievement.short_text}-${index}`} className="flex gap-2.5">
                          <Sparkles
                            className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--muted-foreground)]"
                            strokeWidth={2.1}
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[color:var(--ink)]">
                              {achievement.short_text}
                            </p>
                            {achievement.detail_text ? (
                              <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-[color:var(--ink)]">
                                {achievement.detail_text}
                              </p>
                            ) : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </ProfileSection>
            ) : null}

            <TutorAuthoredNotes tutorCode={tutor.tutor_code} />

            {tutor.portfolio_images.length > 0 ? (
              <ProfileSection icon={Trophy} title={translate("profile.section_trophy")}>
                <TrophyCabinet images={tutor.portfolio_images} />
              </ProfileSection>
            ) : null}

            {selfIntroduction ? (
              <ProfileSection icon={User} title={translate("profile.section_about")}>
                <p className="whitespace-pre-line text-sm leading-relaxed text-[color:var(--ink)] sm:text-base">
                  {selfIntroduction}
                </p>
                <div className="mt-3">
                  <InlineReportLink
                    isOwn={isOwn}
                    targetType="tutor_introduction"
                    targetId={tutor.id}
                    label={translate("report.item_introduction")}
                  />
                </div>
              </ProfileSection>
            ) : null}

            {tutor.subjects.length > 0 || tutor.ia_ee_tok_support.length > 0 ? (
              <ProfileSection icon={Layers} title={translate("profile.section_subjects")}>
                <div className="text-left text-sm">
                  {tutor.subjects.length > 0 ? (
                    <div className="space-y-1">
                      {subjectGroups.map((group) => (
                        <p key={group.systemId} className="leading-relaxed text-sm">
                          <span className="font-bold text-[color:var(--ink)]">
                            {group.systemLabel}:
                          </span>{" "}
                          <span className="text-muted-foreground">{group.subjects.join(", ")}</span>
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {tutor.ia_ee_tok_support.length > 0 ? (
                    <p className="mt-1 text-muted-foreground">
                      <span className="font-bold text-[color:var(--ink)]">IA / EE / TOK:</span>{" "}
                      {tutor.ia_ee_tok_support.join(", ")}
                      {tutor.ia_ee_tok_notes ? ` — ${tutor.ia_ee_tok_notes}` : ""}
                    </p>
                  ) : null}
                </div>
              </ProfileSection>
            ) : null}

            {hasRatesBlock ? (
              <ProfileSection icon={Coins} title={translate("profile.section_rates")}>
                <ul className="divide-y divide-border overflow-hidden rounded-sm border border-border">
                  {tutor.online_rate !== null ? (
                    <li className="flex items-center justify-between gap-4 px-4 py-2.5">
                      <span className="text-sm font-semibold text-[color:var(--ink)]">
                        {translate("profile.rates_online")}
                      </span>
                      <RateValue rate={tutor.online_rate} />
                    </li>
                  ) : null}
                  {tutor.inperson_rate !== null ? (
                    <li className="px-4 py-2.5">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-sm font-semibold text-[color:var(--ink)]">
                          {translate("profile.rates_inperson")}
                        </span>
                        <RateValue rate={tutor.inperson_rate} />
                      </div>
                      {tutor.travel_note ? (
                        <p className="mt-1 text-xs text-muted-foreground">{tutor.travel_note}</p>
                      ) : null}
                    </li>
                  ) : null}
                  {extraRateRows.map((row, index) => (
                    <li
                      key={`${row.label}-${index}`}
                      className="flex items-center justify-between gap-4 px-4 py-2.5"
                    >
                      <span className="text-sm font-semibold text-[color:var(--ink)]">
                        {row.label}
                      </span>
                      <RateValue rate={row.rate} />
                    </li>
                  ))}
                </ul>
                {tutor.rate_note ? (
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {tutor.rate_note}
                  </p>
                ) : null}
              </ProfileSection>
            ) : null}

            {inquiry.kind !== "waitlist" &&
            (hasAvailabilityGrid || preferredTimeWindows.length > 0) ? (
              <ProfileSection icon={Clock} title={translate("profile.section_availability")}>
                <AvailabilityGrid grid={tutor.availability_grid} />
              </ProfileSection>
            ) : null}

            {reviews.length > 0 ? (
              <ProfileSection icon={MessageCircle} title={translate("profile.section_reviews")}>
                <TutorReviews reviews={reviews} />
              </ProfileSection>
            ) : null}

            {materials.length > 0 ? (
              <ProfileSection icon={BookOpen} title={translate("materials.section_title")}>
                <TutorMaterialsSection
                  tutorId={tutor.id}
                  tutorName={tutor.display_name}
                  tutorCode={tutor.tutor_code}
                  whatsappNumber={whatsappNumber}
                />
              </ProfileSection>
            ) : null}

            <ProfileSection icon={MapPin} title={translate("profile.section_lesson")}>
              <ul className="space-y-3.5">
                <LessonDetailRow
                  icon={Globe}
                  label={translate("profile.label_format")}
                  value={lessonFormat}
                  iconClassName="text-[color:var(--ink)]"
                />
                <LessonDetailRow
                  icon={MapPin}
                  label={translate("profile.label_location")}
                  value={lessonLocation}
                  iconClassName="text-[color:var(--ink)]"
                />
                <LessonDetailRow
                  icon={Languages}
                  label={translate("profile.label_languages")}
                  value={lessonLanguages}
                  iconClassName="text-[color:var(--ink)]"
                />
              </ul>
            </ProfileSection>
          </div>
        </div>
      </section>

      {suggestedTutors.length > 0 ? (
        <section className="border-t border-border bg-muted/30 py-10 sm:py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-[color:var(--muted-foreground)]">
                  {translate("profile.suggested_eyebrow")}
                </p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-[color:var(--ink)] sm:text-3xl">
                  {translate("profile.suggested_title")}
                </h2>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link to="/tutors">{translate("profile.browse_all")}</Link>
              </Button>
            </div>
            <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {suggestedTutors.map((candidate) => {
                const candidateInquiry = getTutorInquiryAction(
                  candidate,
                  whatsappNumber,
                  i18n.language,
                );
                return (
                  <PublicTutorCard
                    key={candidate.id}
                    tutor={candidate}
                    priceSuffix={translate("featured.per_hour")}
                    onOpen={(code) =>
                      void navigate({ to: "/tutors/$tutorCode", params: { tutorCode: code } })
                    }
                    footerAction={
                      candidateInquiry.kind === "status" ? (
                        <span className="inline-flex h-9 items-center rounded-sm bg-[color:var(--ink)]/[0.06] px-4 text-[13px] font-bold text-[color:var(--ink)]">
                          {candidateInquiry.label}
                        </span>
                      ) : (
                        <Button
                          asChild
                          className="h-9 rounded-sm bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--surface-invert-hover)]"
                        >
                          <a
                            href={candidateInquiry.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {candidateInquiry.kind === "pre_book" && candidate.earliest_start_date
                              ? translate("tutor_card.prebook_cta", {
                                  date: formatAvailabilityDate(
                                    candidate.earliest_start_date,
                                    i18n.language,
                                  ),
                                })
                              : translate("profile.request_tutor")}
                          </a>
                        </Button>
                      )
                    }
                  />
                );
              })}
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
