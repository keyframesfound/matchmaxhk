import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Building2, Search } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { EmptyState } from "@/components/business/empty-state";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CompactSearchPill,
  SearchGroupProvider,
  StickySearchBar,
} from "@/components/search/sticky-search-group";
import {
  CoursesSearchBar,
  CoursesSearchMobile,
  useCoursesCompactSummary,
} from "@/components/search/courses-search";
import { CourseCard } from "@/features/courses/course-card";
import { useBusinessTracker } from "@/features/business/use-analytics";
import { fetchPublishedCourseSubjects, fetchPublishedCourses } from "@/features/courses/queries";
import { CENTRE_MARKET_ENABLED } from "@/lib/feature-flags";

const searchSchema = z.object({
  subject: z.string().optional(),
  level: z.string().optional(),
  mode: z.string().optional(),
  district: z.string().optional(),
  q: z.string().optional(),
  open: z.preprocess(
    (value) => (value === "1" || value === "true" || value === true ? true : undefined),
    z.boolean().optional(),
  ), // transient: opens the mobile search overlay when hopping tabs
});
type SearchState = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/courses/")({
  beforeLoad: () => {
    if (!CENTRE_MARKET_ENABLED) throw notFound();
  },
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Courses from Hong Kong Learning Centres & Tutors | MatchMax" },
      {
        name: "description",
        content:
          "Browse courses offered by verified tutoring businesses in Hong Kong — IB, DSE, IGCSE, AP, A-Level and more. Compare prices, schedules and lesson modes.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Courses | MatchMax" },
      { property: "og:url", content: "https://matchmax.hk/courses" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/courses" }],
  }),
  component: CoursesDirectory,
});

function CoursesDirectory() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/courses/" });
  const [draft, setDraft] = useState<SearchState>(search);

  useEffect(() => {
    setDraft(search);
  }, [search]);

  const setDraftParam = (patch: Partial<SearchState>) => {
    setDraft((prev) => {
      const next: SearchState = { ...prev, ...patch };
      (Object.keys(next) as (keyof SearchState)[]).forEach((k) => {
        const v = next[k];
        if (v === "") delete next[k];
      });
      return next;
    });
  };

  const { data: courses, isLoading } = useQuery({
    queryKey: ["courses", "published", search],
    queryFn: () => fetchPublishedCourses(search),
  });

  const track = useBusinessTracker();
  useEffect(() => {
    if (!courses?.length) return;
    const orgIds = Array.from(
      new Set(courses.map((course) => course.organization?.id).filter(Boolean)),
    ) as string[];
    if (orgIds.length === 0) return;
    track(orgIds.map((organizationId) => ({ organizationId, type: "impression" as const })));
  }, [courses, track]);
  const { data: subjects } = useQuery({
    queryKey: ["courses", "published-subjects"],
    queryFn: fetchPublishedCourseSubjects,
  });

  const clearAll = () => {
    setDraft({});
    navigate({ search: {} as SearchState });
  };

  const results = courses ?? [];
  const hasActiveFilters = Object.values(search).some(Boolean);
  const subjectOptions = [
    { value: "", label: "Any subject" },
    ...(subjects ?? []).map((subject) => ({ value: subject, label: subject })),
  ];

  const handleSearch = (override?: Partial<SearchState>) => {
    navigate({ search: { ...draft, ...override } });
  };

  const compactSummary = useCoursesCompactSummary(draft);

  return (
    <SearchGroupProvider>
      <div className="flex min-h-screen flex-col bg-background">
        <SiteHeader merged centerSlot={<CompactSearchPill summary={compactSummary} />} />
        <main className="flex-1">
          <section className="border-b border-border bg-[color:var(--surface-header)] py-10 sm:py-12 lg:border-b-0">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <p className="text-sm font-semibold text-[color:var(--brand-link)]">
                Course directory
              </p>
              <h1 className="mt-2 text-4xl font-bold tracking-tight text-[color:var(--ink)] sm:text-5xl">
                Find the right course
              </h1>
              <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
                Compare structured courses from verified education centres across Hong Kong.
              </p>

              <CoursesSearchMobile
                className="mt-8"
                draft={draft}
                onDraftChange={setDraftParam}
                onApply={handleSearch}
                onClear={clearAll}
                subjectOptions={subjects ?? []}
                defaultOverlayOpen={search.open === true}
              />
            </div>
          </section>
          <StickySearchBar>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 py-3">
              <CoursesSearchBar
                draft={draft}
                onDraftChange={setDraftParam}
                onApply={handleSearch}
                onClear={clearAll}
                subjectOptions={subjects ?? []}
              />
            </div>
          </StickySearchBar>

          <section className="py-12">
            <div className="mx-auto max-w-7xl px-4 sm:px-6">
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                {isLoading ? (
                  <Skeleton className="h-4 w-28" />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    <span className="font-bold text-foreground">{results.length}</span>{" "}
                    {results.length === 1 ? "course" : "courses"} found
                  </p>
                )}
                {hasActiveFilters ? (
                  <Button variant="ghost" size="sm" onClick={clearAll}>
                    Clear filters
                  </Button>
                ) : null}
              </div>

              {isLoading && (
                <div className="flex flex-col gap-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-40 rounded-lg border border-border" />
                  ))}
                </div>
              )}

              {!isLoading && results.length === 0 && (
                <EmptyState
                  icon={Search}
                  title={
                    hasActiveFilters ? "No courses match these filters" : "No courses available yet"
                  }
                  description={
                    hasActiveFilters
                      ? "Try broadening your search or clear the filters to browse all published courses."
                      : "New courses from verified education centres will appear here."
                  }
                  action={
                    hasActiveFilters ? (
                      <Button variant="outline" onClick={clearAll}>
                        Clear filters
                      </Button>
                    ) : undefined
                  }
                  secondaryAction={
                    <Button asChild variant="ghost" prefix={<Building2 />}>
                      <Link to="/pricing">List your courses</Link>
                    </Button>
                  }
                />
              )}

              {!isLoading && results.length > 0 && (
                <div className="flex flex-col gap-4">
                  {results.map((course) => (
                    <CourseCard key={course.id} course={course} />
                  ))}
                </div>
              )}
            </div>
          </section>
        </main>
        <SiteFooter />
      </div>
    </SearchGroupProvider>
  );
}
