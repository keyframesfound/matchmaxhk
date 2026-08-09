import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, MapPin, MessageCircle, GraduationCap, Award, Globe, BookOpen } from "lucide-react";
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
import { getSystem } from "@/features/tutors/examSystems";

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
      if (!Number.isFinite(lineHeight) || lineHeight <= 0) {
        lineHeight = current * 1.45;
      }
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

  return {
    title,
    description,
    url,
  };
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
    const t = loaderData.tutor;
    const seo = buildTutorSeoMeta(t, url);
    return {
      meta: [
        { title: seo.title },
        { name: "description", content: seo.description },
        { name: "robots", content: "index, follow" },
        { property: "og:title", content: seo.title },
        { property: "og:description", content: seo.description },
        { property: "og:url", content: seo.url },
        { property: "og:type", content: "profile" },
        ...(t.photo_url
          ? [
              { property: "og:image", content: t.photo_url },
              { name: "twitter:image", content: t.photo_url },
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
        <p className="mt-3 text-muted-foreground">This tutor code doesn’t match any published tutor.</p>
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
      const v = data?.value;
      return typeof v === "string" ? v : "";
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
  const { ref: headlineRef, fontSizePx: headlineSize, maxLines } = useResponsiveHeadlineFit(t.headline ?? "", 18, 13);
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(tutorStructuredData) }} />
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border bg-muted/30 py-14">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:gap-6">
              {t.photo_url ? (
                <img src={t.photo_url} alt={t.tutor_code} className="h-24 w-24 shrink-0 rounded-2xl object-cover" />
              ) : (
                <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl border border-[color:var(--brand-teal)]/20 bg-[color:var(--brand-teal)]/10 text-2xl font-semibold text-[color:var(--brand-teal)]">
                  {t.tutor_code?.slice(0, 2).toUpperCase() || "TP"}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <h1 className="text-3xl font-black text-[color:var(--brand-navy)] sm:text-4xl">{profileTitle}</h1>
                {t.headline && (
                  <p
                    ref={headlineRef}
                    className="mt-1 text-muted-foreground break-words whitespace-pre-line"
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
                )}
                {(t.university || t.highschool) && (
                  <p className="mt-1 text-sm text-muted-foreground break-words">
                    {[t.university, t.highschool].filter(Boolean).join(" | ")}
                  </p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                    {t.lesson_mode === "online" ? <Globe className="h-3 w-3" /> : <MapPin className="h-3 w-3" />}
                    {getTutorLocationLabel(t)}
                  </span>
                  {t.badge && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-teal)]/10 px-3 py-1 text-xs font-bold text-[color:var(--brand-teal)]">
                      <BadgeCheck className="h-3 w-3" /> {t.badge}
                    </span>
                  )}
                  {(t.subjects ?? []).map((s) => (
                    <span key={s} className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="w-full sm:w-auto sm:text-right">
                <p className="text-3xl font-black text-[color:var(--brand-navy)]">
                  HK${t.hourly_rate}
                  <span className="ml-1 text-sm font-semibold text-muted-foreground">/hr</span>
                </p>
                {waUrl ? (
                  <Button asChild className="mt-3 w-full bg-brand-gradient font-bold text-white shadow-teal sm:w-auto">
                    <a href={waUrl} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="mr-2 h-4 w-4" /> Request tutor
                    </a>
                  </Button>
                ) : (
                  <Button disabled className="mt-3 w-full bg-brand-gradient font-bold text-white shadow-teal sm:w-auto">
                    <MessageCircle className="mr-2 h-4 w-4" /> Contact coming soon
                  </Button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="py-14">
          <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:px-6 min-h-0">
            <div className="space-y-4 min-h-0">
              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-base font-bold text-[color:var(--brand-navy)]">
                  <BookOpen className="h-5 w-5 text-[color:var(--brand-teal)]" /> Subjects
                </div>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {t.subjects.length > 0
                    ? t.subjects.map((subject) => (
                        <li key={subject} className="rounded-xl border border-border/70 bg-background/70 p-3">
                          <span className="font-semibold text-foreground">{subject}</span>
                        </li>
                      ))
                    : null}
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-base font-bold text-[color:var(--brand-navy)]">
                  <Award className="h-5 w-5 text-[color:var(--brand-teal)]" /> Academic Excellence
                </div>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {t.exam_results.length > 0
                    ? t.exam_results.map((result, i) => (
                        <li key={i} className="rounded-xl border border-border/70 bg-background/70 p-3">
                          <p className="font-semibold text-foreground">
                            {getSystem(result.system)?.label ?? result.system.toUpperCase()}
                          </p>
                          <div className="mt-2 overflow-x-auto">
                            <div className="min-w-[260px]">
                              <div className="grid grid-cols-[1fr_auto] gap-x-3 border-b border-border/60 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                <span>Subject</span>
                                <span>Grade</span>
                              </div>
                              <div className="mt-1 space-y-1">
                                {result.subjects.map((entry, subjectIndex) => (
                                  <div key={`${entry.subject}-${subjectIndex}`} className="grid grid-cols-[1fr_auto] gap-x-3 py-1">
                                    <span className="text-foreground">{entry.subject}</span>
                                    <span className="font-semibold text-foreground">{entry.grade}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </li>
                      ))
                    : null}
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-base font-bold text-[color:var(--brand-navy)]">
                  <GraduationCap className="h-5 w-5 text-[color:var(--brand-teal)]" /> Qualifications & Languages
                </div>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  {t.qualifications_summary ? (
                    <li className="rounded-xl border border-border/70 bg-background/70 p-3 whitespace-pre-line">
                      {t.qualifications_summary}
                    </li>
                  ) : null}
                  {t.languages.length > 0 ? (
                    <li className="rounded-xl border border-border/70 bg-background/70 p-3">
                      <span className="font-semibold text-foreground">Languages:</span> {t.languages.join(", ")}
                    </li>
                  ) : null}
                </ul>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5">
                <div className="flex items-center gap-2 text-base font-bold text-[color:var(--brand-navy)]">
                  <MapPin className="h-5 w-5 text-[color:var(--brand-teal)]" /> Lesson Format
                </div>
                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
                  <li className="rounded-xl border border-border/70 bg-background/70 p-3">
                    <span className="font-semibold text-foreground">Format:</span> {getTutorLessonModeLabel(t.lesson_mode)}
                  </li>
                  <li className="rounded-xl border border-border/70 bg-background/70 p-3">
                    <span className="font-semibold text-foreground">Location:</span> {t.district ?? "Hong Kong"}
                  </li>
                  {t.lesson_mode === "either" ? (
                    <li className="rounded-xl border border-border/70 bg-background/70 p-3">
                      Online and in-person sessions available.
                    </li>
                  ) : null}
                  {t.lesson_mode === "in_person" ? (
                    <li className="rounded-xl border border-border/70 bg-background/70 p-3">
                      In-person teaching available at the listed location.
                    </li>
                  ) : null}
                </ul>
              </div>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
