import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  ASSESSMENT_CATEGORIES,
  ASSESSMENT_NAME_MAX,
  ASSESSMENT_NOTE_MAX,
  GRADE_LABEL_MAX,
  assessmentError,
  assessmentPct,
  sortAssessments,
  summarizeProgress,
  type AssessmentCategory,
} from "@/features/cases/case-progress";
import {
  deleteAssessment,
  getCaseProgress,
  logAssessment,
  setProgressTarget,
} from "@/features/cases/case-progress.functions";
import { hktDateKey } from "@/features/cases/sor";

import { ProgressChart, type ChartScore } from "./progress-chart";

const SAMPLE_TARGET_PCT = 80;
const SAMPLE_SCORES: ChartScore[] = [
  { id: "s1", name: "", assessedOn: "2026-01-10", marks: 55, maxMarks: 100 },
  { id: "s2", name: "", assessedOn: "2026-03-10", marks: 63, maxMarks: 100 },
  { id: "s3", name: "", assessedOn: "2026-05-10", marks: 72, maxMarks: 100 },
].map((s) => ({ ...s, createdAt: s.assessedOn, gradeLabel: null, note: null }));

function useErrorToast() {
  const { t } = useTranslation();
  return (e: Error) =>
    toast.error(t(`progress.err_${e.message}`, { defaultValue: t("progress.err_generic") }));
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function targetText(
  t: ReturnType<typeof useTranslation>["t"],
  pct: number | null,
  grade: string | null,
): string | null {
  if (pct === null) return null;
  return grade
    ? t("progress.target_line", { pct, grade })
    : t("progress.target_line_no_grade", { pct });
}

function LogScoreDialog({
  caseId,
  onOpenChange,
  onDone,
}: {
  caseId: string;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const onError = useErrorToast();
  const [name, setName] = useState("");
  const [date, setDate] = useState(() => hktDateKey(new Date()));
  const [category, setCategory] = useState<AssessmentCategory>("lesson_quiz");
  const [marks, setMarks] = useState("");
  const [maxMarks, setMaxMarks] = useState("");
  const [gradeLabel, setGradeLabel] = useState("");
  const [note, setNote] = useState("");

  const marksValue = Number(marks);
  const maxValue = Number(maxMarks);
  const inputError =
    marks && maxMarks
      ? assessmentError({
          marks: marksValue,
          maxMarks: maxValue,
          assessedOn: date,
          now: new Date(),
        })
      : null;
  const save = useMutation({
    mutationFn: () =>
      logAssessment({
        data: {
          caseId,
          name: name.trim(),
          assessedOn: date,
          category,
          marks: marksValue,
          maxMarks: maxValue,
          gradeLabel: gradeLabel.trim() || undefined,
          note: note.trim() || undefined,
        },
      }),
    onSuccess: () => {
      onOpenChange(false);
      onDone();
    },
    onError,
  });
  const ready = Boolean(name.trim() && marks && maxMarks && !inputError);

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("progress.log_title")}</DialogTitle>
          <DialogDescription>{t("progress.private_note")}</DialogDescription>
        </DialogHeader>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t("progress.field_name")}
          <Input
            value={name}
            maxLength={ASSESSMENT_NAME_MAX}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("progress.field_date")}
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("progress.field_category")}
            <select
              className="h-9 rounded-md border border-input bg-transparent px-2 text-sm text-[color:var(--ink)]"
              value={category}
              onChange={(e) => setCategory(e.target.value as AssessmentCategory)}
            >
              {ASSESSMENT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {t(`progress.category_${c}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("progress.field_marks")}
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.5"
              value={marks}
              onChange={(e) => setMarks(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("progress.field_max")}
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.5"
              value={maxMarks}
              onChange={(e) => setMaxMarks(e.target.value)}
            />
          </label>
        </div>
        {inputError ? (
          <p role="alert" className="text-sm text-destructive">
            {t(`progress.err_${inputError}`)}
          </p>
        ) : null}
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t("progress.field_grade")}
          <Input
            value={gradeLabel}
            maxLength={GRADE_LABEL_MAX}
            onChange={(e) => setGradeLabel(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t("progress.field_note")}
          <Input
            value={note}
            maxLength={ASSESSMENT_NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("sor.admin_cancel")}
          </Button>
          <Button disabled={save.isPending || !ready} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("progress.log_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TargetDialog({
  caseId,
  currentPct,
  currentGrade,
  onOpenChange,
  onDone,
}: {
  caseId: string;
  currentPct: number | null;
  currentGrade: string | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const onError = useErrorToast();
  const [pct, setPct] = useState(currentPct === null ? "" : String(currentPct));
  const [grade, setGrade] = useState(currentGrade ?? "");
  const pctValue = Number(pct);
  const valid = pct !== "" && Number.isInteger(pctValue) && pctValue >= 0 && pctValue <= 100;
  const save = useMutation({
    mutationFn: () =>
      setProgressTarget({
        data: { caseId, targetPct: pctValue, targetGrade: grade.trim() || undefined },
      }),
    onSuccess: () => {
      onOpenChange(false);
      onDone();
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("progress.target_title")}</DialogTitle>
          <DialogDescription>{t("progress.target_hint")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("progress.field_target_pct")}
            <Input
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              value={pct}
              onChange={(e) => setPct(e.target.value)}
            />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("progress.field_grade")}
            <Input
              value={grade}
              maxLength={GRADE_LABEL_MAX}
              onChange={(e) => setGrade(e.target.value)}
            />
          </label>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("sor.admin_cancel")}
          </Button>
          <Button disabled={save.isPending || !valid} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("progress.target_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** #653: the Progress & Grades tab of the Case Detail drawer. Private to the case. */
export function ProgressTab({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const onError = useErrorToast();
  const queryClient = useQueryClient();
  const queryKey = ["case-progress", caseId];
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => getCaseProgress({ data: { caseId } }),
  });
  const [logOpen, setLogOpen] = useState(false);
  const [targetOpen, setTargetOpen] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey });
  const remove = useMutation({
    mutationFn: (assessmentId: string) => deleteAssessment({ data: { caseId, assessmentId } }),
    onSuccess: refresh,
    onError,
  });

  if (isLoading) return <Loader2 className="mt-4 h-5 w-5 animate-spin" aria-hidden />;
  if (isError || !data) {
    return <p className="mt-4 text-sm text-destructive">{t("progress.err_generic")}</p>;
  }

  const summary = summarizeProgress(data.scores, data.targetPct);
  const log = sortAssessments(data.scores).reverse();
  const percent = (value: number | null) => (value === null ? "--" : `${value}%`);
  const progressValue =
    summary.delta === null
      ? summary.baseline === null
        ? "--"
        : t("progress.one_more")
      : `${summary.delta > 0 ? "+" : ""}${summary.delta}%${
          summary.onTarget ? ` · ${t("progress.on_target")}` : ""
        }`;

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <StatCard label={t("progress.stat_baseline")} value={percent(summary.baseline)} />
        <StatCard label={t("progress.stat_latest")} value={percent(summary.latest)} />
        <StatCard label={t("progress.stat_progress")} value={progressValue} />
      </div>
      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t("progress.chart_title")}</h3>
        {data.scores.length === 0 ? (
          <>
            <ProgressChart
              scores={SAMPLE_SCORES}
              targetPct={SAMPLE_TARGET_PCT}
              targetLabel={t("progress.sample_label")}
              sample
            />
            <p className="text-sm text-muted-foreground">{t("progress.empty_hint")}</p>
          </>
        ) : (
          <ProgressChart
            scores={data.scores}
            targetPct={data.targetPct}
            targetLabel={targetText(t, data.targetPct, data.targetGrade)}
          />
        )}
      </section>
      {data.readOnly ? null : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" onClick={() => setLogOpen(true)}>
            {t("progress.log_open")}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setTargetOpen(true)}>
            {t("progress.target_open")}
          </Button>
        </div>
      )}
      {log.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("progress.log_heading")}</h3>
          <ul className="divide-y divide-border rounded-xl border border-border">
            {log.map((s) => (
              <li key={s.id} className="px-3 py-2 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 font-semibold [overflow-wrap:anywhere]">{s.name}</p>
                  {s.mine && !data.readOnly ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(s.id)}
                    >
                      {t("progress.remove")}
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">
                  {s.assessedOn} · {t(`progress.category_${s.category}`)} · {s.marks}/{s.maxMarks} ·{" "}
                  {assessmentPct(s.marks, s.maxMarks)}%{s.gradeLabel ? ` · ${s.gradeLabel}` : ""}
                </p>
                {s.note ? (
                  <p className="mt-0.5 text-xs [overflow-wrap:anywhere]">{s.note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <p className="text-xs text-muted-foreground">{t("progress.private_note")}</p>
      {logOpen ? (
        <LogScoreDialog caseId={caseId} onOpenChange={setLogOpen} onDone={refresh} />
      ) : null}
      {targetOpen ? (
        <TargetDialog
          caseId={caseId}
          currentPct={data.targetPct}
          currentGrade={data.targetGrade}
          onOpenChange={setTargetOpen}
          onDone={refresh}
        />
      ) : null}
    </div>
  );
}

/** #653: read-only preview on the empty hub. */
export function ProgressSamplePreview() {
  const { t } = useTranslation();
  return (
    <section className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-card p-5">
      <h2 className="text-lg font-bold">{t("progress.tab")}</h2>
      <div className="grid grid-cols-3 gap-2">
        <StatCard label={t("progress.stat_baseline")} value="--" />
        <StatCard label={t("progress.stat_latest")} value="--" />
        <StatCard label={t("progress.stat_progress")} value="--" />
      </div>
      <ProgressChart
        scores={SAMPLE_SCORES}
        targetPct={SAMPLE_TARGET_PCT}
        targetLabel={t("progress.sample_label")}
        sample
      />
      <p className="text-sm text-muted-foreground">{t("progress.empty_hint")}</p>
    </section>
  );
}
