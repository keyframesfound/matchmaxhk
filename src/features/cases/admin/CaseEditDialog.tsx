import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { MtrStationSelect } from "@/components/ui/mtr-station-select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EXAM_SYSTEM_OPTIONS, LEVEL_OPTIONS } from "@/features/cases/case-options";
import {
  ACADEMIC_TIERS,
  FIELDS_OF_STUDY,
  KINDERGARTEN_TOPICS,
  UNIVERSITY_SUGGESTIONS,
  caseAcademicTier,
  normalizeAcademicTier,
  normalizeKindergartenTopics,
} from "@/features/tutors/verticals";
import { academicTierLabel, kindergartenTopicLabel } from "@/features/tutors/verticals-labels";
import { sanitizeCaseUniText } from "@/features/cases/case-verticals";
import type { CaseRow } from "./shared";

const controlClassName = "h-10 w-full rounded-sm";
const labelClassName = "mb-1.5 block text-[11px] font-medium text-muted-foreground";

type EditFormState = {
  title: string;
  description: string;
  subjectsText: string;
  studentLevel: string;
  examSystem: string;
  // Issue #190: academic tier + vertical fields.
  academicTier: string;
  uniField: string;
  uniName: string;
  uniProgram: string;
  uniCourseCodes: string;
  kindergartenTopics: string[];
  district: string;
  mode: CaseRow["mode"];
  budgetMin: string;
  budgetMax: string;
  startTiming: string;
};

function toFormState(caseRow: CaseRow): EditFormState {
  return {
    title: caseRow.title ?? "",
    description: caseRow.description ?? "",
    subjectsText: (caseRow.subjects ?? []).join(", "),
    studentLevel: caseRow.student_level ?? "",
    examSystem: caseRow.exam_system ?? "",
    // Legacy rows have no stored tier, derive it from the student level.
    academicTier:
      normalizeAcademicTier(caseRow.academic_tier) ??
      caseAcademicTier(caseRow.academic_tier, caseRow.student_level) ??
      "",
    uniField: caseRow.uni_field ?? "",
    uniName: caseRow.uni_name ?? "",
    uniProgram: caseRow.uni_program ?? "",
    uniCourseCodes: caseRow.uni_course_codes ?? "",
    kindergartenTopics: normalizeKindergartenTopics(caseRow.kindergarten_focus),
    district: caseRow.district ?? "",
    mode: caseRow.mode ?? "either",
    budgetMin:
      caseRow.budget_min === null || caseRow.budget_min === undefined
        ? ""
        : String(caseRow.budget_min),
    budgetMax:
      caseRow.budget_max === null || caseRow.budget_max === undefined
        ? ""
        : String(caseRow.budget_max),
    startTiming: caseRow.start_timing ?? "unset",
  };
}

export function CaseEditDialog({
  caseRow,
  open,
  onOpenChange,
}: {
  caseRow: CaseRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  const [form, setForm] = useState<EditFormState>(() => toFormState(caseRow));

  useEffect(() => {
    if (open) setForm(toFormState(caseRow));
  }, [open, caseRow]);

  const update = (patch: Partial<EditFormState>) => setForm((prev) => ({ ...prev, ...patch }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const subjects = form.subjectsText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 6);
      const patch: Record<string, unknown> = {
        title: form.title.trim() || caseRow.title,
        description: form.description.trim() || null,
        subjects,
        student_level: form.studentLevel || caseRow.student_level,
        exam_system: form.examSystem.trim() || null,
        // Issue #190: tier + vertical fields. Uni fields only survive on the
        // university tier, K topics only on the kindergarten tier; a blank
        // tier clears them (normalizeAcademicTier returns null for "").
        // Issue #396: uni free text goes through the shared contact filter
        // (strip, not reject) before it can reach the public board.
        academic_tier: normalizeAcademicTier(form.academicTier),
        uni_field:
          form.academicTier === "university" ? sanitizeCaseUniText(form.uniField, 80) : null,
        uni_name:
          form.academicTier === "university" ? sanitizeCaseUniText(form.uniName, 120) : null,
        uni_program:
          form.academicTier === "university" ? sanitizeCaseUniText(form.uniProgram, 120) : null,
        uni_course_codes:
          form.academicTier === "university"
            ? sanitizeCaseUniText(form.uniCourseCodes, 2000)
            : null,
        kindergarten_focus:
          form.academicTier === "kindergarten"
            ? normalizeKindergartenTopics(form.kindergartenTopics)
            : [],
        district: form.district.trim() || null,
        mode: form.mode,
        budget_min: form.budgetMin ? Number(form.budgetMin) : null,
        budget_max: form.budgetMax ? Number(form.budgetMax) : null,
        start_timing: form.startTiming === "unset" ? null : form.startTiming,
      };
      const { error } = await supabase
        .from("tutoring_cases")
        .update(patch as never)
        .eq("id", caseRow.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Request ${caseRow.case_code} updated`);
      queryClient.invalidateQueries({ queryKey: ["admin", "cases"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit request {caseRow.case_code}</DialogTitle>
          <DialogDescription>
            Clean up the listing before publishing it to the public tutor request board. Parent
            contact details stay private.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className={labelClassName} htmlFor={`ce-title-${caseRow.id}`}>
              Title
            </label>
            <Input
              id={`ce-title-${caseRow.id}`}
              className={controlClassName}
              value={form.title}
              onChange={(e) => update({ title: e.target.value })}
            />
          </div>
          <div>
            <label className={labelClassName} htmlFor={`ce-level-${caseRow.id}`}>
              Student level
            </label>
            <SearchableSelect
              value={form.studentLevel}
              onChange={(v) => update({ studentLevel: v })}
              options={LEVEL_OPTIONS}
              placeholder="Select level"
              searchPlaceholder="Search level..."
              className={controlClassName}
            />
          </div>
          <div>
            <label className={labelClassName} htmlFor={`ce-system-${caseRow.id}`}>
              Curriculum
            </label>
            <SearchableSelect
              value={form.examSystem}
              onChange={(v) => update({ examSystem: v })}
              options={["", ...EXAM_SYSTEM_OPTIONS.map((o) => o.value)].map((v) => ({
                value: v,
                label: v || "Not specified",
              }))}
              allowCustom
              placeholder="Not specified"
              searchPlaceholder="Search curriculum..."
              className={controlClassName}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClassName} htmlFor={`ce-subjects-${caseRow.id}`}>
              Subjects
            </label>
            <Input
              id={`ce-subjects-${caseRow.id}`}
              className={controlClassName}
              placeholder="Comma-separated, e.g. Math, Chemistry"
              value={form.subjectsText}
              onChange={(e) => update({ subjectsText: e.target.value })}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClassName} htmlFor={`ce-tier-${caseRow.id}`}>
              {t("case_request.tier_label")}
            </label>
            <SearchableSelect
              value={form.academicTier}
              onChange={(v) => update({ academicTier: v })}
              options={[
                { value: "", label: t("case_request.tier_unspecified") },
                ...ACADEMIC_TIERS.map((tier) => ({ value: tier, label: academicTierLabel(tier) })),
              ]}
              placeholder={t("case_request.tier_unspecified")}
              searchPlaceholder={t("case_request.tier_label")}
              className={controlClassName}
            />
          </div>
          {form.academicTier === "university" ? (
            <>
              <div>
                <label className={labelClassName} htmlFor={`ce-uni-field-${caseRow.id}`}>
                  {t("case_request.uni_field_label")}
                </label>
                <SearchableSelect
                  value={form.uniField}
                  onChange={(v) => update({ uniField: v })}
                  options={FIELDS_OF_STUDY.map((field) => ({ value: field, label: field }))}
                  allowCustom
                  placeholder={t("case_request.uni_field_placeholder")}
                  searchPlaceholder={t("case_request.uni_field_placeholder")}
                  className={controlClassName}
                />
              </div>
              <div>
                <label className={labelClassName} htmlFor={`ce-uni-name-${caseRow.id}`}>
                  {t("case_request.uni_name_label")}
                </label>
                <SearchableSelect
                  value={form.uniName}
                  onChange={(v) => update({ uniName: v })}
                  options={UNIVERSITY_SUGGESTIONS.map((name) => ({ value: name, label: name }))}
                  allowCustom
                  placeholder={t("case_request.uni_name_placeholder")}
                  searchPlaceholder={t("case_request.uni_name_placeholder")}
                  className={controlClassName}
                />
              </div>
              <div>
                <label className={labelClassName} htmlFor={`ce-uni-program-${caseRow.id}`}>
                  {t("case_request.uni_program_label")}
                </label>
                <Input
                  id={`ce-uni-program-${caseRow.id}`}
                  className={controlClassName}
                  maxLength={120}
                  value={form.uniProgram}
                  onChange={(e) => update({ uniProgram: e.target.value })}
                />
              </div>
              <div className="sm:col-span-2">
                <label className={labelClassName} htmlFor={`ce-uni-courses-${caseRow.id}`}>
                  {t("case_request.uni_courses_label")}
                </label>
                <Textarea
                  id={`ce-uni-courses-${caseRow.id}`}
                  rows={3}
                  maxLength={2000}
                  className="w-full rounded-sm"
                  value={form.uniCourseCodes}
                  onChange={(e) => update({ uniCourseCodes: e.target.value })}
                />
              </div>
            </>
          ) : null}
          {form.academicTier === "kindergarten" ? (
            <div className="sm:col-span-2">
              <span className={labelClassName}>{t("case_request.k_focus_label")}</span>
              <div
                role="group"
                aria-label={t("case_request.k_focus_aria")}
                className="space-y-1 rounded-sm border border-border p-3"
              >
                {KINDERGARTEN_TOPICS.map((topic) => {
                  const active = form.kindergartenTopics.includes(topic);
                  return (
                    <label
                      key={topic}
                      className="flex cursor-pointer items-center gap-3 rounded-sm px-2 py-1.5 text-sm text-[color:var(--ink)] transition-colors hover:bg-[color:var(--foreground)]/[0.04]"
                    >
                      <Checkbox
                        checked={active}
                        onCheckedChange={(checked) =>
                          update({
                            kindergartenTopics: checked
                              ? [...form.kindergartenTopics, topic]
                              : form.kindergartenTopics.filter((item) => item !== topic),
                          })
                        }
                      />
                      <span className="font-medium">{kindergartenTopicLabel(topic)}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ) : null}
          <div>
            <label className={labelClassName} htmlFor={`ce-district-${caseRow.id}`}>
              Nearest MTR station
            </label>
            <MtrStationSelect
              value={form.district}
              onChange={(v) => update({ district: v })}
              placeholder="Any / open to discussion"
              className={controlClassName}
            />
          </div>
          <div>
            <label className={labelClassName}>Lesson mode</label>
            <Select value={form.mode} onValueChange={(v) => update({ mode: v as CaseRow["mode"] })}>
              <SelectTrigger className={controlClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="online">Online</SelectItem>
                <SelectItem value="in_person">In-person</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className={labelClassName}>Budget per hour (HK$)</label>
            <div className="flex items-center gap-2">
              <Input
                aria-label="Minimum budget per hour"
                className={controlClassName}
                placeholder="Min"
                inputMode="numeric"
                value={form.budgetMin}
                onChange={(e) => update({ budgetMin: e.target.value.replace(/[^\d]/g, "") })}
              />
              <span className="text-sm font-bold text-muted-foreground">–</span>
              <Input
                aria-label="Maximum budget per hour"
                className={controlClassName}
                placeholder="Max"
                inputMode="numeric"
                value={form.budgetMax}
                onChange={(e) => update({ budgetMax: e.target.value.replace(/[^\d]/g, "") })}
              />
            </div>
          </div>
          <div>
            <label className={labelClassName}>Start timing</label>
            <Select value={form.startTiming} onValueChange={(v) => update({ startTiming: v })}>
              <SelectTrigger className={controlClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unset">Not set</SelectItem>
                <SelectItem value="asap">As soon as possible</SelectItem>
                <SelectItem value="two_weeks">Within 2 weeks</SelectItem>
                <SelectItem value="flexible">Flexible</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <label className={labelClassName} htmlFor={`ce-desc-${caseRow.id}`}>
              Public description
            </label>
            <Textarea
              id={`ce-desc-${caseRow.id}`}
              rows={4}
              className="w-full rounded-sm"
              placeholder="Shown to tutors on the board. Remove anything that could identify the child."
              value={form.description}
              onChange={(e) => update({ description: e.target.value })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saveMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="font-bold"
          >
            {saveMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
