import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Search, SearchX, UserPlus, X } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { PublicTutorCard } from "@/features/tutors/public-tutor-card";
import { TutorSaveButton } from "@/features/tutors/saved-tutors";
import { CompareBar, CompareDialog, useTutorCompare } from "@/features/tutors/compare-tutors";
import { buildTutorWhatsAppUrl } from "@/features/tutors/tutor-display";
import {
  fetchPublishedTutors,
  HK_DISTRICTS,
  type Tutor,
} from "@/features/tutors/queries";
import { getSubjectOptionsForCategory } from "@/features/tutors/subjects";
import { supabase } from "@/integrations/supabase/client";
import {
  EXPERIENCE_FILTER_VALUES,
  PREFERRED_LANGUAGE_VALUES,
  PRICE_MAX,
  PRICE_MIN,
  PRICE_STEP,
  buildActiveFilterChips,
  buildLanguageOptions,
  filterTutors,
  formatPrice,
  isSameTutorSearch,
  sortTutors,
  type ActiveFilterChip,
} from "@/features/tutors/search-filters";

const searchSchema = z.object({
  category: z.string().optional(),
  subject: z.string().optional(),
  station: z.string().optional(), // nearest MTR station to the student
  mode: z.string().optional(), // online | in_person | either
  gender: z.string().optional(), // male | female | other
  district: z.string().optional(), // HK district or region group
  language: z.string().optional(), // teaching language
  experience: z.string().optional(), // min years of experience, e.g. "3"
  ib_core: z.string().optional(), // "1" = requires IA/EE/TOK support
  min_price: z.coerce.number().int().min(0).optional(),
  max_price: z.coerce.number().int().min(0).optional(),
  sort: z.string().optional(), // "" | price_asc | price_desc | experience | newest
  q: z.string().optional(),
});
type SearchState = z.infer<typeof searchSchema>;

const URL_SYNC_DEBOUNCE_MS = 350;

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
      { value: "experience", label: t("search_panel.sort_experience") },
      { value: "newest", label: t("search_panel.sort_newest") },
    ],
    [t],
  );

  const districtOptions = useMemo(
    () => [
      { value: "", label: t("search_panel.any_district") },
      ...HK_DISTRICTS.map((d) => ({ value: d, label: d })),
    ],
    [t],
  );

  const experienceOptions = useMemo(
    () => [
      { value: "", label: t("search_panel.any_experience") },
      ...EXPERIENCE_FILTER_VALUES.map((years) => ({
        value: years,
        label: `${years}+ ${t("search_panel.yrs_short")}`,
      })),
    ],
    [t],
  );

  useEffect(() => {
    setDraft(search);
  }, [search]);

  useEffect(() => {
    if (isSameTutorSearch(draft, search)) return;
    const timer = window.setTimeout(() => {
      navigate({
        search: {
          ...draft,
          station: draft.mode === "in_person" ? draft.station : undefined,
        },
        replace: true,
      });
    }, URL_SYNC_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draft, search, navigate]);

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

  const priceValue: [number, number] = [draft.min_price ?? PRICE_MIN, draft.max_price ?? PRICE_MAX];

  const languageOptions = useMemo(() => {
    const fromTutors = buildLanguageOptions(tutors);
    return fromTutors.length > 0 ? fromTutors : Array.from(PREFERRED_LANGUAGE_VALUES);
  }, [tutors]);

  const filtered = useMemo(
    () => sortTutors(filterTutors(tutors, draft), draft.sort),
    [tutors, draft],
  );

  const activeChips = useMemo(() => buildActiveFilterChips(draft, t), [draft, t]);

  const removeChip = (chip: ActiveFilterChip) => {
    setDraftParam(chip.clear);
  };

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
            <div className="relative mt-7 overflow-hidden rounded-sm border border-border bg-card">
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
                  <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <SearchableSelect
                      value={draft.district ?? ""}
                      onChange={(v) => setDraftParam({ district: v || undefined })}
                      options={districtOptions}
                      placeholder={t("search_panel.any_district")}
                      searchPlaceholder={t("search_panel.search_district")}
                      className="h-11 rounded-sm"
                    />
                    <SearchableSelect
                      value={draft.language ?? ""}
                      onChange={(v) => setDraftParam({ language: v || undefined })}
                      options={[
                        { value: "", label: t("search_panel.any_language") },
                        ...languageOptions.map((language) => ({
                          value: language,
                          label: language,
                        })),
                      ]}
                      placeholder={t("search_panel.any_language")}
                      searchPlaceholder={t("search_panel.search_language")}
                      className="h-11 rounded-sm"
                    />
                    <SearchableSelect
                      value={draft.experience ?? ""}
                      onChange={(v) => setDraftParam({ experience: v || undefined })}
                      options={experienceOptions}
                      placeholder={t("search_panel.any_experience")}
                      className="h-11 rounded-sm"
                    />
                    <div className="flex h-11 items-center justify-between gap-3 rounded-sm border border-border bg-background px-3">
                      <Label
                        htmlFor="tutor-ib-core"
                        className="cursor-pointer text-sm font-normal text-muted-foreground"
                      >
                        {t("search_panel.ib_core")}
                      </Label>
                      <Switch
                        id="tutor-ib-core"
                        checked={draft.ib_core === "1"}
                        onCheckedChange={(checked) =>
                          setDraftParam({ ib_core: checked ? "1" : undefined })
                        }
                        aria-label={t("search_panel.ib_core")}
                      />
                    </div>
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
                    className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[color:var(--brand-whatsapp)] px-5 text-sm font-bold text-white transition-colors hover:bg-[color:var(--brand-whatsapp-hover)] sm:justify-self-start lg:col-span-2 lg:justify-self-end"
                  >
                    <WhatsAppIcon className="h-4 w-4" aria-hidden="true" />
                    WhatsApp us
                  </a>
                ) : null}
                <Button
                  asChild
                  variant="outline"
                  className="h-10 shrink-0 rounded-full px-5 text-sm font-bold sm:justify-self-start lg:col-span-2 lg:col-start-1 lg:justify-self-end xl:col-start-2"
                >
                  <Link to="/join">
                    <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                    Tutor Join Request
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            {activeChips.length > 0 && (
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {activeChips.map((chip) => (
                  <Button
                    key={chip.key}
                    type="button"
                    variant="outline"
                    size="xs"
                    className="rounded-full border-border bg-card font-medium"
                    onClick={() => removeChip(chip)}
                    aria-label={`${t("search_panel.remove_filter")}: ${chip.label}`}
                  >
                    {chip.label}
                    <X aria-hidden="true" />
                  </Button>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="text-muted-foreground"
                  onClick={clearAll}
                >
                  {t("search_panel.clear_all_filters")}
                </Button>
              </div>
            )}
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
                  <Button asChild variant="outline" className="font-bold">
                    <Link to="/join">
                      <UserPlus className="mr-2 h-4 w-4" aria-hidden="true" />
                      Tutor Join Request
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
