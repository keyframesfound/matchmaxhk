import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  MapPin,
  MessageCircle,
  ArrowLeft,
  Award,
  Globe,
  Languages,
  Layers,
  LineChart,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchTutorByCode,
  getTutorGenderLabel,
  getTutorLessonModeLabel,
  type Tutor,
} from "@/features/tutors/queries";
import { getSystem, type ExamResult } from "@/features/tutors/examSystems";
import { TutorSaveButton } from "@/features/tutors/saved-tutors";

function buildTutorSeoMeta(tutor: Tutor, url: string) {
  const subjects = (tutor.subjects ?? []).filter(Boolean);
  const subjectText = subjects.slice(0, 3).join(", ");
  const locationText = tutor.district ? ` in ${tutor.district}` : " in Hong Kong";
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

function ProfileSection({
  icon: Icon,
  title,
  children,
  iconClassName = "text-[color:var(--ink)]",
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
  iconClassName?: string;
}) {
  return (
    <section className="border-b border-border/70 px-5 py-5 last:border-b-0 sm:px-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-[color:var(--ink)]/15 bg-[color:var(--ink)]/8">
          <Icon className={`h-4 w-4 ${iconClassName}`} strokeWidth={2.1} />
        </span>
        <h2 className="text-base font-black tracking-tight text-[color:var(--ink)] sm:text-lg">
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
        <span className="font-black text-[color:var(--ink)]">{label}:</span>{" "}
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
  const subjects = result.subjects.filter((entry) => entry.subject.trim());

  if (subjects.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-[color:var(--ink)]">
        {label}
      </p>
      <ul className="space-y-1.5">
        {subjects.map((entry, subjectIndex) => {
          const papers = (entry.papers ?? []).filter((p) => p.label.trim() && p.score.trim());
          return (
            <li
              key={`${entry.subject}-${subjectIndex}`}
              className="border-l-2 border-[color:var(--brand-link)]/80 pl-3"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-[color:var(--ink)]">{entry.subject}</span>
                {entry.grade.trim() ? (
                  <span className="text-sm font-bold text-[color:var(--brand-link)]">
                    – Grade {entry.grade.replace(/^grade\s+/i, "")}
                  </span>
                ) : null}
              </div>
              {papers.length > 0 ? (
                <p className="mt-0.5 text-xs font-semibold text-[color:var(--ink)]">
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

export const Route = createFileRoute("/tutors/$tutorCode")({
  loader: async ({ params }) => {
    const tutor = await fetchTutorByCode(params.tutorCode);
    if (!tutor) throw notFound();
    return { tutor };
  },
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
  notFoundComponent: () => (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-3xl font-black text-[color:var(--ink)]">Tutor not found</h1>
        <p className="mt-3 text-muted-foreground">
          This tutor code doesn’t match any published tutor.
        </p>
        <Button asChild className="mt-6">
          <Link to="/tutors">Browse all tutors</Link>
        </Button>
      </main>
      <SiteFooter />
    </div>
  ),
  errorComponent: ({ error }) => (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-destructive">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
      </main>
      <SiteFooter />
    </div>
  ),
  component: TutorDetail,
});

function TutorDetail() {
  const { tutor } = Route.useLoaderData();

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

  const waDigits = (whatsappNumber ?? "").replace(/[^\d]/g, "");
  const waUrl = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent(`I would like to request tutor ${t.tutor_code}`)}`
    : "";
  const genderLabel = getTutorGenderLabel(t.gender);
  const subjectText = (t.subjects ?? []).filter(Boolean).slice(0, 3).join(", ");
  const examResults = (t.exam_results ?? []).filter((result) =>
    result.subjects.some((entry) => entry.subject.trim()),
  );
  const profileBio = t.qualifications_summary?.trim() ?? "";
  const lessonLocation = t.district ? `Hong Kong — ${t.district}` : "Hong Kong";
  const tutorLanguages = (t.languages ?? []).filter(Boolean);
  const lessonLanguages = tutorLanguages.length > 0 ? tutorLanguages.join(", ") : "Not specified";
  const lessonFormat = (getTutorLessonModeLabel(t.lesson_mode) ?? "To be confirmed").replace(
    / tutoring$/,
    "",
  );
  const tutorSeoSummary = `Tutor ${t.tutor_code} offers ${subjectText || "tutoring"} support${t.district ? ` in ${t.district}` : " in Hong Kong"}. ${t.lesson_mode === "online" ? "Online lessons are available." : t.lesson_mode === "either" ? "Online and in-person lessons are available." : "In-person lessons are available."} Browse rates and availability on MatchMax.`;
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
          <div className="mx-auto max-w-5xl px-5 sm:px-8">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mb-6"
              onClick={() => window.history.back()}
            >
              <ArrowLeft aria-hidden="true" />
              Back
            </Button>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
              {t.photo_url ? (
                <img
                  src={t.photo_url}
                  alt={t.tutor_code}
                  className="h-16 w-16 shrink-0 rounded-full object-cover sm:h-20 sm:w-20"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-teal)]/20 bg-[color:var(--brand-teal)]/10 text-xl font-semibold text-[color:var(--brand-teal)] sm:h-20 sm:w-20 sm:text-2xl">
                  {t.tutor_code?.slice(0, 2).toUpperCase() || "TP"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-xl font-black text-[color:var(--ink)] sm:text-2xl">
                  {t.tutor_code}
                  {genderLabel ? (
                    <>
                      <strong> • </strong>
                      {genderLabel}
                    </>
                  ) : null}
                </h1>
                {t.academic_headline || t.university || t.secondary_school ? (
                  <div className="mt-2 space-y-1 text-base font-semibold leading-snug text-[color:var(--ink)] sm:text-lg">
                    {t.academic_headline ? (
                      <p className="break-words">{t.academic_headline}</p>
                    ) : null}
                    {t.university ? <p className="break-words">{t.university}</p> : null}
                    {t.secondary_school ? (
                      <p className="break-words">{t.secondary_school}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <div className="w-full sm:w-auto sm:text-right">
                <div className="flex items-center justify-start gap-1.5 sm:justify-end">
                  <p className="text-3xl font-black text-[color:var(--ink)]">
                    HK${t.hourly_rate}
                    <span className="ml-1 text-sm font-semibold text-muted-foreground">/hr</span>
                  </p>
                  <TutorSaveButton tutorId={t.id} compact />
                </div>
                {waUrl ? (
                  <Button
                    asChild
                    className="mt-3 w-full bg-[color:var(--surface-invert)] font-bold text-white shadow-teal hover:bg-[color:var(--surface-invert)] sm:w-auto"
                  >
                    <a href={waUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" /> Request tutor
                    </a>
                  </Button>
                ) : (
                  <Button
                    disabled
                    className="mt-3 w-full bg-[color:var(--surface-invert)] font-bold text-white shadow-teal hover:bg-[color:var(--surface-invert)] sm:w-auto"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" /> Contact coming soon
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="py-8 sm:py-10">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div>
              {examResults.length > 0 ? (
                <ProfileSection icon={LineChart} title="Core Academic Breakdown">
                  <div className="space-y-4">
                    {examResults.map((result, index) => (
                      <AcademicQualification key={`${result.system}-${index}`} result={result} />
                    ))}
                  </div>
                </ProfileSection>
              ) : null}

              {profileBio || t.achievements.length > 0 ? (
                <ProfileSection icon={Award} title="Achievement & Experience">
                  <div className="space-y-4">
                    {profileBio ? (
                      <p className="whitespace-pre-line text-sm leading-relaxed text-[color:var(--ink)]">
                        {profileBio}
                      </p>
                    ) : null}
                    {t.achievements.length > 0 ? (
                      <ul className="space-y-2.5">
                        {t.achievements.map((achievement, index) => (
                          <li key={`${achievement.short_text}-${index}`} className="flex gap-2.5">
                            <Sparkles
                              className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-teal)]"
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

              {t.subjects.length > 0 || t.ia_ee_tok_support.length > 0 ? (
                <ProfileSection icon={Layers} title="Subjects Taught">
                  <div className="text-left text-sm">
                    {t.subjects.length > 0 ? (
                      <p className="font-bold leading-relaxed text-[color:var(--ink)]">
                        {t.subjects.filter(Boolean).join(", ")}
                      </p>
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

              <ProfileSection icon={MapPin} title="Lesson Format & Details">
                <ul className="space-y-3.5">
                  <LessonDetailRow
                    icon={Globe}
                    label="Format"
                    value={lessonFormat}
                    iconClassName="text-[color:var(--ink)]"
                  />
                  <LessonDetailRow
                    icon={MapPin}
                    label="Location"
                    value={lessonLocation}
                    iconClassName="text-[color:var(--ink)]"
                  />
                  <LessonDetailRow
                    icon={Languages}
                    label="Languages"
                    value={lessonLanguages}
                    iconClassName="text-[color:var(--ink)]"
                  />
                </ul>
              </ProfileSection>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
