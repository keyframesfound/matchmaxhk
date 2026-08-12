import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Search } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { LessonModeSelect } from "@/components/ui/lesson-mode-select";
import { PublicTutorCard, buildTutorWhatsAppUrl } from "@/features/tutors/public-tutor-card";
import {
  fetchPublishedTutors,
  HK_DISTRICTS,
  matchesDistrictFilter,
  matchesLessonModeFilter,
  type Tutor,
} from "@/features/tutors/queries";
import { DEFAULT_SUBJECT_OPTIONS, matchesSubjectQuery } from "@/features/tutors/subjects";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  category: z.string().optional(),
  subject: z.string().optional(),
  district: z.string().optional(),
  mode: z.string().optional(), // online | in_person | either
  gender: z.string().optional(), // male | female | other
  q: z.string().optional(),
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
          "Browse verified tutors in Hong Kong by subject, district, lesson mode and price. Search for IB, DSE, IGCSE, AP, A-Level, Mathematics, English and more.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Find Verified Tutors in Hong Kong | MatchMax" },
      {
        property: "og:description",
        content:
          "Browse verified tutors in Hong Kong by subject, district, lesson mode and price. Search for IB, DSE, IGCSE, AP, A-Level, Mathematics, English and more.",
      },
      { property: "og:url", content: "https://matchmax.hk/tutors" },
    ],
    links: [{ rel: "canonical", href: "https://matchmax.hk/tutors" }],
  }),
  component: TutorsDirectory,
});

const MODE_OPTIONS = [
  { value: "", label: "Any lesson mode" },
  { value: "online", label: "Online" },
  { value: "in_person", label: "In-person" },
  { value: "either", label: "Open to discussion" },
];

const GENDER_OPTIONS = [
  { value: "", label: "Any gender" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
];

const CATEGORY_OPTIONS = [
  { value: "", label: "Any category" },
  { value: "IB", label: "IB" },
  { value: "DSE", label: "DSE" },
  { value: "IGCSE", label: "IGCSE" },
  { value: "AP", label: "AP" },
  { value: "A-Level", label: "A-Level" },
  { value: "Primary", label: "Primary" },
  { value: "Secondary", label: "Secondary" },
  { value: "International", label: "International" },
];

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

  const subjectOptions = DEFAULT_SUBJECT_OPTIONS;

  const categoryFilter = (draft.category ?? "").toLowerCase();
  const subjectFilter = (draft.subject ?? "").toLowerCase();
  const districtFilter = draft.district ?? "";
  const modeFilter = draft.mode ?? "";
  const genderFilter = draft.gender ?? "";
  const effectiveDistrictFilter = modeFilter === "in_person" ? districtFilter : "";

  const filtered = useMemo(() => {
    const query = (draft.q ?? "").trim().toLowerCase();
    const list = tutors.filter((tut) => {
      if (categoryFilter) {
        const categorySource = [...tut.subjects, ...tut.target_students, tut.headline ?? ""]
          .join(" ")
          .toLowerCase();
        if (!categorySource.includes(categoryFilter)) return false;
      }
      if (subjectFilter && !tut.subjects.some((s) => matchesSubjectQuery(s, subjectFilter)))
        return false;
      if (!matchesLessonModeFilter(modeFilter, tut.lesson_mode)) return false;
      if (!matchesDistrictFilter(effectiveDistrictFilter, tut.district)) return false;
      if (genderFilter) {
        const g = (tut as unknown as { gender?: string | null }).gender ?? "";
        if (g !== genderFilter) return false;
      }
      if (
        query &&
        !(
          tut.tutor_code.toLowerCase().includes(query) ||
          tut.subjects.some((s) => matchesSubjectQuery(s, query)) ||
          (tut.headline ?? "").toLowerCase().includes(query)
        )
      )
        return false;
      return true;
    });

    return [...list].sort(
      (a, b) =>
        (b.experience_years ?? 0) - (a.experience_years ?? 0) ||
        a.hourly_rate - b.hourly_rate ||
        a.tutor_code.localeCompare(b.tutor_code),
    );
  }, [
    tutors,
    categoryFilter,
    subjectFilter,
    effectiveDistrictFilter,
    modeFilter,
    genderFilter,
    draft.q,
  ]);

  const clearAll = () => {
    setDraft({});
    navigate({ search: {} as SearchState });
  };

  const openTutorDetail = (tutorCode: string) => {
    navigate({ to: "/tutors/$tutorCode", params: { tutorCode } });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="hero-startup-bg border-b border-border py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h1 className="text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">
              Find verified tutors
            </h1>

            <div className="relative mt-8 rounded-sm border border-border bg-card p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
                <p className="text-sm font-black uppercase tracking-wide text-[color:var(--brand-teal)]">
                  Find tutor
                </p>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr_auto]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-11 rounded-sm pl-9"
                    placeholder="Search tutor code, subject, keyword…"
                    value={draft.q ?? ""}
                    onChange={(e) => setDraftParam({ q: e.target.value })}
                  />
                </div>
                <SearchableSelect
                  value={draft.category ?? ""}
                  onChange={(v) => setDraftParam({ category: v || undefined })}
                  options={CATEGORY_OPTIONS}
                  placeholder="Any category"
                  searchPlaceholder="Search category..."
                  className="h-11 rounded-sm"
                />
                <SearchableSelect
                  value={draft.subject ?? ""}
                  onChange={(v) => setDraftParam({ subject: v || undefined })}
                  options={[
                    { value: "", label: "Any subject" },
                    ...subjectOptions.map((s) => ({ value: s, label: s })),
                  ]}
                  placeholder="Any subject"
                  searchPlaceholder="Search subject..."
                  className="h-11 rounded-sm"
                />
                <LessonModeSelect
                  mode={(draft.mode as "" | "online" | "in_person" | "either" | undefined) ?? ""}
                  district={draft.district}
                  districts={HK_DISTRICTS}
                  onChange={({ mode, district }) =>
                    setDraftParam({
                      mode: mode || undefined,
                      district: mode === "in_person" ? district : undefined,
                    })
                  }
                  placeholder="Any lesson mode"
                  className="h-11 rounded-sm"
                />
                <SearchableSelect
                  value={draft.gender ?? ""}
                  onChange={(v) => setDraftParam({ gender: v || undefined })}
                  options={GENDER_OPTIONS}
                  placeholder="Any gender"
                  className="h-11 rounded-sm"
                />
                <Button
                  className="h-11 rounded-sm bg-[color:var(--brand-navy)] px-6 font-bold text-white hover:bg-[color:var(--brand-royal)]"
                  onClick={() =>
                    navigate({
                      search: {
                        ...draft,
                        district: draft.mode === "in_person" ? draft.district : undefined,
                      },
                    })
                  }
                >
                  Search
                </Button>
              </div>
            </div>

          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-6 flex items-baseline justify-between">
              <p className="text-sm text-muted-foreground">
                {isLoading ? (
                  "Loading…"
                ) : (
                  <>
                    <span className="font-bold text-foreground">{filtered.length}</span>{" "}
                    {filtered.length === 1 ? "tutor" : "tutors"} found
                  </>
                )}
              </p>
            </div>

            {isLoading && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-64 animate-pulse rounded-sm border border-border bg-muted/40"
                  />
                ))}
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="rounded-sm border border-dashed border-border bg-card p-12 text-center">
                <p className="text-lg font-bold text-[color:var(--brand-navy)]">
                  No tutors match your filters yet
                </p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Try widening your search, or clear filters to see everyone.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button variant="outline" onClick={clearAll}>
                    Clear filters
                  </Button>
                  <Button
                    asChild
                    className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]"
                  >
                    <Link to="/auth">Request a tutor</Link>
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
                    footerAction={
                      <Button
                        asChild
                        className="h-9 rounded-sm bg-[#0A245F] px-4 text-[13px] font-bold text-white hover:bg-[#081d4f]"
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
                    }
                  />
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
