import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BookOpen, Heart, SearchX, Upload, Users } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
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
import { StudyMaterialCard } from "@/features/materials/material-card";
import { cn } from "@/lib/utils";
import { AuthGateDialog } from "@/features/auth/AuthGateDialog";
import {
  MAX_COMPARE,
  ShopCardActions,
  ShopCompareDialog,
} from "@/features/materials/shop-card-actions";
import { useAuth } from "@/features/auth/useAuth";
import { rankBySearch } from "@/features/materials/note-search";
import {
  CONTENT_LANGUAGES,
  getSubcategoriesForCurriculum,
  NOTE_SUBCATEGORIES,
} from "@/features/materials/note-taxonomy";
import { getMySavedNoteIds } from "@/features/materials/note-engagement.functions";
import {
  SAVED_NOTES_QUERY_KEY,
  SellNotesCta,
  SimilarNotesSection,
} from "@/features/materials/note-engagement";
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
  // Notes upload v2: finer category, document language and saved-only.
  const [subcategory, setSubcategory] = useState("");
  const [language, setLanguage] = useState("");
  const [savedOnly, setSavedOnly] = useState(false);
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
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [authGateOpen, setAuthGateOpen] = useState(false);
  const toggleCompare = (id: string) =>
    setCompareIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= MAX_COMPARE
          ? prev
          : [...prev, id],
    );

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
    subcategory,
    language,
    savedOnly,
    savedIds,
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
  };
  const hasFilters =
    query ||
    school ||
    subject ||
    curriculum ||
    kind !== "all" ||
    subcategory ||
    language ||
    savedOnly;

  useEffect(() => {
    document.title = "Study Materials Marketplace | MatchMax";
  }, []);

  const kindChips: { value: KindFilter; label: string }[] = [
    { value: "all", label: t("shop.filter_all") },
    { value: "notes", label: t("notes.category.notes") },
    { value: "mocks", label: t("notes.category.mocks") },
    { value: "coursework", label: t("notes.category.coursework") },
    { value: "courses", label: t("shop.filter_courses") },
    { value: "folders", label: t("shop.filter_folders") },
    { value: "services", label: t("notes.category.services") },
    { value: "free", label: t("notes.category.free") },
  ];

  return (
    <section className="pt-6 pb-12 sm:pt-8">
      <div className="mx-auto max-w-[1536px] px-4 sm:px-6">
        {/* Notes upload v2: the upload entry sits at the top of the shop. */}
        <SellNotesCta className="mb-5" />
        {/* Kind chips, #392 unified shop grid. */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {kindChips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              aria-pressed={kind === chip.value}
              onClick={() => setKind(chip.value)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
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
                "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13px] font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
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
          <div className="mb-4 flex flex-wrap items-center gap-2" role="group">
            {subcategoryOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                aria-pressed={subcategory === option.value}
                onClick={() => setSubcategory(subcategory === option.value ? "" : option.value)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
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

        {/* Filter bar, flat, border-delineated, same chrome as the tutors bar. */}
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("notes.search.placeholder")}
            className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm text-[color:var(--ink)] placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
            aria-label={t("materials.search_placeholder")}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
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
        </div>

        <div className="mb-6 flex items-baseline justify-between">
          {isLoading ? (
            <Skeleton className="h-4 w-28" />
          ) : (
            <p className="text-sm text-muted-foreground">
              <span className="font-bold text-foreground">{filtered.length}</span>{" "}
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
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((material: MarketplaceMaterial) => (
              <StudyMaterialCard
                key={material.id}
                material={material}
                tutorName={material.tutor_display_name}
                tutorCode={material.tutor_code}
                showTutorLink={!material.tutor_community}
                verifiedTutor={material.tutor_verified}
                rating={ratings.get(material.id) ?? null}
                footer={
                  <ShopCardActions
                    material={material}
                    compared={compareIds.includes(material.id)}
                    onToggleCompare={() => toggleCompare(material.id)}
                    onRequireAuth={() => setAuthGateOpen(true)}
                  />
                }
                detailHref={`/notes/${material.slug ?? material.id}`}
              />
            ))}
          </div>
        )}
      </div>
      {compareIds.length > 0 ? (
        <div className="mm-overlay-lift fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-3 py-2 lg:bottom-6">
          <Button
            type="button"
            size="sm"
            variant="solid"
            color="neutral"
            onClick={() => setCompareOpen(true)}
          >
            {t("notes.engage.compare_button", { count: compareIds.length })}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setCompareIds([])}>
            {t("notes.engage.compare_clear")}
          </Button>
        </div>
      ) : null}
      <ShopCompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        items={materials.filter((m) => compareIds.includes(m.id))}
        ratings={ratings}
      />
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
      {/* Notes upload v2: always-reachable upload button (floating layer).
          Stacks ABOVE the global float column (WhatsApp @5rem/bottom-6,
          BackToTop @9rem/bottom-24 — both z-50) so it never hides under the
          mobile bottom nav or under the desktop WhatsApp button. */}
      <Link
        to="/account/notes/new"
        className="mm-overlay-lift fixed bottom-[calc(13rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex items-center gap-2 rounded-full bg-[color:var(--ink)] px-5 py-3 text-sm font-bold text-[color:var(--surface-invert-fg)] transition-colors hover:bg-[color:var(--ink)]/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)] lg:bottom-44 lg:right-6"
      >
        <Upload className="h-4 w-4" aria-hidden />
        {t("notes.cta.upload_fab")}
      </Link>
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
    { key: "materials" as const, label: t("materials.toggle_materials"), icon: BookOpen },
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
