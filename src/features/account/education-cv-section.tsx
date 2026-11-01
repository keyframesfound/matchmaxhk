import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, Loader2, Pencil, Plus, Printer, Trash2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  deleteAcademicRecord,
  getMyEducationCv,
  saveAcademicRecord,
  saveLearnerSnapshot,
  RECORD_CATEGORIES,
  type AcademicRecord,
  type RecordCategory,
} from "@/features/account/academic-records.functions";

/**
 * Issue #545: Education CV & Academic Records on /account — learner
 * diagnostic snapshot + 6-category achievement timeline, one lightweight
 * modal for add/edit, share-with-matched-tutors toggle and a print/PDF
 * portfolio view (print stylesheet scopes to the .cv-print block).
 */

const CATEGORY_LABEL_KEYS: Record<RecordCategory, string> = {
  early_years: "cv.cat_early_years",
  primary: "cv.cat_primary",
  secondary: "cv.cat_secondary",
  post_secondary: "cv.cat_post_secondary",
  extracurricular_award: "cv.cat_extracurricular",
  certification_language: "cv.cat_certification",
};

type FormState = {
  id?: string;
  category: RecordCategory;
  institutionOrIssuer: string;
  titleOrProgram: string;
  curriculumOrBody: string;
  startYear: string;
  endYear: string;
  isCurrent: boolean;
  gradesOrResults: string;
  notes: string;
  visibility: "private" | "matched_tutors" | "public_tutor";
};

const emptyForm = (): FormState => ({
  category: "secondary",
  institutionOrIssuer: "",
  titleOrProgram: "",
  curriculumOrBody: "",
  startYear: "",
  endYear: "",
  isCurrent: false,
  gradesOrResults: "",
  notes: "",
  visibility: "matched_tutors",
});

function yearValue(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n >= 1990 && n <= 2100 ? Math.trunc(n) : null;
}

export function EducationCvSection({
  childProfileId,
  learnerName,
}: {
  childProfileId: string | null;
  learnerName: string;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState | null>(null);
  const [snapshotEditing, setSnapshotEditing] = useState(false);

  const cvQuery = useQuery({
    queryKey: ["education-cv", childProfileId ?? "myself"],
    queryFn: () => getMyEducationCv({ data: { childProfileId } }),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["education-cv"] });

  const saveSnapshot = useMutation({
    mutationFn: (input: {
      currentLevel: string | null;
      strengthsText: string | null;
      weaknessesText: string | null;
      targetGoalText: string | null;
      shareWithTutors: boolean;
    }) => saveLearnerSnapshot({ data: { childProfileId, ...input } }),
    onSuccess: () => {
      toast.success(t("cv.saved"));
      setSnapshotEditing(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleShare = useMutation({
    mutationFn: (share: boolean) => {
      const s = cvQuery.data?.snapshot;
      return saveLearnerSnapshot({
        data: {
          childProfileId,
          currentLevel: s?.current_level ?? null,
          strengthsText: s?.strengths_text ?? null,
          weaknessesText: s?.weaknesses_text ?? null,
          targetGoalText: s?.target_goal_text ?? null,
          shareWithTutors: share,
        },
      });
    },
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const saveRecord = useMutation({
    mutationFn: () =>
      saveAcademicRecord({
        data: {
          id: form?.id,
          childProfileId,
          category: form!.category,
          institutionOrIssuer: form!.institutionOrIssuer,
          titleOrProgram: form!.titleOrProgram,
          curriculumOrBody: form!.curriculumOrBody || null,
          startYear: yearValue(form!.startYear),
          endYear: form!.isCurrent ? null : yearValue(form!.endYear),
          isCurrent: form!.isCurrent,
          gradesOrResults: form!.gradesOrResults || null,
          notes: form!.notes || null,
          visibility: form!.visibility,
        },
      }),
    onSuccess: () => {
      toast.success(t("cv.saved"));
      setForm(null);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRecord = useMutation({
    mutationFn: (id: string) => deleteAcademicRecord({ data: { id } }),
    onSuccess: () => invalidate(),
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const records = cvQuery.data?.records ?? [];
    return RECORD_CATEGORIES.map((cat) => ({
      cat,
      items: records.filter((r) => r.category === cat),
    })).filter((g) => g.items.length > 0);
  }, [cvQuery.data?.records]);

  const snapshot = cvQuery.data?.snapshot;

  return (
    <section className="cv-print mt-8 rounded-2xl border border-border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-[color:var(--ink)]">
          <GraduationCap className="h-5 w-5" aria-hidden />
          {t("cv.title")}
          <span className="text-sm font-normal text-muted-foreground">— {learnerName}</span>
        </h3>
        <div className="flex items-center gap-3 print:hidden">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Switch
              checked={snapshot?.share_with_tutors ?? true}
              onCheckedChange={(v) => toggleShare.mutate(v)}
              aria-label={t("cv.share_toggle")}
            />
            {t("cv.share_toggle")}
          </label>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" aria-hidden />
            {t("cv.export")}
          </Button>
          <Button size="sm" onClick={() => setForm(emptyForm())}>
            <Plus className="mr-1.5 h-4 w-4" aria-hidden />
            {t("cv.add")}
          </Button>
        </div>
      </div>

      {cvQuery.isLoading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
        </div>
      ) : (
        <div className="space-y-5 p-5">
          {/* Learner snapshot */}
          <div className="rounded-xl border border-border bg-[color:var(--foreground)]/[0.02] p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[color:var(--ink)]">
                {t("cv.snapshot_title")}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="print:hidden"
                onClick={() => setSnapshotEditing(true)}
              >
                <Pencil className="mr-1 h-3.5 w-3.5" aria-hidden />
                {t("cv.edit")}
              </Button>
            </div>
            {snapshot &&
            (snapshot.current_level ||
              snapshot.strengths_text ||
              snapshot.weaknesses_text ||
              snapshot.target_goal_text) ? (
              <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
                {snapshot.current_level && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">{t("cv.level")}</dt>
                    <dd className="text-[color:var(--ink)]">{snapshot.current_level}</dd>
                  </div>
                )}
                {snapshot.target_goal_text && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">{t("cv.goal")}</dt>
                    <dd className="text-[color:var(--ink)]">{snapshot.target_goal_text}</dd>
                  </div>
                )}
                {snapshot.strengths_text && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">
                      {t("cv.strengths")}
                    </dt>
                    <dd className="text-[color:var(--ink)]">{snapshot.strengths_text}</dd>
                  </div>
                )}
                {snapshot.weaknesses_text && (
                  <div>
                    <dt className="text-xs font-medium text-muted-foreground">{t("cv.needs")}</dt>
                    <dd className="text-[color:var(--ink)]">{snapshot.weaknesses_text}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">{t("cv.snapshot_empty")}</p>
            )}
          </div>

          {/* Timeline */}
          {grouped.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {t("cv.empty")}
            </p>
          ) : (
            <div className="space-y-5">
              {grouped.map(({ cat, items }) => (
                <div key={cat}>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(CATEGORY_LABEL_KEYS[cat])}
                  </p>
                  <ul className="mt-2 space-y-2">
                    {items.map((r: AcademicRecord) => (
                      <li
                        key={r.id}
                        className="flex items-start justify-between gap-3 rounded-xl border border-border p-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-[color:var(--ink)]">
                            {r.title_or_program} · {r.institution_or_issuer}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {r.start_year ?? "?"}
                            {r.is_current
                              ? ` – ${t("cv.present")}`
                              : r.end_year
                                ? ` – ${r.end_year}`
                                : ""}
                            {r.curriculum_or_body ? ` · ${r.curriculum_or_body}` : ""}
                          </p>
                          {r.grades_or_results && (
                            <p className="mt-1 text-sm text-[color:var(--ink)]">
                              {t("cv.grades")}: {r.grades_or_results}
                            </p>
                          )}
                          {r.notes && (
                            <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-1 print:hidden">
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("cv.edit")}
                            onClick={() =>
                              setForm({
                                id: r.id,
                                category: r.category,
                                institutionOrIssuer: r.institution_or_issuer,
                                titleOrProgram: r.title_or_program,
                                curriculumOrBody: r.curriculum_or_body ?? "",
                                startYear: r.start_year ? String(r.start_year) : "",
                                endYear: r.end_year ? String(r.end_year) : "",
                                isCurrent: r.is_current,
                                gradesOrResults: r.grades_or_results ?? "",
                                notes: r.notes ?? "",
                                visibility: r.visibility,
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={t("cv.delete")}
                            onClick={() => {
                              if (window.confirm(t("cv.delete_confirm"))) deleteRecord.mutate(r.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4" aria-hidden />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Snapshot edit dialog */}
      <Dialog open={snapshotEditing} onOpenChange={setSnapshotEditing}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("cv.snapshot_edit_title")}</DialogTitle>
          </DialogHeader>
          <SnapshotForm
            initial={cvQuery.data?.snapshot ?? null}
            busy={saveSnapshot.isPending}
            onCancel={() => setSnapshotEditing(false)}
            onSubmit={(v) => saveSnapshot.mutate(v)}
          />
        </DialogContent>
      </Dialog>

      {/* Record add/edit dialog */}
      <Dialog open={form !== null} onOpenChange={(open) => !open && setForm(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{form?.id ? t("cv.edit_record") : t("cv.add_record")}</DialogTitle>
          </DialogHeader>
          {form && (
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label>{t("cv.field_category")}</Label>
                <Select
                  value={form.category}
                  onValueChange={(v) => setForm({ ...form, category: v as RecordCategory })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RECORD_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {t(CATEGORY_LABEL_KEYS[c])}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>{t("cv.field_institution")}</Label>
                <Input
                  value={form.institutionOrIssuer}
                  maxLength={120}
                  onChange={(e) => setForm({ ...form, institutionOrIssuer: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("cv.field_title")}</Label>
                <Input
                  value={form.titleOrProgram}
                  maxLength={160}
                  onChange={(e) => setForm({ ...form, titleOrProgram: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="grid gap-1.5">
                  <Label>{t("cv.field_start")}</Label>
                  <Input
                    inputMode="numeric"
                    value={form.startYear}
                    placeholder="2021"
                    onChange={(e) => setForm({ ...form, startYear: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>{t("cv.field_end")}</Label>
                  <Input
                    inputMode="numeric"
                    value={form.isCurrent ? "" : form.endYear}
                    disabled={form.isCurrent}
                    placeholder="2025"
                    onChange={(e) => setForm({ ...form, endYear: e.target.value })}
                  />
                </div>
                <label className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={form.isCurrent}
                    onChange={(e) => setForm({ ...form, isCurrent: e.target.checked })}
                  />
                  {t("cv.field_current")}
                </label>
              </div>
              <div className="grid gap-1.5">
                <Label>{t("cv.field_curriculum")}</Label>
                <Input
                  value={form.curriculumOrBody}
                  maxLength={60}
                  onChange={(e) => setForm({ ...form, curriculumOrBody: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("cv.field_grades")}</Label>
                <Input
                  value={form.gradesOrResults}
                  maxLength={300}
                  onChange={(e) => setForm({ ...form, gradesOrResults: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("cv.field_notes")}</Label>
                <Textarea
                  value={form.notes}
                  rows={2}
                  maxLength={300}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>{t("cv.field_visibility")}</Label>
                <Select
                  value={form.visibility}
                  onValueChange={(v) =>
                    setForm({ ...form, visibility: v as FormState["visibility"] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="private">{t("cv.vis_private")}</SelectItem>
                    <SelectItem value="matched_tutors">{t("cv.vis_matched")}</SelectItem>
                    {!childProfileId && (
                      <SelectItem value="public_tutor">{t("cv.vis_public")}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div className="mt-1 flex justify-end gap-2">
                <Button variant="outline" onClick={() => setForm(null)}>
                  <X className="mr-1.5 h-4 w-4" aria-hidden />
                  {t("cv.cancel")}
                </Button>
                <Button
                  disabled={
                    saveRecord.isPending ||
                    form.institutionOrIssuer.trim().length === 0 ||
                    form.titleOrProgram.trim().length === 0
                  }
                  onClick={() => saveRecord.mutate()}
                >
                  {saveRecord.isPending && (
                    <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />
                  )}
                  {t("cv.save")}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function SnapshotForm({
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: {
    current_level: string | null;
    strengths_text: string | null;
    weaknesses_text: string | null;
    target_goal_text: string | null;
    share_with_tutors: boolean;
  } | null;
  busy: boolean;
  onSubmit: (v: {
    currentLevel: string | null;
    strengthsText: string | null;
    weaknessesText: string | null;
    targetGoalText: string | null;
    shareWithTutors: boolean;
  }) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const [level, setLevel] = useState(initial?.current_level ?? "");
  const [strengths, setStrengths] = useState(initial?.strengths_text ?? "");
  const [needs, setNeeds] = useState(initial?.weaknesses_text ?? "");
  const [goal, setGoal] = useState(initial?.target_goal_text ?? "");
  const [share, setShare] = useState(initial?.share_with_tutors ?? true);
  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <Label>{t("cv.level")}</Label>
        <Input value={level} maxLength={60} onChange={(e) => setLevel(e.target.value)} />
      </div>
      <div className="grid gap-1.5">
        <Label>{t("cv.strengths")}</Label>
        <Textarea
          value={strengths}
          rows={2}
          maxLength={200}
          onChange={(e) => setStrengths(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>{t("cv.needs")}</Label>
        <Textarea
          value={needs}
          rows={2}
          maxLength={200}
          onChange={(e) => setNeeds(e.target.value)}
        />
      </div>
      <div className="grid gap-1.5">
        <Label>{t("cv.goal")}</Label>
        <Textarea value={goal} rows={2} maxLength={200} onChange={(e) => setGoal(e.target.value)} />
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          {t("cv.cancel")}
        </Button>
        <label className="mr-auto flex items-center gap-2 text-sm text-muted-foreground">
          <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} />
          {t("cv.share_toggle")}
        </label>
        <Button
          disabled={busy}
          onClick={() =>
            onSubmit({
              currentLevel: level || null,
              strengthsText: strengths || null,
              weaknessesText: needs || null,
              targetGoalText: goal || null,
              shareWithTutors: share,
            })
          }
        >
          {busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden />}
          {t("cv.save")}
        </Button>
      </div>
    </div>
  );
}
