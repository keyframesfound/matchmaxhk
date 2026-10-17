import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { gigCategoryLabelKey } from "@/features/gigs/gig";
import { getPublicGigs, publicCoverUrl, type PublicGig } from "@/features/gigs/gigs.queries";

/**
 * Issues #326/#329: the "Tutor services" row on the home page — the gig
 * sibling of HomeNotesRow (#312), identical carousel anatomy (heading, View
 * all, arrows, mobile swipe + md paged track, flat border-defined cards, no
 * shadows). Data comes from the get_public_gigs SECURITY DEFINER RPC; when
 * it is missing the query degrades to [] and the row renders nothing (it
 * also needs >= 3 published gigs, same cold-start guardrail as the notes
 * row). Azure is never spent here — it stays on money CTAs only.
 */

const HOME_GIGS_LIMIT = 8;
const GIGS_PER_PAGE = 4;
const MIN_HOME_GIGS = 3;

/** The gig card shared by the home row and the directory services grid. */
export function GigCard({ gig, className }: { gig: PublicGig; className?: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const cover = publicCoverUrl(gig.coverImagePath);
  const openGig = () => {
    void navigate({ to: "/notes/$slug", params: { slug: gig.slug || gig.id } });
  };

  return (
    <article
      role="link"
      tabIndex={0}
      aria-label={gig.title}
      onClick={openGig}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openGig();
        }
      }}
      className={cn(
        "flex h-full cursor-pointer flex-col gap-3 overflow-hidden rounded-lg border border-border bg-[color:var(--surface)] transition-colors hover:bg-[color:var(--surface-subtle)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
        className,
      )}
    >
      {cover ? (
        <div className="h-32 w-full border-b border-border bg-[color:var(--surface-subtle)]">
          <img
            src={cover}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
            onError={(event) => {
              // Missing cover file degrades to the flat card, never a broken image.
              event.currentTarget.style.display = "none";
            }}
          />
        </div>
      ) : null}
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-5 pt-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">
              {t(gigCategoryLabelKey(gig.gigCategory))}
              {gig.subjectTag ? ` · ${gig.subjectTag}` : ""}
            </p>
            <h3 className="mt-1 text-base font-bold leading-snug text-[color:var(--ink)]">
              {gig.title}
            </h3>
          </div>
          <p className="shrink-0 text-lg font-bold text-[color:var(--ink)]">
            HK${Number(gig.priceHkd).toFixed(0)}
          </p>
        </div>

        {gig.boughtCount > 0 ? (
          <p className="text-xs font-semibold text-muted-foreground">
            {t("gigs.bought_count_suffix", { count: gig.boughtCount })}
          </p>
        ) : null}

        <div className="mt-auto pt-1">
          {/* Clicking the tutor opens the profile, not the gig (stopPropagation
              so the card-level gig navigation does not win). */}
          <a
            href={`/tutors/${gig.tutorCode}`}
            onClick={(event) => event.stopPropagation()}
            className="text-xs text-muted-foreground hover:underline"
          >
            <span className="font-bold text-[color:var(--brand-link)]">{gig.tutorDisplayName}</span>
            {" · "}
            {gig.tutorCode}
            {/* #314 honesty: the Verified tag shows for tier_2_verified only. */}
            {gig.verificationTier === "tier_2_verified" ? (
              <span className="ml-1.5 font-semibold text-[color:var(--brand-link)]">
                · {t("gigs.verified")}
              </span>
            ) : null}
          </a>
        </div>
      </div>
    </article>
  );
}

function renderGigCard(gig: PublicGig, className?: string) {
  return <GigCard key={gig.id} gig={gig} className={className} />;
}

// The directory lives at /tutors?view=materials; #services jumps straight to
// the Tutor services section (plain anchor keeps this file route-free, same
// as the notes row's SeeAllTile).
function SeeAllTile({ className }: { className?: string }) {
  const { t } = useTranslation();
  return (
    <a
      href="/tutors?view=materials#services"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-[var(--radius-panel)] border border-dashed border-border bg-[color:var(--surface-subtle)]/40 text-center transition-colors hover:bg-[color:var(--surface-subtle)]",
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card">
        <ArrowRight className="h-5 w-5 text-[color:var(--brand-link)]" aria-hidden="true" />
      </span>
      <span className="text-sm font-bold text-[color:var(--ink)]">{t("gigs.view_all")}</span>
    </a>
  );
}

function GigsCarouselArrows({
  pages,
  currentPage,
  goToPage,
}: {
  pages: number;
  currentPage: number;
  goToPage: (next: number) => void;
}) {
  const { t } = useTranslation();
  if (pages <= 1) return null;
  return (
    <div className="ml-auto hidden shrink-0 items-center gap-1.5 md:flex">
      <button
        type="button"
        aria-label={t("gigs.home_prev")}
        disabled={currentPage === 0}
        onClick={() => goToPage(currentPage - 1)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label={t("gigs.home_next")}
        disabled={currentPage === pages - 1}
        onClick={() => goToPage(currentPage + 1)}
        className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card text-[color:var(--ink)] transition-colors hover:bg-[color:var(--surface-subtle)] disabled:cursor-not-allowed disabled:opacity-40 sm:h-9 sm:w-9"
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Issue #329: the home-page services row. Renders nothing below 3 public gigs. */
export function HomeGigsRow() {
  const { t } = useTranslation();
  const { data: gigs, isLoading } = useQuery({
    queryKey: ["landing", "home_gigs"],
    queryFn: () => getPublicGigs(null, HOME_GIGS_LIMIT),
  });

  // Pagination state must be created unconditionally (rules of hooks), so the
  // loading/empty early returns happen after it.
  const [page, setPage] = useState(0);
  const visible = gigs ?? [];
  const pages: PublicGig[][] = [];
  for (let i = 0; i < visible.length; i += GIGS_PER_PAGE) {
    pages.push(visible.slice(i, i + GIGS_PER_PAGE));
  }
  const currentPage = Math.min(page, Math.max(0, pages.length - 1));
  const goToPage = (next: number) => setPage(Math.max(0, Math.min(pages.length - 1, next)));

  if (isLoading) {
    return (
      <section className="mx-auto max-w-7xl">
        <Skeleton className="mb-4 h-8 w-40" />
        <div className="-mx-4 flex gap-3 overflow-hidden px-4 md:mx-0 md:grid md:grid-cols-4 md:gap-6 md:px-0">
          {Array.from({ length: GIGS_PER_PAGE }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-56 w-[min(70vw,300px)] shrink-0 rounded-lg border border-border md:w-auto"
            />
          ))}
        </div>
      </section>
    );
  }

  if (visible.length < MIN_HOME_GIGS) return null;

  return (
    <section className="mx-auto max-w-7xl">
      <div className="mb-4 flex items-center gap-2 sm:gap-3">
        <h2 className="min-w-0 truncate text-xl font-black tracking-tight text-[color:var(--ink)] md:text-2xl">
          {t("gigs.home_row_title")}
        </h2>
        <Button
          asChild
          variant="ghost"
          className="h-8 shrink-0 rounded-full px-2.5 text-[13px] font-bold text-[color:var(--brand-link)] hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--ink)] sm:h-9 sm:px-3 sm:text-sm"
        >
          <a href="/tutors?view=materials#services">
            {t("gigs.view_all")}
            <ArrowRight className="ml-1 h-4 w-4" aria-hidden="true" />
          </a>
        </Button>
        <GigsCarouselArrows pages={pages.length} currentPage={currentPage} goToPage={goToPage} />
      </div>

      {/* Mobile: one swipeable row — first page of gigs, then the see-all tile */}
      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pt-1 pb-2 scroll-px-4 md:hidden">
        {visible
          .slice(0, GIGS_PER_PAGE)
          .map((gig) => renderGigCard(gig, "w-[min(70vw,300px)] shrink-0 snap-start"))}
        <SeeAllTile className="min-h-56 w-[min(70vw,300px)] shrink-0 snap-start" />
      </div>

      {/* md+: paged sliding track, 4 cards per page */}
      <div className="hidden overflow-hidden pt-1 md:block">
        <div
          className="flex items-stretch transition-transform duration-300 ease-out motion-reduce:transition-none"
          style={{ transform: `translateX(-${currentPage * 100}%)` }}
        >
          {pages.map((pageGigs, pageIndex) => {
            const isCurrentPage = pageIndex === currentPage;
            const withSeeAllTile = pages.length > 1 && pageIndex === pages.length - 1;
            return (
              <div
                key={pageIndex}
                inert={!isCurrentPage}
                aria-hidden={!isCurrentPage}
                className="grid w-full shrink-0 grid-cols-2 gap-6 lg:grid-cols-4"
              >
                {pageGigs.map((gig) => renderGigCard(gig))}
                {withSeeAllTile ? <SeeAllTile className="min-h-56" /> : null}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
