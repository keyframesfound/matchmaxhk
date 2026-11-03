import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Bookmark, BookOpen, CalendarClock, Clock, Inbox, MapPin, Wallet } from "lucide-react";
import { toast } from "sonner";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import { TutorSaveButton, fetchSavedTutors } from "@/features/tutors/saved-tutors";
import { CompareBar, CompareDialog, useTutorCompare } from "@/features/tutors/compare-tutors";
import { CourseSaveButton, fetchSavedCourses } from "@/features/courses/saved-courses";
import { formatCoursePrice, type CourseWithOrganization } from "@/features/courses/queries";
import { CaseSaveButton, useSavedCaseIds } from "@/features/cases/saved-cases";
import {
  CaseCompareBar,
  CaseCompareDialog,
  CaseCompareToggle,
  useCaseCompare,
} from "@/features/cases/compare-cases";
import { CASE_MODE_LABEL, formatCaseBudgetHkd, formatCaseSchedule } from "@/features/cases/display";
import { getPublicCaseBoard } from "@/lib/cases.functions";
import { getTutorInquiryAction } from "@/features/tutors/tutor-display";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";
import { NoteBrowseCard } from "@/features/materials/note-browse-card";
import { SAVED_NOTES_QUERY_KEY } from "@/features/materials/note-engagement";
import { getMySavedNoteIds, setNoteSaved } from "@/features/materials/note-engagement.functions";
import { fetchMarketplaceMaterials, fetchMaterialRatings } from "@/features/materials/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/saved-posts")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Saved Posts | MatchMax" },
      {
        name: "description",
        content: "Your saved MatchMax tutors and Marketplace materials.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SavedPostsPage,
});

// #610: saved courses ride the same Carousell-style grid as saved materials
// (photo + title + price + seller-under), not tutor-style vertical chunks.
function SavedCourseCard({ course }: { course: CourseWithOrganization }) {
  const { t } = useTranslation();
  const price = formatCoursePrice(course.price, course.currency);
  const seller = course.organization?.name ?? "MatchMax partner";
  return (
    <article className="group relative min-w-0">
      <a
        href={`/courses/${course.id}`}
        className="block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
      >
        <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-[color:var(--surface-subtle)]">
          {course.image_url ? (
            <img
              src={course.image_url}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02] motion-reduce:transition-none"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-3 text-center">
              <BookOpen
                className="h-9 w-9 text-[color:var(--brand-link)]"
                strokeWidth={1.5}
                aria-hidden
              />
              <span className="line-clamp-2 text-xs font-semibold text-muted-foreground">
                {course.level ?? ""}
              </span>
            </div>
          )}
          <span className="absolute left-2 top-2 rounded-full bg-card/90 px-2 py-0.5 text-[11px] font-bold text-[color:var(--ink)]">
            {t("shop.filter_courses")}
          </span>
        </div>
        <h3 className="mt-2 line-clamp-2 text-sm font-bold leading-snug text-[color:var(--ink)]">
          {course.title}
        </h3>
        <p className="mt-1 text-sm font-bold text-[color:var(--ink)]">{price}</p>
        <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
          <span
            aria-hidden
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--surface-subtle)] text-[10px] font-bold text-[color:var(--ink)]"
          >
            {seller.slice(0, 1).toUpperCase()}
          </span>
          <span className="truncate">{seller}</span>
        </p>
      </a>
      <div className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-card/90 text-[color:var(--ink)] transition-colors hover:bg-card">
        <CourseSaveButton courseId={course.id} />
      </div>
    </article>
  );
}

function SavedPostsPage() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // #610 CEO lock: exactly two top-level tabs — Tutors | Marketplace.
  const [activeTab, setActiveTab] = useState<"tutors" | "marketplace">("tutors");

  const savedTutorsQuery = useQuery({
    queryKey: ["saved-posts", user?.id],
    queryFn: () => fetchSavedTutors(user!.id),
    enabled: Boolean(user),
  });
  const savedTutors = useMemo(() => savedTutorsQuery.data ?? [], [savedTutorsQuery.data]);
  const { compareIds, compareTutors, toggleCompare, compareOpen, setCompareOpen, clearCompare } =
    useTutorCompare(savedTutors);

  const savedCaseIdsQuery = useSavedCaseIds();
  const caseBoardQuery = useQuery({
    queryKey: ["cases", "board"],
    queryFn: () => getPublicCaseBoard(),
  });
  const savedCases = useMemo(() => {
    const ids = new Set(savedCaseIdsQuery.data ?? []);
    return (caseBoardQuery.data?.items ?? []).filter((item) => ids.has(item.id));
  }, [savedCaseIdsQuery.data, caseBoardQuery.data]);
  const whatsappNumber = caseBoardQuery.data?.whatsappNumber ?? "";

  const savedCoursesQuery = useQuery({
    queryKey: ["saved-courses-posts", user?.id],
    queryFn: () => fetchSavedCourses(user!.id),
    enabled: Boolean(user) && CENTRE_MARKET_ENABLED,
  });
  const savedCourses = savedCoursesQuery.data ?? [];

  // #610 Marketplace tab: saved materials (saved_materials) joined onto the
  // published marketplace read, the same pattern as the shop directory grid.
  const savedNoteIdsQuery = useQuery({
    queryKey: [...SAVED_NOTES_QUERY_KEY, user?.id],
    queryFn: () => getMySavedNoteIds(),
    enabled: Boolean(user),
    staleTime: 60_000,
  });
  const marketplaceQuery = useQuery({
    queryKey: ["materials", "marketplace"],
    queryFn: fetchMarketplaceMaterials,
  });
  const ratingsQuery = useQuery({
    queryKey: ["materials", "ratings"],
    queryFn: fetchMaterialRatings,
    staleTime: 5 * 60_000,
  });
  const savedMaterials = useMemo(() => {
    const ids = new Set(savedNoteIdsQuery.data ?? []);
    return (marketplaceQuery.data ?? []).filter((m) => ids.has(m.id));
  }, [savedNoteIdsQuery.data, marketplaceQuery.data]);

  // Unsave from the Marketplace tab; the heart on the card is the unsave
  // prompt (same control as the shop grid's save toggle).
  const unsaveMaterial = async (materialId: string) => {
    try {
      await setNoteSaved({ data: { materialId, saved: false } });
      await queryClient.invalidateQueries({ queryKey: SAVED_NOTES_QUERY_KEY });
      toast.success(t("notes.engage.unsaved"));
    } catch {
      toast.error(t("notes.engage.save_failed"));
    }
  };

  const {
    compareCases,
    compareOpen: caseCompareOpen,
    setCompareOpen: setCaseCompareOpen,
    clearCompare: clearCaseCompare,
  } = useCaseCompare(savedCases);
  const tutorBarVisible = compareTutors.length > 0 && !compareOpen;
  const caseBarVisible = compareCases.length > 0 && !caseCompareOpen;

  const tutorsReady = !savedTutorsQuery.isLoading;
  const casesReady = !savedCaseIdsQuery.isLoading && !caseBoardQuery.isLoading;
  const marketplaceReady = !savedNoteIdsQuery.isLoading && !marketplaceQuery.isLoading;
  // Saved requests live under the Tutors tab (#610: no third top-level tab).
  const tutorsTabHasItems = savedTutors.length > 0 || savedCases.length > 0;
  const marketplaceTabHasItems =
    savedMaterials.length > 0 || (CENTRE_MARKET_ENABLED && savedCourses.length > 0);
  const globalEmpty =
    tutorsReady && casesReady && marketplaceReady && !tutorsTabHasItems && !marketplaceTabHasItems;
  const tutorsTabEmpty = savedTutors.length === 0 && casesReady && savedCases.length === 0;
  const marketplaceTabEmpty =
    savedMaterials.length === 0 && !(CENTRE_MARKET_ENABLED && savedCourses.length > 0);

  const findTutorsCta = (
    <Button variant="outline" asChild>
      <Link to="/tutors">{t("saved.cta_find_tutors")}</Link>
    </Button>
  );
  const browseMarketplaceCta = (
    <Button variant="outline" asChild>
      <Link to="/tutors" search={{ view: "materials" }}>
        {t("saved.cta_browse_marketplace")}
      </Link>
    </Button>
  );

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--surface-subtle)] text-[color:var(--ink)]">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-[1536px] px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[color:var(--muted-foreground)]">
                {t("saved.eyebrow")}
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-[color:var(--ink)] sm:text-5xl">
                {t("saved.title")}
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {t("saved.subtitle")}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {findTutorsCta}
              {browseMarketplaceCta}
            </div>
          </div>

          {/* #610 CEO lock: exactly two top-level tabs. */}
          <div role="tablist" className="mt-8 flex gap-6 border-b border-border">
            {(["tutors", "marketplace"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  "-mb-px border-b-2 px-1 pb-2.5 text-base font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
                  activeTab === tab
                    ? "border-[color:var(--ink)] text-[color:var(--ink)]"
                    : "border-transparent text-[color:var(--ink)]/55 hover:text-[color:var(--ink)]",
                )}
              >
                {tab === "tutors" ? t("saved.tab_tutors") : t("saved.tab_marketplace")}
              </button>
            ))}
          </div>

          <div className="mt-8 p-0 sm:p-2">
            {globalEmpty ? (
              <div className="p-12 text-center">
                <Bookmark
                  className="mx-auto h-8 w-8 text-[color:var(--muted-foreground)]"
                  aria-hidden="true"
                />
                <p className="mt-4 text-lg font-bold text-[color:var(--ink)]">
                  {t("saved.empty_global_title")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">{t("saved.empty_global_desc")}</p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  {findTutorsCta}
                  {browseMarketplaceCta}
                </div>
              </div>
            ) : activeTab === "tutors" ? (
              <>
                {savedTutorsQuery.isLoading ? (
                  <div className="text-sm text-muted-foreground">Loading saved tutors...</div>
                ) : savedTutorsQuery.isError ? (
                  <div className="p-12 text-center">
                    <p className="text-lg font-bold text-[color:var(--ink)]">
                      We couldn't load your saved tutors
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Please refresh the page and try again.
                    </p>
                  </div>
                ) : tutorsTabEmpty ? (
                  <div className="p-12 text-center">
                    <Bookmark
                      className="mx-auto h-8 w-8 text-[color:var(--muted-foreground)]"
                      aria-hidden="true"
                    />
                    <p className="mt-4 text-lg font-bold text-[color:var(--ink)]">
                      {t("saved.empty_tutors_title")}
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {t("saved.empty_tutors_desc")}
                    </p>
                    <div className="mt-6 flex justify-center">{findTutorsCta}</div>
                  </div>
                ) : savedTutors.length > 0 ? (
                  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {savedTutors.map((tutor) => {
                      const inquiry = getTutorInquiryAction(tutor, whatsappNumber, "en");
                      return (
                        <PublicTutorCard
                          key={tutor.id}
                          tutor={tutor}
                          priceSuffix="/hr"
                          onOpen={(code) =>
                            void navigate({ to: "/tutors/$tutorCode", params: { tutorCode: code } })
                          }
                          onCompareToggle={() => toggleCompare(tutor)}
                          compareSelected={compareIds.includes(tutor.id)}
                          saveAction={<TutorSaveButton tutorId={tutor.id} />}
                          footerAction={
                            inquiry.kind === "status" ? (
                              <span className="inline-flex h-9 items-center rounded-sm bg-[color:var(--ink)]/[0.06] px-4 text-[13px] font-bold text-[color:var(--ink)]">
                                {inquiry.label}
                              </span>
                            ) : (
                              <Button
                                asChild
                                className="h-9 rounded-sm bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--surface-invert-hover)]"
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
                            )
                          }
                        />
                      );
                    })}
                  </div>
                ) : null}

                <div className="mt-14">
                  <h2 className="text-xl font-bold tracking-tight text-[color:var(--ink)]">
                    Saved requests
                  </h2>
                  {savedCaseIdsQuery.isLoading || caseBoardQuery.isLoading ? (
                    <div className="mt-6 text-sm text-muted-foreground">
                      Loading saved requests...
                    </div>
                  ) : savedCases.length === 0 ? (
                    <div className="mt-6 p-10 text-center">
                      <Inbox
                        className="mx-auto h-8 w-8 text-[color:var(--muted-foreground)]"
                        aria-hidden="true"
                      />
                      <p className="mt-4 text-base font-bold text-[color:var(--ink)]">
                        You haven't saved any requests yet
                      </p>
                      <p className="mt-2 text-sm text-muted-foreground">
                        Bookmark tutoring requests from the board to revisit them later.
                      </p>
                      <Button variant="outline" className="mt-5" asChild>
                        <Link to="/tutor-requests">Browse requests</Link>
                      </Button>
                    </div>
                  ) : (
                    <ul className="mt-6 flex flex-col overflow-hidden rounded-xl border border-border divide-y divide-border bg-[color:var(--surface)]">
                      {savedCases.map((item) => (
                        <li key={item.id}>
                          <Link
                            to="/tutor-requests/$caseCode"
                            params={{ caseCode: item.caseCode }}
                            className="group flex items-center justify-between gap-4 px-4 py-3.5 transition-colors hover:bg-muted/40"
                          >
                            <div className="flex min-w-0 flex-col gap-1.5">
                              <span className="flex items-center gap-2 text-sm font-bold text-[color:var(--ink)]">
                                <span className="min-w-0 truncate">
                                  {item.subjects.filter(Boolean).slice(0, 2).join(", ") ||
                                    item.title}
                                </span>
                                {item.startTiming === "asap" ? (
                                  <span className="inline-flex shrink-0 items-center gap-0.5 rounded bg-[color:var(--warning)]/15 px-1.5 py-0.5 text-xs font-bold text-[#a16207] dark:text-[color:var(--warning)]">
                                    <CalendarClock className="h-3 w-3" aria-hidden="true" />
                                    ASAP
                                  </span>
                                ) : null}
                              </span>
                              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                                  {item.district ??
                                    CASE_MODE_LABEL[item.mode] ??
                                    "Location flexible"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                                  {formatCaseSchedule(
                                    item.sessionsPerWeek,
                                    item.sessionLengthMinutes,
                                  )}
                                </span>
                                {/* #423: empty string (both bounds blank) omits the rate. */}
                                {formatCaseBudgetHkd(item) ? (
                                  <span className="flex items-center gap-1">
                                    <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                                    {formatCaseBudgetHkd(item)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <CaseCompareToggle caseId={item.id} />
                              <CaseSaveButton caseId={item.id} compact />
                              <span className="text-sm font-semibold text-[color:var(--ink)]">
                                View details
                              </span>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            ) : !marketplaceReady ? (
              <div className="text-sm text-muted-foreground">{t("saved.loading_marketplace")}</div>
            ) : savedNoteIdsQuery.isError || marketplaceQuery.isError ? (
              <div className="p-12 text-center">
                <p className="text-lg font-bold text-[color:var(--ink)]">
                  {t("saved.error_marketplace_title")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("saved.error_marketplace_desc")}
                </p>
              </div>
            ) : marketplaceTabEmpty ? (
              <div className="p-12 text-center">
                <Bookmark
                  className="mx-auto h-8 w-8 text-[color:var(--muted-foreground)]"
                  aria-hidden="true"
                />
                <p className="mt-4 text-lg font-bold text-[color:var(--ink)]">
                  {t("saved.empty_marketplace_title")}
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  {t("saved.empty_marketplace_desc")}
                </p>
                <div className="mt-6 flex justify-center">{browseMarketplaceCta}</div>
              </div>
            ) : (
              // #610 CEO lock: Carousell-style 2-column grid for Marketplace
              // saves (photo + title + price + seller-under cards).
              <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5">
                {savedMaterials.map((material) => (
                  <NoteBrowseCard
                    key={material.id}
                    material={material}
                    rating={ratingsQuery.data?.get(material.id) ?? null}
                    saved
                    onToggleSave={() => void unsaveMaterial(material.id)}
                  />
                ))}
                {CENTRE_MARKET_ENABLED &&
                  savedCourses.map((course) => <SavedCourseCard key={course.id} course={course} />)}
              </div>
            )}
          </div>
        </div>
      </main>
      <SiteFooter />
      {tutorBarVisible ? (
        <CompareBar
          selectedTutors={compareTutors}
          onOpenCompare={() => setCompareOpen(true)}
          onClear={clearCompare}
        />
      ) : null}
      {caseBarVisible ? (
        <CaseCompareBar
          count={compareCases.length}
          onOpenCompare={() => setCaseCompareOpen(true)}
          onClear={clearCaseCompare}
          className={
            tutorBarVisible
              ? "fixed bottom-[8.75rem] left-1/2 z-40 w-[min(92vw,30rem)] -translate-x-1/2 sm:bottom-[4.75rem]"
              : undefined
          }
        />
      ) : null}
      <CompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        tutors={compareTutors}
        whatsappNumber={whatsappNumber}
      />
      <CaseCompareDialog
        open={caseCompareOpen}
        onOpenChange={setCaseCompareOpen}
        cases={compareCases}
      />
    </div>
  );
}
