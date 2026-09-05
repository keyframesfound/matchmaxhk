import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, BookOpen } from "lucide-react";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/features/auth/useAuth";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import { TutorSaveButton, fetchSavedTutors } from "@/features/tutors/saved-tutors";
import { CourseSaveButton, fetchSavedCourses } from "@/features/courses/saved-courses";
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-[color:var(--brand-teal)]">
                Your collection
              </p>
              <h1 className="mt-2 text-4xl font-black tracking-tight text-[color:var(--ink)] sm:text-5xl">
                Saved Posts
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                Keep a shortlist of tutors you would like to come back to.
              </p>
            </div>
            <Button variant="outline" onClick={() => void navigate({ to: "/tutors" })}>
              Find tutors
            </Button>
          </div>

          {savedTutorsQuery.isLoading ? (
            <div className="mt-10 text-sm text-muted-foreground">Loading saved tutors...</div>
          ) : savedTutorsQuery.isError ? (
            <div className="mt-10 rounded-sm border border-dashed border-border bg-card p-12 text-center">
              <p className="text-lg font-bold text-[color:var(--ink)]">
                We couldn't load your saved tutors
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Please refresh the page and try again.
              </p>
            </div>
          ) : savedTutorsQuery.data?.length === 0 ? (
            <div className="mt-10 rounded-sm border border-dashed border-border bg-card p-12 text-center">
              <Bookmark
                className="mx-auto h-8 w-8 text-[color:var(--brand-teal)]"
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
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {savedTutorsQuery.data?.map((tutor) => (
                <PublicTutorCard
                  key={tutor.id}
                  tutor={tutor}
                  priceSuffix="/hr"
                  onOpen={(code) =>
                    void navigate({ to: "/tutors/$tutorCode", params: { tutorCode: code } })
                  }
                  saveAction={<TutorSaveButton tutorId={tutor.id} />}
                  footerAction={
                    <Button
                      asChild
                      className="h-9 rounded-sm bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-white hover:bg-[color:var(--surface-invert)]"
                    >
                      <a
                        href={buildTutorWhatsAppUrl("", tutor.tutor_code)}
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

          {CENTRE_MARKET_ENABLED && (
            <div className="mt-14">
              <h2 className="text-xl font-black tracking-tight text-[color:var(--ink)]">
                Saved courses
              </h2>
              {savedCoursesQuery.isLoading ? (
                <div className="mt-6 text-sm text-muted-foreground">Loading saved courses...</div>
              ) : savedCourses.length === 0 ? (
                <div className="mt-6 rounded-sm border border-dashed border-border bg-card p-10 text-center">
                  <BookOpen
                    className="mx-auto h-8 w-8 text-[color:var(--brand-teal)]"
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
                      <div
                        key={course.id}
                        className="flex items-center gap-4 rounded-lg border border-border bg-card p-4"
                      >
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
      </main>
      <SiteFooter />
    </div>
  );
}
