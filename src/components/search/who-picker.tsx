import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/useAuth";
import { CHILD_LEVELS, ChildInput, type ChildLevel } from "@/features/children/children";
import { listMyChildren, saveChild } from "@/features/children/children.functions";
import { CHILDREN_QUERY_KEY } from "@/features/children/my-children-section";
import {
  LEARNER_CURRICULA,
  learnerCurriculumLabel,
  learnerFromChild,
  learnerLevelLabel,
  learnerSummary,
  setLearnerContext,
  useLearnerContext,
  type LearnerContext,
} from "@/features/children/learner-context";
import { getSubjectOptionsForCategory } from "@/features/tutors/subjects";
import { SubjectMultiSelect } from "./subject-multi-select";

/**
 * #698 "Who is learning?" in the search sheet / Filters dialog. Saved
 * children as pills, "Any student (manual filter)", and "+ Add student"
 * (saved to the parent's account when signed in; a temporary session
 * persona for guests). The pick lives in the session learner context and
 * only re-ranks tutors.
 */

const pillClass = (active: boolean) =>
  cn(
    "inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--ring)]",
    active
      ? "border-[color:var(--brand-link)] bg-[color:var(--brand-link)]/10 text-[color:var(--ink)]"
      : "border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-[color:var(--ink)]/75 hover:border-[color:var(--ink)]/30 hover:text-[color:var(--ink)]",
  );

type DraftLearner = { name: string; level: string; curriculum: string; subjects: string[] };
const EMPTY_DRAFT: DraftLearner = { name: "", level: "", curriculum: "", subjects: [] };

export function WhoPicker() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const learner = useLearnerContext();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<DraftLearner>(EMPTY_DRAFT);

  const childrenQuery = useQuery({
    queryKey: CHILDREN_QUERY_KEY,
    queryFn: () => listMyChildren(),
    enabled: Boolean(user),
    staleTime: 60_000,
  });
  const children = user ? (childrenQuery.data ?? []) : [];

  const draftContext = (): LearnerContext => ({
    source: "guest",
    name: draft.name.trim() || undefined,
    level: (CHILD_LEVELS as readonly string[]).includes(draft.level)
      ? (draft.level as ChildLevel)
      : null,
    curriculum: draft.curriculum || null,
    subjects: draft.subjects,
  });

  const saveMutation = useMutation({
    mutationFn: () => {
      const ctx = draftContext();
      return saveChild({
        data: {
          child: ChildInput.parse({
            nickname: draft.name.trim(),
            curriculum: ctx.curriculum,
            level: ctx.level,
            subjects: ctx.subjects,
          }),
        },
      });
    },
    onSuccess: (child) => {
      void queryClient.invalidateQueries({ queryKey: CHILDREN_QUERY_KEY });
      setLearnerContext(learnerFromChild(child));
      setAdding(false);
      setDraft(EMPTY_DRAFT);
    },
    onError: () => {
      // Saving failed: still apply the details for this session (#698 §4).
      toast.error(t("learner.save_failed"));
      setLearnerContext(draftContext());
      setAdding(false);
    },
  });

  const applyDraft = () => {
    if (user && draft.name.trim()) {
      saveMutation.mutate();
      return;
    }
    setLearnerContext(draftContext());
    setAdding(false);
  };

  const levelOptions = [
    { value: "", label: t("learner.level_any") },
    ...CHILD_LEVELS.map((level) => ({ value: level, label: learnerLevelLabel(level, t) })),
  ];
  const curriculumOptions = [
    { value: "", label: t("learner.curriculum_any") },
    ...LEARNER_CURRICULA.map((value) => ({ value, label: learnerCurriculumLabel(value) })),
  ];
  const subjectOptions = getSubjectOptionsForCategory(draft.curriculum || undefined);
  const isGuestActive = learner?.source === "guest";

  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label={t("learner.who_title")} className="flex flex-wrap gap-2">
        {childrenQuery.isLoading && user
          ? [0, 1].map((i) => (
              <span key={i} className="h-9 w-28 animate-pulse rounded-full bg-muted" />
            ))
          : null}
        {children.map((child) => {
          const ctx = learnerFromChild(child);
          const active = learner?.source === "child" && learner.childId === child.id;
          const summary = learnerSummary(ctx, t);
          return (
            <button
              key={child.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setLearnerContext(active ? null : ctx)}
              className={pillClass(active)}
            >
              {child.nickname}
              {summary ? (
                <span className="font-medium text-muted-foreground">({summary})</span>
              ) : null}
            </button>
          );
        })}
        {isGuestActive ? (
          <span className={pillClass(true)}>
            {learner.name || t("learner.guest_label")}
            {learnerSummary(learner, t) ? (
              <span className="font-medium text-muted-foreground">
                ({learnerSummary(learner, t)})
              </span>
            ) : null}
          </span>
        ) : null}
        <button
          type="button"
          role="radio"
          aria-checked={!learner}
          onClick={() => setLearnerContext(null)}
          className={pillClass(!learner)}
        >
          {t("learner.any_student")}
        </button>
        <button
          type="button"
          onClick={() => setAdding((value) => !value)}
          aria-expanded={adding}
          className={pillClass(adding)}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t("learner.add_student")}
        </button>
      </div>

      {adding ? (
        <div className="space-y-3 rounded-2xl border border-border p-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-[color:var(--ink)]">
              {user ? t("learner.add_title") : t("learner.guest_title")}
            </p>
            <button
              type="button"
              aria-label={t("learner.cancel")}
              onClick={() => setAdding(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <Input
            value={draft.name}
            maxLength={40}
            onChange={(event) => setDraft((d) => ({ ...d, name: event.target.value }))}
            placeholder={t("learner.name_placeholder")}
            aria-label={t("learner.name_placeholder")}
          />
          <div className="grid grid-cols-2 gap-2">
            <SearchableSelect
              value={draft.level}
              onChange={(level) => setDraft((d) => ({ ...d, level }))}
              options={levelOptions}
              placeholder={t("learner.level_any")}
              className="h-11 rounded-xl"
            />
            <SearchableSelect
              value={draft.curriculum}
              onChange={(curriculum) => setDraft((d) => ({ ...d, curriculum, subjects: [] }))}
              options={curriculumOptions}
              placeholder={t("learner.curriculum_any")}
              className="h-11 rounded-xl"
            />
          </div>
          <SubjectMultiSelect
            options={subjectOptions}
            selected={draft.subjects}
            onToggle={(subject) =>
              setDraft((d) => ({
                ...d,
                subjects: d.subjects.includes(subject)
                  ? d.subjects.filter((s) => s !== subject)
                  : [...d.subjects, subject].slice(0, 8),
              }))
            }
            onClear={() => setDraft((d) => ({ ...d, subjects: [] }))}
            clearLabel={t("search_ui.clear_subjects")}
            searchPlaceholder={t("search_panel.search_subject")}
            emptyText={t("search_panel.no_matches")}
          />
          <p className="text-xs text-muted-foreground">
            {user ? t("learner.add_hint") : t("learner.guest_hint")}
          </p>
          <Button
            type="button"
            variant="solid"
            color="blue"
            className="h-11 w-full rounded-full font-bold"
            disabled={
              saveMutation.isPending ||
              (!draft.name.trim() &&
                !draft.level &&
                !draft.curriculum &&
                draft.subjects.length === 0)
            }
            onClick={applyDraft}
          >
            {user && draft.name.trim() ? t("learner.save_and_use") : t("learner.use_for_search")}
          </Button>
        </div>
      ) : null}

      {learner && (learner.subjects.length > 0 || learnerSummary(learner, t)) ? (
        <p className="text-xs text-muted-foreground">
          {t("learner.auto_matched", {
            name: learner.name || t("learner.guest_label"),
            value: [learnerSummary(learner, t), learner.subjects.join(", ")]
              .filter(Boolean)
              .join(" · "),
          })}
        </p>
      ) : null}
    </div>
  );
}

/** #698: "Showing tutors tailored for …" banner above results, with Switch / Clear. */
export function LearnerContextBanner({ onSwitch }: { onSwitch: () => void }) {
  const { t } = useTranslation();
  const learner = useLearnerContext();
  if (!learner) return null;
  const summary = learnerSummary(learner, t);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-[color:var(--brand-link)]/40 bg-[color:var(--brand-link)]/[0.07] px-3 py-2 text-sm text-[color:var(--ink)]">
      <span className="min-w-0 flex-1 font-semibold">
        {t("learner.banner", {
          name: learner.name || t("learner.guest_label"),
          value: summary || t("learner.any_level"),
        })}
      </span>
      <button
        type="button"
        onClick={onSwitch}
        className="text-sm font-bold text-[color:var(--brand-link)] underline-offset-4 hover:underline"
      >
        {t("learner.switch")}
      </button>
      <button
        type="button"
        onClick={() => setLearnerContext(null)}
        aria-label={t("learner.clear")}
        className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-[color:var(--brand-link)]/15"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}
