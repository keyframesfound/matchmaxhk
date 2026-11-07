import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  CircleHelp,
  ClipboardList,
  FileText,
  GraduationCap,
  Heart,
  SearchX,
  SlidersHorizontal,
  Store,
  Upload,
  Users,
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { GuidedCard, MoreFiltersAccordion } from "@/components/search/guided-card";
import {
  MobileSearchOverlay,
  type MobileSearchTab,
} from "@/components/search/mobile-search-overlay";
import { MobileSearchTrigger } from "@/components/search/mobile-search-trigger";
import { PanelLabel, SearchBigInput, Segmented } from "@/components/search/search-controls";
import { setSearchSlideDirection } from "@/components/search/slide-direction";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchMarketplaceMaterials,
  fetchMaterialRatings,
  collectSchoolTags,
  type MarketplaceMaterial,
} from "@/features/materials/queries";
import { NoteBrowseCard } from "@/features/materials/note-browse-card";
import { cn } from "@/lib/utils";
import { AuthGateDialog } from "@/features/auth/AuthGateDialog";
import { useAuth } from "@/features/auth/useAuth";
import { rankBySearch } from "@/features/materials/note-search";
import {
  CONTENT_LANGUAGES,
  getSubcategoriesForCurriculum,
  NOTE_SUBCATEGORIES,
} from "@/features/materials/note-taxonomy";
import { getMySavedNoteIds, setNoteSaved } from "@/features/materials/note-engagement.functions";
import { SAVED_NOTES_QUERY_KEY, SimilarNotesSection } from "@/features/materials/note-engagement";
import { formatMaterialTypeLabel } from "@/features/materials/queries";

/**
 * Issue #131 + #392: the SHOP side of the /tutors directory toggle, ONE
 * unified grid for every listing kind (notes, mocks, exemplars, flashcards,
 * topic folders, video/general courses AND freestyle gigs) built from the
 * big-cover expandable card. Client-side filtered (the whole published
 * marketplace is one RLS read, same pattern as the tutors list) with the
 * #392 kind filter chips (All / Notes / Courses / Folders / Services) plus
 * the school/subject/curriculum dropdowns and text search. Gig orders keep
 * their existing flow, only the card presentation changed; the old
 * separate services section is gone (home-gigs-row is untouched). Every
 * kind routes through its detail page, so the old per-card WhatsApp deep
 * links are no longer needed here.
 */

/**
 * #557 Carousell-style category bar: All · Study notes · Mocks & solutions ·
 * IA / EE / SBA · Video courses · Topic folders · Marking & services · Free.
 */
type KindFilter =
  "all" | "notes" | "mocks" | "coursework" | "courses" | "folders" | "services" | "free";

const COURSEWORK_SUBCATEGORIES = new Set(["ia", "ee", "tok", "sba", "coursework"]);

/* Radix Select items can't hold an empty value, so each filter's "all"
 * choice rides this sentinel and maps back to "". */
const MATERIALS_ALL_VALUE = "__all__";

function matchesKind(m: MarketplaceMaterial, kind: KindFilter): boolean {
  switch (kind) {
    case "all":
      return true;
    case "notes":
      return m.material_type === "notes" || m.material_type === "flashcards";
    case "mocks":
      return m.material_type === "mock";
    case "coursework":
      return (
        m.material_type === "exemplar" ||
        (m.subcategory != null && COURSEWORK_SUBCATEGORIES.has(m.subcategory))
      );
    case "courses":
      return m.material_type === "video_course" || m.material_type === "general_course";
    case "folders":
      return m.material_type === "topic_folder";
    case "services":
      return m.material_type === "gig";
    case "free":
      return Number(m.price_hkd) === 0;
  }
}

export function MaterialsDirectory() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [school, setSchool] = useState("");
  const [subject, setSubject] = useState("");
  const [curriculum, setCurriculum] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  // #557 / #594 Marketplace shell: Notes | Gigs tabs (Notes is the default).
  const [shopTab, setShopTab] = useState<"notes" | "gigs">("notes");
  // Notes upload v2: finer category, document language and saved-only.
  const [subcategory, setSubcategory] = useState("");
  const [language, setLanguage] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  // #605 §3.6 Notes: grade band (Pill 3) + More Filters price / verified.
  const [grade, setGrade] = useState("");
  const [priceBand, setPriceBand] = useState<"" | "free" | "paid">("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["materials", "marketplace"],
    queryFn: fetchMarketplaceMaterials,
  });
  const savedQuery = useQuery({
    queryKey: [...SAVED_NOTES_QUERY_KEY, user?.id],
    queryFn: () => getMySavedNoteIds(),
    enabled: Boolean(user),
    staleTime: 60_000,
  });
  const savedIds = useMemo(() => new Set(savedQuery.data ?? []), [savedQuery.data]);
  // #556 card actions: ratings on cards, compare tray (up to 3), save gate.
  const ratingsQuery = useQuery({
    queryKey: ["materials", "ratings"],
    queryFn: fetchMaterialRatings,
    staleTime: 5 * 60_000,
  });
  const ratings = ratingsQuery.data ?? new Map<string, { average: number | null; count: number }>();
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const queryClient = useQueryClient();
  // Card heart: signed-out viewers get the sign-in gate.
  const toggleSave = async (id: string) => {
    if (!user) {
      setAuthGateOpen(true);
      return;
    }
    const next = !savedIds.has(id);
    try {
      await setNoteSaved({ data: { materialId: id, saved: next } });
      await queryClient.invalidateQueries({ queryKey: SAVED_NOTES_QUERY_KEY });
      toast.success(next ? t("notes.engage.saved") : t("notes.engage.unsaved"));
    } catch {
      toast.error(t("notes.engage.save_failed"));
    }
  };

  const schools = useMemo(() => collectSchoolTags(materials), [materials]);
  const subjects = useMemo(
    () =>
      Array.from(
        new Set(materials.map((m) => m.subject_tag?.trim()).filter((s): s is string => Boolean(s))),
      ).sort((a, b) => a.localeCompare(b)),
    [materials],
  );
  const curricula = useMemo(
    () =>
      Array.from(
        new Set(materials.map((m) => m.curriculum_tag.trim()).filter((s) => Boolean(s))),
      ).sort((a, b) => a.localeCompare(b)),
    [materials],
  );

  // #605: grade / score bands that listings actually carry (5**, 7, A* …).
  const grades = useMemo(
    () =>
      Array.from(
        new Set(
          materials.map((m) => m.grade_achieved?.trim()).filter((g): g is string => Boolean(g)),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [materials],
  );

  // Sub-category chips: the selected curriculum's list, else every
  // category that at least one listing in the shop uses.
  const subcategoryOptions = useMemo(() => {
    if (curriculum) return getSubcategoriesForCurriculum(curriculum);
    const used = new Set(materials.map((m) => m.subcategory).filter(Boolean));
    const seen = new Set<string>();
    return Object.values(NOTE_SUBCATEGORIES)
      .flat()
      .filter((s) => used.has(s.value) && !seen.has(s.value) && seen.add(s.value));
  }, [curriculum, materials]);

  const filtered = useMemo(() => {
    const narrowed = materials.filter((m) => {
      if (shopTab === "gigs" ? m.material_type !== "gig" : m.material_type === "gig") return false;
      if (!matchesKind(m, kind)) return false;
      if (school && (m.school_tag ?? "").trim().toLowerCase() !== school.toLowerCase())
        return false;
      if (subject && (m.subject_tag ?? "").trim().toLowerCase() !== subject.toLowerCase())
        return false;
      if (curriculum && m.curriculum_tag.trim().toLowerCase() !== curriculum.toLowerCase())
        return false;
      if (subcategory && m.subcategory !== subcategory) return false;
      if (language && m.content_language !== language) return false;
      if (savedOnly && !savedIds.has(m.id)) return false;
      if (grade && (m.grade_achieved ?? "").trim() !== grade) return false;
      if (priceBand === "free" && Number(m.price_hkd) !== 0) return false;
      if (priceBand === "paid" && Number(m.price_hkd) === 0) return false;
      if (verifiedOnly && !m.tutor_verified) return false;
      return true;
    });
    // Notes upload v2: ranked, forgiving search (synonyms EN/繁/简, typos,
    // Chinese bigrams), see note-search.ts.
    return rankBySearch(narrowed, query, (m) => ({
      primary: [
        m.title,
        m.summary ?? "",
        m.subject_tag ?? "",
        m.topic ?? "",
        m.subcategory ? m.subcategory.replace(/_/g, " ") : "",
        m.subcategory ? t(`notes.subcategory.${m.subcategory}`) : "",
        ...m.search_tags,
      ],
      secondary: [
        m.description ?? "",
        m.curriculum_tag,
        m.school_tag ?? "",
        m.material_type,
        formatMaterialTypeLabel(m.material_type, t),
        m.year_tag ?? "",
        m.tutor_display_name,
        m.admin_marketing_summary ?? "",
      ],
    }));
  }, [
    materials,
    query,
    school,
    subject,
    curriculum,
    kind,
    shopTab,
    subcategory,
    language,
    savedOnly,
    savedIds,
    grade,
    priceBand,
    verifiedOnly,
    t,
  ]);

  const clearAll = () => {
    setQuery("");
    setSchool("");
    setSubject("");
    setCurriculum("");
    setKind("all");
    setSubcategory("");
    setLanguage("");
    setSavedOnly(false);
    setGrade("");
    setPriceBand("");
    setVerifiedOnly(false);
  };
  const activeFilterCount = [school, subject, curriculum, language].filter(Boolean).length;
  const hasFilters =
    query ||
    school ||
    subject ||
    curriculum ||
    kind !== "all" ||
    subcategory ||
    language ||
    savedOnly ||
    grade ||
    priceBand ||
    verifiedOnly;

  useEffect(() => {
    document.title = "Study Materials Marketplace | MatchMax";
  }, []);

  const sheetFilterCount = [
    query,
    curriculum,
    subject,
    kind !== "all" ? kind : "",
    subcategory,
    grade,
    priceBand,
    language,
    school,
    verifiedOnly ? "verified" : "",
    savedOnly ? "saved" : "",
  ].filter(Boolean).length;
  const sheetTabs: MobileSearchTab[] = [
    {
      id: "tutors",
      label: t("search_ui.tab_tutors"),
      icon: <GraduationCap className="h-5 w-5" aria-hidden="true" />,
      active: false,
      onSelect: () => {
        setSearchSlideDirection("prev");
        void navigate({ to: "/tutors", search: { q: query || undefined, open: true } });
      },
    },
    {
      id: "cases",
      label: t("search_ui.tab_cases"),
      icon: <ClipboardList className="h-5 w-5" aria-hidden="true" />,
      active: false,
      onSelect: () => {
        setSearchSlideDirection("prev");
        void navigate({ to: "/tutor-requests", search: { q: query || undefined, open: true } });
      },
    },
    {
      id: "notes",
      label: t("explore_search.tab_notes"),
      icon: <FileText className="h-5 w-5" aria-hidden="true" />,
      active: true,
      onSelect: () => {},
    },
  ];

  const kindChips: { value: KindFilter; label: string }[] = [
    { value: "all", label: t("shop.filter_all") },
    { value: "notes", label: t("notes.category.notes") },
    { value: "mocks", label: t("notes.category.mocks") },
    { value: "coursework", label: t("notes.category.coursework") },
    { value: "courses", label: t("shop.filter_courses") },
    { value: "folders", label: t("shop.filter_folders") },
    { value: "free", label: t("notes.category.free") },
  ];

  return (
    <section className="pt-6 pb-12 sm:pt-8">
      <div className="mx-auto max-w-[1536px] px-4 sm:px-6">
        {/* #605 phone: the shared search trigger + full-screen sheet (Notes scope). */}
        <MobileSearchTrigger
          className="mb-4"
          label={t("explore_search.pill_title_notes")}
          subtitle={[
            curriculum || t("explore_search.any_curriculum"),
            subject || t("explore_search.any_subject"),
            kind !== "all"
              ? (kindChips.find((chip) => chip.value === kind)?.label ?? "")
              : t("explore_search.any_resource"),
          ].join(" · ")}
          badgeCount={sheetFilterCount}
          onClick={() => setSheetOpen(true)}
        />
        {/* #557 / #594: Marketplace tabs, Notes | Gigs. */}
        {/* #605 / #557 M3: one compact sub-row, Notes | Gigs on the left,
            How it works + Upload on the right. */}
        <div className="mb-3 flex items-end justify-between gap-3 border-b border-border">
          <div role="tablist" className="flex gap-6">
            {(["notes", "gigs"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={shopTab === tab}
                onClick={() => {
                  setShopTab(tab);
                  setKind("all");
                  setSubcategory("");
                }}
                className={cn(
                  "-mb-px border-b-2 px-1 pb-2.5 text-base font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
                  shopTab === tab
                    ? "border-[color:var(--ink)] text-[color:var(--ink)]"
                    : "border-transparent text-[color:var(--ink)]/55 hover:text-[color:var(--ink)]",
                )}
              >
                {tab === "notes" ? t("marketplace.tab_notes") : t("marketplace.tab_gigs")}
              </button>
            ))}
          </div>
          <div className="flex shrink-0 items-center gap-1.5 pb-1.5">
            <Link
              to="/guide/notes"
              aria-label={t("notes.market.how_it_works")}
              title={t("notes.market.how_it_works")}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border text-[color:var(--ink)] hover:bg-[color:var(--surface-subtle)]"
            >
              <CircleHelp className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              to="/account/notes/new"
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-[color:var(--ink)] px-3 text-[13px] font-bold text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--ink)]/90"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden />
              {t("notes.market.upload_short")}
            </Link>
          </div>
        </div>
        {/* Kind chips, #392 unified shop grid. #605: ONE scrolling row. */}
        <div className="-mx-4 mb-3 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {(shopTab === "notes"
            ? kindChips
            : kindChips.filter((c) => c.value === "all" || c.value === "free")
          ).map((chip) => (
            <button
              key={chip.value}
              type="button"
              aria-pressed={kind === chip.value}
              onClick={() => setKind(chip.value)}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
                kind === chip.value
                  ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--surface-invert-fg)]"
                  : "border-border bg-card text-[color:var(--ink)]/70 hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--ink)]",
              )}
            >
              {chip.label}
            </button>
          ))}
          {user ? (
            <button
              type="button"
              aria-pressed={savedOnly}
              onClick={() => setSavedOnly((v) => !v)}
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
                savedOnly
                  ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--surface-invert-fg)]"
                  : "border-border bg-card text-[color:var(--ink)]/70 hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--ink)]",
              )}
            >
              <Heart className="h-3.5 w-3.5" aria-hidden />
              {t("notes.search.saved_only")}
            </button>
          ) : null}
        </div>

        {/* Notes upload v2: finer categories (IA / EE / Paper 1 / SBA ...). */}
        {(kind === "all" || kind === "notes" || kind === "mocks" || kind === "coursework") &&
        subcategoryOptions.length > 0 ? (
          <div
            className="-mx-4 mb-3 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden"
            role="group"
          >
            {subcategoryOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={subcategory === option.value}
                onClick={() => setSubcategory(subcategory === option.value ? "" : option.value)}
                className={cn(
                  "shrink-0 whitespace-nowrap rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
                  subcategory === option.value
                    ? "border-[color:var(--brand-link)] bg-[color:var(--brand-link)]/10 text-[color:var(--brand-link)]"
                    : "border-border bg-card text-[color:var(--ink)]/70 hover:bg-[color:var(--surface-subtle)]",
                )}
              >
                {t(option.labelKey)}
              </button>
            ))}
          </div>
        ) : null}

        <MobileSearchOverlay
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          tabs={sheetTabs}
          clearLabel={t("search_ui.clear_all")}
          submitLabel={t("explore_search.show_notes", { count: filtered.length })}
          onClear={clearAll}
          onSubmit={() => setSheetOpen(false)}
        >
          <div className="space-y-4">
            <SearchBigInput
              value={query}
              onValueChange={setQuery}
              onEnter={() => setSheetOpen(false)}
              placeholder={t("explore_search.placeholder_notes")}
              ariaLabel={t("materials.search_placeholder")}
            />
            <GuidedCard title={t("explore_search.card_subject")}>
              <div className="space-y-1.5">
                <PanelLabel>{t("search_ui.segment_curriculum")}</PanelLabel>
                <SearchableSelect
                  value={curriculum}
                  onChange={setCurriculum}
                  options={[
                    { value: "", label: t("materials.filter_curriculum_all") },
                    ...curricula.map((entry) => ({ value: entry, label: entry })),
                  ]}
                  placeholder={t("materials.filter_curriculum_all")}
                  className="h-12 rounded-2xl"
                />
              </div>
              <div className="space-y-1.5">
                <PanelLabel>{t("search_ui.segment_subject")}</PanelLabel>
                <SearchableSelect
                  value={subject}
                  onChange={setSubject}
                  options={[
                    { value: "", label: t("materials.filter_subject_all") },
                    ...subjects.map((entry) => ({ value: entry, label: entry })),
                  ]}
                  placeholder={t("materials.filter_subject_all")}
                  className="h-12 rounded-2xl"
                />
              </div>
            </GuidedCard>
            {shopTab === "notes" ? (
              <GuidedCard title={t("explore_search.card_resource")}>
                <div className="flex flex-wrap gap-2">
                  {kindChips.map((chip) => (
                    <button
                      key={chip.value}
                      type="button"
                      aria-pressed={kind === chip.value}
                      onClick={() => setKind(chip.value)}
                      className={sheetChipClass(kind === chip.value)}
                    >
                      {chip.label}
                    </button>
                  ))}
                </div>
                {subcategoryOptions.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {subcategoryOptions.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={subcategory === option.value}
                        onClick={() =>
                          setSubcategory(subcategory === option.value ? "" : option.value)
                        }
                        className={sheetChipClass(subcategory === option.value)}
                      >
                        {t(option.labelKey)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </GuidedCard>
            ) : null}
            {grades.length > 0 ? (
              <GuidedCard title={t("explore_search.card_grade")}>
                <div className="flex flex-wrap gap-2">
                  {grades.map((entry) => (
                    <button
                      key={entry}
                      type="button"
                      aria-pressed={grade === entry}
                      onClick={() => setGrade(grade === entry ? "" : entry)}
                      className={sheetChipClass(grade === entry)}
                    >
                      {entry}
                    </button>
                  ))}
                </div>
              </GuidedCard>
            ) : null}
            <MoreFiltersAccordion
              title={t("explore_search.more_filters")}
              count={
                [priceBand, language, school, verifiedOnly ? "v" : "", savedOnly ? "s" : ""].filter(
                  Boolean,
                ).length
              }
            >
              <div className="space-y-2">
                <PanelLabel>{t("explore_search.price_title")}</PanelLabel>
                <Segmented
                  aria-label={t("explore_search.price_title")}
                  value={priceBand}
                  onChange={(value) => setPriceBand(value as "" | "free" | "paid")}
                  options={[
                    { value: "", label: t("explore_search.price_any") },
                    { value: "free", label: t("explore_search.price_free") },
                    { value: "paid", label: t("explore_search.price_paid") },
                  ]}
                />
              </div>
              <div className="space-y-2">
                <PanelLabel>{t("explore_search.language_title")}</PanelLabel>
                <SearchableSelect
                  value={language}
                  onChange={setLanguage}
                  options={[
                    { value: "", label: t("notes.search.language_all") },
                    ...CONTENT_LANGUAGES.map((code) => ({
                      value: code,
                      label: t(`notes.language.${code}`),
                    })),
                  ]}
                  placeholder={t("notes.search.language_all")}
                  className="h-12 rounded-2xl"
                />
              </div>
              <div className="space-y-2">
                <PanelLabel>{t("explore_search.school_title")}</PanelLabel>
                <SearchableSelect
                  value={school}
                  onChange={setSchool}
                  options={[
                    { value: "", label: t("materials.filter_school_all") },
                    ...schools.map((entry) => ({ value: entry, label: entry })),
                  ]}
                  placeholder={t("materials.filter_school_all")}
                  className="h-12 rounded-2xl"
                />
              </div>
              <label className="flex w-fit cursor-pointer items-center gap-3 text-sm font-medium text-[color:var(--ink)]">
                <Checkbox
                  checked={verifiedOnly}
                  onCheckedChange={(checked) => setVerifiedOnly(checked === true)}
                />
                {t("explore_search.verified_seller")}
              </label>
              {user ? (
                <label className="flex w-fit cursor-pointer items-center gap-3 text-sm font-medium text-[color:var(--ink)]">
                  <Checkbox
                    checked={savedOnly}
                    onCheckedChange={(checked) => setSavedOnly(checked === true)}
                  />
                  {t("notes.search.saved_only")}
                </label>
              ) : null}
            </MoreFiltersAccordion>
          </div>
        </MobileSearchOverlay>

        {/* Filter bar, flat, border-delineated, same chrome as the tutors bar. */}
        {/* #605: no always-on card of 4 stacked selects; one search field and
            a Filters button that opens them. Phone uses the sheet above. */}
        <div className="mb-4 hidden items-center gap-2 lg:flex">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("notes.search.placeholder")}
            className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm text-[color:var(--ink)] placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
            aria-label={t("materials.search_placeholder")}
          />
          <button
            type="button"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((v) => !v)}
            className={cn(
              "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold",
              filtersOpen || activeFilterCount > 0
                ? "border-[color:var(--ink)] text-[color:var(--ink)]"
                : "border-border text-[color:var(--ink)]/75",
            )}
          >
            <SlidersHorizontal className="h-4 w-4" aria-hidden />
            {t("search_ui.filters")}
            {activeFilterCount > 0 ? ` · ${activeFilterCount}` : ""}
          </button>
        </div>
        {filtersOpen ? (
          <div className="mb-6 grid grid-cols-2 gap-2 rounded-lg border border-border bg-card p-3 sm:grid-cols-4">
            <Select
              value={school === "" ? MATERIALS_ALL_VALUE : school}
              onValueChange={(v) => setSchool(v === MATERIALS_ALL_VALUE ? "" : v)}
            >
              <SelectTrigger
                aria-label={t("materials.filter_school_all")}
                className="h-10 min-h-10 w-full px-3"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MATERIALS_ALL_VALUE}>
                  {t("materials.filter_school_all")}
                </SelectItem>
                {schools.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={subject === "" ? MATERIALS_ALL_VALUE : subject}
              onValueChange={(v) => setSubject(v === MATERIALS_ALL_VALUE ? "" : v)}
            >
              <SelectTrigger
                aria-label={t("materials.filter_subject_all")}
                className="h-10 min-h-10 w-full px-3"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MATERIALS_ALL_VALUE}>
                  {t("materials.filter_subject_all")}
                </SelectItem>
                {subjects.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={curriculum === "" ? MATERIALS_ALL_VALUE : curriculum}
              onValueChange={(v) => setCurriculum(v === MATERIALS_ALL_VALUE ? "" : v)}
            >
              <SelectTrigger
                aria-label={t("materials.filter_curriculum_all")}
                className="h-10 min-h-10 w-full px-3"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MATERIALS_ALL_VALUE}>
                  {t("materials.filter_curriculum_all")}
                </SelectItem>
                {curricula.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {entry}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={language === "" ? MATERIALS_ALL_VALUE : language}
              onValueChange={(v) => setLanguage(v === MATERIALS_ALL_VALUE ? "" : v)}
            >
              <SelectTrigger
                aria-label={t("notes.search.language_all")}
                className="h-10 min-h-10 w-full px-3"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={MATERIALS_ALL_VALUE}>
                  {t("notes.search.language_all")}
                </SelectItem>
                {CONTENT_LANGUAGES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {t(`notes.language.${code}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        {/* Issue #566 follow-up: the bold count span duplicated the {{count}}
            inside the translation ("1 1 listing found"). Translation-owned,
            matching the tutors directory count (#600). */}
        <div className="mb-6 flex items-baseline justify-between">
          {isLoading ? (
            <Skeleton className="h-4 w-28" />
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("materials.result_count", { count: filtered.length })}
            </p>
          )}
        </div>

        {isLoading && (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[26rem] rounded-[10px] border border-border" />
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
              {hasFilters ? t("materials.empty_results") : t("materials.empty_state")}
            </h2>
            {hasFilters ? (
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <Button variant="outline" onClick={clearAll}>
                  {t("directory.empty_clear")}
                </Button>
              </div>
            ) : null}
          </div>
        )}

        {!isLoading && filtered.length > 0 && (
          // #557 / #543 CEO lock: Carousell-style 2-column grid of compact
          // photo-first cards (photo, title, price, seller name).
          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-4 lg:grid-cols-4 xl:grid-cols-5">
            {filtered.map((material: MarketplaceMaterial) => (
              <NoteBrowseCard
                key={material.id}
                material={material}
                rating={ratings.get(material.id) ?? null}
                saved={savedIds.has(material.id)}
                onToggleSave={() => void toggleSave(material.id)}
              />
            ))}
          </div>
        )}
      </div>
      <AuthGateDialog
        open={authGateOpen}
        onOpenChange={setAuthGateOpen}
        title={t("notes.gate_title")}
        description={t("notes.gate_description")}
      />
      {/* #557: "Recommended for you" seeded by the viewer's saved notes. */}
      {savedOnly && savedIds.size > 0 ? (
        <div className="mx-auto max-w-[1536px] px-4 sm:px-6">
          <SimilarNotesSection seedIds={Array.from(savedIds).slice(0, 50)} className="mt-12" />
        </div>
      ) : null}
    </section>
  );
}

/** The Tutors | Study Materials toggle switch (issue #131 directory tab). */
export function DirectoryToggle({
  active,
  onChange,
}: {
  active: "tutors" | "materials";
  onChange: (next: "tutors" | "materials") => void;
}) {
  const { t } = useTranslation();
  const prefersReducedMotion = useReducedMotion();
  const options = [
    { key: "tutors" as const, label: t("materials.toggle_tutors"), icon: Users },
    { key: "materials" as const, label: t("materials.toggle_materials"), icon: Store },
  ];
  return (
    <div
      role="tablist"
      aria-label={t("materials.toggle_tutors")}
      className="relative inline-flex rounded-full border border-border bg-card p-1"
    >
      {options.map(({ key, label, icon: Icon }) => {
        const isActive = key === active;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(key)}
            className={cn(
              "relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
              isActive
                ? "text-[color:var(--surface-invert-fg)]"
                : "text-[color:var(--ink)]/70 hover:text-[color:var(--ink)]",
            )}
          >
            {/* Sliding ink thumb: same resting look as the old per-button
                fill, but the pill springs between tabs instead of swapping. */}
            {isActive ? (
              <motion.span
                layoutId="directory-toggle-thumb"
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-[color:var(--ink)]"
                transition={
                  prefersReducedMotion
                    ? { duration: 0 }
                    : { type: "spring", bounce: 0.15, duration: 0.45 }
                }
              />
            ) : null}
            <Icon className="relative z-10 h-4 w-4" aria-hidden="true" />
            <span className="relative z-10">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

const sheetChipClass = (active: boolean) =>
  cn(
    "inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
    active
      ? "border-[color:var(--ink)] bg-[color:var(--ink)]/5 text-[color:var(--ink)]"
      : "border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-[color:var(--ink)]/70 hover:border-[color:var(--ink)]/30 hover:text-[color:var(--ink)]",
  );
