import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  MapPin,
  MessageCircle,
  Award,
  Globe,
  Layers,
  LineChart,
  Sparkles,
  Languages,
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
    <span className="rounded-[2px] bg-[color:var(--brand-teal)]/12 px-2 py-1 text-xs font-semibold text-[color:var(--brand-navy)]">
      {chip.subject}
      {chip.grade ? (
        <>
          {" : "}
          {gradeMatch?.[1] ?? ""}
          <span className="font-black tracking-tight text-[color:var(--brand-navy)]">
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
}: {
  icon: LucideIcon;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-b border-border/70 px-5 py-5 last:border-b-0 sm:px-6">
      <div className="flex items-center gap-2.5">
        <span className="flex h-7 w-7 items-center justify-center rounded-[3px] border border-[color:var(--brand-navy)]/15 bg-[color:var(--brand-navy)]/8">
          <Icon className="h-4 w-4 text-[color:var(--brand-navy)]" strokeWidth={2.1} />
        </span>
        <h2 className="text-base font-black tracking-tight text-[color:var(--brand-navy)] sm:text-lg">
          {title}
        </h2>
      </div>
      <div className="mt-3.5">{children}</div>
    </section>
  );
}

function AcademicQualification({ result }: { result: ExamResult }) {
  const label = getSystem(result.system)?.label ?? result.system.toUpperCase();
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
              className="border-l-2 border-[color:var(--brand-teal)]/40 pl-3"
            >
              <div className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-[color:var(--brand-navy)]">
                  {entry.subject}
                </span>
                {entry.grade.trim() ? (
                  <span className="text-sm font-bold text-[color:var(--brand-teal)]">
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
        <h1 className="text-3xl font-black text-[color:var(--brand-navy)]">Tutor not found</h1>
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
  const {
    ref: headlineRef,
    fontSizePx: headlineSize,
    maxLines,
  } = useResponsiveHeadlineFit(t.headline ?? "", 18, 13);
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
        <section className="border-b border-border bg-muted/30 py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
              {t.photo_url ? (
                <img
                  src={t.photo_url}
                  alt={t.tutor_code}
                  className="h-24 w-24 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-teal)]/20 bg-[color:var(--brand-teal)]/10 text-2xl font-semibold text-[color:var(--brand-teal)]">
                  {t.tutor_code?.slice(0, 2).toUpperCase() || "TP"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-black text-[color:var(--brand-navy)] sm:text-4xl">
                  {profileTitle}
                </h1>
                {t.headline ? (
                  <p
                    ref={headlineRef}
                    className="mt-1 break-words whitespace-pre-line text-muted-foreground"
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
                {t.university || t.highschool ? (
                  <p className="mt-1 text-sm text-muted-foreground break-words">
                    {[t.university, t.highschool].filter(Boolean).join(" | ")}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-[2px] border border-border bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {t.lesson_mode === "online" ? (
                      <Globe className="h-3 w-3" />
                    ) : (
                      <MapPin className="h-3 w-3" />
                    )}
                    {getTutorLocationLabel(t)}
                  </span>
                  {t.badge ? (
                    <span className="inline-flex items-center gap-1 rounded-[2px] border border-[color:var(--brand-teal)]/25 bg-[color:var(--brand-teal)]/10 px-2.5 py-1 text-xs font-bold text-[color:var(--brand-teal)]">
                      <BadgeCheck className="h-3 w-3" /> {t.badge}
                    </span>
                  ) : null}
                  {subjectChips.map((chip, index) => (
                    <DetailSubjectChip key={`${chip.subject}-${index}`} chip={chip} />
                  ))}
                </div>
              </div>
              <div className="w-full sm:w-auto sm:text-right">
                <p className="text-3xl font-black text-[color:var(--brand-navy)]">
                  HK${t.hourly_rate}
                  <span className="ml-1 text-sm font-semibold text-muted-foreground">/hr</span>
                </p>
                {waUrl ? (
                  <Button
                    asChild
                    className="mt-3 w-full bg-brand-gradient font-bold text-white shadow-teal sm:w-auto"
                  >
                    <a href={waUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" /> Request tutor
                    </a>
                  </Button>
                ) : (
                  <Button
                    disabled
                    className="mt-3 w-full bg-brand-gradient font-bold text-white shadow-teal sm:w-auto"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" /> Contact coming soon
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="py-12">
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

              {t.achievements.length > 0 ? (
                <ProfileSection icon={Sparkles} title="Achievements and Experiences">
                  <ul className="space-y-2.5">
                    {t.achievements.map((achievement, index) => (
                      <li key={`${achievement.short_text}-${index}`} className="flex gap-2.5">
                        <Award
                          className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--brand-navy)]"
                          strokeWidth={2.1}
                        />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-[color:var(--brand-navy)]">
                            {achievement.short_text}
                          </p>
                          {achievement.detail_text ? (
                            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground whitespace-pre-line">
                              {achievement.detail_text}
                            </p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                </ProfileSection>
              ) : null}

              {subjectChips.length > 0 || t.ia_ee_tok_support.length > 0 ? (
                <ProfileSection icon={Layers} title="Subjects Taught">
                  <div className="text-left text-sm">
                    {subjectChips.length > 0 ? (
                      <p className="font-bold leading-relaxed text-[color:var(--brand-navy)]">
                        {getTutorSubjectSentence(t)}
                      </p>
                    ) : null}
                    {t.ia_ee_tok_support.length > 0 ? (
                      <p className="mt-1 text-muted-foreground">
                        <span className="font-bold text-[color:var(--brand-navy)]">Mentorship:</span>{" "}
                        {t.ia_ee_tok_support.join(", ")}
                        {t.ia_ee_tok_notes ? ` — ${t.ia_ee_tok_notes}` : ""}
                      </p>
                    ) : null}
                  </div>
                </ProfileSection>
              ) : null}

              <ProfileSection icon={MapPin} title="Lesson Format & Details">
                <ul className="space-y-2 text-sm">
                  <li className="flex items-baseline gap-2">
                    <Globe className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-[color:var(--brand-navy)]" />
                    <span className="font-bold text-[color:var(--brand-navy)]">Format:</span>
                    <span className="text-muted-foreground">
                      {getTutorLessonModeLabel(t.lesson_mode)}
                    </span>
                  </li>
                  <li className="flex items-baseline gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-[color:var(--brand-navy)]" />
                    <span className="font-bold text-[color:var(--brand-navy)]">Location:</span>
                    <span className="text-muted-foreground">
                      Hong Kong{t.district ? ` – ${t.district}` : ""}
                    </span>
                  </li>
                  {t.languages.length > 0 ? (
                    <li className="flex items-baseline gap-2">
                      <Languages className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-[color:var(--brand-navy)]" />
                      <span className="font-bold text-[color:var(--brand-navy)]">Languages:</span>
                      <span className="text-muted-foreground">{t.languages.join(", ")}</span>
                    </li>
                  ) : null}
                  {t.qualifications_summary ? (
                    <li className="text-muted-foreground whitespace-pre-line">
                      {t.qualifications_summary}
                    </li>
                  ) : null}
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
