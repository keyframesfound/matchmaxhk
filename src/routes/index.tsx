import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { type QueryClient, useQuery } from "@tanstack/react-query";
import { ArrowRight, ChevronLeft, ChevronRight, Flame } from "lucide-react";
import { useReducedMotion } from "motion/react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { canonicalUrl, currentSeoLocale, hreflangLinks, localizedMeta } from "@/features/i18n/seo";
import { Button } from "@/components/ui/button";
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
import { buildHomeCurriculumRails } from "@/features/tutors/home-rails";
import { dailyTieBreakSort, hktDate } from "@/features/tutors/daily-shuffle";
import { trackTutorEvent } from "@/features/tracking/engagement-client";
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

const TUTORS_PER_PAGE = 4;
const MAX_HOME_TUTORS = 6;

// Issue #151 Option A: the home trending showcase. Candidates come from the
// get_trending_tutors RPC, get re-ranked here with the quality multipliers
// and are capped at 8 rendered cards. Cold-start guardrail: below three
// tutors with ANY real engagement we keep the previous page (no near-empty
// trending row, the empty-restaurant problem).
const TRENDING_CANDIDATE_LIMIT = 24;
const TRENDING_TUTOR_LIMIT = 8;
const TRENDING_MIN_ELIGIBLE = 3;

type TrendingEntry = { tutor: Tutor; engagement: RankedTrending };

async function fetchWhatsappNumber(): Promise<string> {
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "whatsapp_number")
    .maybeSingle();
  if (error) throw error;
  return typeof data?.value === "string" ? data.value : "";
}

// Pre-warm the landing data so hover-intent prefetch (and cold loads)
// resolve before the page paints instead of flashing section skeletons.
const landingLoader = async ({ context }: { context: { queryClient: QueryClient } }) => {
  await Promise.all([
    context.queryClient.ensureQueryData({
      queryKey: ["tutors", "published"],
      queryFn: fetchPublishedTutors,
    }),
    context.queryClient.ensureQueryData({
      queryKey: ["landing", "featured_tutors"],
      queryFn: () => fetchTopWeeklyTutors(3),
    }),
    context.queryClient.ensureQueryData({
      queryKey: ["landing", "trending_candidates"],
      queryFn: () => fetchTrendingTutorSummaries(TRENDING_CANDIDATE_LIMIT),
    }),
    context.queryClient.ensureQueryData({
      queryKey: ["settings", "whatsapp_number"],
      queryFn: fetchWhatsappNumber,
    }),
  ]);
};

export const Route = createFileRoute("/")({
  loader: landingLoader,
  // Issue #401: locale-aware SEO copy (exact CEO-approved strings).
  head: () => {
    const locale = currentSeoLocale();
    return {
      meta: [
        ...localizedMeta(locale, {
          title: {
            en: "MatchMax | Tutoring Made Convenient in Hong Kong",
            "zh-HK": "MatchMax | 香港最透明的補習配對平台 · 極速配對・免中介費",
          },
          description: {
            en: "Hong Kong's fairest and most transparent tutoring matching platform. Fast concierge matching, zero parent fees, an industry-low 1.5-lesson commission for tutors, and an integrated study notes shop.",
            "zh-HK":
              "Tutoring Made Convenient。打破傳統中介收費模式，提供極速專人配對及精讀筆記專門店。家長全免手續費，導師盡享全港最公平的 1.5 堂行政費。",
          },
        }),
        { name: "robots", content: "index, follow" },
        { property: "og:url", content: canonicalUrl("/") },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "MatchMax" },
        { property: "og:image", content: OG_IMAGE },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { name: "twitter:card", content: "summary_large_image" },
        {
          name: "twitter:title",
          content:
            locale === "zh-HK"
              ? "MatchMax | 香港最透明的補習配對平台"
              : "Tutoring Made Convenient in Hong Kong | MatchMax",
        },
        {
          name: "twitter:description",
          content:
            locale === "zh-HK"
              ? "極速專人配對、透明紙面成績，家長全免手續費。"
              : "Find elite IB, HKDSE, IGCSE, AP, A-Level and international school tutors in Hong Kong.",
        },
        { name: "twitter:image", content: OG_IMAGE },
      ],
      links: [
        { rel: "canonical", href: canonicalUrl("/") },
        ...hreflangLinks("/"),
        { rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
        { rel: "shortcut icon", href: "/favicon.ico" },
        { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon-32x32.png" },
        { rel: "icon", type: "image/png", sizes: "16x16", href: "/favicon-16x16.png" },
        { rel: "apple-touch-icon", sizes: "180x180", href: "/apple-touch-icon.png" },
        { rel: "manifest", href: "/site.webmanifest" },
      ],
    };
  },

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
      <ArrowRight
        className="h-6 w-6 text-[color:var(--brand-link)] transition-transform duration-200 ease-out group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0"
        strokeWidth={1.75}
        aria-hidden="true"
      />
      <span className="text-sm font-bold text-[color:var(--ink)]">{t("featured.see_all")}</span>
    </Link>
  );

  return (
    <section className="mx-auto max-w-[1536px]">
      <div className="mb-4 flex items-center gap-2 sm:gap-3">
        <h2 className="min-w-0 truncate text-xl font-bold tracking-tight text-[color:var(--ink)] md:text-2xl">
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
          {/* Mobile: one swipeable row, first page of tutors, then the see-all tile */}
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
    <section className="mx-auto max-w-[1536px]">
      <div className="mb-4 flex items-center gap-2 sm:gap-3">
        <Flame
          className="h-5 w-5 shrink-0 text-[color:var(--brand-link)] sm:h-6 sm:w-6"
          strokeWidth={1.75}
          aria-hidden="true"
        />
        <h2 className="min-w-0 truncate text-xl font-bold tracking-tight text-[color:var(--ink)] md:text-2xl">
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

      <div
        ref={railRef}
        className="-mx-4 rail-scroll flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pt-1 pb-2"
      >
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

  // Shared cache key with /tutors: both surfaces fetch the same rows, so
  // navigating between them renders from cache, and profile-edit
  // invalidations of ["tutors", "published"] cover both pages.
  const { data: publishedTutors = [], isLoading: publishedTutorsLoading } = useQuery({
    queryKey: ["tutors", "published"],
    queryFn: fetchPublishedTutors,
  });

  // Issue #151 Option A: merge the RPC's base-score candidates with the full
  // Tutor rows already fetched for the curriculum rails (no new SELECT),
  // re-rank with the quality multipliers and keep the top 8. qualityFor keys
  // off the public Tutor row: verification_tier ships in the public select
  // (#142; tier_2_verified = transcripts + HKID passed manual review) and
  // top-scorer detection runs over APPROVED grade labels only. Cold-start
  // guardrail: fewer than three candidates with popularity_score > 0 means
  // the page renders exactly as before, no near-empty trending row.
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
    // Issue #485 Phase B: rankTrending already ordered by popularity_score
    // desc, then requests_30d desc. This pass re-orders ONLY exact ties on
    // BOTH keys (never different engagement tiers) by the daily HKT hash,
    // ascending, so tie groups rotate at Hong Kong midnight instead of
    // sticking to query order all week. Slice AFTER the tie-break so the
    // TRENDING_TUTOR_LIMIT cut itself is what rotates.
    const tieBroken = dailyTieBreakSort(
      eligible,
      (a, b) => b.popularity_score - a.popularity_score || b.requests_30d - a.requests_30d,
      (candidate) => candidate.tutor_id,
      hktDate(),
    );
    return tieBroken.slice(0, TRENDING_TUTOR_LIMIT).flatMap((candidate) => {
      const tutor = tutorById.get(candidate.tutor_id);
      return tutor ? [{ tutor, engagement: candidate }] : [];
    });
  }, [publishedTutors, trendingCandidates]);

  // Issue #485 Phase A: one card per home layout. The old per-category
  // tutorsForCategory() built every rail independently, so multi-tag tutors
  // repeated across Most Requested + IBDP + DSE. This single sequential
  // builder seeds alreadyShown with the trending row, then walks the
  // categories in CURRICULUM_CATEGORIES order, taking the NEXT 6 unique
  // tutors per rail (exclude BEFORE the slice). Rails whose post-exclude
  // pool drops below 3 are hidden at render time (same ≥3 bar as the
  // notes/gigs rows); /tutors?category= browse keeps full membership.
  const curriculumRails = useMemo(
    () =>
      buildHomeCurriculumRails({
        tutors: publishedTutors,
        trendingTutorIds: trendingEntries.map((entry) => entry.tutor.id),
        categories: CURRICULUM_CATEGORIES.map(({ value }) => value),
        maxPerRail: MAX_HOME_TUTORS,
        day: hktDate(),
        highlightsFor: getTutorCardHighlights,
      }),
    [publishedTutors, trendingEntries],
  );

  // Education dropdown options = the distinct values that actually appear on
  // tutor profiles (issue #130), refreshed whenever the tutor list does.
  const educationValues = useMemo(
    () => collectEducationValueSets(publishedTutors),
    [publishedTutors],
  );

  const { data: whatsappNumber = "" } = useQuery({
    queryKey: ["settings", "whatsapp_number"],
    queryFn: fetchWhatsappNumber,
  });

  const { compareIds, compareTutors, toggleCompare, compareOpen, setCompareOpen, clearCompare } =
    useTutorCompare(publishedTutors);

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
      "Find elite IB, HKDSE, IGCSE, AP, A-Level and international school tutors in Hong Kong.",
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
          <div className="mx-auto max-w-5xl px-4 sm:px-6 py-3">
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
          <div className="mx-auto max-w-[1600px] px-4 md:px-6">
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
          <div className="mx-auto max-w-[1600px] px-4 md:px-6">
            <div className="mt-4 space-y-10 md:mt-10 md:space-y-12">
              {/* Issue #312: approved notes under the search bar, above the
                  IB rail; renders nothing below three public notes. The
                  null guards live INSIDE the row so a hidden row leaves no
                  empty wrapper in the space-y stack. */}
              <HomeNotesRow />
              {/* Issue #329: Tutor services row, ORDER IS SEMANTIC: the
                  notes row (#312) stays first, gigs sit immediately below it.
                  Same ≥3-listings guardrail; renders nothing when the gigs
                  RPC is missing or fewer than three services are published. */}
              <HomeGigsRow />
              {/* Issue #151 Option A: trending showcase; hidden entirely
                  (existing page) until 3+ tutors clear the guardrail. */}
              {trendingEntries.length > 0 ? (
                <TrendingTutorsSection
                  entries={trendingEntries}
                  priceSuffix={t("featured.per_hour")}
                  whatsappNumber={whatsappNumber}
                  onOpen={openTutorDetail}
                  compareSelectedIds={compareIds}
                  onCompareToggle={toggleCompare}
                />
              ) : null}
              {CURRICULUM_CATEGORIES.map(({ label, value }) => {
                const tutors = curriculumRails[value] ?? [];
                // Issue #485: hide a rail whose post-exclude pool fell
                // below the notes/gigs ≥3 bar — no empty heading. While the
                // tutor fetch is in flight the rails are still empty, so
                // keep the section (and its skeletons) until loading ends.
                if (!publishedTutorsLoading && tutors.length < 3) return null;
                return (
                  <CurriculumTutorSection
                    key={value}
                    label={label}
                    category={value}
                    tutors={tutors}
                    loading={publishedTutorsLoading}
                    priceSuffix={t("featured.per_hour")}
                    whatsappNumber={whatsappNumber}
                    onOpen={openTutorDetail}
                    compareSelectedIds={compareIds}
                    onCompareToggle={toggleCompare}
                  />
                );
              })}
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
