import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { BadgeCheck, MapPin, Search, Globe, X } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { LessonModeSelect } from "@/components/ui/lesson-mode-select";
import {
  fetchPublishedTutors,
  getTutorGenderLabel,
  getTutorLessonModeLabel,
  getTutorLocationLabel,
  HK_DISTRICTS,
  matchesDistrictFilter,
  matchesLessonModeFilter,
  type Tutor,
} from "@/features/tutors/queries";
import { DEFAULT_SUBJECT_OPTIONS } from "@/features/tutors/subjects";
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
      { name: "description", content: "Browse verified tutors in Hong Kong by subject, district, lesson mode and price. Search for IB, DSE, IGCSE, AP, A-Level, Mathematics, English and more." },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Find Verified Tutors in Hong Kong | MatchMax" },
      { property: "og:description", content: "Browse verified tutors in Hong Kong by subject, district, lesson mode and price. Search for IB, DSE, IGCSE, AP, A-Level, Mathematics, English and more." },
      { property: "og:url", content: "https://www.maxmatch.app/tutors" },
    ],
    links: [{ rel: "canonical", href: "https://www.maxmatch.app/tutors" }],
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
  const [q, setQ] = useState(search.q ?? "");

  const setParam = (patch: Partial<SearchState>) => {
    navigate({
      search: (prev: SearchState) => {
        const next: SearchState = { ...prev, ...patch };
        (Object.keys(next) as (keyof SearchState)[]).forEach((k) => {
          const v = next[k];
          if (v === "" || v === undefined || (typeof v === "number" && Number.isNaN(v))) delete next[k];
        });
        return next;
      },
    });
  };

  const { data: tutors = [], isLoading } = useQuery({
    queryKey: ["tutors", "published"],
    queryFn: fetchPublishedTutors,
  });

  const { data: subjectOptions = DEFAULT_SUBJECT_OPTIONS } = useQuery({
    queryKey: ["settings", "subject_options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings").select("value").eq("key", "subject_options").maybeSingle();
      if (error) throw error;
      const v = data?.value;
      if (Array.isArray(v)) {
        const arr = (v as unknown[]).filter((x): x is string => typeof x === "string" && x.trim().length > 0);
        if (arr.length > 0) return arr;
      }
      return DEFAULT_SUBJECT_OPTIONS;
    },
  });

  const categoryFilter = (search.category ?? "").toLowerCase();
  const subjectFilter = (search.subject ?? "").toLowerCase();
  const districtFilter = search.district ?? "";
  const modeFilter = search.mode ?? "";
  const genderFilter = search.gender ?? "";
  const effectiveDistrictFilter = modeFilter === "in_person" ? districtFilter : "";

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const list = tutors.filter((tut) => {
      if (categoryFilter) {
        const categorySource = [
          ...tut.subjects,
          ...tut.target_students,
          tut.headline ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!categorySource.includes(categoryFilter)) return false;
      }
      if (subjectFilter && !tut.subjects.some((s) => s.toLowerCase().includes(subjectFilter))) return false;
      if (!matchesLessonModeFilter(modeFilter, tut.lesson_mode)) return false;
      if (!matchesDistrictFilter(effectiveDistrictFilter, tut.district)) return false;
      if (genderFilter) {
        const g = (tut as unknown as { gender?: string | null }).gender ?? "";
        if (g !== genderFilter) return false;
      }
      if (query && !(
        tut.tutor_code.toLowerCase().includes(query) ||
        tut.subjects.some((s) => s.toLowerCase().includes(query)) ||
        (tut.headline ?? "").toLowerCase().includes(query)
      )) return false;
      return true;
    });

    return [...list].sort(
      (a, b) =>
        (b.experience_years ?? 0) - (a.experience_years ?? 0) ||
        a.hourly_rate - b.hourly_rate ||
        a.tutor_code.localeCompare(b.tutor_code),
    );
  }, [tutors, categoryFilter, subjectFilter, effectiveDistrictFilter, modeFilter, genderFilter, q]);

  const activeChips: { key: string; label: string; onClear: () => void }[] = [];
  if (search.category) activeChips.push({ key: "category", label: `Category: ${search.category}`, onClear: () => setParam({ category: undefined }) });
  if (search.subject) activeChips.push({ key: "subject", label: `Subject: ${search.subject}`, onClear: () => setParam({ subject: undefined }) });
  if (modeFilter === "in_person" && search.district) activeChips.push({ key: "district", label: `District: ${search.district}`, onClear: () => setParam({ district: undefined }) });
  if (search.mode) activeChips.push({ key: "mode", label: `Mode: ${MODE_OPTIONS.find((m) => m.value === search.mode)?.label ?? search.mode}`, onClear: () => setParam({ mode: undefined }) });
  if (search.gender) activeChips.push({ key: "gender", label: `Gender: ${GENDER_OPTIONS.find((g) => g.value === search.gender)?.label ?? search.gender}`, onClear: () => setParam({ gender: undefined }) });

  const clearAll = () => {
    setQ("");
    navigate({ search: {} as SearchState });
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="border-b border-border bg-muted/30 py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h1 className="text-4xl font-black tracking-tight text-[color:var(--brand-navy)] sm:text-5xl">Find verified tutors in Hong Kong</h1>
            <p className="mt-3 max-w-3xl text-lg text-muted-foreground">
              Browse tutors for IB, DSE, IGCSE, AP, A-Level, Mathematics, English, Science and more. Filter by district, lesson mode, price and language to find the right tutor quickly.
            </p>

            <div className="mt-8 rounded-3xl border border-border bg-card p-4 shadow-sm sm:p-5">
              <div className="flex items-center justify-between gap-2 border-b border-border pb-4">
                <p className="text-sm font-black uppercase tracking-wide text-[color:var(--brand-teal)]">Find tutor</p>
              </div>

              <div className="mt-4 grid gap-3 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1fr]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    className="h-11 rounded-xl pl-9"
                    placeholder="Search tutor code, subject, keyword…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
                <SearchableSelect
                  value={search.category ?? ""}
                  onChange={(v) => setParam({ category: v || undefined })}
                  options={CATEGORY_OPTIONS}
                  placeholder="Category"
                  searchPlaceholder="Search category…"
                />
                <SearchableSelect
                  value={search.subject ?? ""}
                  onChange={(v) => setParam({ subject: v || undefined })}
                  options={[{ value: "", label: "Any subject" }, ...subjectOptions.map((s) => ({ value: s, label: s }))]}
                  placeholder="Subject"
                  searchPlaceholder="Search subject…"
                />
                <LessonModeSelect
                  mode={(search.mode as "" | "online" | "in_person" | "either" | undefined) ?? ""}
                  district={search.district}
                  districts={HK_DISTRICTS}
                  onChange={({ mode, district }) =>
                    setParam({
                      mode: mode || undefined,
                      district: mode === "in_person" ? district : undefined,
                    })
                  }
                  placeholder="Lesson mode"
                />
                <SearchableSelect
                  value={search.gender ?? ""}
                  onChange={(v) => setParam({ gender: v || undefined })}
                  options={GENDER_OPTIONS}
                  placeholder="Gender"
                />
              </div>
            </div>

            {/* Active chips + result meta */}
            {(activeChips.length > 0 || q) && (
              <div className="mt-5 flex flex-wrap items-center gap-2">
                {q && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--brand-navy)]/5 px-3 py-1 text-xs font-semibold text-[color:var(--brand-navy)]">
                    “{q}”
                    <button aria-label="Clear search" onClick={() => setQ("")} className="rounded-full p-0.5 hover:bg-[color:var(--brand-navy)]/10">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                )}
                {activeChips.map((c) => (
                  <span key={c.key} className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--brand-teal)]/10 px-3 py-1 text-xs font-semibold text-[color:var(--brand-teal)]">
                    {c.label}
                    <button aria-label={`Clear ${c.key}`} onClick={c.onClear} className="rounded-full p-0.5 hover:bg-[color:var(--brand-teal)]/20">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <Button variant="ghost" size="sm" onClick={clearAll} className="ml-auto h-7 text-xs font-semibold text-muted-foreground hover:text-foreground">
                  Clear all
                </Button>
              </div>
            )}
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-6 flex items-baseline justify-between">
              <p className="text-sm text-muted-foreground">
                {isLoading ? "Loading…" : (
                  <><span className="font-bold text-foreground">{filtered.length}</span> {filtered.length === 1 ? "tutor" : "tutors"} found</>
                )}
              </p>
            </div>

            {isLoading && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-64 animate-pulse rounded-sm border border-border bg-muted/40" />
                ))}
              </div>
            )}

            {!isLoading && filtered.length === 0 && (
              <div className="rounded-sm border border-dashed border-border bg-card p-12 text-center">
                <p className="text-lg font-bold text-[color:var(--brand-navy)]">No tutors match your filters yet</p>
                <p className="mt-2 text-sm text-muted-foreground">Try widening your search, or clear filters to see everyone.</p>
                <div className="mt-6 flex flex-wrap justify-center gap-3">
                  <Button variant="outline" onClick={clearAll}>Clear filters</Button>
                  <Button asChild className="bg-[color:var(--brand-navy)] font-bold text-white hover:bg-[color:var(--brand-royal)]">
                    <Link to="/auth">Request a tutor</Link>
                  </Button>
                </div>
              </div>
            )}

            {!isLoading && filtered.length > 0 && (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filtered.map((tut: Tutor) => (
                  <Link
                    key={tut.id}
                    to="/tutors/$tutorCode"
                    params={{ tutorCode: tut.tutor_code }}
                    className="flex flex-col rounded-sm border border-border bg-card p-6 transition-all hover:shadow-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--brand-teal)]"
                  >
                    <div className="flex items-center gap-4">
                      {tut.photo_url ? (
                        <img src={tut.photo_url} alt={tut.tutor_code} className="h-14 w-14 shrink-0 rounded-full object-cover" />
                      ) : (
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-[color:var(--brand-teal)]/20 bg-[color:var(--brand-teal)]/10 text-base font-semibold text-[color:var(--brand-teal)]">
                          {tut.tutor_code?.slice(0, 2).toUpperCase() || "TP"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-base font-bold text-foreground break-words">
                          {tut.tutor_code}{getTutorGenderLabel(tut.gender) ? ` · ${getTutorGenderLabel(tut.gender)}` : ""}
                        </p>
                        <p className="text-sm leading-relaxed text-muted-foreground break-words whitespace-pre-line">
                          {tut.headline ?? ([tut.university, tut.highschool].filter(Boolean).join(" | ") || getTutorLessonModeLabel(tut.lesson_mode))}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {tut.subjects.slice(0, 3).map((subject) => (
                        <span key={subject} className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                          {subject}
                        </span>
                      ))}
                      {tut.subjects.length > 3 && (
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                          +{tut.subjects.length - 3} more
                        </span>
                      )}
                    </div>
                    {tut.badge && (
                      <div className="mt-4">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--brand-teal)]/10 px-2.5 py-1 text-[11px] font-bold text-[color:var(--brand-teal)]">
                          <BadgeCheck className="h-3 w-3" /> {tut.badge}
                        </span>
                      </div>
                    )}
                    {tut.target_students.length > 0 && (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Target students: {tut.target_students.slice(0, 2).join(", ")}{tut.target_students.length > 2 ? ` +${tut.target_students.length - 2} more` : ""}
                      </p>
                    )}
                    <div className="mt-5 flex items-center justify-between border-t border-border pt-4 text-sm">
                      <span className="inline-flex items-center gap-1 text-muted-foreground">
                        {tut.lesson_mode === "online" ? <Globe className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                        {getTutorLocationLabel(tut)}
                      </span>
                    </div>
                    <p className="mt-4 text-2xl font-black text-[color:var(--brand-navy)]">
                      HK${tut.hourly_rate}
                      <span className="ml-1 text-sm font-semibold text-muted-foreground">{t("featured.per_hour")}</span>
                    </p>
                  </Link>
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
