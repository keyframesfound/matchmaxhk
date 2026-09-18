import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { LessonModeSelect } from "@/components/ui/lesson-mode-select";
import { CompactSearchBar, compactChipTriggerClass } from "@/components/search/compact-search-bar";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import { TutorSaveButton } from "@/features/tutors/saved-tutors";
import { CompareBar, CompareDialog, useTutorCompare } from "@/features/tutors/compare-tutors";
import { buildTutorWhatsAppUrl } from "@/features/tutors/tutor-display";
import { blurActive } from "@/lib/dom";
import { cn } from "@/lib/utils";
import {
  fetchPublishedTutors,
  fetchTopWeeklyTutors,
  getTutorCardHighlights,
  type Tutor,
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
  station?: string;
  gender?: string;
  q?: string;
};

const HOME_CATEGORY_OPTIONS = [
  { value: "", label: "Any curriculum" },
  { value: "IB", label: "IB" },
  { value: "DSE", label: "DSE" },
  { value: "IGCSE", label: "IGCSE" },
  { value: "AP", label: "AP" },
  { value: "A-Level", label: "A-Level" },
  { value: "Primary", label: "Primary School" },
  { value: "Junior Secondary", label: "Junior Secondary" },
  { value: "Admissions", label: "Admissions & Standardized Tests" },
];

const HOME_GENDER_OPTIONS = [
  { value: "", label: "Any gender" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

const CURRICULUM_CATEGORIES = [
  { label: "IBDP", value: "IB" },
  { label: "DSE", value: "DSE" },
  { label: "IGCSE", value: "IGCSE" },
  { label: "A Levels", value: "A-Level" },
  { label: "Examiner/pro teachers", value: "International" },
];

const TUTORS_PER_PAGE = 3;
const MAX_HOME_TUTORS = 6;

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

function CurriculumTutorSection({
  label,
  category,
  tutors,
  loading,
  priceSuffix,
  whatsappNumber,
  onOpen,
  compareSelectedIds,
  onCompareToggle,
}: {
  label: string;
  category: string;
  tutors: Tutor[];
  loading: boolean;
  priceSuffix: string;
  whatsappNumber: string;
  onOpen: (tutorCode: string) => void;
  compareSelectedIds: string[];
  onCompareToggle: (tutor: Tutor) => void;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);

  const pages: Tutor[][] = [];
  let visibleTutors = tutors;
  if (tutors.length > TUTORS_PER_PAGE && tutors.length % TUTORS_PER_PAGE === 0) {
    visibleTutors = tutors.slice(0, tutors.length - 1);
  }
  for (let i = 0; i < visibleTutors.length; i += TUTORS_PER_PAGE) {
    pages.push(visibleTutors.slice(i, i + TUTORS_PER_PAGE));
  }
  const currentPage = Math.min(page, pages.length - 1);
  const goToPage = (next: number) => setPage(Math.max(0, Math.min(pages.length - 1, next)));

  const renderTutorCard = (tutor: Tutor, className?: string) => (
    <div key={tutor.id} className={cn("min-w-0", className)}>
      <PublicTutorCard
        tutor={tutor}
        priceSuffix={priceSuffix}
        onOpen={onOpen}
        compareSelected={compareSelectedIds.includes(tutor.id)}
        onCompareToggle={() => onCompareToggle(tutor)}
        footerAction={
          <>
            <TutorSaveButton tutorId={tutor.id} compact />
            <Button
              asChild
              className="h-9 rounded-sm bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--surface-invert-hover)] @max-sm:h-8 @max-sm:px-3 @max-sm:text-xs"
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
  );

  const seeAllTile = (className: string) => (
    <Link
      to="/tutors"
      search={{ category }}
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-panel)] border border-dashed border-border bg-[color:var(--surface-subtle)]/40 text-center transition-colors hover:bg-[color:var(--surface-subtle)]",
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card">
        <ArrowRight className="h-5 w-5 text-[color:var(--brand-link)]" aria-hidden="true" />
      </span>
      <span className="text-sm font-bold text-[color:var(--ink)]">{t("featured.see_all")}</span>
    </Link>
  );

  return (
    <section className="mx-auto max-w-7xl">
      <div className="mb-4 flex items-center gap-2 sm:gap-3">
        <h2 className="min-w-0 truncate text-xl font-black tracking-tight text-[color:var(--ink)] md:text-2xl">
          {label} tutors
        </h2>
        <Button
          asChild
          variant="ghost"
          className="h-8 shrink-0 rounded-full px-2.5 text-[13px] font-bold text-[color:var(--brand-link)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--ink)] sm:h-9 sm:px-3 sm:text-sm"
        >
          <Link to="/tutors" search={{ category }}>
            {t("featured.view_all")}
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </Link>
        </Button>
        {pages.length > 1 ? (
          <div className="ml-auto hidden shrink-0 items-center gap-1.5 md:flex">
            <button
              type="button"
              aria-label={t("featured.prev")}
              disabled={currentPage === 0}
              onClick={() => goToPage(currentPage - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={t("featured.next")}
              disabled={currentPage === pages.length - 1}
              onClick={() => goToPage(currentPage + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="-mx-4 flex gap-3 overflow-hidden px-4 md:mx-0 md:grid md:grid-cols-2 md:gap-6 md:px-0 lg:grid-cols-3">
          {Array.from({ length: TUTORS_PER_PAGE }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-[23rem] w-[min(80vw,380px)] shrink-0 rounded-[var(--radius-panel)] border border-border md:w-auto"
            />
          ))}
        </div>
      ) : tutors.length > 0 ? (
        <>
          {/* Mobile: one swipeable row — first page of tutors, then the see-all tile */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-1 pb-2 scroll-px-4 md:hidden">
            {tutors
              .slice(0, TUTORS_PER_PAGE)
              .map((tutor) => renderTutorCard(tutor, "w-[min(80vw,380px)] shrink-0 snap-start"))}
            {tutors.length > TUTORS_PER_PAGE
              ? seeAllTile("min-h-[20rem] w-[min(80vw,380px)] shrink-0 snap-start")
              : null}
          </div>

          {/* md+: paged sliding track */}
          <div className="hidden overflow-hidden pt-1 md:block">
            <div
              className="flex items-stretch transition-transform duration-300 ease-out motion-reduce:transition-none"
              style={{ transform: `translateX(-${currentPage * 100}%)` }}
            >
              {pages.map((pageTutors, pageIndex) => {
                const isCurrentPage = pageIndex === currentPage;
                const withSeeAllTile = pages.length > 1 && pageIndex === pages.length - 1;
                return (
                  <div
                    key={pageIndex}
                    inert={!isCurrentPage}
                    aria-hidden={!isCurrentPage}
                    className="grid w-full shrink-0 grid-cols-2 gap-6 lg:grid-cols-3"
                  >
                    {pageTutors.map((tutor) => renderTutorCard(tutor))}
                    {withSeeAllTile ? seeAllTile("min-h-[23rem]") : null}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}

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
  const { data: featuredTutors = [] } = useQuery({
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

  const { compareIds, compareTutors, toggleCompare, compareOpen, setCompareOpen, clearCompare } =
    useTutorCompare(publishedTutors);

  const tutorsForCategory = (category: string) =>
    publishedTutors
      .filter((tutor) =>
        matchesCategoryFilter(category, tutor.subjects, [
          ...tutor.target_students,
          ...getTutorCardHighlights(tutor),
        ]),
      )
      .slice(0, MAX_HOME_TUTORS);

  const openTutorDetail = (tutorCode: string) => {
    navigate({ to: "/tutors/$tutorCode", params: { tutorCode } });
  };

  const homeSubjectOptions = useMemo(
    () => getSubjectOptionsForCategory(homeSearch.category) ?? DEFAULT_SUBJECT_OPTIONS,
    [homeSearch.category],
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
    };
    if (homeSearch.mode === "in_person") {
      params.station = homeSearch.station;
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
      <section className="hero-startup-bg hero-city-bg relative overflow-hidden">
        <video
          className="hero-city-video"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          poster="/matchmax_city_background_poster.jpg"
          aria-hidden="true"
          tabIndex={-1}
        >
          <source src="/matchmax_city_background_2560x1080.mp4" type="video/mp4" />
        </video>
        <div className="hero-city-overlay" aria-hidden="true" />
        <div className="relative z-10 mx-auto grid max-w-[1440px] grid-cols-1 gap-8 px-4 pt-6 pb-12 md:px-6 md:pt-24 md:pb-28 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col justify-center">
            <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-5xl md:text-6xl lg:text-7xl">
              {t("hero.title_a")}
              <br />
            </h1>
            <div className="mt-6 flex flex-wrap gap-3 md:mt-8">
              <Button
                asChild
                size="lg"
                className="h-12 w-full rounded-xl bg-[color:var(--surface-invert)] px-5 text-base font-bold text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--surface-invert-hover)] md:h-14 md:w-auto md:rounded-md md:px-8 md:text-lg"
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
        <div className="mx-auto max-w-[1440px] px-4 md:px-6">
          <div className="relative rounded-sm border border-border bg-card p-2.5 sm:p-5">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5 sm:pb-4">
              <p className="text-xs font-black uppercase tracking-wide text-[color:var(--ink)] sm:text-sm">
                Find tutor
              </p>
            </div>

            <CompactSearchBar
              className="mt-2.5 border-0 bg-transparent lg:hidden"
              value={homeSearch.q ?? ""}
              onValueChange={(q) => setHomeSearchParam({ q })}
              placeholder="Search tutor code, subject, keyword…"
              inputAriaLabel="Search tutors"
              submitLabel="Search"
              onSubmit={() => navigate({ to: "/tutors", search: tutorSearchParams })}
            >
              <SearchableSelect
                value={homeSearch.category ?? ""}
                onChange={handleHomeCategoryChange}
                options={HOME_CATEGORY_OPTIONS}
                placeholder="Curriculum"
                searchPlaceholder="Search category..."
                className={compactChipTriggerClass}
              />
              <SearchableSelect
                value={homeSearch.subject ?? ""}
                onChange={(v) => setHomeSearchParam({ subject: v || undefined })}
                options={[
                  { value: "", label: "Any subject" },
                  ...homeSubjectOptions.map((s) => ({ value: s, label: s })),
                ]}
                placeholder="Subject"
                searchPlaceholder="Search subject..."
                className={compactChipTriggerClass}
              />
              <LessonModeSelect
                mode={(homeSearch.mode as "" | "online" | "in_person" | "either" | undefined) ?? ""}
                station={homeSearch.station}
                onChange={({ mode, station }) =>
                  setHomeSearchParam({
                    mode: mode || undefined,
                    station: mode === "in_person" ? station : undefined,
                  })
                }
                placeholder="Mode"
                className={compactChipTriggerClass}
              />
              <SearchableSelect
                value={homeSearch.gender ?? ""}
                onChange={(v) => setHomeSearchParam({ gender: v || undefined })}
                options={HOME_GENDER_OPTIONS}
                placeholder="Gender"
                className={compactChipTriggerClass}
              />
            </CompactSearchBar>

            <div className="mt-2.5 hidden gap-3 lg:grid lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="h-11 rounded-sm pl-9 text-sm"
                  placeholder="Search tutor code, subject, keyword…"
                  value={homeSearch.q ?? ""}
                  onChange={(e) => setHomeSearchParam({ q: e.target.value })}
                />
              </div>
              <SearchableSelect
                value={homeSearch.category ?? ""}
                onChange={handleHomeCategoryChange}
                options={HOME_CATEGORY_OPTIONS}
                placeholder="Any curriculum"
                searchPlaceholder="Search category..."
                className="h-11 rounded-sm text-sm"
              />
              <SearchableSelect
                value={homeSearch.subject ?? ""}
                onChange={(v) => setHomeSearchParam({ subject: v || undefined })}
                options={[
                  { value: "", label: "Any subject" },
                  ...homeSubjectOptions.map((s) => ({ value: s, label: s })),
                ]}
                placeholder="Any subject"
                searchPlaceholder="Search subject..."
                className="h-11 rounded-sm text-sm"
              />
              <LessonModeSelect
                mode={(homeSearch.mode as "" | "online" | "in_person" | "either" | undefined) ?? ""}
                station={homeSearch.station}
                onChange={({ mode, station }) =>
                  setHomeSearchParam({
                    mode: mode || undefined,
                    station: mode === "in_person" ? station : undefined,
                  })
                }
                placeholder="Any lesson mode"
                className="h-11 rounded-sm text-sm"
              />
              <SearchableSelect
                value={homeSearch.gender ?? ""}
                onChange={(v) => setHomeSearchParam({ gender: v || undefined })}
                options={HOME_GENDER_OPTIONS}
                placeholder="Any gender"
                className="h-11 rounded-sm text-sm"
              />
              <Button
                className="h-11 rounded-sm bg-[color:var(--surface-invert)] px-6 text-base font-bold text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--surface-invert-hover)]"
                onClick={() => navigate({ to: "/tutors", search: tutorSearchParams })}
              >
                <Search className="mr-1.5 h-4 w-4" />
                Search
              </Button>
            </div>
          </div>

          <div className="mt-8 space-y-10 md:mt-10 md:space-y-12">
            {CURRICULUM_CATEGORIES.map(({ label, value }) => (
              <CurriculumTutorSection
                key={value}
                label={label}
                category={value}
                tutors={tutorsForCategory(value)}
                loading={publishedTutorsLoading}
                priceSuffix={t("featured.per_hour")}
                whatsappNumber={whatsappNumber}
                onOpen={openTutorDetail}
                compareSelectedIds={compareIds}
                onCompareToggle={toggleCompare}
              />
            ))}
          </div>
        </div>
      </section>

      <SiteFooter />

      {compareTutors.length > 0 && !compareOpen ? (
        <CompareBar
          selectedTutors={compareTutors}
          onOpenCompare={() => setCompareOpen(true)}
          onClear={clearCompare}
        />
      ) : null}
      <CompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        tutors={compareTutors}
        whatsappNumber={whatsappNumber}
      />
    </div>
  );
}
