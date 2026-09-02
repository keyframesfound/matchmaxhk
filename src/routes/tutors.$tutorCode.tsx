import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  MapPin,
  MessageCircle,
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
  getTutorLocationLabel,
  type Tutor,
} from "@/features/tutors/queries";
import { getSystem, type ExamResult } from "@/features/tutors/examSystems";
import { TutorSaveButton } from "@/features/tutors/saved-tutors";
import {
  getTutorSubjectChips,
  getTutorSubjectSentence,
  type TutorSubjectChip,
} from "@/features/tutors/tutor-display";

function useResponsiveHeadlineFit(text: string, baseSize = 18, minSize = 13) {
  const ref = useRef<HTMLParagraphElement | null>(null);
  const [fontSizePx, setFontSizePx] = useState(baseSize);
  const [maxLines, setMaxLines] = useState(2);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const updateLines = () => setMaxLines(media.matches ? 1 : 2);
    updateLines();
    media.addEventListener("change", updateLines);
    return () => media.removeEventListener("change", updateLines);
  }, []);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const fitToTwoLines = () => {
      let current = baseSize;
      node.style.fontSize = `${current}px`;
      node.style.lineHeight = "1.45";

      let lineHeight = Number.parseFloat(window.getComputedStyle(node).lineHeight);
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) lineHeight = current * 1.45;
      const maxHeight = lineHeight * maxLines + 1;

      while (current > minSize && node.scrollHeight > maxHeight) {
        current -= 0.5;
        node.style.fontSize = `${current}px`;
        lineHeight = Number.parseFloat(window.getComputedStyle(node).lineHeight) || current * 1.45;
      }

      setFontSizePx(current);
    };

    fitToTwoLines();

    let raf = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(fitToTwoLines);
    });
    observer.observe(node);
    if (node.parentElement) observer.observe(node.parentElement);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [text, baseSize, minSize, maxLines]);

  return { ref, fontSizePx, maxLines };
}

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

function DetailSubjectChip({ chip }: { chip: TutorSubjectChip }) {
  const gradeMatch = chip.grade?.match(/^(Grade\s+)(.+)$/i);

  return (
    <span className="rounded-[2px] bg-[color:var(--brand-teal)]/12 px-2 py-1 text-xs font-semibold text-[color:var(--ink)]">
      {chip.subject}
      {chip.grade ? (
        <>
          {" : "}
          {gradeMatch?.[1] ?? ""}
          <span className="font-black tracking-tight text-[color:var(--ink)]">
            {gradeMatch?.[2] ?? chip.grade}
          </span>
        </>
      ) : null}
    </span>
  );
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
      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
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
                <p className="mt-0.5 text-xs font-semibold text-muted-foreground">
                  {papers.map((p) => `${p.label}: ${p.score}`).join(" · ")}
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
  const profileTitle = `${t.tutor_code}${genderLabel ? ` • ${genderLabel}` : ""}`;
  const subjectText = (t.subjects ?? []).filter(Boolean).slice(0, 3).join(", ");
  const subjectChips = getTutorSubjectChips(t);
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
  const {
    ref: headlineRef,
    fontSizePx: headlineSize,
    maxLines,
  } = useResponsiveHeadlineFit(t.headline ?? "", 16, 12);
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
        <section className="bg-[#171717] py-5 font-mono text-[#d4d4d4] sm:py-7">
          <div className="mx-auto max-w-5xl px-5 sm:px-8">
            <Link
              to="/tutors"
              className="inline-block text-sm font-semibold text-[#a3a3a3] transition-colors hover:text-white"
            >
              &lt; Back
            </Link>
            <div className="mt-6 grid gap-5 sm:grid-cols-[100px_minmax(0,1fr)_auto] sm:gap-x-6">
              <div className="flex min-h-20 items-start justify-center sm:justify-start">
                {t.photo_url ? (
                  <img
                    src={t.photo_url}
                    alt={t.tutor_code}
                    className="h-20 w-20 object-cover grayscale"
                  />
                ) : (
                  <span className="text-sm leading-6 text-[#a3a3a3]">[ Avatar ]</span>
                )}
              </div>
              <div className="min-w-0 space-y-1 text-sm leading-6 sm:text-base">
                <h1 className="font-bold text-[#f5f5f5]">{profileTitle}</h1>
                {t.academic_headline ? <p className="break-words">{t.academic_headline}</p> : null}
                {t.university ? <p className="break-words">{t.university}</p> : null}
                {t.secondary_school ? <p className="break-words">{t.secondary_school}</p> : null}
                {t.headline ? (
                  <p
                    ref={headlineRef}
                    className="break-words whitespace-pre-line text-[#a3a3a3]"
                    style={{
                      fontSize: `${headlineSize}px`,
                      lineHeight: 1.45,
                      display: "-webkit-box",
                      WebkitLineClamp: maxLines,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {t.headline}
                  </p>
                ) : null}
              </div>
              <div className="space-y-4 text-sm leading-6 sm:text-right sm:text-base">
                <p className="font-bold text-[#f5f5f5]">HK${t.hourly_rate} /hr</p>
                <p className="text-[#a3a3a3]">Ref: {t.tutor_code}</p>
                <TutorSaveButton tutorId={t.id} compact />
              </div>
            </div>
            <div className="mt-5 border-t border-[#404040] pt-5 sm:ml-[124px]">
              {waUrl ? (
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#e5e5e5] transition-colors hover:text-white"
                >
                  <span aria-hidden="true">[</span>
                  <MessageCircle className="h-4 w-4" strokeWidth={2} />
                  Request tutor
                  <span aria-hidden="true">]</span>
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 text-sm text-[#737373]">
                  <span aria-hidden="true">[</span>
                  <MessageCircle className="h-4 w-4" strokeWidth={2} />
                  Contact coming soon
                  <span aria-hidden="true">]</span>
                </span>
              )}
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
                      <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
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
                                <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
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
