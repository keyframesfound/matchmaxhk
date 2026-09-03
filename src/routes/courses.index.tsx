import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { Building2, Search, SlidersHorizontal } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { EmptyState } from "@/components/business/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { CourseCard } from "@/features/courses/course-card";
import {
  COURSE_LEVEL_OPTIONS,
  COURSE_MODE_OPTIONS,
  fetchPublishedCourseSubjects,
  fetchPublishedCourses,
} from "@/features/courses/queries";
import { HK_DISTRICTS } from "@/features/tutors/queries";

const searchSchema = z.object({
  subject: z.string().optional(),
  level: z.string().optional(),
  mode: z.string().optional(),
  district: z.string().optional(),
  q: z.string().optional(),
});
type SearchState = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/courses/")({
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

  const handleSearch = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    navigate({ search: { ...draft } });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="hero-startup-bg border-b border-border py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <p className="text-sm font-semibold text-[color:var(--brand-link)]">Course directory</p>
            <h1 className="mt-2 text-4xl font-black tracking-tight text-[color:var(--ink)] sm:text-5xl">
              Find the right course
            </h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Compare structured courses from verified education centres across Hong Kong.
            </p>

            <form
              className="relative mt-8 rounded-sm border border-border bg-card p-4 shadow-sm sm:p-5"
              onSubmit={handleSearch}
            >
              <div className="flex items-center gap-2 border-b border-border pb-4">
                <SlidersHorizontal className="h-4 w-4 text-[color:var(--brand-link)]" />
                <p className="text-sm font-bold text-[color:var(--ink)]">Search and filter</p>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-11 rounded-sm pl-9"
                    placeholder="Search course title, subject, keyword…"
                    value={draft.q ?? ""}
                    onChange={(e) => setDraftParam({ q: e.target.value })}
                  />
                </div>
                <SearchableSelect
                  value={draft.level ?? ""}
                  onChange={(v) => setDraftParam({ level: v || undefined })}
                  options={[
                    { value: "", label: "Any level" },
                    ...COURSE_LEVEL_OPTIONS.map((level) => ({ value: level, label: level })),
                  ]}
                  placeholder="Any level"
                  searchPlaceholder="Search level..."
                  className="h-11 rounded-sm"
                />
                <SearchableSelect
                  value={draft.subject ?? ""}
                  onChange={(v) => setDraftParam({ subject: v || undefined })}
                  options={subjectOptions}
                  placeholder="Any subject"
                  searchPlaceholder="Search subject..."
                  className="h-11 rounded-sm"
                />
                <SearchableSelect
                  value={draft.mode ?? ""}
                  onChange={(v) => setDraftParam({ mode: v || undefined })}
                  options={COURSE_MODE_OPTIONS}
                  placeholder="Any lesson mode"
                  className="h-11 rounded-sm"
                />
                <SearchableSelect
                  value={draft.district ?? ""}
                  onChange={(v) => setDraftParam({ district: v || undefined })}
                  options={[
                    { value: "", label: "Any district" },
                    ...HK_DISTRICTS.map((d) => ({ value: d, label: d })),
                  ]}
                  placeholder="Any district"
                  searchPlaceholder="Search district..."
                  className="h-11 rounded-sm"
                />
                <Button
                  type="submit"
                  className="h-11 rounded-sm bg-[color:var(--surface-invert)] px-6 font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
                >
                  Search
                </Button>
              </div>
            </form>
          </div>
        </section>

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
  );
}
