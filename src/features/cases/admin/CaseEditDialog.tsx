import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
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
import { HK_DISTRICTS } from "@/features/tutors/queries";
import { EXAM_SYSTEM_OPTIONS, LEVEL_OPTIONS } from "@/features/cases/case-options";
import type { CaseRow } from "./shared";

const controlClassName = "h-10 w-full rounded-sm";
const labelClassName =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-wider text-muted-foreground";

type EditFormState = {
  title: string;
  description: string;
  subjectsText: string;
  studentLevel: string;
  examSystem: string;
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
          <div>
            <label className={labelClassName} htmlFor={`ce-district-${caseRow.id}`}>
              District
            </label>
            <SearchableSelect
              value={form.district}
              onChange={(v) => update({ district: v })}
              options={["", ...HK_DISTRICTS].map((d) => ({
                value: d,
                label: d || "Any / open to discussion",
              }))}
              placeholder="Optional"
              searchPlaceholder="Search district..."
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
                <SelectItem value="either">Open to discussion</SelectItem>
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
            className="bg-[color:var(--surface-invert)] font-bold text-white hover:bg-[color:var(--surface-invert-hover)]"
          >
            {saveMutation.isPending ? "Saving…" : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
