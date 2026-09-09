import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, BookOpen, CalendarClock, Clock, Inbox, MapPin, Wallet } from "lucide-react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import { TutorSaveButton, fetchSavedTutors } from "@/features/tutors/saved-tutors";
import { CompareBar, CompareDialog, useTutorCompare } from "@/features/tutors/compare-tutors";
import { CourseSaveButton, fetchSavedCourses } from "@/features/courses/saved-courses";
import { CaseSaveButton, useSavedCaseIds } from "@/features/cases/saved-cases";
import { CASE_MODE_LABEL, formatCaseBudget, formatCaseSchedule } from "@/features/cases/display";
import { getPublicCaseBoard } from "@/lib/cases.functions";
import { courseModeLabel, formatCoursePrice } from "@/features/courses/queries";
import { buildTutorWhatsAppUrl } from "@/features/tutors/tutor-display";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";

export const Route = createFileRoute("/_authenticated/saved-posts")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Saved Posts | MatchMax" },
      { name: "description", content: "Your saved MatchMax tutors." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SavedPostsPage,
});

function SavedPostsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const savedTutorsQuery = useQuery({
    queryKey: ["saved-posts", user?.id],
    queryFn: () => fetchSavedTutors(user!.id),
    enabled: Boolean(user),
  });
  const savedCoursesQuery = useQuery({
    queryKey: ["saved-courses-posts", user?.id],
    queryFn: () => fetchSavedCourses(user!.id),
    enabled: Boolean(user) && CENTRE_MARKET_ENABLED,
  });
  const savedCourses = savedCoursesQuery.data ?? [];
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

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--surface-subtle)] text-[color:var(--ink)]">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-[color:var(--muted-foreground)]">
                Your collection
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-[color:var(--ink)] sm:text-5xl">
                Saved Posts
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Keep a shortlist of tutors and tutoring requests you would like to come back to.
              </p>
            </div>
            <Button variant="outline" onClick={() => void navigate({ to: "/tutors" })}>
              Find tutors
            </Button>
          </div>

          <div className="mt-8 p-0 sm:p-2">
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
            ) : savedTutors.length === 0 ? (
              <div className="p-12 text-center">
                <Bookmark
                  className="mx-auto h-8 w-8 text-[color:var(--muted-foreground)]"
                  aria-hidden="true"
                />
                <p className="mt-4 text-lg font-bold text-[color:var(--ink)]">
                  You haven't saved any tutors yet
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Browse the tutor directory and bookmark the profiles you want to revisit.
                </p>
              </div>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {savedTutors.map((tutor) => (
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
                      <Button
                        asChild
                        className="h-9 rounded-sm bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-[color:var(--surface-invert-fg)] shadow-none hover:bg-[color:var(--surface-invert-hover)]"
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
                    }
                  />
                ))}
              </div>
            )}

            <div className="mt-14">
              <h2 className="text-xl font-bold tracking-tight text-[color:var(--ink)]">
                Saved requests
              </h2>
              {savedCaseIdsQuery.isLoading || caseBoardQuery.isLoading ? (
                <div className="mt-6 text-sm text-muted-foreground">Loading saved requests...</div>
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
                    <a href="/tutor-requests">Browse requests</a>
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
                              {item.subjects.filter(Boolean).slice(0, 2).join(", ") || item.title}
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
                              {item.district ?? CASE_MODE_LABEL[item.mode] ?? "Location flexible"}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3.5 w-3.5" aria-hidden="true" />
                              {formatCaseSchedule(item.sessionsPerWeek, item.sessionLengthMinutes)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Wallet className="h-3.5 w-3.5" aria-hidden="true" />
                              {formatCaseBudget(item.budgetMin, item.budgetMax)}
                            </span>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
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

            {CENTRE_MARKET_ENABLED && (
              <div className="mt-14">
                <h2 className="text-xl font-bold tracking-tight text-[color:var(--ink)]">
                  Saved courses
                </h2>
                {savedCoursesQuery.isLoading ? (
                  <div className="mt-6 text-sm text-muted-foreground">Loading saved courses...</div>
                ) : savedCourses.length === 0 ? (
                  <div className="mt-6 p-10 text-center">
                    <BookOpen
                      className="mx-auto h-8 w-8 text-[color:var(--muted-foreground)]"
                      aria-hidden="true"
                    />
                    <p className="mt-4 text-base font-bold text-[color:var(--ink)]">
                      You haven't saved any courses yet
                    </p>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Bookmark courses from the directory to build your shortlist.
                    </p>
                    <Button variant="outline" className="mt-5" asChild>
                      <a href="/courses">Browse courses</a>
                    </Button>
                  </div>
                ) : (
                  <div className="mt-6 space-y-3">
                    {savedCourses.map((course) => {
                      const price = formatCoursePrice(course.price, course.currency);
                      return (
                        <div key={course.id} className="flex items-center gap-4 p-4">
                          {course.image_url ? (
                            <img
                              src={course.image_url}
                              alt=""
                              className="h-14 w-20 shrink-0 rounded-md border border-border object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="flex h-14 w-20 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                              <BookOpen className="h-5 w-5" />
                            </span>
                          )}
                          <div className="min-w-0 flex-1">
                            <a
                              href={`/courses/${course.id}`}
                              className="block truncate text-sm font-bold text-[color:var(--ink)] hover:text-[color:var(--brand-link)]"
                            >
                              {course.title}
                            </a>
                            <p className="mt-0.5 truncate text-xs text-muted-foreground">
                              {course.organization?.name ?? "MatchMax partner"} ·{" "}
                              {course.level ?? "General"} · {courseModeLabel(course.mode)}
                              {price ? ` · ${price}` : ""}
                            </p>
                          </div>
                          <CourseSaveButton courseId={course.id} />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
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
