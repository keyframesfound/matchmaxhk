import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, Search, UserPlus } from "lucide-react";
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
  { value: "Primary", label: "Primary" },
  { value: "Secondary", label: "Secondary" },
  { value: "International", label: "International" },
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
const MAX_HOME_TUTORS = 7;

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
}: {
  label: string;
  category: string;
  tutors: Tutor[];
  loading: boolean;
  priceSuffix: string;
  whatsappNumber: string;
  onOpen: (tutorCode: string) => void;
}) {
  const { t } = useTranslation();
  const [page, setPage] = useState(0);

  const pages: Tutor[][] = [];
  for (let i = 0; i < tutors.length; i += TUTORS_PER_PAGE) {
    pages.push(tutors.slice(i, i + TUTORS_PER_PAGE));
  }
  const currentPage = Math.min(page, pages.length - 1);
  const goToPage = (next: number) => setPage(Math.max(0, Math.min(pages.length - 1, next)));

  const renderTutorCard = (tutor: Tutor, className?: string) => (
    <div key={tutor.id} className={cn("min-w-0", className)}>
      <PublicTutorCard
        tutor={tutor}
        priceSuffix={priceSuffix}
        onOpen={onOpen}
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
              className="h-[23rem] w-[min(88vw,380px)] shrink-0 rounded-[var(--radius-panel)] border border-border md:w-auto"
            />
          ))}
        </div>
      ) : tutors.length > 0 ? (
        <>
          {/* Mobile: one swipeable row — first page of tutors, then the see-all tile */}
          <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scroll-px-4 md:hidden">
            {tutors
              .slice(0, TUTORS_PER_PAGE)
              .map((tutor) => renderTutorCard(tutor, "w-[min(88vw,380px)] shrink-0 snap-start"))}
            {tutors.length > TUTORS_PER_PAGE
              ? seeAllTile("min-h-[20rem] w-[min(88vw,380px)] shrink-0 snap-start")
              : null}
          </div>

          {/* md+: paged sliding track */}
          <div className="hidden overflow-hidden md:block">
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
      <section className="hero-startup-bg relative overflow-hidden">
        <div className="mx-auto grid max-w-[1440px] grid-cols-1 gap-8 px-4 pt-6 pb-12 md:px-6 md:pt-24 md:pb-28 lg:grid-cols-2 lg:gap-16">
          <div className="flex flex-col justify-center">
            <h1 className="mt-3 text-4xl font-black leading-[1.05] tracking-tight text-[color:var(--ink)] sm:text-5xl md:text-6xl lg:text-7xl">
              {t("hero.title_a")}
              <br />
            </h1>
            <div className="mt-6 flex flex-wrap gap-3 md:mt-8">
              <Button
                asChild
                size="lg"
                className="h-12 w-full rounded-xl bg-[color:var(--surface-invert)] px-5 text-base font-bold text-[color:var(--surface-invert-fg)] shadow-brand hover:bg-[color:var(--surface-invert-hover)] md:h-14 md:w-auto md:rounded-md md:px-8 md:text-lg"
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
          <div className="relative rounded-sm border border-border bg-card p-2.5 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5 sm:pb-4">
              <p className="text-xs font-black uppercase tracking-wide text-[color:var(--ink)] sm:text-sm">
                Find tutor
              </p>
            </div>

            <div className="mt-2.5 grid gap-2 sm:gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground md:h-4 md:w-4" />
                <Input
                  className="h-9 rounded-sm pl-9 text-xs md:h-11 md:text-sm"
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
                className="h-9 rounded-sm text-xs md:h-11 md:text-sm"
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
                className="h-9 rounded-sm text-xs md:h-11 md:text-sm"
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
                className="h-9 rounded-sm bg-[color:var(--surface-invert)] px-4 text-xs font-bold text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--surface-invert-hover)] md:h-11 md:px-6 md:text-base"
                onClick={() => navigate({ to: "/tutors", search: tutorSearchParams })}
              >
                <Search className="mr-1.5 h-3.5 w-3.5 md:h-4 md:w-4" />
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
              />
            ))}
          </div>
        </div>
      </section>

      {/* FINDING A TUTOR / TUTOR CTA */}
      <section id="how" className="py-12 md:py-24">
        <div className="mx-auto max-w-[1440px] space-y-8 px-4 md:space-y-12 md:px-6">
          <div className="grid items-center gap-6 md:gap-12 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <h2 className="mt-2 text-2xl font-black tracking-tight text-[color:var(--ink)] md:text-4xl">
                {t("how.step1_title")}
              </h2>
              <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-muted-foreground md:mt-4 md:text-lg md:font-normal">
                {t("how.step1_desc")}
              </p>
              <Button
                asChild
                size="lg"
                className="mt-5 h-11 w-full rounded-xl bg-[color:var(--surface-invert)] px-4 text-sm font-bold text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--surface-invert-hover)] md:mt-8 md:h-12 md:w-auto md:rounded-md md:px-8 md:text-base"
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
              <h3 className="mt-2 text-2xl font-black tracking-tight text-[color:var(--ink)] md:text-4xl">
                {t("tutors_cta.title")}
              </h3>
              <p className="mt-2 max-w-xl text-sm font-medium leading-relaxed text-muted-foreground md:mt-4 md:text-lg md:font-normal">
                {t("tutors_cta.subtitle")}
              </p>
              <Button
                asChild
                size="lg"
                className="mt-5 h-11 w-full rounded-xl bg-[color:var(--surface-invert)] px-4 text-sm font-bold text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--surface-invert-hover)] md:mt-8 md:h-12 md:w-auto md:rounded-md md:px-8 md:text-base"
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
