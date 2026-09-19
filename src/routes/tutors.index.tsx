import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { SearchX } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { WhatsAppIcon } from "@/components/layout/WhatsAppFloatButton";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TutorsSearch } from "@/components/search/tutors-search";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import { TutorSaveButton } from "@/features/tutors/saved-tutors";
import { CompareBar, CompareDialog, useTutorCompare } from "@/features/tutors/compare-tutors";
import { buildTutorWhatsAppUrl } from "@/features/tutors/tutor-display";
import {
  fetchPublishedTutors,
  getTutorCardHighlights,
  matchesLessonModeFilter,
  matchesStationFilter,
  type Tutor,
} from "@/features/tutors/queries";
import { matchesCategoryFilter, matchesSubjectQuery } from "@/features/tutors/subjects";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  category: z.string().optional(),
  subject: z.string().optional(),
  station: z.string().optional(), // nearest MTR station to the student
  mode: z.string().optional(), // online | in_person | either
  gender: z.string().optional(), // male | female | other
  status: z.string().optional(), // uni_student | full_part_time_tutor | examiner
  min_price: z.coerce.number().int().min(0).optional(),
  max_price: z.coerce.number().int().min(0).optional(),
  sort: z.string().optional(), // "" | price_asc | price_desc
  q: z.string().optional(),
  open: z.preprocess(
    (value) => (value === "1" || value === "true" || value === true ? true : undefined),
    z.boolean().optional(),
  ), // transient: opens the mobile search overlay when hopping tabs
});
type SearchState = z.infer<typeof searchSchema>;

export const Route = createFileRoute("/tutors/")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Find Verified Tutors in Hong Kong | MatchMax" },
      {
        name: "description",
        content:
          "Browse verified tutors in Hong Kong by subject, MTR station, lesson mode and price. Search for IB, DSE, IGCSE, AP, A-Level, Mathematics, English and more.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Find Verified Tutors in Hong Kong | MatchMax" },
      {
        property: "og:description",
        content:
          "Browse verified tutors in Hong Kong by subject, MTR station, lesson mode and price. Search for IB, DSE, IGCSE, AP, A-Level, Mathematics, English and more.",
      },
      { property: "og:url", content: "https://matchmax.hk/tutors" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/tutors" }],
  }),
  component: TutorsDirectory,
});

function TutorsDirectory() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/tutors/" });
  const [draft, setDraft] = useState<SearchState>(search);

  useEffect(() => {
    setDraft(search);
  }, [search]);

  const setDraftParam = (patch: Partial<SearchState>) => {
    setDraft((prev) => {
      const next: SearchState = { ...prev, ...patch };
      (Object.keys(next) as (keyof SearchState)[]).forEach((k) => {
        const v = next[k];
        if (v === "" || v === undefined || (typeof v === "number" && Number.isNaN(v)))
          delete next[k];
      });
      return next;
    });
  };

  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ["tutors", "published"],
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
      const value = data?.value;
      return typeof value === "string" ? value : "";
    },
  });

  const categoryFilter = (draft.category ?? "").toLowerCase();

  const subjectFilter = (draft.subject ?? "").toLowerCase();
  const stationFilter = draft.station ?? "";
  const modeFilter = draft.mode ?? "";
  const genderFilter = draft.gender ?? "";
  const statusFilter = draft.status ?? "";
  const effectiveStationFilter = modeFilter === "in_person" ? stationFilter : "";

  const filtered = useMemo(() => {
    const query = (draft.q ?? "").trim().toLowerCase();
    const sort = draft.sort ?? "";

    const list = tutors.filter((tut) => {
      if (
        categoryFilter &&
        !matchesCategoryFilter(categoryFilter, tut.subjects, [
          ...tut.target_students,
          ...getTutorCardHighlights(tut),
        ])
      )
        return false;
      if (subjectFilter && !tut.subjects.some((s) => matchesSubjectQuery(s, subjectFilter)))
        return false;
      if (draft.min_price !== undefined && tut.hourly_rate < draft.min_price) return false;
      if (draft.max_price !== undefined && tut.hourly_rate > draft.max_price) return false;
      if (!matchesLessonModeFilter(modeFilter, tut.lesson_mode)) return false;
      if (!matchesStationFilter(effectiveStationFilter, tut.stations)) return false;
      if (genderFilter) {
        const g = (tut as unknown as { gender?: string | null }).gender ?? "";
        if (g !== genderFilter) return false;
      }
      if (statusFilter && (tut.tutor_status ?? "") !== statusFilter) return false;
      if (
        query &&
        !(
          tut.tutor_code.toLowerCase().includes(query) ||
          tut.subjects.some((s) => matchesSubjectQuery(s, query)) ||
          getTutorCardHighlights(tut).some((highlight) => highlight.toLowerCase().includes(query))
        )
      )
        return false;
      return true;
    });

    return [...list].sort((a, b) => {
      if (sort === "price_asc")
        return a.hourly_rate - b.hourly_rate || a.tutor_code.localeCompare(b.tutor_code);
      if (sort === "price_desc")
        return b.hourly_rate - a.hourly_rate || a.tutor_code.localeCompare(b.tutor_code);
      return (
        (b.experience_years ?? 0) - (a.experience_years ?? 0) ||
        a.hourly_rate - b.hourly_rate ||
        a.tutor_code.localeCompare(b.tutor_code)
      );
    });
  }, [
    tutors,
    categoryFilter,
    subjectFilter,
    effectiveStationFilter,
    modeFilter,
    genderFilter,
    statusFilter,
    draft.q,
    draft.min_price,
    draft.max_price,
    draft.sort,
  ]);

  const { compareIds, compareTutors, toggleCompare, compareOpen, setCompareOpen, clearCompare } =
    useTutorCompare(tutors);

  const clearAll = () => {
    setDraft({});
    navigate({ search: {} as SearchState });
  };

  const openTutorDetail = (tutorCode: string) => {
    navigate({ to: "/tutors/$tutorCode", params: { tutorCode } });
  };

  const hotlineUrl = buildTutorWhatsAppUrl(whatsappNumber, "");

  const applySearch = (override?: Partial<SearchState>) => {
    const next = { ...draft, ...override };
    navigate({
      search: {
        ...next,
        station: next.mode === "in_person" ? next.station : undefined,
      },
    });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border py-10 sm:py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h1 className="text-4xl font-bold tracking-tight text-[color:var(--ink)] sm:text-5xl">
              Find verified tutors
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Start with a subject or tutor code, then narrow the list to the right fit.
            </p>
            <TutorsSearch
              className="mt-7"
              draft={draft}
              onDraftChange={setDraftParam}
              onApply={applySearch}
              onClear={clearAll}
              resultCount={filtered.length}
              allPrices={tutors.map((tutor) => tutor.hourly_rate)}
              defaultOverlayOpen={search.open === true}
              whatsappUrl={hotlineUrl || undefined}
            />
          </div>
        </section>
        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-6 flex items-baseline justify-between">
              {isLoading ? (
                <Skeleton className="h-4 w-28" />
              ) : (
                <p className="text-sm text-muted-foreground">
                  <span className="font-bold text-foreground">{filtered.length}</span>{" "}
                  {filtered.length === 1 ? "tutor" : "tutors"} found
                </p>
              )}
            </div>

            {isLoading && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-[23rem] rounded-[10px] border border-border" />
                ))}
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="rounded-sm border border-border bg-card p-8 text-center sm:p-12">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-[color:var(--foreground)]/15 bg-[color:var(--foreground)]/[0.04]">
                  <SearchX
                    className="h-5 w-5 text-[color:var(--muted-foreground)]"
                    aria-hidden="true"
                  />
                </div>
                <h2 className="mt-4 text-xl font-bold tracking-tight text-[color:var(--ink)] sm:text-2xl">
                  {t("directory.empty_title")}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  {t("directory.empty_desc")}
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button variant="outline" onClick={clearAll}>
                    {t("directory.empty_clear")}
                  </Button>
                  {hotlineUrl ? (
                    <Button asChild variant="ghost">
                      <a href={hotlineUrl} target="_blank" rel="noreferrer">
                        <WhatsAppIcon
                          className="mr-2 h-4 w-4 text-[color:var(--muted-foreground)]"
                          aria-hidden="true"
                        />
                        {t("directory.empty_whatsapp")}
                      </a>
                    </Button>
                  ) : null}
                  <Button asChild variant="solid" color="blue" className="font-bold">
                    <Link to="/tutor-requests" search={{ post: true }}>
                      {t("directory.empty_case")}
                    </Link>
                  </Button>
                </div>
              </div>
            )}

            {!isLoading && filtered.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((tut: Tutor) => (
                  <PublicTutorCard
                    key={tut.id}
                    tutor={tut}
                    priceSuffix={t("featured.per_hour")}
                    onOpen={openTutorDetail}
                    onCompareToggle={() => toggleCompare(tut)}
                    compareSelected={compareIds.includes(tut.id)}
                    footerAction={
                      <>
                        <TutorSaveButton tutorId={tut.id} compact />
                        <Button
                          asChild
                          className="h-9 rounded-sm bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--surface-invert-hover)]"
                        >
                          <a
                            href={buildTutorWhatsAppUrl(whatsappNumber, tut.tutor_code)}
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
                ))}
              </div>
            )}
          </div>
        </section>
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
