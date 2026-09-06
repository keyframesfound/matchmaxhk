import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { LessonModeSelect } from "@/components/ui/lesson-mode-select";
import { AmountReadout, AmountSlider } from "@/components/ui/amount-slider";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import { TutorSaveButton } from "@/features/tutors/saved-tutors";
import Hero08, { Hero08Cards, type Hero08Avatar, type Hero08Card } from "@/components/ui/hero-08";
import { buildTutorWhatsAppUrl } from "@/features/tutors/tutor-display";
import {
  fetchPublishedTutors,
  fetchTopWeeklyTutors,
  fetchTutorByCode,
  getTutorCardHighlights,
  HK_DISTRICTS,
} from "@/features/tutors/queries";
import {
  DEFAULT_SUBJECT_OPTIONS,
  getSubjectOptionsForCategory,
  matchesCategoryFilter,
} from "@/features/tutors/subjects";
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
  max_price?: number;
};

const PRICE_MIN = 100;
const PRICE_MAX = 1200;
const PRICE_STEP = 10;
const PRICE_STOPS = [100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200];

const CURRICULUM_CATEGORIES = [
  { label: "IBDP", value: "IB" },
  { label: "DSE", value: "DSE" },
  { label: "IGCSE", value: "IGCSE" },
  { label: "A Levels", value: "A-Level" },
  { label: "Examiner/pro teachers", value: "International" },
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
      return typeof data?.value === "string" ? data.value : "";
    },
  });

  const defaultHeroTutor = pickedHeroTutor ?? featuredTutors[0] ?? null;

  const heroTutor = useMemo(() => {
    return defaultHeroTutor;
  }, [defaultHeroTutor]);

  const tutorsForCategory = (category: string) =>
    publishedTutors
      .filter((tutor) =>
        matchesCategoryFilter(category, tutor.subjects, [
          ...tutor.target_students,
          ...getTutorCardHighlights(tutor),
        ]),
      )
      .slice(0, 6);

  const heroAvatars = useMemo<Hero08Avatar[]>(
    () =>
      featuredTutors
        .filter((tutor) => tutor.photo_url)
        .slice(0, 3)
        .map((tutor) => ({
          src: tutor.photo_url as string,
          fallback: (tutor.display_name || tutor.tutor_code).slice(0, 2).toUpperCase(),
        })),
    [featuredTutors],
  );

  const heroCards = useMemo<Hero08Card[]>(
    () => [
      {
        title: t("search_panel.find_tutor"),
        subtitle: t("hero.card_find_subtitle"),
        image:
          "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=1200&auto=format&fit=crop",
        imageAlt: t("search_panel.find_tutor"),
        invert: true,
        cta: {
          ctaEnabled: true,
          text: t("hero.cta_primary"),
          link: "/tutors",
          size: "default",
        },
      },
      {
        title: t("tutors_cta.title"),
        subtitle: t("tutors_cta.subtitle"),
        image:
          "https://images.unsplash.com/photo-1577896851231-70ef18881754?q=80&w=1200&auto=format&fit=crop",
        imageAlt: t("tutors_cta.title"),
        invert: true,
        cta: {
          ctaEnabled: true,
          text: t("tutors_cta.cta"),
          link: "/join",
          size: "default",
        },
      },
    ],
    [t],
  );

  const openTutorDetail = (tutorCode: string) => {
    navigate({ to: "/tutors/$tutorCode", params: { tutorCode } });
  };

  const homeSubjectOptions = useMemo(
    () => getSubjectOptionsForCategory(homeSearch.category) ?? DEFAULT_SUBJECT_OPTIONS,
    [homeSearch.category],
  );

  const homeCategoryOptions = useMemo(
    () => [
      { value: "", label: t("search_panel.any_category") },
      { value: "IB", label: "IB" },
      { value: "DSE", label: "DSE" },
      { value: "IGCSE", label: "IGCSE" },
      { value: "AP", label: "AP" },
      { value: "A-Level", label: "A-Level" },
      { value: "Primary", label: t("search_panel.category_primary") },
      { value: "Secondary", label: t("search_panel.category_secondary") },
      { value: "International", label: t("search_panel.category_international") },
    ],
    [t],
  );

  const homeGenderOptions = useMemo(
    () => [
      { value: "", label: t("search_panel.any_gender") },
      { value: "female", label: t("search_panel.gender_female") },
      { value: "male", label: t("search_panel.gender_male") },
    ],
    [t],
  );

  const handleHomeCategoryChange = (category: string) => {
    const nextSubjectOptions = getSubjectOptionsForCategory(category);
    setHomeSearchParam({
      category: category || undefined,
      ...(homeSearch.subject && !nextSubjectOptions.includes(homeSearch.subject)
        ? { subject: undefined }
        : {}),
    });
  };

  const tutorSearchParams = useMemo(() => {
    const params: HomeTutorSearchState = {
      category: homeSearch.category,
      subject: homeSearch.subject,
      mode: homeSearch.mode,
      gender: homeSearch.gender,
      q: homeSearch.q,
      max_price: homeSearch.max_price,
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

      {/* HERO */}
      <Hero08
        className="hero-startup-bg bg-transparent"
        title={`${t("hero.title_a")} ${t("hero.title_b")}`}
        description={t("hero.description")}
        socialProof={t("hero.eyebrow")}
        avatars={heroAvatars}
        animation="subtle"
      />

      <section className="relative -mt-4 pb-14 md:-mt-7 md:pb-16">
        <div className="mx-auto max-w-7xl px-4 md:px-6">
          <div className="relative rounded-sm border border-border bg-card p-4 shadow-sm sm:p-5">
            <form
              className="grid gap-3 lg:grid-cols-[1fr_1fr_1fr_1fr_auto]"
              onSubmit={(event) => {
                event.preventDefault();
                navigate({ to: "/tutors", search: tutorSearchParams });
              }}
            >
              <div className="relative lg:col-span-5">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 rounded-sm pl-9"
                  placeholder={t("search_panel.keyword_placeholder")}
                  aria-label={t("search_panel.keyword_aria")}
                  value={homeSearch.q ?? ""}
                  onChange={(e) => setHomeSearchParam({ q: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5 lg:col-span-5">
                <div className="flex shrink-0 items-baseline gap-2.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("search_panel.price_range")}
                  </p>
                  <AmountReadout
                    value={homeSearch.max_price ?? PRICE_MAX}
                    prefix="HK$"
                    className="text-base leading-none"
                  />
                </div>
                <AmountSlider
                  aria-label={t("search_panel.price_range")}
                  min={PRICE_MIN}
                  max={PRICE_MAX}
                  step={PRICE_STEP}
                  stops={PRICE_STOPS}
                  value={[homeSearch.max_price ?? PRICE_MAX]}
                  onValueChange={([next]) =>
                    setHomeSearchParam({
                      max_price: next && next < PRICE_MAX ? next : undefined,
                    })
                  }
                  className="w-full sm:flex-1"
                />
              </div>
              <SearchableSelect
                value={homeSearch.category ?? ""}
                onChange={handleHomeCategoryChange}
                options={homeCategoryOptions}
                placeholder={t("search_panel.any_category")}
                searchPlaceholder={t("search_panel.search_category")}
                className="h-11 rounded-sm"
              />
              <SearchableSelect
                value={homeSearch.subject ?? ""}
                onChange={(v) => setHomeSearchParam({ subject: v || undefined })}
                options={[
                  { value: "", label: t("search_panel.any_subject") },
                  ...homeSubjectOptions.map((s) => ({ value: s, label: s })),
                ]}
                placeholder={t("search_panel.any_subject")}
                searchPlaceholder={t("search_panel.search_subject")}
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
                placeholder={t("search_panel.any_mode")}
                className="h-11 rounded-sm"
              />
              <SearchableSelect
                value={homeSearch.gender ?? ""}
                onChange={(v) => setHomeSearchParam({ gender: v || undefined })}
                options={homeGenderOptions}
                placeholder={t("search_panel.any_gender")}
                className="h-11 rounded-sm"
              />
              <Button
                type="submit"
                variant="solid"
                color="blue"
                className="h-11 rounded-sm px-6 font-bold"
              >
                <Search className="mr-1.5 h-4 w-4" />
                {t("search_panel.search")}
              </Button>
            </form>
          </div>

          <div className="mt-8 space-y-10 md:mt-10 md:space-y-12">
            {CURRICULUM_CATEGORIES.map(({ label, value }) => {
              const tutors = tutorsForCategory(value);

              return (
                <section key={value}>
                  <div className="mb-4 flex items-center justify-between gap-4">
                    <h2 className="text-xl font-bold tracking-tight text-[color:var(--ink)] md:text-2xl">
                      {label} tutors
                    </h2>
                    <Button
                      asChild
                      variant="ghost"
                      className="h-9 shrink-0 rounded-full px-3 text-sm font-bold text-[color:var(--brand-link)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--ink)] sm:px-4"
                    >
                      <Link to="/tutors" search={{ category: value }}>
                        {t("featured.view_all")}
                        <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>

                  {publishedTutorsLoading ? (
                    <div className="-mx-4 flex gap-4 overflow-hidden px-4 md:mx-0 md:px-0">
                      {Array.from({ length: 3 }).map((_, index) => (
                        <Skeleton
                          key={index}
                          className="h-[23rem] w-[min(86vw,370px)] shrink-0 rounded-[10px] border border-border"
                        />
                      ))}
                    </div>
                  ) : tutors.length > 0 ? (
                    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:gap-6 md:px-0">
                      {tutors.map((tutor) => (
                        <div
                          key={tutor.id}
                          className="w-[min(86vw,370px)] shrink-0 snap-start md:w-[350px] xl:w-[370px]"
                        >
                          <PublicTutorCard
                            tutor={tutor}
                            priceSuffix={t("featured.per_hour")}
                            onOpen={openTutorDetail}
                            footerAction={
                              <>
                                <TutorSaveButton tutorId={tutor.id} compact />
                                <Button
                                  asChild
                                  className="h-9 rounded-sm px-4 text-[13px] font-bold shadow-none"
                                >
                                  <a
                                    href={buildTutorWhatsAppUrl(whatsappNumber, tutor.tutor_code)}
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
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINDING A TUTOR / TUTOR CTA */}
      <section id="how" className="py-12 md:py-24">
        <Hero08Cards cards={heroCards} animation="subtle" />
      </section>

      <SiteFooter />
    </div>
  );
}
