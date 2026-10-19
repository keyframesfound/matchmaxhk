import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Button } from "@/components/ui/button";
import { Reveal } from "@/components/ui/reveal";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CompactSearchPill,
  SearchGroupProvider,
  StickySearchBar,
} from "@/components/search/sticky-search-group";
import {
  TutorsSearchBar,
  TutorsSearchMobile,
  useTutorsCompactSegments,
} from "@/components/search/tutors-search";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import { TutorSaveButton } from "@/features/tutors/saved-tutors";
import { HomeNotesRow } from "@/features/materials/home-notes-row";
import { HomeGigsRow } from "@/features/gigs/home-gigs-row";
import { CompareBar, CompareDialog, useTutorCompare } from "@/features/tutors/compare-tutors";
import { getTutorInquiryAction } from "@/features/tutors/tutor-display";
import { cn } from "@/lib/utils";
import {
  fetchPublishedTutors,
  fetchTopWeeklyTutors,
  getTutorCardHighlights,
  type Tutor,
} from "@/features/tutors/queries";
import {
  isTopScorer,
  rankTrending,
  type EngagementQuality,
  type RankedTrending,
} from "@/features/tutors/engagement";
import { fetchTrendingTutorSummaries } from "@/features/tutors/trending";
import { trackTutorEvent } from "@/features/tracking/engagement-client";
import { matchesCategoryFilter } from "@/features/tutors/subjects";
import { collectEducationValueSets } from "@/features/tutors/education-filters";
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

const CURRICULUM_CATEGORIES = [
  { label: "IBDP", value: "IB" },
  { label: "DSE", value: "DSE" },
  { label: "IGCSE", value: "IGCSE" },
  { label: "A Levels", value: "A-Level" },
  { label: "Examiner/pro teachers", value: "International" },
];

const TUTORS_PER_PAGE = 3;
const MAX_HOME_TUTORS = 6;

// Issue #151 Option A: the home trending showcase. Candidates come from the
// get_trending_tutors RPC, get re-ranked here with the quality multipliers
// and are capped at 8 rendered cards. Cold-start guardrail: below three
// tutors with ANY real engagement we keep the previous page (no near-empty
// trending row — the empty-restaurant problem).
const TRENDING_CANDIDATE_LIMIT = 24;
const TRENDING_TUTOR_LIMIT = 8;
const TRENDING_MIN_ELIGIBLE = 3;

type TrendingEntry = { tutor: Tutor; engagement: RankedTrending };

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
  const { t, i18n } = useTranslation();
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

  const renderTutorCard = (tutor: Tutor, className?: string) => {
    const inquiry = getTutorInquiryAction(tutor, whatsappNumber, i18n.language);
    return (
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
              {inquiry.kind === "status" ? (
                <span className="inline-flex h-9 items-center rounded-sm bg-[color:var(--ink)]/[0.06] px-4 text-[13px] font-bold text-[color:var(--ink)] @max-sm:h-8 @max-sm:px-3 @max-sm:text-xs">
                  {inquiry.label}
                </span>
              ) : (
                <Button
                  asChild
                  className="h-9 rounded-sm bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--surface-invert-hover)] @max-sm:h-8 @max-sm:px-3 @max-sm:text-xs"
                >
                  <a
                    href={inquiry.href}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {inquiry.label}
                  </a>
                </Button>
              )}
            </>
          }
        />
      </div>
    );
  };

  const seeAllTile = (className: string) => (
    <Link
      to="/tutors"
      search={{ category }}
      className={cn(
        "group flex flex-col items-center justify-center gap-3 rounded-[var(--radius-panel)] border border-dashed border-border bg-[color:var(--surface-subtle)]/40 text-center transition-colors hover:bg-[color:var(--surface-subtle)]",
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card transition-colors group-hover:bg-[color:var(--surface-subtle)]">
        <ArrowRight
          className="h-5 w-5 text-[color:var(--brand-link)] transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
          aria-hidden="true"
        />
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
          refined
          hoverArrow
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
          <div className="-mx-4 rail-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-1 pb-2 scroll-px-4 md:hidden">
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

// Issue #151 Option A: horizontal trending carousel. Same card-row anatomy as
// the curriculum rails' swipeable row (snap scroll, same card width), with
// the section's demand + Parent Favorite badges fed by the candidate's
// engagement summary. The WhatsApp inquiry CTA fires the inquiry_click
// tracking event via a capture-phase wrapper so the click itself is never
// blocked (tracking is fire-and-forget).
function TrendingTutorsSection({
  entries,
  priceSuffix,
  whatsappNumber,
  onOpen,
  compareSelectedIds,
  onCompareToggle,
}: {
  entries: TrendingEntry[];
  priceSuffix: string;
  whatsappNumber: string;
  onOpen: (tutorCode: string) => void;
  compareSelectedIds: string[];
  onCompareToggle: (tutor: Tutor) => void;
}) {
  const { t, i18n } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const railRef = useRef<HTMLDivElement>(null);
  const [railCanPrev, setRailCanPrev] = useState(false);
  const [railCanNext, setRailCanNext] = useState(false);

  // Arrow states track the snap row's scroll position; the buttons hide on
  // mobile where the swipe row is the affordance (same chrome as the
  // curriculum rails' paged arrows).
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const update = () => {
      setRailCanPrev(rail.scrollLeft > 4);
      setRailCanNext(rail.scrollLeft < rail.scrollWidth - rail.clientWidth - 4);
    };
    update();
    rail.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      rail.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [entries.length]);

  const scrollRail = (direction: 1 | -1) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      left: direction * rail.clientWidth * 0.85,
      behavior: prefersReducedMotion ? "auto" : "smooth",
    });
  };

  return (
    <section className="mx-auto max-w-7xl">
      <div className="mb-4 flex items-center gap-2 sm:gap-3">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-subtle)] sm:h-9 sm:w-9"
        >
          <Flame className="h-5 w-5 text-[color:var(--brand-link)]" />
        </span>
        <h2 className="min-w-0 truncate text-xl font-black tracking-tight text-[color:var(--ink)] md:text-2xl">
          {t("home.trending_title")}
        </h2>
        <div className="ml-auto hidden shrink-0 items-center gap-1.5 md:flex">
          <button
            type="button"
            aria-label={t("featured.prev")}
            disabled={!railCanPrev}
            onClick={() => scrollRail(-1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t("featured.next")}
            disabled={!railCanNext}
            onClick={() => scrollRail(1)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="-mx-4 rail-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pt-1 pb-2">
        {entries.map((entry) => {
          const { tutor } = entry;
          const inquiry = getTutorInquiryAction(tutor, whatsappNumber, i18n.language);
          return (
            <div key={tutor.id} className="min-w-0 w-[min(80vw,380px)] shrink-0 snap-start">
              <PublicTutorCard
                tutor={tutor}
                engagement={entry.engagement}
                priceSuffix={priceSuffix}
                onOpen={onOpen}
                compareSelected={compareSelectedIds.includes(tutor.id)}
                onCompareToggle={() => onCompareToggle(tutor)}
                footerAction={
                  <>
                    <TutorSaveButton tutorId={tutor.id} compact />
                    {inquiry.kind === "status" ? (
                      <span className="inline-flex h-9 items-center rounded-sm bg-[color:var(--ink)]/[0.06] px-4 text-[13px] font-bold text-[color:var(--ink)] @max-sm:h-8 @max-sm:px-3 @max-sm:text-xs">
                        {inquiry.label}
                      </span>
                    ) : (
                      <span
                        className="contents"
                        onClickCapture={() => void trackTutorEvent(tutor.id, "inquiry_click")}
                      >
                        <Button
                          asChild
                          className="h-9 rounded-sm bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--surface-invert-hover)] @max-sm:h-8 @max-sm:px-3 @max-sm:text-xs"
                        >
                          <a
                            href={inquiry.href}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {inquiry.label}
                          </a>
                        </Button>
                      </span>
                    )}
                  </>
                }
              />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Landing() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const heroVideoRef = useRef<HTMLVideoElement>(null);
  const [homeSearch, setHomeSearch] = useState<HomeTutorSearchState>({});

  useEffect(() => {
    const video = heroVideoRef.current;
    if (!video) return;

    const tryPlay = () => {
      video.muted = true;
      video.defaultMuted = true;
      void video.play().catch(() => {
        // Safari may defer autoplay until the next readiness event.
      });
    };

    video.addEventListener("loadedmetadata", tryPlay);
    video.addEventListener("canplay", tryPlay);
    tryPlay();

    return () => {
      video.removeEventListener("loadedmetadata", tryPlay);
      video.removeEventListener("canplay", tryPlay);
    };
  }, []);

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

  const { data: trendingCandidates = [] } = useQuery({
    queryKey: ["landing", "trending_candidates"],
    queryFn: () => fetchTrendingTutorSummaries(TRENDING_CANDIDATE_LIMIT),
  });

  const { data: publishedTutors = [], isLoading: publishedTutorsLoading } = useQuery({
    queryKey: ["landing", "published_tutors"],
    queryFn: fetchPublishedTutors,
  });

  // Issue #151 Option A: merge the RPC's base-score candidates with the full
  // Tutor rows already fetched for the curriculum rails (no new SELECT),
  // re-rank with the quality multipliers and keep the top 8. qualityFor keys
  // off the public Tutor row: verification_tier ships in the public select
  // (#142; tier_2_verified = transcripts + HKID passed manual review) and
  // top-scorer detection runs over APPROVED grade labels only. Cold-start
  // guardrail: fewer than three candidates with popularity_score > 0 means
  // the page renders exactly as before — no near-empty trending row.
  const trendingEntries = useMemo<TrendingEntry[]>(() => {
    if (publishedTutors.length === 0 || trendingCandidates.length === 0) return [];
    const tutorById = new Map(publishedTutors.map((tutor) => [tutor.id, tutor]));
    const qualityFor = (tutorId: string): EngagementQuality => {
      const tutor = tutorById.get(tutorId);
      return {
        verified: tutor?.verification_tier === "tier_2_verified",
        topScorer: isTopScorer(tutor?.approved_grade_labels),
      };
    };
    const eligible = rankTrending(
      trendingCandidates.filter((candidate) => tutorById.has(candidate.tutor_id)),
      qualityFor,
    ).filter((candidate) => candidate.popularity_score > 0);
    if (eligible.length < TRENDING_MIN_ELIGIBLE) return [];
    return eligible.slice(0, TRENDING_TUTOR_LIMIT).flatMap((candidate) => {
      const tutor = tutorById.get(candidate.tutor_id);
      return tutor ? [{ tutor, engagement: candidate }] : [];
    });
  }, [publishedTutors, trendingCandidates]);

  // Education dropdown options = the distinct values that actually appear on
  // tutor profiles (issue #130), refreshed whenever the tutor list does.
  const educationValues = useMemo(
    () => collectEducationValueSets(publishedTutors),
    [publishedTutors],
  );

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

  const applyHomeSearch = (override?: Partial<HomeTutorSearchState>) => {
    const next = { ...homeSearch, ...override };
    const params: HomeTutorSearchState = {
      category: next.category,
      subject: next.subject,
      mode: next.mode,
      gender: next.gender,
      q: next.q,
    };
    if (next.mode === "in_person") {
      params.station = next.station;
    }
    navigate({ to: "/tutors", search: params });
  };

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

  // Issue #151: ItemList JSON-LD follows what actually renders on the page —
  // the trending tutors once the carousel is up, the previous newest-tutors
  // featured list while the cold-start guardrail holds it back.
  const itemListTutors =
    trendingEntries.length > 0 ? trendingEntries.map((entry) => entry.tutor) : featuredTutors;

  const tutorListStructuredData =
    itemListTutors.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "ItemList",
          itemListElement: itemListTutors.map((tut, i) => ({
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

  const compactSegments = useTutorsCompactSegments(homeSearch);

  return (
    <SearchGroupProvider>
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

        <SiteHeader
          merged
          centerSlot={<CompactSearchPill segments={compactSegments} icon="/nav-find.png" />}
        />

        <StickySearchBar>
          <div className="mx-auto max-w-4xl px-4 sm:px-6 py-3">
            <TutorsSearchBar
              draft={homeSearch}
              onDraftChange={setHomeSearchParam}
              onApply={applyHomeSearch}
              onClear={() => setHomeSearch({})}
              educationValues={educationValues}
            />
          </div>
        </StickySearchBar>

        {/* #307: grey band behind the mobile search pill, mirroring the
            desktop StickySearchBar band -- full-bleed, hairline bottom. */}
        <div className="relative z-20 border-b border-border bg-[color:var(--surface-header)] lg:hidden">
          <div className="mx-auto max-w-[1440px] px-4 md:px-6">
            <div className="py-2.5 sm:p-5">
              <TutorsSearchMobile
                draft={homeSearch}
                onDraftChange={setHomeSearchParam}
                onApply={applyHomeSearch}
                onClear={() => setHomeSearch({})}
                educationValues={educationValues}
              />
            </div>
          </div>
        </div>

        <section className="relative pb-10 md:pt-6 md:pb-16">
          <div className="mx-auto max-w-[1440px] px-4 md:px-6">
            <div className="mt-4 space-y-10 md:mt-10 md:space-y-12">
              {/* Issue #312: approved notes under the search bar, above the
                  IB rail; renders nothing below three public notes. */}
              <Reveal>
                <HomeNotesRow />
              </Reveal>
              {/* Issue #329: Tutor services row — ORDER IS SEMANTIC: the
                  notes row (#312) stays first, gigs sit immediately below it.
                  Same ≥3-listings guardrail; renders nothing when the gigs
                  RPC is missing or fewer than three services are published. */}
              <Reveal>
                <HomeGigsRow />
              </Reveal>
              {/* Issue #151 Option A: trending showcase; hidden entirely
                  (existing page) until 3+ tutors clear the guardrail. */}
              {trendingEntries.length > 0 ? (
                <Reveal>
                  <TrendingTutorsSection
                    entries={trendingEntries}
                    priceSuffix={t("featured.per_hour")}
                    whatsappNumber={whatsappNumber}
                    onOpen={openTutorDetail}
                    compareSelectedIds={compareIds}
                    onCompareToggle={toggleCompare}
                  />
                </Reveal>
              ) : null}
              {CURRICULUM_CATEGORIES.map(({ label, value }) => (
                <Reveal key={value}>
                  <CurriculumTutorSection
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
                </Reveal>
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
    </SearchGroupProvider>
  );
}
