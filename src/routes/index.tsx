import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { 
  ArrowRight, BadgeCheck, MessageCircle, MapPin, 
  Globe, Search 
} from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { blurActive } from "@/lib/dom";
import { 
  fetchTopWeeklyTutors, fetchLandingStats, fetchTutorByCode, 
  getTutorGenderLabel, getTutorLessonModeLabel, getTutorLocationLabel, HK_DISTRICTS,
  type Tutor 
} from "@/features/tutors/queries";
import { DEFAULT_SUBJECT_OPTIONS } from "@/features/tutors/subjects";
import { supabase } from "@/integrations/supabase/client";

const OG_IMAGE = "https://storage.googleapis.com/gpt-engineer-file-uploads/8gNheRvRfCOczS8mI5H1ghF3qLL2/social-images/social-1784777386937-Untitled_design.webp";

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

const HOME_MODE_OPTIONS = [
  { value: "", label: "Any lesson mode" },
  { value: "online", label: "Online" },
  { value: "in_person", label: "In-person" },
  { value: "either", label: "Open to discussion" },
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
      { name: "description", content: "Find verified IB, DSE, IGCSE, AP and A-Level tutors in Hong Kong. Compare tutor profiles, lesson modes and pricing to get matched quickly." },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Find Verified IB, DSE & IGCSE Tutors in Hong Kong | MatchMax" },
      { property: "og:description", content: "Find verified IB, DSE, IGCSE, AP and A-Level tutors in Hong Kong. Compare tutor profiles, lesson modes and pricing to get matched quickly." },
      { property: "og:url", content: "https://www.maxmatch.app/" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "MatchMax" },
      { property: "og:locale", content: "en_HK" },
      { property: "og:image", content: OG_IMAGE },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "IB, DSE & IGCSE Tutors in Hong Kong | MatchMax" },
      { name: "twitter:description", content: "Find verified IB, HKDSE, IGCSE, AP, A-Level and international school tutors in Hong Kong." },
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
    ]
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

  const showHomeDistrict = homeSearch.mode === "in_person";

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

  // JSON-LD
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    name: "MatchMax",
    url: "https://www.maxmatch.app/",
    description: "Find verified IB, HKDSE, IGCSE, AP, A-Level and international school tutors in Hong Kong.",
    areaServed: {
      "@type": "City",
      name: "Hong Kong",
    },
  };

  const tutorListStructuredData = featuredTutors.length > 0 ? {
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
  } : null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
      {tutorListStructuredData && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(tutorListStructuredData) }} />
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
              <Button asChild size="lg" className="h-16 md:h-14 rounded-2xl md:rounded-md bg-[color:var(--brand-navy)] px-8 text-lg md:text-base font-bold text-white shadow-brand hover:bg-[color:var(--brand-royal)] w-full md:w-auto">
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
              <div className="absolute inset-0 rounded-2xl md:rounded-sm border border-border/50 bg-muted/30" aria-hidden />
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
                        <p className="text-xl md:text-sm font-black md:font-bold text-foreground break-words">{heroTutor.tutor_code}{getTutorGenderLabel(heroTutor.gender) ? ` · ${getTutorGenderLabel(heroTutor.gender)}` : ""}</p>
                        <p className="text-sm md:text-xs leading-relaxed text-muted-foreground break-words whitespace-pre-line">
                          {heroTutor.headline ?? heroTutor.subjects.slice(0, 3).join(" · ")}
                        </p>
                      </div>
                      <span className="rounded-lg md:rounded-md border border-[color:var(--brand-teal)]/15 bg-[color:var(--brand-teal)]/10 px-2.5 py-1 text-[11px] md:text-[10px] font-bold uppercase tracking-wider text-[color:var(--brand-teal)]">Featured</span>
                    </div>
                    
                    <div className="mt-8 md:mt-5 grid grid-cols-3 gap-3 rounded-xl md:rounded-md border border-border/70 bg-muted/50 p-5 md:p-4 text-center text-xs">
                      <div>
                        <p className="font-black md:font-bold text-2xl md:text-lg text-[color:var(--brand-navy)]">{heroTutor.tutor_code}</p>
                        <p className="text-[11px] md:text-[10px] font-bold md:font-normal uppercase tracking-wider text-muted-foreground">Code</p>
                      </div>
                      <div>
                        <p className="font-black md:font-bold text-2xl md:text-lg text-[color:var(--brand-navy)]">${heroTutor.hourly_rate}</p>
                        <p className="text-[11px] md:text-[10px] font-bold md:font-normal uppercase tracking-wider text-muted-foreground">/hr</p>
                      </div>
                      <div>
                        <p className="font-black md:font-bold text-2xl md:text-lg text-[color:var(--brand-navy)]">{heroTutor.experience_years ? `${heroTutor.experience_years}+ yrs` : "New"}</p>
                        <p className="text-[11px] md:text-[10px] font-bold md:font-normal uppercase tracking-wider text-muted-foreground">Experience</p>
                      </div>
                    </div>
                    
                    <div className="mt-5 rounded-xl md:rounded-md border border-border/70 bg-muted/40 p-5 md:p-4">
                      <div className="space-y-3 md:space-y-2">
                        {[
                          heroTutor.badge,
                          heroTutor.district,
                          heroTutor.experience_years ? `${heroTutor.experience_years}+ years` : null,
                          heroTutor.subjects[0] ?? null,
                        ]
                          .filter((x): x is string => !!x)
                          .slice(0, 4)
                          .map((tag) => (
                            <div key={tag} className="flex items-center gap-3 md:gap-2 text-sm md:text-xs text-muted-foreground font-medium md:font-normal">
                              <BadgeCheck className="h-5 w-5 md:h-3.5 md:w-3.5 text-[color:var(--brand-teal)]" />
                              {tag}
                            </div>
                          ))}
                      </div>
                    </div>
                    
                    <Button asChild className="mt-8 md:mt-6 w-full rounded-xl md:rounded-lg bg-[color:var(--brand-navy)] py-6 md:py-3 text-lg md:text-sm font-bold text-white hover:bg-[color:var(--brand-royal)]">
                      <Link to="/tutors/$tutorCode" params={{ tutorCode: heroTutor.tutor_code }}>
                        <MessageCircle className="mr-2 inline h-5 w-5 md:h-4 md:w-4" /> View tutor profile
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
          <div className="rounded-3xl border border-border bg-card p-4 shadow-[0_12px_30px_rgba(4,19,68,0.08)] sm:p-5">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
              <p className="text-sm font-black uppercase tracking-wide text-[color:var(--brand-teal)]">Find tutor</p>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 rounded-xl pl-9"
                  placeholder="Search tutor code, subject, keyword..."
                  value={homeSearch.q ?? ""}
                  onChange={(e) => setHomeSearchParam({ q: e.target.value })}
                />
              </div>
              <SearchableSelect
                value={homeSearch.category ?? ""}
                onChange={(v) => setHomeSearchParam({ category: v || undefined })}
                options={HOME_CATEGORY_OPTIONS}
                placeholder="Category"
                searchPlaceholder="Search category..."
              />
              <SearchableSelect
                value={homeSearch.subject ?? ""}
                onChange={(v) => setHomeSearchParam({ subject: v || undefined })}
                options={[{ value: "", label: "Any subject" }, ...subjectOptions.map((s) => ({ value: s, label: s }))]}
                placeholder="Subject"
                searchPlaceholder="Search subject..."
              />
              <SearchableSelect
                value={homeSearch.mode ?? ""}
                onChange={(v) => {
                  const nextMode = v || undefined;
                  setHomeSearchParam({
                    mode: nextMode,
                    district: nextMode === "in_person" ? homeSearch.district : undefined,
                  });
                }}
                options={HOME_MODE_OPTIONS}
                placeholder="Lesson mode"
              />
              <SearchableSelect
                value={homeSearch.gender ?? ""}
                onChange={(v) => setHomeSearchParam({ gender: v || undefined })}
                options={HOME_GENDER_OPTIONS}
                placeholder="Gender"
              />
              <Button
                className="h-11 rounded-xl bg-[color:var(--brand-navy)] px-6 font-bold text-white hover:bg-[color:var(--brand-royal)]"
                onClick={() => navigate({ to: "/tutors", search: tutorSearchParams })}
              >
                Search
              </Button>
            </div>

            {showHomeDistrict && (
              <div className="mt-3 grid gap-3 sm:grid-cols-1 md:max-w-sm">
                <SearchableSelect
                  value={homeSearch.district ?? ""}
                  onChange={(v) => setHomeSearchParam({ district: v || undefined })}
                  options={[{ value: "", label: "Any district" }, ...HK_DISTRICTS.map((d) => ({ value: d, label: d }))]}
                  placeholder="District (for in-person)"
                  searchPlaceholder="Search district..."
                />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* FEATURED TUTORS */}
      <section id="tutors" className="py-20 md:py-28 bg-muted/10">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-5xl md:text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">{t("featured.title")}</h2>
              <p className="mt-4 md:mt-3 text-xl md:text-lg text-muted-foreground">{t("featured.subtitle")}</p>
            </div>
            <Button asChild variant="outline" className="font-bold h-12 md:h-10 px-6 md:px-4 rounded-xl md:rounded-md w-full md:w-auto mt-4 md:mt-0">
              <Link to="/tutors" onClick={() => blurActive()}>{t("featured.view_all")} <ArrowRight className="ml-2 h-5 w-5 md:h-4 md:w-4" /></Link>
            </Button>
          </div>
          
          {featuredLoading && (
            <p className="mt-10 text-center text-muted-foreground">{t("common.loading")}</p>
          )}
          {!featuredLoading && featuredTutors.length === 0 && (
            <p className="mt-10 text-center text-muted-foreground">{t("common.no_tutors_yet")}</p>
          )}
          
          <div className="mt-12 md:mt-10 grid gap-8 md:gap-6 md:grid-cols-3">
            {featuredTutors.map((tut) => (
              <Link
                key={tut.id}
                to="/tutors/$tutorCode"
                params={{ tutorCode: tut.tutor_code }}
                className="block rounded-3xl md:rounded-sm border border-border/80 bg-card p-8 md:p-6 shadow-[0_8px_24px_rgba(4,19,68,0.05)] transition-all hover:-translate-y-0.5 hover:border-[color:var(--brand-teal)]/30 hover:shadow-[0_12px_30px_rgba(4,19,68,0.08)]"
                onClick={() => blurActive()}
              >
                <div className="flex items-center gap-5 md:gap-4">
                  {tut.photo_url ? (
                    <img
                      src={tut.photo_url}
                      alt="Tutor"
                      loading="lazy"
                      className="h-16 w-16 md:h-14 md:w-14 shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-16 w-16 md:h-14 md:w-14 shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-teal)]/20 bg-[color:var(--brand-teal)]/10 text-xl md:text-base font-bold md:font-semibold text-[color:var(--brand-teal)]">
                      {tut.tutor_code?.slice(0, 2).toUpperCase() || "TP"}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-xl md:text-base font-black md:font-bold text-foreground break-words">{tut.tutor_code}{getTutorGenderLabel(tut.gender) ? ` · ${getTutorGenderLabel(tut.gender)}` : ""}</p>
                    <p className="text-base md:text-sm leading-relaxed text-muted-foreground break-words whitespace-pre-line font-medium md:font-normal">{tut.headline ?? getTutorLessonModeLabel(tut.lesson_mode)}</p>
                  </div>
                </div>
                
                <div className="mt-5 md:mt-3 flex flex-wrap gap-2 md:gap-2">
                  {tut.subjects.slice(0, 3).map((subject) => (
                    <span key={subject} className="rounded-full bg-muted px-3 py-1.5 md:px-2.5 md:py-1 text-xs md:text-[11px] font-bold md:font-medium text-muted-foreground">
                      {subject}
                    </span>
                  ))}
                  {tut.subjects.length > 3 && (
                    <span className="rounded-full bg-muted px-3 py-1.5 md:px-2.5 md:py-1 text-xs md:text-[11px] font-bold md:font-medium text-muted-foreground">
                      +{tut.subjects.length - 3} more
                    </span>
                  )}
                </div>
                
                {tut.badge && (
                  <div className="mt-5 md:mt-4 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 md:gap-1 rounded-full bg-[color:var(--brand-teal)]/10 px-3 py-1.5 md:px-2.5 md:py-1 text-xs md:text-[11px] font-bold text-[color:var(--brand-teal)]">
                      <BadgeCheck className="h-4 w-4 md:h-3 md:w-3" /> {tut.badge}
                    </span>
                  </div>
                )}
                
                <div className="mt-6 md:mt-5 flex items-center justify-between border-t border-border pt-5 md:pt-4 text-base md:text-sm">
                  <span className="inline-flex items-center gap-2 md:gap-1 font-bold md:font-normal text-muted-foreground">
                    {tut.lesson_mode === "online" ? <Globe className="h-5 w-5 md:h-4 md:w-4" aria-hidden="true" /> : <MapPin className="h-5 w-5 md:h-4 md:w-4" aria-hidden="true" />}
                    {getTutorLocationLabel(tut)}
                  </span>
                </div>
                
                <p className="mt-6 md:mt-4 text-4xl md:text-2xl font-black text-[color:var(--brand-navy)]">
                  HK${tut.hourly_rate}
                  <span className="ml-1.5 md:ml-1 text-base md:text-sm font-bold md:font-semibold text-muted-foreground">{t("featured.per_hour")}</span>
                </p>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-5xl md:text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">{t("how.title")}</h2>
          </div>
          <div className="mt-16 grid gap-8 md:gap-6 md:grid-cols-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="group relative overflow-hidden rounded-3xl md:rounded-sm border border-border/80 bg-card/95 p-10 md:p-8 shadow-[0_10px_24px_rgba(4,19,68,0.05)] transition-all duration-300 hover:-translate-y-1 hover:border-[color:var(--brand-teal)]/45 hover:shadow-brand"
              >
                <div className="relative mb-8 md:mb-6 flex h-16 w-16 md:h-14 md:w-14 items-center justify-center rounded-2xl md:rounded-md bg-brand-gradient text-3xl md:text-2xl font-black text-white shadow-teal" aria-hidden="true">
                  {n}
                </div>
                <h3 className="text-3xl md:text-xl font-black md:font-bold text-foreground">{t(`how.step${n}_title`)}</h3>
                <p className="mt-4 md:mt-3 text-lg md:text-sm leading-relaxed text-muted-foreground font-medium md:font-normal">{t(`how.step${n}_desc`)}</p>
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
              style={{ background: "radial-gradient(ellipse at top right, #2ED5DE 0%, transparent 60%)" }}
            />
            <div className="relative flex flex-col items-start justify-between gap-8 md:gap-6 sm:flex-row sm:items-center">
              <div className="max-w-xl">
                <h3 className="text-4xl md:text-3xl font-black text-white sm:text-4xl">{t("tutors_cta.title")}</h3>
                <p className="mt-4 md:mt-3 text-lg md:text-base font-medium md:font-normal text-white/80">{t("tutors_cta.subtitle")}</p>
              </div>
              <Button asChild size="lg" className="h-16 md:h-14 w-full md:w-auto rounded-2xl md:rounded-md bg-white px-8 text-lg md:text-base font-bold text-[color:var(--brand-navy)] hover:bg-white/90">
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