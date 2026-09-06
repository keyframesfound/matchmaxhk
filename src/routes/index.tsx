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
import { AmountReadout, AmountSlider } from "@/components/ui/amount-slider";
import { Accordion05 } from "@/components/ui/accordion-05";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import { TutorSaveButton } from "@/features/tutors/saved-tutors";
import { buildTutorWhatsAppUrl } from "@/features/tutors/tutor-display";
import { blurActive } from "@/lib/dom";
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

  const howAccordionItems = useMemo(
    () =>
      [
        { id: "1", title: t("how_accordion.item1_title"), content: t("how_accordion.item1_desc") },
        { id: "2", title: t("how_accordion.item2_title"), content: t("how_accordion.item2_desc") },
        { id: "3", title: t("how_accordion.item3_title"), content: t("how_accordion.item3_desc") },
        { id: "4", title: t("how_accordion.item4_title"), content: t("how_accordion.item4_desc") },
        { id: "5", title: t("how_accordion.item5_title"), content: t("how_accordion.item5_desc") },
      ] satisfies { id: string; title: string; content: string }[],
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

      {/* HERO SECTION */}
      <section className="hero-startup-bg relative overflow-hidden">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-4 pt-6 pb-12 md:px-6 md:pt-24 md:pb-28 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col justify-center">
            <h1 className="mt-3 text-4xl font-extrabold leading-[1.05] tracking-tight text-[color:var(--ink)] sm:text-5xl md:text-6xl lg:text-7xl">
              {t("hero.title_a")}
              <br />
              <span className="text-[color:var(--ink)]">{t("hero.title_b")}</span>
            </h1>
            <div className="mt-6 flex flex-wrap gap-3 md:mt-8">
              <Button
                asChild
                size="lg"
                variant="solid"
                color="blue"
                className="h-12 w-full rounded-xl px-5 text-base font-bold shadow-brand md:h-14 md:w-auto md:rounded-md md:px-8 md:text-lg"
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

      {/* FINDING A TUTOR / MATCHING */}
      <section id="how" className="py-12 md:py-24">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-8 px-4 md:gap-10 md:px-6">
          <Accordion05 items={howAccordionItems} defaultValue="1" />
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              variant="solid"
              color="blue"
              className="h-11 rounded-xl px-6 text-sm font-bold md:h-12 md:rounded-md md:px-8 md:text-base"
            >
              <Link to="/tutors">
                <Search className="mr-2 h-4 w-4" />
                {t("how.cta_find")}
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-11 rounded-xl px-6 text-sm font-bold md:h-12 md:rounded-md md:px-8 md:text-base"
            >
              <Link to="/join">
                <UserPlus className="mr-2 h-4 w-4" />
                {t("tutors_cta.cta")}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
