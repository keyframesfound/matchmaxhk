import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { BookOpen, SearchX, Users } from "lucide-react";
import { motion, useReducedMotion } from "motion/react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  fetchMarketplaceMaterials,
  collectSchoolTags,
  type MarketplaceMaterial,
} from "@/features/materials/queries";
import { StudyMaterialCard } from "@/features/materials/material-card";
import { cn } from "@/lib/utils";

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

type KindFilter = "all" | "notes" | "courses" | "folders" | "services";

const KIND_FILTER_TYPES: Record<Exclude<KindFilter, "all">, string[]> = {
  notes: ["notes", "mock", "exemplar", "flashcards"],
  courses: ["video_course", "general_course"],
  folders: ["topic_folder"],
  services: ["gig"],
};

export function MaterialsDirectory() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [school, setSchool] = useState("");
  const [subject, setSubject] = useState("");
  const [curriculum, setCurriculum] = useState("");
  const [kind, setKind] = useState<KindFilter>("all");
  const { data: materials = [], isLoading } = useQuery({
    queryKey: ["materials", "marketplace"],
    queryFn: fetchMarketplaceMaterials,
  });

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const kindTypes = kind === "all" ? null : KIND_FILTER_TYPES[kind];
    return materials.filter((m) => {
      if (kindTypes && !kindTypes.includes(m.material_type)) return false;
      if (school && (m.school_tag ?? "").trim().toLowerCase() !== school.toLowerCase())
        return false;
      if (subject && (m.subject_tag ?? "").trim().toLowerCase() !== subject.toLowerCase())
        return false;
      if (curriculum && m.curriculum_tag.trim().toLowerCase() !== curriculum.toLowerCase())
        return false;
      if (
        q &&
        !(
          m.title.toLowerCase().includes(q) ||
          (m.description ?? "").toLowerCase().includes(q) ||
          (m.school_tag ?? "").toLowerCase().includes(q) ||
          m.subject_tag?.toLowerCase().includes(q) ||
          m.curriculum_tag.toLowerCase().includes(q) ||
          m.tutor_display_name.toLowerCase().includes(q)
        )
      )
        return false;
      return true;
    });
  }, [materials, query, school, subject, curriculum, kind]);

  const clearAll = () => {
    setQuery("");
    setSchool("");
    setSubject("");
    setCurriculum("");
    setKind("all");
  };
  const hasFilters = query || school || subject || curriculum || kind !== "all";

  useEffect(() => {
    document.title = "Study Materials Marketplace | MatchMax";
  }, []);

  const kindChips: { value: KindFilter; label: string }[] = [
    { value: "all", label: t("shop.filter_all") },
    { value: "notes", label: t("shop.filter_notes") },
    { value: "courses", label: t("shop.filter_courses") },
    { value: "folders", label: t("shop.filter_folders") },
    { value: "services", label: t("shop.filter_services") },
  ];

  return (
    <section className="pt-6 pb-12 sm:pt-8">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {/* Kind chips, #392 unified shop grid. */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {kindChips.map((chip) => (
            <button
              key={chip.value}
              type="button"
              aria-pressed={kind === chip.value}
              onClick={() => setKind(chip.value)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
                kind === chip.value
                  ? "border-[color:var(--ink)] bg-[color:var(--ink)] text-[color:var(--surface-invert-fg)]"
                  : "border-border bg-card text-[color:var(--ink)]/70 hover:bg-[color:var(--surface-subtle)] hover:text-[color:var(--ink)]",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Filter bar, flat, border-delineated, same chrome as the tutors bar. */}
        <div className="mb-6 flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("materials.search_placeholder")}
            className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm text-[color:var(--ink)] placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]"
            aria-label={t("materials.search_placeholder")}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <select
              value={school}
              onChange={(event) => setSchool(event.target.value)}
              className="h-10 rounded-md border border-border bg-background px-2 text-sm text-[color:var(--ink)]"
              aria-label={t("materials.filter_school_all")}
            >
              <option value="">{t("materials.filter_school_all")}</option>
              {schools.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
            <select
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="h-10 rounded-md border border-border bg-background px-2 text-sm text-[color:var(--ink)]"
              aria-label={t("materials.filter_subject_all")}
            >
              <option value="">{t("materials.filter_subject_all")}</option>
              {subjects.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
            <select
              value={curriculum}
              onChange={(event) => setCurriculum(event.target.value)}
              className="h-10 rounded-md border border-border bg-background px-2 text-sm text-[color:var(--ink)]"
              aria-label={t("materials.filter_curriculum_all")}
            >
              <option value="">{t("materials.filter_curriculum_all")}</option>
              {curricula.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-6 flex items-baseline justify-between">
          {isLoading ? (
            <Skeleton className="h-4 w-28" />
          ) : (
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{filtered.length}</span>{" "}
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
            <h2 className="mt-4 text-xl font-medium tracking-tight text-[color:var(--ink)] sm:text-2xl">
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
                showTutorLink
                verifiedTutor={material.tutor_verified}
                detailHref={`/notes/${material.slug ?? material.id}`}
              />
            ))}
          </div>
        )}
      </div>
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
              "relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
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
