import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Search, UserPlus } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { WhatsAppIcon } from "@/components/layout/WhatsAppFloatButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { LessonModeSelect } from "@/components/ui/lesson-mode-select";
import { AmountReadout, AmountSlider } from "@/components/ui/amount-slider";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import { TutorSaveButton } from "@/features/tutors/saved-tutors";
import { buildTutorWhatsAppUrl } from "@/features/tutors/tutor-display";
import {
  fetchPublishedTutors,
  fetchTopWeeklyTutors,
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
  min_price?: number;
  max_price?: number;
  sort?: string;
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

  const homeSortOptions = useMemo(
    () => [
      { value: "", label: t("search_panel.sort_recommended") },
      { value: "price_asc", label: t("search_panel.sort_price_asc") },
      { value: "price_desc", label: t("search_panel.sort_price_desc") },
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
      min_price: homeSearch.min_price,
      max_price: homeSearch.max_price,
      sort: homeSearch.sort,
    };
    if (homeSearch.mode === "in_person") {
      params.district = homeSearch.district;
    }
    return params;
  }, [homeSearch]);

  const hotlineUrl = buildTutorWhatsAppUrl(whatsappNumber, "");

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

      <section className="relative min-h-[min(58vh,560px)] border-b border-[color:var(--ink)]/10 bg-[color:var(--surface-subtle)] px-4 pb-12 pt-10 sm:px-6 sm:pt-14 md:pb-16 md:pt-20">
        <div className="mx-auto flex max-w-7xl flex-col justify-center">
          <div className="mb-7 max-w-xl">
            <p className="text-sm font-bold uppercase tracking-[0.16em] text-[color:var(--brand-link)]">
              MatchMax
            </p>
            <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-[color:var(--ink)] sm:text-5xl">
              {t("search_panel.find_tutor")}
            </h1>
            <p className="mt-3 text-base text-[color:var(--ink)]/65 sm:text-lg">
              Find the right subject expert for your next lesson.
            </p>
          </div>
        <div className="mx-auto max-w-[1440px] px-4 md:px-6">
          <div className="relative overflow-hidden rounded-[var(--radius-panel)] border border-[color:var(--ink)]/10 bg-[color:var(--surface)] shadow-[0_18px_50px_-28px_rgba(4,19,68,0.35)]">
            <form
              className="p-3 sm:p-4"
              onSubmit={(event) => {
                event.preventDefault();
                navigate({ to: "/tutors", search: tutorSearchParams });
              }}
            >
              <div className="grid gap-1 rounded-[calc(var(--radius-panel)-2px)] border border-[color:var(--ink)]/10 bg-[color:var(--surface)] p-1 md:grid-cols-[1.35fr_1fr_1fr_0.9fr_auto] md:items-center">
                <div className="relative min-h-16 rounded-[calc(var(--radius-panel)-4px)] px-4 py-3 transition-colors hover:bg-[color:var(--surface-subtle)]">
                  <label htmlFor="home-tutor-search" className="block text-xs font-bold text-[color:var(--ink)]">
                    Search
                  </label>
                  <Input
                    id="home-tutor-search"
                    className="h-7 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
                    placeholder={t("search_panel.keyword_placeholder")}
                    aria-label={t("search_panel.keyword_aria")}
                    value={homeSearch.q ?? ""}
                    onChange={(e) => setHomeSearchParam({ q: e.target.value })}
                  />
                </div>
                <div className="min-h-16 rounded-[calc(var(--radius-panel)-4px)] px-4 py-3 transition-colors hover:bg-[color:var(--surface-subtle)]">
                  <label className="block text-xs font-bold text-[color:var(--ink)]">Curriculum</label>
                  <SearchableSelect
                    value={homeSearch.category ?? ""}
                    onChange={handleHomeCategoryChange}
                    options={homeCategoryOptions}
                    placeholder={t("search_panel.any_category")}
                    searchPlaceholder={t("search_panel.search_category")}
                    className="mt-1 h-7 border-0 bg-transparent px-0 shadow-none"
                  />
                </div>
                <div className="min-h-16 rounded-[calc(var(--radius-panel)-4px)] px-4 py-3 transition-colors hover:bg-[color:var(--surface-subtle)]">
                  <label className="block text-xs font-bold text-[color:var(--ink)]">Subject</label>
                  <SearchableSelect
                    value={homeSearch.subject ?? ""}
                    onChange={(v) => setHomeSearchParam({ subject: v || undefined })}
                    options={[
                      { value: "", label: t("search_panel.any_subject") },
                      ...homeSubjectOptions.map((s) => ({ value: s, label: s })),
                    ]}
                    placeholder={t("search_panel.any_subject")}
                    searchPlaceholder={t("search_panel.search_subject")}
                    className="mt-1 h-7 border-0 bg-transparent px-0 shadow-none"
                  />
                </div>
                <div className="min-h-16 rounded-[calc(var(--radius-panel)-4px)] px-4 py-3 transition-colors hover:bg-[color:var(--surface-subtle)]">
                  <label className="block text-xs font-bold text-[color:var(--ink)]">Lesson mode</label>
                  <LessonModeSelect
                    mode={
                      (homeSearch.mode as "" | "online" | "in_person" | "either" | undefined) ?? ""
                    }
                    district={homeSearch.district}
                    districts={HK_DISTRICTS}
                    onChange={({ mode, district }) =>
                      setHomeSearchParam({
                        mode: mode || undefined,
                        district: mode === "in_person" ? district : undefined,
                      })
                    }
                    placeholder={t("search_panel.any_mode")}
                    className="mt-1 h-7 border-0 bg-transparent px-0 shadow-none"
                  />
                </div>
                <div className="min-h-16 rounded-[calc(var(--radius-panel)-4px)] px-4 py-3 transition-colors hover:bg-[color:var(--surface-subtle)]">
                  <label className="block text-xs font-bold text-[color:var(--ink)]">Gender</label>
                  <SearchableSelect
                    value={homeSearch.gender ?? ""}
                    onChange={(v) => setHomeSearchParam({ gender: v || undefined })}
                    options={homeGenderOptions}
                    placeholder={t("search_panel.any_gender")}
                    className="mt-1 h-7 border-0 bg-transparent px-0 shadow-none"
                  />
                </div>
                <Button type="submit" variant="solid" color="blue" className="h-14 rounded-full px-6 font-bold">
                  <Search className="mr-1.5 h-4 w-4" />
                  {t("search_panel.search")}
                </Button>
              </div>
            </form>
            <div className="grid gap-4 border-t border-border bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5 lg:grid-cols-[minmax(22rem,36rem)_14rem_auto] lg:items-center lg:gap-6">
              <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
                <div className="flex shrink-0 items-baseline gap-2.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    {t("search_panel.price_range")}
                  </p>
                  <AmountReadout
                    value={homeSearch.min_price ?? PRICE_MIN}
                    prefix="HK$"
                    className="text-base leading-none"
                  />
                  <span aria-hidden="true" className="text-xs text-muted-foreground">
                    –
                  </span>
                  <AmountReadout
                    value={homeSearch.max_price ?? PRICE_MAX}
                    prefix="HK$"
                    suffix={homeSearch.max_price === undefined ? "+" : undefined}
                    className="text-base leading-none"
                  />
                </div>
                <AmountSlider
                  aria-label={t("search_panel.price_range")}
                  min={PRICE_MIN}
                  max={PRICE_MAX}
                  step={PRICE_STEP}
                  stops={PRICE_STOPS}
                  minStepsBetweenThumbs={1}
                  thumbAriaLabels={["Minimum hourly rate", "Maximum hourly rate"]}
                  value={[homeSearch.min_price ?? PRICE_MIN, homeSearch.max_price ?? PRICE_MAX]}
                  onValueChange={([lo, hi]) =>
                    setHomeSearchParam({
                      min_price: lo && lo > PRICE_MIN ? lo : undefined,
                      max_price: hi && hi < PRICE_MAX ? hi : undefined,
                    })
                  }
                  className="w-full sm:flex-1"
                />
              </div>
              <SearchableSelect
                value={homeSearch.sort ?? ""}
                onChange={(sort) => setHomeSearchParam({ sort: sort || undefined })}
                options={homeSortOptions}
                placeholder={t("search_panel.sort_recommended")}
                searchPlaceholder={t("search_panel.search_sorting")}
                className="h-11 w-full rounded-sm sm:w-56 sm:shrink-0"
              />
              {hotlineUrl ? (
                <a
                  href={hotlineUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[color:var(--brand-whatsapp)] px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[color:var(--brand-whatsapp-hover)]"
                >
                  <WhatsAppIcon className="h-4 w-4" aria-hidden="true" />
                  WhatsApp us
                </a>
              ) : null}
            </div>
          </div>
        </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 md:py-14">
        <div className="mx-auto max-w-[1600px]">
          <div className="space-y-10 md:space-y-12">
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
                          className="h-[23rem] w-[min(86vw,370px)] shrink-0 rounded-[var(--radius-panel)] border border-border"
                        />
                      ))}
                    </div>
                  ) : tutors.length > 0 ? (
                    <div className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:gap-6 md:px-0">
                      {tutors.map((tutor) => (
                        <div
                          key={tutor.id}
                          className="w-[min(86vw,320px)] shrink-0 snap-start md:w-[300px] xl:w-[320px]"
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
                  ) : (
                    <p className="text-sm text-muted-foreground">{t("common.no_tutors_yet")}</p>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      </section>

      {/* FINDING A TUTOR / TUTOR CTA */}
      <section id="how" className="py-12 md:py-24">
        <div className="mx-auto max-w-7xl space-y-8 px-4 md:space-y-12 md:px-6">
          <div className="grid items-center gap-6 md:gap-12 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <h2 className="mt-2 text-2xl font-bold tracking-tight text-[color:var(--ink)] md:text-4xl">
                {t("how.step1_title")}
              </h2>
              <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-muted-foreground md:mt-4 md:text-lg md:font-normal">
                {t("how.step1_desc")}
              </p>
              <Button
                asChild
                size="lg"
                variant="solid"
                color="blue"
                className="mt-5 h-11 w-full rounded-xl px-4 text-sm font-bold md:mt-8 md:h-12 md:w-auto md:rounded-md md:px-8 md:text-base"
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
              <div className="overflow-hidden rounded-2xl bg-[color:var(--surface)]">
                <img
                  src="/tutor-matching-network.jpeg"
                  alt="Tutor and student matching network"
                  className="h-auto w-full object-cover"
                  loading="lazy"
                />
              </div>
            </div>
            <div>
              <h3 className="mt-2 text-2xl font-bold tracking-tight text-[color:var(--ink)] md:text-4xl">
                {t("tutors_cta.title")}
              </h3>
              <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-muted-foreground md:mt-4 md:text-lg md:font-normal">
                {t("tutors_cta.subtitle")}
              </p>
              <Button
                asChild
                size="lg"
                variant="solid"
                color="blue"
                className="mt-5 h-11 w-full rounded-xl px-4 text-sm font-bold md:mt-8 md:h-12 md:w-auto md:rounded-md md:px-8 md:text-base"
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
