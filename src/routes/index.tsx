import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, UserPlus } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { LessonModeSelect } from "@/components/ui/lesson-mode-select";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import { TutorSaveButton } from "@/features/tutors/saved-tutors";
import { buildTutorWhatsAppUrl } from "@/features/tutors/tutor-display";
import { blurActive } from "@/lib/dom";
import {
  fetchPublishedTutors,
  fetchTopWeeklyTutors,
  fetchLandingStats,
  fetchTutorByCode,
  HK_DISTRICTS,
  matchesDistrictFilter,
  matchesLessonModeFilter,
} from "@/features/tutors/queries";
import { DEFAULT_SUBJECT_OPTIONS, matchesSubjectQuery } from "@/features/tutors/subjects";
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
      { property: "og:url", content: "https://matchmax.hk/" },
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
      { rel: "canonical", href: "https://matchmax.hk/" },
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

  const { data: publishedTutors = [], isLoading: publishedTutorsLoading } = useQuery({
    queryKey: ["landing", "published_tutors"],
    queryFn: fetchPublishedTutors,
  });

  const { data: whatsappNumber = "" } = useQuery({
    queryKey: ["settings", "whatsapp_number"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "whatsapp_number")
        .maybeSingle();
      if (error) throw error;
      const value = data?.value;
      return typeof value === "string" ? value : "";
    },
  });

  const defaultHeroTutor = pickedHeroTutor ?? featuredTutors[0] ?? publishedTutors[0] ?? null;

  const heroTutor = useMemo(() => {
    return defaultHeroTutor;
  }, [defaultHeroTutor]);

  const openTutorDetail = (tutorCode: string) => {
    navigate({ to: "/tutors/$tutorCode", params: { tutorCode } });
  };

  const subjectOptions = DEFAULT_SUBJECT_OPTIONS;

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

    return publishedTutors
      .filter((tut) => {
        if (categoryFilter) {
          const categorySource = [...tut.subjects, ...tut.target_students, tut.headline ?? ""]
            .join(" ")
            .toLowerCase();
          if (!categorySource.includes(categoryFilter)) return false;
        }
        if (subjectFilter && !tut.subjects.some((s) => matchesSubjectQuery(s, subjectFilter)))
          return false;
        if (!matchesLessonModeFilter(modeFilter, tut.lesson_mode)) return false;
        if (!matchesDistrictFilter(districtFilter, tut.district)) return false;
        if (genderFilter && (tut.gender ?? "") !== genderFilter) return false;
        if (
          query &&
          !(
            tut.tutor_code.toLowerCase().includes(query) ||
            tut.subjects.some((s) => matchesSubjectQuery(s, query)) ||
            (tut.headline ?? "").toLowerCase().includes(query)
          )
        ) {
          return false;
        }
        return true;
      })
      .slice(0, 6);
  }, [homeSearch, publishedTutors]);

  // JSON-LD
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "MatchMax",
    url: "https://matchmax.hk/",
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
              url: `https://matchmax.hk/tutors/${tut.tutor_code}`,
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
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 pt-6 pb-12 md:px-6 md:pt-24 md:pb-28 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col justify-center">
            <p className="font-serif text-lg italic tracking-wide text-[color:var(--brand-navy)]/75 md:text-xl">
              Hong Kong&apos;s tutor network
            </p>
            <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-tight text-[color:var(--brand-navy)] sm:text-5xl md:text-6xl lg:text-7xl">
              {t("hero.title_a")}
              <br />
              <span className="text-[color:var(--brand-navy)]">{t("hero.title_b")}</span>
            </h1>
            <div className="mt-6 flex flex-wrap gap-3 md:mt-10">
              <Button
                asChild
                size="lg"
                className="h-12 w-full rounded-xl bg-[color:var(--brand-navy)] px-5 text-base font-bold text-white shadow-brand hover:bg-[color:var(--brand-royal)] md:h-14 md:w-auto md:rounded-md md:px-8 md:text-lg"
              >
                <Link
                  to="/tutors"
                  onClick={(event) => {
                    event.stopPropagation();
                    blurActive();
                  }}
                >
                  {t("hero.cta_primary")}
                  <ArrowRight className="ml-2 h-6 w-6 md:h-5 md:w-5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="relative -mt-4 pb-14 md:-mt-7 md:pb-16">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="relative rounded-sm border border-border bg-card p-2.5 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5 sm:pb-4">
              <p className="text-xs font-black uppercase tracking-wide text-[color:var(--brand-navy)] sm:text-sm">
                Find tutor
              </p>
            </div>

            <div className="mt-2.5 grid gap-2 sm:gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
              <div className="relative hidden md:block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-9 rounded-sm pl-9 text-xs md:h-11 md:text-sm"
                  placeholder="Search tutor code, subject, keyword…"
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
                className="h-9 rounded-sm text-xs md:h-11 md:text-sm"
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
                className="h-9 rounded-sm text-xs md:h-11 md:text-sm"
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
                className="h-9 rounded-sm text-xs md:h-11 md:text-sm"
              />
              <SearchableSelect
                value={homeSearch.gender ?? ""}
                onChange={(v) => setHomeSearchParam({ gender: v || undefined })}
                options={HOME_GENDER_OPTIONS}
                placeholder="Any gender"
                className="h-9 rounded-sm text-xs md:h-11 md:text-sm"
              />
              <Button
                className="h-9 rounded-sm bg-[color:var(--brand-navy)] px-4 text-xs font-bold text-white hover:bg-[color:var(--brand-royal)] md:h-11 md:px-6 md:text-base"
                onClick={() => navigate({ to: "/tutors", search: tutorSearchParams })}
              >
                <Search className="mr-1.5 h-3.5 w-3.5 md:h-4 md:w-4" />
                Search
              </Button>
            </div>
          </div>

          <div className="mt-6">
            {publishedTutorsLoading && (
              <div className="flex gap-4 overflow-hidden">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton
                    key={i}
                    className="h-[23rem] w-[min(86vw,370px)] shrink-0 rounded-sm border border-border"
                  />
                ))}
              </div>
            )}

            {!publishedTutorsLoading && previewTutors.length === 0 && (
              <div className="rounded-sm border border-dashed border-border bg-card p-12 text-center">
                <p className="text-lg font-bold text-[color:var(--brand-navy)]">
                  No tutors match your filters yet
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try widening your search, then tap Search to view all matching tutors.
                </p>
              </div>
            )}

            {!publishedTutorsLoading && previewTutors.length > 0 && (
              <div className="group relative overflow-hidden py-2">
                <div className="landing-tutor-marquee flex w-max gap-4 pr-4 group-hover:[animation-play-state:paused] md:gap-6 md:pr-6">
                  {[...previewTutors, ...previewTutors].map((tut, index) => (
                    <div
                      key={`${tut.id}-${index}`}
                      className="w-[min(86vw,370px)] shrink-0 md:w-[350px] xl:w-[370px]"
                    >
                      <PublicTutorCard
                        tutor={tut}
                        priceSuffix={t("featured.per_hour")}
                        onOpen={openTutorDetail}
                        footerAction={
                          <>
                            <TutorSaveButton tutorId={tut.id} />
                            <Button
                              asChild
                              className="h-9 rounded-sm bg-[#0A245F] px-4 text-[13px] font-bold text-white hover:bg-[#081d4f]"
                            >
                              <a
                                href={buildTutorWhatsAppUrl(whatsappNumber, tut.tutor_code)}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(event) => event.stopPropagation()}
                              >
                                Request tutor
                              </a>
                            </Button>
                          </>
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="pb-12 md:pb-22">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <p className="font-serif text-lg italic tracking-wide text-[color:var(--brand-navy)]/75 md:text-xl">
            Keep your options open
          </p>
          <h2 className="mt-2 text-xl font-black tracking-tight text-[color:var(--brand-navy)] md:text-2xl">
            Save your shortlist
          </h2>

          <div className="mt-4">
            <article className="saved-posts-reserve-card overflow-hidden rounded-3xl md:rounded-sm">
              <div className="grid min-h-[430px] gap-0 md:min-h-[520px]">
                <div className="flex flex-col justify-between gap-4 p-4 sm:p-6 md:p-10">
                  <div>
                    <h2 className="mt-2 max-w-xl text-xl font-black leading-[1.05] tracking-tight text-[color:var(--brand-navy)] sm:text-2xl md:mt-5 md:text-[2.75rem]">
                      Keep your favorite tutors close
                    </h2>
                    <p className="mt-3 max-w-xl text-xs leading-relaxed text-muted-foreground sm:text-sm md:mt-5 md:text-[1.04rem]">
                      Bookmark tutors from the directory so you can compare your shortlist and come
                      back when you are ready to request a lesson.
                    </p>

                    <div className="mt-4 grid gap-2.5 sm:mt-6 sm:grid-cols-2">
                      <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-[0_8px_20px_rgba(4,19,68,0.04)] md:rounded-sm">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Save profiles
                        </p>
                        <p className="mt-1 text-sm font-black text-[color:var(--brand-navy)] sm:text-lg">
                          Build your shortlist
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground sm:text-sm">
                          Keep promising tutor profiles in one place while you decide.
                        </p>
                      </div>
                      <div className="rounded-xl border border-border bg-card px-4 py-3 shadow-[0_8px_20px_rgba(4,19,68,0.04)] md:rounded-sm">
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
                          Return anytime
                        </p>
                        <p className="mt-1 text-sm font-black text-[color:var(--brand-navy)] sm:text-lg">
                          Request when ready
                        </p>
                        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground sm:text-sm">
                          Open a saved profile and contact the tutor when the time is right.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <Button
                      asChild
                      size="lg"
                      className="h-11 w-full rounded-xl bg-[color:var(--brand-navy)] px-4 text-sm font-bold text-white hover:bg-[color:var(--brand-royal)] md:h-12 md:w-auto md:rounded-sm md:px-8 md:text-base"
                    >
                      <Link to="/saved-posts">View saved posts</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* FINDING A TUTOR / TUTOR CTA */}
      <section id="how" className="py-12 md:py-24">
        <div className="mx-auto max-w-7xl space-y-8 px-4 md:space-y-12 md:px-6">
          <div className="grid items-center gap-6 md:gap-12 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <p className="font-serif text-lg italic tracking-wide text-[color:var(--brand-navy)]/75 md:text-xl">
                Find the right fit
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-[color:var(--brand-navy)] md:text-4xl">
                {t("how.step1_title")}
              </h2>
              <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-muted-foreground md:mt-4 md:text-lg md:font-normal">
                {t("how.step1_desc")}
              </p>
              <Button
                asChild
                size="lg"
                className="mt-5 h-11 w-full rounded-xl bg-[color:var(--brand-navy)] px-4 text-sm font-bold text-white hover:bg-[color:var(--brand-royal)] md:mt-8 md:h-12 md:w-auto md:rounded-md md:px-8 md:text-base"
              >
                <Link to="/tutors">
                  <Search className="mr-2 h-4 w-4" />
                  {t("how.cta_find")}
                </Link>
              </Button>
            </div>
            <div className="order-1 lg:order-2">
              <div className="landing-tutor-visual landing-tutor-visual--dots" aria-hidden="true" />
            </div>
          </div>

          <div className="grid items-center gap-6 md:gap-12 lg:grid-cols-2">
            <div>
              <div className="overflow-hidden rounded-2xl bg-white">
                <img
                  src="/tutor-matching-network.jpeg"
                  alt="Tutor and student matching network"
                  className="h-auto w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
            <div>
              <p className="font-serif text-lg italic tracking-wide text-[color:var(--brand-navy)]/75 md:text-xl">
                For ambitious tutors
              </p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-[color:var(--brand-navy)] md:text-4xl">
                {t("tutors_cta.title")}
              </h3>
              <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-muted-foreground md:mt-4 md:text-lg md:font-normal">
                {t("tutors_cta.subtitle")}
              </p>
              <Button
                asChild
                size="lg"
                className="mt-5 h-11 w-full rounded-xl bg-[color:var(--brand-navy)] px-4 text-sm font-bold text-white hover:bg-[color:var(--brand-royal)] md:mt-8 md:h-12 md:w-auto md:rounded-md md:px-8 md:text-base"
              >
                <Link to="/join">
                  <UserPlus className="mr-2 h-4 w-4" />
                  {t("tutors_cta.cta")}
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
