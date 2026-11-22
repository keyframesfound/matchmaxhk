import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  BOTTLENECKS,
  FEEDBACK_STYLES,
  LANGUAGE_MEDIUMS,
  LEARNING_STYLES,
  PREFERRED_STYLES,
  PRIMARY_GOALS,
  type DemandSide,
} from "@/features/cases/demand-side/demand-side";
import {
  getCaseDemandSide,
  saveCaseDemandSide,
} from "@/features/cases/demand-side/demand-side.functions";
import { fetchCaseHeatmap } from "@/features/cases/heatmap.functions";
import { cn } from "@/lib/utils";

const controlClass =
  "h-10 w-full rounded-[var(--radius-control)] border border-input bg-transparent px-3 text-sm";

const chipClass =
  "inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]";
const chipSelected =
  "border-[color:var(--brand-link)] bg-[color:var(--brand-link)]/[0.06] text-[color:var(--ink)]";
const chipResting = "border-border text-muted-foreground hover:bg-muted";

/** The three preferred-style values do not map 1:1 onto their copy keys. */
const STYLE_LABEL: Record<string, string> = {
  patient_step_by_step: "preferred_style_patient",
  fast_paced: "preferred_style_fast_paced",
  past_paper_focused: "preferred_style_past_paper",
};

const chipLabel = (prefix: "goal" | "bottleneck" | "preferred_style", value: string) =>
  prefix === "preferred_style"
    ? `demand_side.${STYLE_LABEL[value] ?? `${prefix}_${value}`}`
    : `demand_side.${prefix}_${value}`;

function OptionSelect({
  label,
  value,
  options,
  prefix,
  onChange,
}: {
  label: string;
  value: string | null;
  options: readonly string[];
  prefix: string;
  onChange: (value: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <label className="block text-xs font-medium text-muted-foreground">
      {label}
      <select
        className={cn(controlClass, "mt-1 text-[color:var(--ink)]")}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
      >
        <option value="">{t("demand_side.not_set")}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {t(`demand_side.${prefix}_${option}`)}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Single-select chips with no forced answer: pressing the selected chip again
 * clears it, so "skip" needs no extra control.
 */
function ChipGroup({
  label,
  prefix,
  options,
  selected,
  onChange,
}: {
  label: string;
  prefix: "goal" | "bottleneck" | "preferred_style";
  options: readonly string[];
  selected: string | null;
  onChange: (value: string | null) => void;
}) {
  const { t } = useTranslation();
  return (
    <fieldset>
      <legend className="text-xs font-medium text-muted-foreground">{label}</legend>
      <div className="mt-1.5 flex flex-wrap gap-2">
        {options.map((option) => {
          const on = selected === option;
          return (
            <button
              key={option}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? null : option)}
              className={cn(chipClass, on ? chipSelected : chipResting)}
            >
              {t(chipLabel(prefix, option))}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm text-[color:var(--ink)]">
        {value}
      </dd>
    </div>
  );
}

const formatDate = (iso: string, locale: string) => {
  const date = new Date(`${iso}T00:00:00`);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString(locale);
};

/** The briefing chips that are set, in group order, as label/value pairs. */
function chipEntries(values: DemandSide, t: (key: string) => string) {
  const entries: { key: string; label: string; value: string }[] = [];
  if (values.primaryGoal) {
    entries.push({
      key: "goal",
      label: t("demand_side.goal_label"),
      value: t(chipLabel("goal", values.primaryGoal)),
    });
  }
  if (values.bottleneck) {
    entries.push({
      key: "bottleneck",
      label: t("demand_side.bottleneck_label"),
      value: t(chipLabel("bottleneck", values.bottleneck)),
    });
  }
  if (values.preferredStyle) {
    entries.push({
      key: "style",
      label: t("demand_side.preferred_style_label"),
      value: t(chipLabel("preferred_style", values.preferredStyle)),
    });
  }
  return entries;
}

/** Study-plan lines that have a value. Focus topics are rendered separately. */
function planEntries(values: DemandSide, t: (key: string) => string, locale: string) {
  const entries: { key: string; label: string; value: string }[] = [];
  if (values.targetExam.trim()) {
    entries.push({
      key: "exam",
      label: t("demand_side.plan_exam_label"),
      value: values.targetExam,
    });
  }
  if (values.targetExamDate) {
    entries.push({
      key: "exam_date",
      label: t("demand_side.plan_exam_date_label"),
      value: formatDate(values.targetExamDate, locale),
    });
  }
  if (values.currentLevel.trim()) {
    entries.push({
      key: "current",
      label: t("demand_side.current_label"),
      value: values.currentLevel,
    });
  }
  if (values.targetGrade.trim()) {
    entries.push({
      key: "target",
      label: t("demand_side.target_label"),
      value: values.targetGrade,
    });
  }
  return entries;
}

/** Read-only weak topics from the mastery heatmap: the tutor's input, never editable here. */
function FocusTopics({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const { data } = useQuery({
    queryKey: ["case-heatmap", caseId],
    queryFn: () => fetchCaseHeatmap({ data: { caseId } }),
  });
  if (!data) return null;
  const cells = data.cells;
  const topics = [
    ...cells.filter((cell) => cell.mastery === "weak"),
    ...cells.filter((cell) => cell.mastery !== "weak" && cell.weakByMistakes),
  ].slice(0, 3);
  if (topics.length === 0) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">
        {t("demand_side.plan_weak_label")}
      </p>
      <p className="text-xs text-muted-foreground">{t("demand_side.plan_weak_hint")}</p>
      <ul className="mt-1.5 flex flex-wrap gap-1.5">
        {topics.map((cell) => (
          <li
            key={cell.tag}
            className="rounded-full border border-border px-2.5 py-0.5 text-xs text-[color:var(--ink)]"
          >
            {cell.tag}
          </li>
        ))}
      </ul>
    </div>
  );
}

function ChipPills({ values }: { values: DemandSide }) {
  const { t } = useTranslation();
  const entries = chipEntries(values, t);
  if (entries.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-2">
      {entries.map((entry) => (
        <li
          key={entry.key}
          className="inline-flex h-9 items-center rounded-full border border-border px-3 text-sm font-medium text-[color:var(--ink)]"
        >
          {entry.value}
        </li>
      ))}
    </ul>
  );
}

function PlanBlock({ caseId, values }: { caseId: string; values: DemandSide }) {
  const { t, i18n } = useTranslation();
  const entries = planEntries(values, t, i18n.language);
  return (
    <div className="space-y-3">
      {entries.length > 0 ? (
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--ink)]">
            {t("demand_side.plan_title")}
          </h3>
          <dl className="mt-2 grid gap-3 sm:grid-cols-2">
            {entries.map((entry) => (
              <Field key={entry.key} label={entry.label} value={entry.value} />
            ))}
          </dl>
        </div>
      ) : null}
      <FocusTopics caseId={caseId} />
    </div>
  );
}

function ReadView({ caseId, values }: { caseId: string; values: DemandSide }) {
  const { t } = useTranslation();
  const dash = t("demand_side.not_set");
  const optionText = (prefix: string, value: string | null) =>
    value ? t(`demand_side.${prefix}_${value}`) : dash;
  return (
    <div className="space-y-4">
      <ChipPills values={values} />
      <div>
        <h3 className="text-sm font-semibold text-[color:var(--ink)]">
          {t("demand_side.household_title")}
        </h3>
        <dl className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field
            label={t("demand_side.medium_label")}
            value={optionText("medium", values.languageMedium)}
          />
          <Field
            label={t("demand_side.feedback_label")}
            value={optionText("feedback", values.feedbackStyle)}
          />
          <Field label={t("demand_side.notes_label")} value={values.householdNotes || dash} />
        </dl>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-[color:var(--ink)]">
          {t("demand_side.student_title")}
        </h3>
        <dl className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field
            label={t("demand_side.topics_label")}
            value={values.weakTopics.join(", ") || dash}
          />
          <Field
            label={t("demand_side.styles_label")}
            value={values.learningStyles.map((s) => t(`demand_side.style_${s}`)).join(", ") || dash}
          />
        </dl>
      </div>
      <PlanBlock caseId={caseId} values={values} />
    </div>
  );
}

function EditForm({
  caseId,
  initial,
  onDone,
}: {
  caseId: string;
  initial: DemandSide;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [values, setValues] = useState(initial);
  const [topicsText, setTopicsText] = useState(initial.weakTopics.join(", "));
  const [saveAsDefault, setSaveAsDefault] = useState(false);
  const patch = (next: Partial<DemandSide>) => setValues((prev) => ({ ...prev, ...next }));
  const save = useMutation({
    mutationFn: () =>
      saveCaseDemandSide({
        data: {
          caseId,
          saveAsDefault,
          values: {
            ...values,
            targetExamDate: values.targetExamDate || null,
            weakTopics: topicsText.split(/[,，、]/),
          } as never,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["case-demand-side", caseId] });
      toast.success(t("demand_side.saved"));
      onDone();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const toggleStyle = (style: string) =>
    patch({
      learningStyles: values.learningStyles.includes(style)
        ? values.learningStyles.filter((s) => s !== style)
        : [...values.learningStyles, style],
    });
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate();
      }}
    >
      <h3 className="text-sm font-semibold text-[color:var(--ink)]">
        {t("demand_side.household_title")}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <OptionSelect
          label={t("demand_side.medium_label")}
          value={values.languageMedium}
          options={LANGUAGE_MEDIUMS}
          prefix="medium"
          onChange={(languageMedium) => patch({ languageMedium })}
        />
        <OptionSelect
          label={t("demand_side.feedback_label")}
          value={values.feedbackStyle}
          options={FEEDBACK_STYLES}
          prefix="feedback"
          onChange={(feedbackStyle) => patch({ feedbackStyle })}
        />
      </div>
      <label className="block text-xs font-medium text-muted-foreground">
        {t("demand_side.notes_label")}
        <Textarea
          rows={3}
          maxLength={1000}
          className="mt-1"
          value={values.householdNotes}
          onChange={(e) => patch({ householdNotes: e.target.value })}
        />
      </label>

      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">{t("demand_side.skip_hint")}</p>
        <ChipGroup
          label={t("demand_side.goal_label")}
          prefix="goal"
          options={PRIMARY_GOALS}
          selected={values.primaryGoal}
          onChange={(primaryGoal) => patch({ primaryGoal })}
        />
        <ChipGroup
          label={t("demand_side.bottleneck_label")}
          prefix="bottleneck"
          options={BOTTLENECKS}
          selected={values.bottleneck}
          onChange={(bottleneck) => patch({ bottleneck })}
        />
        <ChipGroup
          label={t("demand_side.preferred_style_label")}
          prefix="preferred_style"
          options={PREFERRED_STYLES}
          selected={values.preferredStyle}
          onChange={(preferredStyle) => patch({ preferredStyle })}
        />
      </div>

      <h3 className="text-sm font-semibold text-[color:var(--ink)]">
        {t("demand_side.student_title")}
      </h3>
      <label className="block text-xs font-medium text-muted-foreground">
        {t("demand_side.topics_label")}
        <Input
          className="mt-1"
          placeholder={t("demand_side.topics_hint")}
          value={topicsText}
          onChange={(e) => setTopicsText(e.target.value)}
        />
      </label>
      <fieldset>
        <legend className="text-xs font-medium text-muted-foreground">
          {t("demand_side.styles_label")}
        </legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {LEARNING_STYLES.map((style) => {
            const on = values.learningStyles.includes(style);
            return (
              <button
                key={style}
                type="button"
                aria-pressed={on}
                onClick={() => toggleStyle(style)}
                className={cn(
                  "h-9 rounded-full border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]",
                  on
                    ? "border-[color:var(--surface-invert)] bg-[color:var(--surface-invert)] text-[color:var(--surface-invert-fg)]"
                    : "border-border text-[color:var(--ink)] hover:border-[color:var(--foreground)]/25",
                )}
              >
                {t(`demand_side.style_${style}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="space-y-3 rounded-[var(--radius-control)] border border-border p-3">
        <div>
          <h3 className="text-sm font-semibold text-[color:var(--ink)]">
            {t("demand_side.plan_title")}
          </h3>
          <p className="text-xs text-muted-foreground">{t("demand_side.plan_hint")}</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-xs font-medium text-muted-foreground">
            {t("demand_side.plan_exam_label")}
            <Input
              className="mt-1"
              maxLength={80}
              value={values.targetExam}
              onChange={(e) => patch({ targetExam: e.target.value })}
            />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            {t("demand_side.plan_exam_date_label")}
            <Input
              className="mt-1"
              type="date"
              value={values.targetExamDate ?? ""}
              onChange={(e) => patch({ targetExamDate: e.target.value || null })}
            />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            {t("demand_side.current_label")}
            <Input
              className="mt-1"
              maxLength={40}
              value={values.currentLevel}
              onChange={(e) => patch({ currentLevel: e.target.value })}
            />
          </label>
          <label className="block text-xs font-medium text-muted-foreground">
            {t("demand_side.target_label")}
            <Input
              className="mt-1"
              maxLength={40}
              value={values.targetGrade}
              onChange={(e) => patch({ targetGrade: e.target.value })}
            />
          </label>
        </div>
        <FocusTopics caseId={caseId} />
      </div>

      <label className="flex items-start gap-2 text-sm text-[color:var(--ink)]">
        <Checkbox
          className="mt-0.5"
          checked={saveAsDefault}
          onCheckedChange={(checked) => setSaveAsDefault(checked === true)}
        />
        {t("demand_side.save_default")}
      </label>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={save.isPending}>
          {t("demand_side.save")}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          {t("demand_side.cancel")}
        </Button>
      </div>
    </form>
  );
}

/**
 * Tutors get a read-only brief instead of the household edit surface. It stays
 * expanded until the first verified lesson, then collapses to a native details
 * element so the lesson log and heatmap take over the page.
 */
function TutorBrief({
  caseId,
  values,
  lessonsCompleted,
}: {
  caseId: string;
  values: DemandSide;
  lessonsCompleted: number;
}) {
  const { t, i18n } = useTranslation();
  const chips = chipEntries(values, t);
  const plan = planEntries(values, t, i18n.language);
  if (chips.length === 0 && plan.length === 0) return null;
  const lines = (
    <div className="space-y-1">
      {[...chips, ...plan].map((entry) => (
        <p key={entry.key} className="text-sm">
          <span className="font-medium text-muted-foreground">{entry.label}</span>{" "}
          <span className="text-[color:var(--ink)]">{entry.value}</span>
        </p>
      ))}
      <FocusTopics caseId={caseId} />
    </div>
  );
  if (lessonsCompleted < 1) return lines;
  const hint = [
    chips.find((chip) => chip.key === "goal")?.value,
    chips.find((chip) => chip.key === "style")?.value,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <details>
      <summary className="cursor-pointer text-sm font-medium text-[color:var(--ink)]">
        {t("demand_side.brief_collapsed")}
        {hint ? <span className="ml-2 font-normal text-muted-foreground">{hint}</span> : null}
      </summary>
      <div className="mt-2">{lines}</div>
    </details>
  );
}

/** #637: renders nothing for anyone who is not a party to the case. */
export function DemandSidePanel({ caseId }: { caseId: string }) {
  const { t, i18n } = useTranslation();
  const [editing, setEditing] = useState(false);
  const { data } = useQuery({
    queryKey: ["case-demand-side", caseId],
    queryFn: () => getCaseDemandSide({ data: { caseId } }),
  });
  if (!data) return null;
  return (
    <section
      className="rounded-[var(--radius-panel)] border border-border bg-card p-4"
      data-testid="demand-side"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-[color:var(--ink)]">{t("demand_side.title")}</h2>
          <p className="text-xs text-muted-foreground">
            {data.updatedAt
              ? t("demand_side.last_updated", {
                  when: new Date(data.updatedAt).toLocaleDateString(i18n.language),
                  name: data.updatedByName ?? t("demand_side.a_party"),
                })
              : t("demand_side.private_note")}
          </p>
        </div>
        {data.access === "edit" && !editing ? (
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
            <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            {t("demand_side.edit")}
          </Button>
        ) : null}
      </div>
      {editing ? (
        <EditForm caseId={caseId} initial={data.values} onDone={() => setEditing(false)} />
      ) : data.access === "read" ? (
        <TutorBrief caseId={caseId} values={data.values} lessonsCompleted={data.lessonsCompleted} />
      ) : (
        <ReadView caseId={caseId} values={data.values} />
      )}
    </section>
  );
}
