import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BadgeCheck, BookOpen, Clock3, MessageCircle, Search } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { LessonModeSelect } from "@/components/ui/lesson-mode-select";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { blurActive } from "@/lib/dom";
import {
  fetchPublishedTutors,
  fetchTopWeeklyTutors,
  fetchLandingStats,
  fetchTutorByCode,
  getTutorGenderLabel,
  getTutorLessonModeLabel,
  HK_DISTRICTS,
  matchesDistrictFilter,
  matchesLessonModeFilter,
  type Tutor,
} from "@/features/tutors/queries";
import { DEFAULT_SUBJECT_OPTIONS } from "@/features/tutors/subjects";
import { supabase } from "@/integrations/supabase/client";

const OG_IMAGE =
  "https://storage.googleapis.com/gpt-engineer-file-uploads/8gNheRvRfCOczS8mI5H1ghF3qLL2/social-images/social-1784777386937-Untitled_design.webp";

type HomeTutorSearchState = {
  category?: string;
  subject?: string;
  mode?: string;
  district?: string;
  gender?: string;
  q?: string;
};

const HOME_CATEGORY_OPTIONS = [
  { value: "", label: "Any category" },
  { value: "IB", label: "IB" },
  { value: "DSE", label: "DSE" },
  { value: "IGCSE", label: "IGCSE" },
  { value: "AP", label: "AP" },
  { value: "A-Level", label: "A-Level" },
  { value: "Primary", label: "Primary" },
  { value: "Secondary", label: "Secondary" },
  { value: "International", label: "International" },
];

const HOME_GENDER_OPTIONS = [
  { value: "", label: "Any gender" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

function formatTutorCode(code?: string | null) {
  const normalized = (code ?? "").trim().toUpperCase();
  if (!normalized) return "MM-XXXX";
  if (/^MM-\d{4}$/.test(normalized)) return normalized;
  if (/^\d{4}$/.test(normalized)) return `MM-${normalized}`;
  if (/^MM-/.test(normalized)) return normalized;
  return normalized;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Find Verified IB, DSE & IGCSE Tutors in Hong Kong | MatchMax" },
      {
        name: "description",
        content:
          "Find verified IB, DSE, IGCSE, AP and A-Level tutors in Hong Kong. Compare tutor profiles, lesson modes and pricing to get matched quickly.",
      },
      { name: "robots", content: "index, follow" },
      {
        property: "og:title",
        content: "Find Verified IB, DSE & IGCSE Tutors in Hong Kong | MatchMax",
      },
      {
        property: "og:description",
        content:
          "Find verified IB, DSE, IGCSE, AP and A-Level tutors in Hong Kong. Compare tutor profiles, lesson modes and pricing to get matched quickly.",
      },
      { property: "og:url", content: "https://www.maxmatch.app/" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "MatchMax" },
      { property: "og:locale", content: "en_HK" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "IB, DSE & IGCSE Tutors in Hong Kong | MatchMax" },
      {
        name: "twitter:description",
        content:
          "Find verified IB, HKDSE, IGCSE, AP, A-Level and international school tutors in Hong Kong.",
      },
      { name: "twitter:image", content: OG_IMAGE },
    ],
    links: [
      { rel: "canonical", href: "https://www.maxmatch.app/" },
      { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
      { rel: "shortcut icon", href: "/favicon.ico" },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
      { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
      { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/site.webmanifest" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [homeSearch, setHomeSearch] = useState<HomeTutorSearchState>({});

  const setHomeSearchParam = (patch: Partial<HomeTutorSearchState>) => {
    setHomeSearch((prev) => {
      const next = { ...prev, ...patch };
      (Object.keys(next) as (keyof HomeTutorSearchState)[]).forEach((k) => {
        if (!next[k]) delete next[k];
      });
      return next;
    });
  };

  // Queries
  const { data: featuredTutors = [], isLoading: featuredLoading } = useQuery({
    queryKey: ["landing", "featured_tutors"],
    queryFn: () => fetchTopWeeklyTutors(3),
  });

  const { data: liveStats } = useQuery({
    queryKey: ["landing", "stats"],
    queryFn: () => fetchLandingStats(),
  });

  const { data: studentsMatchedSetting } = useQuery({
    queryKey: ["settings", "students_matched"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "students_matched")
        .maybeSingle();
      if (error) throw error;
      const v = data?.value;
      const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : 0;
      return Number.isFinite(n) ? n : 0;
    },
  });

  const { data: heroTutorCode } = useQuery({
    queryKey: ["settings", "hero_tutor_code"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "hero_tutor_code")
        .maybeSingle();
      if (error) throw error;
      const v = data?.value;
      return typeof v === "string" ? v.trim() : "";
    },
  });

  const { data: pickedHeroTutor } = useQuery({
    queryKey: ["landing", "hero_tutor", heroTutorCode ?? ""],
    queryFn: () => fetchTutorByCode(heroTutorCode as string),
    enabled: !!heroTutorCode,
  });

  const heroTutor: Tutor | null = pickedHeroTutor ?? featuredTutors[0] ?? null;

  const { data: publishedTutors = [], isLoading: publishedTutorsLoading } = useQuery({
    queryKey: ["landing", "published_tutors"],
    queryFn: fetchPublishedTutors,
  });

  const { data: subjectOptions = DEFAULT_SUBJECT_OPTIONS } = useQuery({
    queryKey: ["settings", "subject_options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "subject_options")
        .maybeSingle();
      if (error) throw error;
      const v = data?.value;
      if (Array.isArray(v)) {
        const arr = (v as unknown[]).filter(
          (x): x is string => typeof x === "string" && x.trim().length > 0,
        );
        if (arr.length > 0) return arr;
      }
      return DEFAULT_SUBJECT_OPTIONS;
    },
  });

  const tutorSearchParams = useMemo(() => {
    const params: HomeTutorSearchState = {
      category: homeSearch.category,
      subject: homeSearch.subject,
      mode: homeSearch.mode,
      gender: homeSearch.gender,
      q: homeSearch.q,
    };
    if (homeSearch.mode === "in_person") {
      params.district = homeSearch.district;
    }
    return params;
  }, [homeSearch]);

  const previewTutors = useMemo(() => {
    const categoryFilter = (homeSearch.category ?? "").toLowerCase();
    const subjectFilter = (homeSearch.subject ?? "").toLowerCase();
    const districtFilter = homeSearch.mode === "in_person" ? (homeSearch.district ?? "") : "";
    const modeFilter = homeSearch.mode ?? "";
    const genderFilter = homeSearch.gender ?? "";
    const query = (homeSearch.q ?? "").trim().toLowerCase();

    return publishedTutors.filter((tut) => {
      if (categoryFilter) {
        const categorySource = [...tut.subjects, ...tut.target_students, tut.headline ?? ""]
          .join(" ")
          .toLowerCase();
        if (!categorySource.includes(categoryFilter)) return false;
      }
      if (subjectFilter && !tut.subjects.some((s) => s.toLowerCase().includes(subjectFilter)))
        return false;
      if (!matchesLessonModeFilter(modeFilter, tut.lesson_mode)) return false;
      if (!matchesDistrictFilter(districtFilter, tut.district)) return false;
      if (genderFilter && (tut.gender ?? "") !== genderFilter) return false;
      if (
        query &&
        !(
          tut.tutor_code.toLowerCase().includes(query) ||
          tut.subjects.some((s) => s.toLowerCase().includes(query)) ||
          (tut.headline ?? "").toLowerCase().includes(query)
        )
      ) {
        return false;
      }
      return true;
    });
  }, [homeSearch, publishedTutors]);

  // JSON-LD
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "MatchMax",
    url: "https://www.maxmatch.app/",
    description:
      "Find verified IB, HKDSE, IGCSE, AP, A-Level and international school tutors in Hong Kong.",
    areaServed: {
      "@type": "City",
      name: "Hong Kong",
    },
  };

  const tutorListStructuredData =
    featuredTutors.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: featuredTutors.map((tut, i) => ({
            "@type": "ListItem",
            position: i + 1,
            item: {
              "@type": "Person",
              name: tut.tutor_code,
              url: `https://www.maxmatch.app/tutors/${tut.tutor_code}`,
            },
          })),
        }
      : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      {tutorListStructuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(tutorListStructuredData) }}
        />
      )}

      <SiteHeader />

      {/* HERO SECTION */}
      <section className="hero-startup-bg relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse at top right, color-mix(in oklab, #2ED5DE 25%, transparent) 0%, transparent 55%), radial-gradient(ellipse at bottom left, color-mix(in oklab, #041344 15%, transparent) 0%, transparent 50%)",
          }}
        />
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-4 pt-10 pb-20 md:px-6 lg:grid-cols-2 lg:gap-16 md:pt-24 md:pb-28">
          <div className="flex flex-col justify-center">
            <h1 className="mt-6 text-6xl md:text-5xl font-black leading-[1.05] tracking-tight text-[color:var(--brand-navy)] sm:text-6xl lg:text-7xl">
              {t("hero.title_a")}
              <br />
              <span className="text-brand-gradient">{t("hero.title_b")}</span>
            </h1>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button
                asChild
                size="lg"
                className="h-16 md:h-14 rounded-2xl md:rounded-md bg-[color:var(--brand-navy)] px-8 text-lg md:text-base font-bold text-white shadow-brand hover:bg-[color:var(--brand-royal)] w-full md:w-auto"
              >
                <Link to="/tutors" onClick={() => blurActive()}>
                  {t("hero.cta_primary")}
                  <ArrowRight className="ml-2 h-6 w-6 md:h-5 md:w-5" />
                </Link>
              </Button>
            </div>
          </div>

          {/* HERO VISUAL CARD */}
          <div className="relative flex items-center justify-center">
            <div className="relative w-full max-w-md">
              <div
                className="absolute inset-0 rounded-2xl md:rounded-sm border border-border/50 bg-muted/30"
                aria-hidden
              />
              <div className="relative rounded-2xl md:rounded-sm border border-border/80 bg-card/95 p-8 md:p-6 shadow-[0_10px_30px_rgba(4,19,68,0.06)]">
                {heroTutor ? (
                  <>
                    <div className="flex items-center gap-4 md:gap-3">
                      {heroTutor.photo_url ? (
                        <img
                          src={heroTutor.photo_url}
                          alt="Featured Tutor"
                          width={56}
                          height={56}
                          className="h-16 w-16 md:h-11 md:w-11 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-16 w-16 md:h-11 md:w-11 shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-teal)]/20 bg-[color:var(--brand-teal)]/10 text-xl md:text-sm font-bold md:font-semibold text-[color:var(--brand-teal)]">
                          {heroTutor.tutor_code?.slice(0, 2).toUpperCase() || "TP"}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xl md:text-sm font-black md:font-bold text-foreground break-words">
                          {formatTutorCode(heroTutor.tutor_code)}
                          {getTutorGenderLabel(heroTutor.gender)
                            ? ` · ${getTutorGenderLabel(heroTutor.gender)}`
                            : ""}
                        </p>
                        <p className="text-sm md:text-xs leading-relaxed text-muted-foreground break-words whitespace-pre-line">
                          {heroTutor.headline ?? heroTutor.subjects.slice(0, 3).join(" · ")}
                        </p>
                      </div>
                      <span className="rounded-lg md:rounded-md border border-[color:var(--brand-teal)]/15 bg-[color:var(--brand-teal)]/10 px-2.5 py-1 text-[11px] md:text-[10px] font-bold uppercase tracking-wider text-[color:var(--brand-teal)]">
                        Featured
                      </span>
                    </div>

                    <div className="mt-8 md:mt-5 grid grid-cols-3 gap-3 rounded-xl md:rounded-md border border-border/70 bg-muted/50 p-5 md:p-4 text-center text-xs">
                      <div>
                        <p className="font-black md:font-bold text-2xl md:text-lg text-[color:var(--brand-navy)]">
                          {formatTutorCode(heroTutor.tutor_code)}
                        </p>
                        <p className="text-[11px] md:text-[10px] font-bold md:font-normal uppercase tracking-wider text-muted-foreground">
                          Code
                        </p>
                      </div>
                      <div>
                        <p className="font-black md:font-bold text-2xl md:text-lg text-[color:var(--brand-navy)]">
                          ${heroTutor.hourly_rate}
                        </p>
                        <p className="text-[11px] md:text-[10px] font-bold md:font-normal uppercase tracking-wider text-muted-foreground">
                          /hr
                        </p>
                      </div>
                      <div>
                        <p className="font-black md:font-bold text-2xl md:text-lg text-[color:var(--brand-navy)]">
                          {heroTutor.experience_years
                            ? `${heroTutor.experience_years}+ yrs`
                            : "New"}
                        </p>
                        <p className="text-[11px] md:text-[10px] font-bold md:font-normal uppercase tracking-wider text-muted-foreground">
                          Experience
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 rounded-xl md:rounded-md border border-border/70 bg-muted/40 p-5 md:p-4">
                      <div className="space-y-3 md:space-y-2">
                        {[
                          heroTutor.badge,
                          heroTutor.district,
                          heroTutor.experience_years
                            ? `${heroTutor.experience_years}+ years`
                            : null,
                          heroTutor.subjects[0] ?? null,
                        ]
                          .filter((x): x is string => !!x)
                          .slice(0, 4)
                          .map((tag) => (
                            <div
                              key={tag}
                              className="flex items-center gap-3 md:gap-2 text-sm md:text-xs text-muted-foreground font-medium md:font-normal"
                            >
                              <BadgeCheck className="h-5 w-5 md:h-3.5 md:w-3.5 text-[color:var(--brand-teal)]" />
                              {tag}
                            </div>
                          ))}
                      </div>
                    </div>

                    <Button
                      asChild
                      className="mt-8 md:mt-6 w-full rounded-xl md:rounded-lg bg-[color:var(--brand-navy)] py-6 md:py-3 text-lg md:text-sm font-bold text-white hover:bg-[color:var(--brand-royal)]"
                    >
                      <Link to="/tutors/$tutorCode" params={{ tutorCode: heroTutor.tutor_code }}>
                        <MessageCircle className="mr-2 inline h-5 w-5 md:h-4 md:w-4" /> View tutor
                        profile
                      </Link>
                    </Button>
                  </>
                ) : (
                  <div className="py-16 text-center text-sm text-muted-foreground">
                    {featuredLoading ? "Loading featured tutor…" : "No featured tutor yet."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative -mt-10 pb-14 md:-mt-14 md:pb-16">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="rounded-sm border border-border bg-card p-4 shadow-[0_12px_30px_rgba(4,19,68,0.08)] sm:p-5">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
              <p className="text-sm font-black uppercase tracking-wide text-[color:var(--brand-teal)]">
                Explore the tutors MatchMax offers
              </p>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 rounded-sm pl-9"
                  placeholder="Search tutor code, subject, keyword..."
                  value={homeSearch.q ?? ""}
                  onChange={(e) => setHomeSearchParam({ q: e.target.value })}
                />
              </div>
              <SearchableSelect
                value={homeSearch.category ?? ""}
                onChange={(v) => setHomeSearchParam({ category: v || undefined })}
                options={HOME_CATEGORY_OPTIONS}
                placeholder="Any category"
                searchPlaceholder="Search category..."
                className="h-11 rounded-sm"
              />
              <SearchableSelect
                value={homeSearch.subject ?? ""}
                onChange={(v) => setHomeSearchParam({ subject: v || undefined })}
                options={[
                  { value: "", label: "Any subject" },
                  ...subjectOptions.map((s) => ({ value: s, label: s })),
                ]}
                placeholder="Any subject"
                searchPlaceholder="Search subject..."
                className="h-11 rounded-sm"
              />
              <LessonModeSelect
                mode={(homeSearch.mode as "" | "online" | "in_person" | "either" | undefined) ?? ""}
                district={homeSearch.district}
                districts={HK_DISTRICTS}
                onChange={({ mode, district }) =>
                  setHomeSearchParam({
                    mode: mode || undefined,
                    district: mode === "in_person" ? district : undefined,
                  })
                }
                placeholder="Any lesson mode"
                className="h-11 rounded-sm"
              />
              <SearchableSelect
                value={homeSearch.gender ?? ""}
                onChange={(v) => setHomeSearchParam({ gender: v || undefined })}
                options={HOME_GENDER_OPTIONS}
                placeholder="Any gender"
                className="h-11 rounded-sm"
              />
              <Button
                className="h-11 rounded-sm bg-[color:var(--brand-navy)] px-6 font-bold text-white hover:bg-[color:var(--brand-royal)]"
                onClick={() => navigate({ to: "/tutors", search: tutorSearchParams })}
              >
                Search
              </Button>
            </div>
          </div>

          <div className="mt-6">
            {publishedTutorsLoading && (
              <p className="text-sm text-muted-foreground">Loading tutors...</p>
            )}

            {!publishedTutorsLoading && previewTutors.length === 0 && (
              <p className="text-sm text-muted-foreground">No tutors match this search yet.</p>
            )}

            {!publishedTutorsLoading && previewTutors.length > 0 && (
              <Carousel opts={{ align: "start", loop: false }} className="mx-0">
                <CarouselContent>
                  {previewTutors.map((tut) => (
                    <CarouselItem
                      key={tut.id}
                      className="flex basis-full sm:basis-1/2 lg:basis-1/3 xl:basis-1/4"
                    >
                      <article className="flex h-full w-full flex-col overflow-hidden rounded-sm border border-[color:var(--brand-teal)]/20 bg-card shadow-[0_8px_24px_rgba(4,19,68,0.05)] transition-all hover:-translate-y-0.5 hover:shadow-[0_12px_30px_rgba(4,19,68,0.08)]">
                        <div className="bg-[color:var(--brand-teal)]/8 p-4">
                          <div className="flex items-center gap-3">
                            {tut.photo_url ? (
                              <img
                                src={tut.photo_url}
                                alt="Tutor"
                                loading="lazy"
                                className="h-16 w-16 shrink-0 rounded-full border-2 border-[color:var(--brand-teal)] object-cover"
                              />
                            ) : (
                              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border-2 border-[color:var(--brand-teal)] bg-white text-lg font-bold text-[color:var(--brand-teal)]">
                                {tut.tutor_code?.slice(0, 2).toUpperCase() || "TP"}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="text-xl font-black text-[color:var(--brand-navy)]">
                                {formatTutorCode(tut.tutor_code)}
                                {getTutorGenderLabel(tut.gender)
                                  ? ` · ${getTutorGenderLabel(tut.gender)}`
                                  : ""}
                              </p>
                              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                                <BadgeCheck className="h-4 w-4 text-[color:var(--brand-teal)]" />
                                {tut.university ?? tut.highschool ?? "Education details"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-1 flex-col space-y-4 p-4">
                          <div className="flex flex-wrap gap-2">
                            {tut.subjects.slice(0, 3).map((subject) => (
                              <span
                                key={subject}
                                className="rounded-sm bg-[color:var(--brand-teal)]/10 px-2.5 py-1 text-xs font-semibold text-[color:var(--brand-navy)]"
                              >
                                {subject}
                              </span>
                            ))}
                          </div>

                          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                            {tut.headline ??
                              tut.bio ??
                              "Experienced tutor profile with subject-specific support."}
                          </p>

                          <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-sm">
                            <div>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Lesson Mode
                              </p>
                              <p className="mt-1 inline-flex items-center gap-1.5 font-semibold text-foreground">
                                <BookOpen className="h-4 w-4 text-[color:var(--brand-teal)]" />
                                {getTutorLessonModeLabel(tut.lesson_mode)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs uppercase tracking-wide text-muted-foreground">
                                Tutoring Experience
                              </p>
                              <p className="mt-1 inline-flex items-center gap-1.5 font-semibold text-foreground">
                                <Clock3 className="h-4 w-4 text-[color:var(--brand-teal)]" />
                                {tut.experience_years ? `${tut.experience_years} years` : "N/A"}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between border-t border-border bg-white px-4 py-3">
                          <p className="text-2xl font-black text-[color:var(--brand-navy)]">
                            HK${tut.hourly_rate}
                            <span className="ml-1 text-sm font-semibold text-muted-foreground">
                              / hour
                            </span>
                          </p>
                          <Button
                            asChild
                            className="rounded-sm bg-[color:var(--brand-teal)] px-4 font-bold text-white hover:bg-[color:var(--brand-royal)]"
                          >
                            <Link
                              to="/tutors/$tutorCode"
                              params={{ tutorCode: tut.tutor_code }}
                              onClick={() => blurActive()}
                            >
                              View Tutor
                            </Link>
                          </Button>
                        </div>
                      </article>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-2 top-1/2 -translate-y-1/2 md:-left-4" />
                <CarouselNext className="right-2 top-1/2 -translate-y-1/2 md:-right-4" />
              </Carousel>
            )}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-5xl md:text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
              {t("how.title")}
            </h2>
          </div>
          <div className="mt-16 grid gap-8 md:gap-6 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="group relative overflow-hidden rounded-3xl md:rounded-sm border border-border/80 bg-card/95 p-10 md:p-8 shadow-[0_10px_24px_rgba(4,19,68,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--brand-teal)]/45 hover:shadow-brand"
              >
                <div
                  className="relative mb-8 md:mb-6 flex h-16 w-16 md:h-14 md:w-14 items-center justify-center rounded-2xl md:rounded-md bg-brand-gradient text-3xl md:text-2xl font-black text-white shadow-teal"
                  aria-hidden="true"
                >
                  {n}
                </div>
                <h3 className="text-3xl md:text-xl font-black md:font-bold text-foreground">
                  {t(`how.step${n}_title`)}
                </h3>
                <p className="mt-4 md:mt-3 text-lg md:text-sm leading-relaxed text-muted-foreground font-medium md:font-normal">
                  {t(`how.step${n}_desc`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="pb-20 md:pb-28 pt-10 md:pt-0">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="relative overflow-hidden rounded-3xl md:rounded-sm bg-[color:var(--brand-navy)] p-10 sm:p-14">
            <div
              aria-hidden
              className="absolute inset-0 opacity-40"
              style={{
                background: "radial-gradient(ellipse at top right, #2ED5DE 0%, transparent 60%)",
              }}
            />
            <div className="relative flex flex-col items-start justify-between gap-8 md:gap-6 sm:flex-row sm:items-center">
              <div className="max-w-xl">
                <h3 className="text-4xl md:text-3xl font-black text-white sm:text-4xl">
                  {t("tutors_cta.title")}
                </h3>
                <p className="mt-4 md:mt-3 text-lg md:text-base font-medium md:font-normal text-white/80">
                  {t("tutors_cta.subtitle")}
                </p>
              </div>
              <Button
                asChild
                size="lg"
                className="h-16 md:h-14 w-full md:w-auto rounded-2xl md:rounded-md bg-white px-8 text-lg md:text-base font-bold text-[color:var(--brand-navy)] hover:bg-white/90"
              >
                <Link to="/become-a-tutor">
                  {t("tutors_cta.cta")}
                  <ArrowRight className="ml-2 h-6 w-6 md:h-5 md:w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
