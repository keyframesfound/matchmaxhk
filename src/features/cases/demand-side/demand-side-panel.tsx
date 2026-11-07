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
  FEEDBACK_STYLES,
  LANGUAGE_MEDIUMS,
  LEARNING_STYLES,
  PRIMARY_GOALS,
  type DemandSide,
} from "@/features/cases/demand-side/demand-side";
import {
  getCaseDemandSide,
  saveCaseDemandSide,
} from "@/features/cases/demand-side/demand-side.functions";
import { cn } from "@/lib/utils";

const controlClass =
  "h-10 w-full rounded-[var(--radius-control)] border border-input bg-transparent px-3 text-sm";

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

function ReadView({ values }: { values: DemandSide }) {
  const { t } = useTranslation();
  const dash = t("demand_side.not_set");
  const optionText = (prefix: string, value: string | null) =>
    value ? t(`demand_side.${prefix}_${value}`) : dash;
  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-[color:var(--ink)]">
          {t("demand_side.household_title")}
        </h3>
        <dl className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field
            label={t("demand_side.goal_label")}
            value={optionText("goal", values.primaryGoal)}
          />
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
          <Field label={t("demand_side.current_label")} value={values.currentLevel || dash} />
          <Field label={t("demand_side.target_label")} value={values.targetGrade || dash} />
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
      <div className="grid gap-3 sm:grid-cols-3">
        <OptionSelect
          label={t("demand_side.goal_label")}
          value={values.primaryGoal}
          options={PRIMARY_GOALS}
          prefix="goal"
          onChange={(primaryGoal) => patch({ primaryGoal })}
        />
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
      <h3 className="text-sm font-semibold text-[color:var(--ink)]">
        {t("demand_side.student_title")}
      </h3>
      <div className="grid gap-3 sm:grid-cols-2">
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
    <section className="rounded-2xl border border-border bg-card p-4" data-testid="demand-side">
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
      ) : (
        <ReadView values={data.values} />
      )}
    </section>
  );
}
