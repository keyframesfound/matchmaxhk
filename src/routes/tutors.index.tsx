import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Search, SearchX } from "lucide-react";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { WhatsAppIcon } from "@/components/layout/WhatsAppFloatButton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { LessonModeSelect } from "@/components/ui/lesson-mode-select";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
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
import {
  getSubjectOptionsForCategory,
  matchesCategoryFilter,
  matchesSubjectQuery,
} from "@/features/tutors/subjects";
import { supabase } from "@/integrations/supabase/client";

const searchSchema = z.object({
  category: z.string().optional(),
  subject: z.string().optional(),
  station: z.string().optional(), // nearest MTR station to the student
  mode: z.string().optional(), // online | in_person | either
  gender: z.string().optional(), // male | female | other
  min_price: z.coerce.number().int().min(0).optional(),
  max_price: z.coerce.number().int().min(0).optional(),
  sort: z.string().optional(), // "" | price_asc | price_desc
  q: z.string().optional(),
});
type SearchState = z.infer<typeof searchSchema>;

const PRICE_MIN = 100;
const PRICE_MAX = 1200;
const PRICE_STEP = 10;

const formatPrice = (price: number) =>
  price === PRICE_MAX ? `HK$${price.toLocaleString()}+` : `HK$${price.toLocaleString()}`;

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

const CATEGORY_VALUES = ["IB", "DSE", "IGCSE", "AP", "A-Level"];

function TutorsDirectory() {
  const { t } = useTranslation();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/tutors/" });
  const [draft, setDraft] = useState<SearchState>(search);

  const genderOptions = useMemo(
    () => [
      { value: "", label: t("search_panel.any_gender") },
      { value: "female", label: t("search_panel.gender_female") },
      { value: "male", label: t("search_panel.gender_male") },
    ],
    [t],
  );

  const categoryOptions = useMemo(
    () => [
      { value: "", label: t("search_panel.any_category") },
      ...CATEGORY_VALUES.map((value) => ({ value, label: value })),
      { value: "Primary", label: t("search_panel.category_primary") },
      { value: "Secondary", label: t("search_panel.category_secondary") },
      { value: "International", label: t("search_panel.category_international") },
    ],
    [t],
  );

  const sortOptions = useMemo(
    () => [
      { value: "", label: t("search_panel.sort_recommended") },
      { value: "price_asc", label: t("search_panel.sort_price_asc") },
      { value: "price_desc", label: t("search_panel.sort_price_desc") },
    ],
    [t],
  );

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
  const subjectOptions = useMemo(
    () => getSubjectOptionsForCategory(draft.category),
    [draft.category],
  );

  const handleCategoryChange = (category: string) => {
    const nextSubjectOptions = getSubjectOptionsForCategory(category);
    setDraftParam({
      category: category || undefined,
      ...(draft.subject && !nextSubjectOptions.includes(draft.subject)
        ? { subject: undefined }
        : {}),
    });
  };

  const subjectFilter = (draft.subject ?? "").toLowerCase();
  const stationFilter = draft.station ?? "";
  const modeFilter = draft.mode ?? "";
  const genderFilter = draft.gender ?? "";
  const effectiveStationFilter = modeFilter === "in_person" ? stationFilter : "";
  const priceValue: [number, number] = [draft.min_price ?? PRICE_MIN, draft.max_price ?? PRICE_MAX];

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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />
      <main className="flex-1">
        <section className="hero-startup-bg border-b border-border py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h1 className="text-4xl font-bold tracking-tight text-[color:var(--ink)] sm:text-5xl">
              Find verified tutors
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Start with a subject or tutor code, then narrow the list to the right fit.
            </p>
            <div className="relative mt-7 overflow-hidden rounded-sm border border-border bg-card shadow-sm">
              <form
                className="p-4 sm:p-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  navigate({
                    search: {
                      ...draft,
                      station: draft.mode === "in_person" ? draft.station : undefined,
                    },
                  });
                }}
              >
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      className="h-12 rounded-sm pl-9 text-base"
                      placeholder={t("search_panel.keyword_placeholder")}
                      aria-label={t("search_panel.keyword_aria")}
                      value={draft.q ?? ""}
                      onChange={(e) => setDraftParam({ q: e.target.value })}
                    />
                  </div>
                  <Button
                    type="submit"
                    variant="solid"
                    color="blue"
                    className="h-12 rounded-sm px-7 font-bold"
                  >
                    <Search className="mr-1.5 h-4 w-4" />
                    {t("search_panel.search")}
                  </Button>
                </div>
                <div className="mt-4 border-t border-border pt-4">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <SearchableSelect
                      value={draft.category ?? ""}
                      onChange={handleCategoryChange}
                      options={categoryOptions}
                      placeholder={t("search_panel.any_category")}
                      searchPlaceholder={t("search_panel.search_category")}
                      className="h-11 rounded-sm"
                    />
                    <SearchableSelect
                      value={draft.subject ?? ""}
                      onChange={(v) => setDraftParam({ subject: v || undefined })}
                      options={[
                        { value: "", label: t("search_panel.any_subject") },
                        ...subjectOptions.map((s) => ({ value: s, label: s })),
                      ]}
                      placeholder={t("search_panel.any_subject")}
                      searchPlaceholder={t("search_panel.search_subject")}
                      className="h-11 rounded-sm"
                    />
                    <LessonModeSelect
                      mode={
                        (draft.mode as "" | "online" | "in_person" | "either" | undefined) ?? ""
                      }
                      station={draft.station}
                      onChange={({ mode, station }) =>
                        setDraftParam({
                          mode: mode || undefined,
                          station: mode === "in_person" ? station : undefined,
                        })
                      }
                      placeholder={t("search_panel.any_mode")}
                      className="h-11 rounded-sm"
                    />
                    <SearchableSelect
                      value={draft.gender ?? ""}
                      onChange={(v) => setDraftParam({ gender: v || undefined })}
                      options={genderOptions}
                      placeholder={t("search_panel.any_gender")}
                      className="h-11 rounded-sm"
                    />
                  </div>
                </div>
              </form>

              <div className="grid gap-3 border-t border-border bg-[color:var(--surface-subtle)] px-4 py-4 sm:px-5 sm:grid-cols-2 lg:grid-cols-4 lg:items-center">
                <div className="w-full space-y-3 sm:col-span-2 lg:col-span-1">
                  <Label className="tabular-nums">
                    {t("search_panel.price_from")} {formatPrice(priceValue[0])}{" "}
                    {t("search_panel.price_to")} {formatPrice(priceValue[1])}
                  </Label>
                  <Slider
                    value={priceValue}
                    onValueChange={([lo, hi]) =>
                      setDraftParam({
                        min_price: lo > PRICE_MIN ? lo : undefined,
                        max_price: hi < PRICE_MAX ? hi : undefined,
                      })
                    }
                    min={PRICE_MIN}
                    max={PRICE_MAX}
                    step={PRICE_STEP}
                    minStepsBetweenThumbs={1}
                    showTooltip
                    tooltipContent={formatPrice}
                    aria-label={t("search_panel.price_range")}
                  />
                </div>
                <SearchableSelect
                  value={draft.sort ?? ""}
                  onChange={(v) =>
                    navigate({
                      search: (prev: SearchState) => ({ ...prev, sort: v || undefined }),
                    })
                  }
                  options={sortOptions}
                  placeholder={t("search_panel.sort_recommended")}
                  searchPlaceholder={t("search_panel.search_sorting")}
                  className="h-11 rounded-sm"
                />
                {hotlineUrl ? (
                  <a
                    href={hotlineUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[color:var(--brand-whatsapp)] px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[color:var(--brand-whatsapp-hover)] sm:justify-self-start lg:col-span-2 lg:justify-self-end"
                  >
                    <WhatsAppIcon className="h-4 w-4" aria-hidden="true" />
                    WhatsApp us
                  </a>
                ) : null}
              </div>
            </div>
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
                          className="h-9 rounded-sm bg-[color:var(--surface-invert)] px-4 text-[13px] font-bold text-[color:var(--surface-invert-fg)] shadow-none hover:bg-[color:var(--surface-invert-hover)]"
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
