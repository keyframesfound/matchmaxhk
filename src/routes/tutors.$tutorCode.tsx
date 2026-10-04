import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useEffect, useState } from "react";
import {
  MapPin,
  MessageCircle,
  ArrowLeft,
  Award,
  CalendarDays,
  Clock,
  Coins,
  Globe,
  GraduationCap,
  Languages,
  Layers,
  LineChart,
  Lock,
  School,
  Share2,
  Sparkles,
  Trophy,
  User,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchPublishedTutors,
  fetchTutorByCode,
  fetchTutorReviews,
  getTutorGenderLabel,
  getTutorLessonModeLabel,
  getTutorStationsText,
  type Tutor,
} from "@/features/tutors/queries";
import { getSystem, type ExamResult } from "@/features/tutors/examSystems";
import {
  formatAvailabilityDate,
  getCurriculumPricingLabel,
  getSortedPricingTiers,
  getTutorAvailabilityReadiness,
  getTutorInquiryAction,
  getTutorPriceDisplay,
  getTutorPublicStatusKey,
  getTutorSubjectGroups,
} from "@/features/tutors/tutor-display";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import { TrophyCabinet } from "@/features/tutors/trophy-cabinet";
import { AvailabilityGrid } from "@/features/tutors/availability-grid";
import { TutorReviews } from "@/features/tutors/tutor-reviews";
import {
  countAvailableCells,
  parseAvailabilityGrid,
} from "@/features/tutors/availability-grid-model";
import { TutorSaveButton } from "@/features/tutors/saved-tutors";
import { Skeleton } from "@/components/ui/skeleton";
import { MarkdownText } from "@/components/ui/markdown-text";
import { shareOrCopy } from "@/lib/share";

function buildTutorSeoMeta(tutor: Tutor, url: string) {
  const subjects = (tutor.subjects ?? []).filter(Boolean);
  const subjectText = subjects.slice(0, 3).join(", ");
  const areaText = getTutorStationsText(tutor);
  const locationText = areaText ? ` in ${areaText}` : " in Hong Kong";
  const lessonModeText =
    tutor.lesson_mode === "online"
      ? "online"
      : tutor.lesson_mode === "either"
        ? "online or in-person"
        : "in-person";
  const title = `${tutor.tutor_code} | ${subjectText || "Tutor"} ${lessonModeText} ${locationText} | MatchMax`;
  const description = `Tutor ${tutor.tutor_code} offers ${subjectText || "subject"} support${locationText}. Browse profile details, lesson mode, rates and availability on MatchMax.`;

  return { title, description, url };
}

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

function getExamSystemSubjectSummary(result: ExamResult) {
  const systemLabel = formatExamSystemLabel(result.system);
  const subjects = (result.subjects ?? []).map((entry) => entry.subject.trim()).filter(Boolean);

  return { systemLabel, subjects };
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
                    – {gradeNoun} {entry.grade.replace(/^(grade|band)\s+/i, "")}
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

function TutorProfileSkeleton() {
  const { t } = useTranslation();
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1" aria-busy="true" aria-label={t("profile.loading_aria")}>
        <section className="border-b border-border bg-muted/30 py-8 sm:py-10">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Skeleton className="h-9 w-24 rounded-md" />
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
              <Skeleton className="h-16 w-16 shrink-0 rounded-full sm:h-20 sm:w-20" />
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-7 w-44" />
                <Skeleton className="h-5 w-2/3 max-w-md" />
                <Skeleton className="h-5 w-1/2 max-w-sm" />
              </div>
              <div className="w-full space-y-3 sm:w-auto sm:text-right">
                <Skeleton className="h-9 w-40 sm:ml-auto" />
                <Skeleton className="h-10 w-full rounded-md sm:w-44" />
              </div>
            </div>
          </div>
        </section>
        <section className="py-8 sm:py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="overflow-hidden rounded-lg border border-border">
              {[0, 1, 2].map((section) => (
                <div
                  key={section}
                  className="border-b border-border px-5 py-5 last:border-b-0 sm:px-6"
                >
                  <div className="flex items-center gap-2.5">
                    <Skeleton className="h-7 w-7 rounded-[3px]" />
                    <Skeleton className="h-5 w-40" />
                  </div>
                  <div className="mt-4 space-y-2.5">
                    <Skeleton className="h-4 w-full max-w-2xl" />
                    <Skeleton className="h-4 w-5/6 max-w-xl" />
                    <Skeleton className="h-4 w-2/3 max-w-lg" />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10">
              <Skeleton className="h-7 w-64" />
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((card) => (
                  <div
                    key={card}
                    className="rounded-[var(--radius-panel)] border border-border bg-[color:var(--surface)] p-4"
                  >
                    <div className="flex items-center gap-3">
                      <Skeleton className="h-11 w-11 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                    <Skeleton className="mt-4 h-3 w-full" />
                    <Skeleton className="mt-2 h-3 w-3/4" />
                    <Skeleton className="mt-4 h-9 w-full rounded-md" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

export const Route = createFileRoute("/tutors/$tutorCode")({
  loader: async ({ params }) => {
    const tutor = await fetchTutorByCode(params.tutorCode);
    if (!tutor) throw notFound();
    return { tutor };
  },
  pendingComponent: TutorProfileSkeleton,
  pendingMs: 0,
  pendingMinMs: 400,
  head: ({ loaderData, params }) => {
    const url = `https://matchmax.hk/tutors/${params.tutorCode}`;
    if (!loaderData) {
      return {
        meta: [{ title: "Tutor not found — MatchMax" }, { name: "robots", content: "noindex" }],
        links: [{ rel: "canonical", href: url }],
      };
    }
    const seo = buildTutorSeoMeta(loaderData.tutor, url);
    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: seo.title },
        { property: "og:description", content: seo.description },
        { property: "og:url", content: seo.url },
        { property: "og:type", content: "profile" },
        ...(loaderData.tutor.photo_url
          ? [
              { property: "og:image", content: loaderData.tutor.photo_url },
              { name: "twitter:image", content: loaderData.tutor.photo_url },
            ]
          : []),
      ],
      links: [{ rel: "canonical", href: url }],
    };
  },
  notFoundComponent: function TutorNotFound() {
    const { t } = useTranslation();
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-3xl px-4 py-24 text-center">
          <h1 className="text-3xl font-bold text-[color:var(--ink)]">
            {t("profile.not_found_title")}
          </h1>
          <p className="mt-3 text-muted-foreground">{t("profile.not_found_body")}</p>
          <Button asChild className="mt-6">
            <Link to="/tutors">{t("profile.browse_all")}</Link>
          </Button>
        </main>
        <SiteFooter />
      </div>
    );
  },
  errorComponent: TutorErrorComponent,
  component: TutorDetail,
});

function TutorErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const { t } = useTranslation();
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-[color:var(--ink)]">{t("profile.error_title")}</h1>
        <p className="mt-3 text-sm text-muted-foreground">{t("profile.error_body")}</p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset}>{t("common.try_again")}</Button>
          <Button asChild variant="outline">
            <Link to="/tutors">{t("profile.browse_all")}</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function TutorDetail() {
  const { tutor } = Route.useLoaderData();
  const navigate = useNavigate();
  const { t: translate, i18n } = useTranslation();

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

  const { data: liveTutor } = useQuery({
    queryKey: ["tutor", "byCode", tutor.tutor_code],
    queryFn: () => fetchTutorByCode(tutor.tutor_code),
    initialData: tutor,
  });
  const t: Tutor = liveTutor ?? tutor;

  // Issues #83 + #105 (+ reviews half of #116): verified parent/student
  // reviews, admin-curated. Read-only; hidden entirely when there are none.
  const { data: reviews = [] } = useQuery({
    queryKey: ["tutor", "reviews", t.id],
    queryFn: () => fetchTutorReviews(t.id),
  });

  const { data: allPublished = [] } = useQuery({
    queryKey: ["tutors", "published"],
    queryFn: fetchPublishedTutors,
  });

  const suggestedTutors = useMemo(() => {
    const currentSubjects = new Set(
      (t.subjects ?? []).map((s) => s.trim().toLowerCase()).filter(Boolean),
    );
    return allPublished
      .filter((candidate) => candidate.id !== t.id)
      .map((candidate) => {
        const sharedSubjects = (candidate.subjects ?? []).filter((s) =>
          currentSubjects.has(s.trim().toLowerCase()),
        ).length;
        const sharedStations = (candidate.stations ?? []).filter((station) =>
          (t.stations ?? []).includes(station),
        ).length;
        return { tutor: candidate, score: sharedSubjects * 2 + sharedStations };
      })
      .sort(
        (a, b) =>
          b.score - a.score || (b.tutor.experience_years ?? 0) - (a.tutor.experience_years ?? 0),
      )
      .slice(0, 3)
      .map((entry) => entry.tutor);
  }, [allPublished, t]);

  const waDigits = (whatsappNumber ?? "").replace(/[^\d]/g, "");
  const inquiry = getTutorInquiryAction(t, whatsappNumber, i18n.language);
  const waUrl = waDigits ? inquiry.href : "";
  const availabilityReadiness = getTutorAvailabilityReadiness(t);
  // Issue #103: macro availability windows for the public profile tags.
  const preferredTimeWindows = t.preferred_time_windows ?? [];
  // Issue #116: self-serve weekly grid has at least one non-unavailable cell.
  const hasAvailabilityGrid = countAvailableCells(parseAvailabilityGrid(t.availability_grid)) > 0;
  const genderLabel = getTutorGenderLabel(t.gender);
  // Issue #77: tutor status pill next to the profile name.
  const statusKey = getTutorPublicStatusKey(t.tutor_status);
  const subjectText = (t.subjects ?? []).filter(Boolean).slice(0, 3).join(", ");
  const subjectGroups = getTutorSubjectGroups(t).map((group) => {
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
  const examResults = (t.exam_results ?? []).filter((result) =>
    result.subjects.some((entry) => entry.subject.trim()),
  );
  const profileBio = t.qualifications_summary?.trim() ?? "";
  const selfIntroduction = t.self_introduction?.trim() ?? "";
  const lessonLocation = (() => {
    const area = getTutorStationsText(t);
    return area ? `Hong Kong — ${area}` : "Hong Kong";
  })();
  const tutorLanguages = (t.languages ?? []).filter(Boolean);
  const lessonLanguages =
    tutorLanguages.length > 0 ? tutorLanguages.join(", ") : translate("profile.not_specified");
  const price = getTutorPriceDisplay(t);
  const sortedPricingTiers = getSortedPricingTiers(t.pricing_tiers);
  const lessonFormat = (getTutorLessonModeLabel(t.lesson_mode) ?? "To be confirmed").replace(
    / tutoring$/,
    "",
  );
  const tutorSeoSummary = `Tutor ${t.tutor_code} offers ${subjectText || "tutoring"} support${getTutorStationsText(t) ? ` in ${getTutorStationsText(t)}` : " in Hong Kong"}. ${t.lesson_mode === "online" ? "Online lessons are available." : t.lesson_mode === "either" ? "Online and in-person lessons are available." : "In-person lessons are available."} Browse rates and availability on MatchMax.`;

  const [isSharing, setIsSharing] = useState(false);
  const handleShare = () => {
    setIsSharing(true);
    void shareOrCopy(
      {
        title: `Tutor ${t.tutor_code} | MatchMax`,
        // Issue #125: flagged pricing strips the rate — omit it from shares.
        text:
          price.baseRate > 0
            ? `Check out tutor ${t.tutor_code} on MatchMax — HK$${price.baseRate}/hr.`
            : `Check out tutor ${t.tutor_code} on MatchMax.`,
        url: window.location.href,
      },
      translate("profile.link_copied"),
    ).finally(() => setIsSharing(false));
  };
  const tutorStructuredData = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: t.tutor_code,
    url: `https://matchmax.hk/tutors/${t.tutor_code}`,
    description: tutorSeoSummary,
    ...(t.photo_url ? { image: t.photo_url } : {}),
    ...(t.district
      ? {
          address: {
            "@type": "PostalAddress",
            addressLocality: t.district,
            addressRegion: "Hong Kong",
          },
        }
      : {}),
    ...(t.subjects?.length ? { knowsAbout: t.subjects } : {}),
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(tutorStructuredData) }}
      />
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border bg-muted/30 py-8 sm:py-10">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <Button
              type="button"
              variant="link"
              size="sm"
              className="mb-6"
              onClick={() => window.history.back()}
            >
              <ArrowLeft aria-hidden="true" />
              Back
            </Button>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
              <div className="relative shrink-0 self-start">
                {t.photo_url ? (
                  <img
                    src={t.photo_url}
                    alt={t.tutor_code}
                    className="h-16 w-16 rounded-full object-cover sm:h-20 sm:w-20"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[color:var(--foreground)]/15 bg-[color:var(--foreground)]/[0.04] text-xl font-semibold text-[color:var(--muted-foreground)] sm:h-20 sm:w-20 sm:text-2xl">
                    {t.tutor_code?.slice(0, 2).toUpperCase() || "TP"}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-xl font-bold text-[color:var(--ink)] sm:text-2xl">
                    {t.tutor_code}
                    {genderLabel ? (
                      <>
                        <strong> • </strong>
                        {genderLabel}
                      </>
                    ) : null}
                  </h1>
                  {/* Issue #77: tutor status pill next to the name (mockup:
                      "( Uni Student )"), hidden entirely when unset. */}
                  {statusKey ? (
                    <span className="inline-flex items-center rounded-full border border-[color:var(--foreground)]/20 px-2.5 py-0.5 text-xs font-semibold text-[color:var(--ink)] sm:text-sm">
                      {translate(statusKey)}
                    </span>
                  ) : null}
                </div>
                {t.academic_headline || t.undergrad_university || t.secondary_school ? (
                  <div className="mt-2 space-y-1 text-base font-semibold leading-snug text-[color:var(--ink)] sm:text-lg">
                    {t.academic_headline ? (
                      <p className="break-words">{t.academic_headline}</p>
                    ) : null}
                    {t.has_postgrad && (t.postgrad_university || t.postgrad_degree) ? (
                      <p className="flex items-start gap-1.5">
                        <GraduationCap
                          className="mt-1 h-4 w-4 shrink-0 text-[color:var(--brand-link)]"
                          aria-hidden="true"
                        />
                        <span className="break-words">
                          {translate("profile.education_postgraduate")}:{" "}
                          {formatInstitutionDegree(t.postgrad_university, t.postgrad_degree)}
                        </span>
                      </p>
                    ) : null}
                    {t.undergrad_university || t.undergrad_degree ? (
                      <p className="flex items-start gap-1.5">
                        <GraduationCap
                          className="mt-1 h-4 w-4 shrink-0 text-[color:var(--brand-link)]"
                          aria-hidden="true"
                        />
                        <span className="break-words">
                          {translate("profile.education_undergraduate")}:{" "}
                          {formatInstitutionDegree(t.undergrad_university, t.undergrad_degree)}
                        </span>
                      </p>
                    ) : null}
                    {t.secondary_school ? (
                      <p className="flex items-start gap-1.5">
                        <School
                          className="mt-1 h-4 w-4 shrink-0 text-[color:var(--brand-link)]"
                          aria-hidden="true"
                        />
                        <span className="break-words">
                          {translate("profile.education_secondary")}: {t.secondary_school}
                        </span>
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="w-full sm:w-auto sm:text-right">
                <div className="flex items-center justify-start gap-1.5 sm:justify-end">
                  {/* Issue #125: flagged pricing strips the rate — hide the
                      hero price instead of rendering HK$0. */}
                  {price.baseRate > 0 ? (
                    <p className="text-3xl font-bold text-[color:var(--ink)]">
                      HK${price.baseRate}
                      {price.isRange ? (
                        <span className="ml-1 text-sm font-semibold text-muted-foreground">
                          {translate("tutor_card.price_up")}
                        </span>
                      ) : null}
                      <span className="ml-1 text-sm font-semibold text-muted-foreground">
                        {translate("featured.per_hour")}
                      </span>
                    </p>
                  ) : null}
                  <TutorSaveButton tutorId={t.id} compact />
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
                {availabilityReadiness === "pre_booking" && t.earliest_start_date ? (
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
                    <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
                    {translate("tutor_card.available_from", {
                      date: formatAvailabilityDate(t.earliest_start_date, i18n.language),
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
                {waUrl ? (
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

              {profileBio || t.achievements.length > 0 ? (
                <ProfileSection icon={Award} title={translate("profile.section_achievements")}>
                  <div className="space-y-4">
                    {profileBio ? (
                      <MarkdownText className="text-[color:var(--ink)]">{profileBio}</MarkdownText>
                    ) : null}
                    {t.achievements.length > 0 ? (
                      <ul className="space-y-2.5">
                        {t.achievements.map((achievement, index) => (
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

              {/* Issue #97: Trophy Cabinet — optional award photos; hidden
                  entirely when the tutor uploaded none. */}
              {t.portfolio_images.length > 0 ? (
                <ProfileSection icon={Trophy} title={translate("profile.section_trophy")}>
                  <TrophyCabinet images={t.portfolio_images} />
                </ProfileSection>
              ) : null}

              {/* Issue #119: tutor-written self-introduction; hidden entirely
                  when blank so profiles without one keep no empty gap. */}
              {selfIntroduction ? (
                <ProfileSection icon={User} title={translate("profile.section_about")}>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-[color:var(--ink)] sm:text-base">
                    {selfIntroduction}
                  </p>
                </ProfileSection>
              ) : null}

              {t.subjects.length > 0 || t.ia_ee_tok_support.length > 0 ? (
                <ProfileSection icon={Layers} title={translate("profile.section_subjects")}>
                  <div className="text-left text-sm">
                    {t.subjects.length > 0 ? (
                      <div className="space-y-1">
                        {subjectGroups.map((group) => (
                          <p key={group.systemId} className="leading-relaxed text-sm">
                            <span className="font-bold text-[color:var(--ink)]">
                              {group.systemLabel}:
                            </span>{" "}
                            <span className="text-muted-foreground">
                              {group.subjects.join(", ")}
                            </span>
                          </p>
                        ))}
                      </div>
                    ) : null}
                    {t.ia_ee_tok_support.length > 0 ? (
                      <p className="mt-1 text-muted-foreground">
                        <span className="font-bold text-[color:var(--ink)]">IA / EE / TOK:</span>{" "}
                        {t.ia_ee_tok_support.join(", ")}
                        {t.ia_ee_tok_notes ? ` — ${t.ia_ee_tok_notes}` : ""}
                      </p>
                    ) : null}
                  </div>
                </ProfileSection>
              ) : null}

              {sortedPricingTiers.length > 0 ? (
                <ProfileSection icon={Coins} title={translate("profile.section_pricing")}>
                  <ul className="divide-y divide-border overflow-hidden rounded-sm border border-border">
                    {sortedPricingTiers.map((tier) => (
                      <li
                        key={tier.curriculum}
                        className="flex items-center justify-between gap-4 px-4 py-2.5"
                      >
                        <span className="text-sm font-semibold text-[color:var(--ink)]">
                          {getCurriculumPricingLabel(tier.curriculum)}
                        </span>
                        <span className="shrink-0 text-sm font-bold text-[color:var(--ink)]">
                          HK${tier.rate}
                          <span className="ml-0.5 text-xs font-medium text-muted-foreground">
                            {translate("featured.per_hour")}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground sm:text-sm">
                    {translate("profile.pricing_disclaimer")}
                  </p>
                </ProfileSection>
              ) : null}

              {inquiry.kind !== "waitlist" &&
              (hasAvailabilityGrid || preferredTimeWindows.length > 0) ? (
                <ProfileSection icon={Clock} title={translate("profile.section_availability")}>
                  <AvailabilityGrid grid={t.availability_grid} />
                </ProfileSection>
              ) : null}

              {/* Issues #83 + #105 (+ reviews half of #116): verified
                  parent/student reviews, admin-curated; hidden when empty. */}
              {reviews.length > 0 ? (
                <ProfileSection icon={MessageCircle} title={translate("profile.section_reviews")}>
                  <TutorReviews reviews={reviews} />
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
                      }
                    />
                  );
                })}
              </div>
              <div className="mt-8 rounded-sm border border-border bg-[color:var(--surface)] px-5 py-4 sm:px-6">
                <p className="text-sm text-muted-foreground sm:text-base">
                  {translate("profile.cant_find")}{" "}
                  <span className="font-bold text-[color:var(--ink)]">
                    {translate("profile.skip_pitch")}
                  </span>
                </p>
                <Button asChild variant="solid" color="blue" className="mt-3 font-bold">
                  <Link to="/tutor-requests" search={{ post: true }}>
                    {translate("profile.submit_case")}
                  </Link>
                </Button>
              </div>
            </div>
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
