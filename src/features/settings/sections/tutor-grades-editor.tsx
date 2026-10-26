import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Bell, Loader2, Plus, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useAuth } from "@/features/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  GRADE_SLIP_ACCEPT_ATTRIBUTE,
  GRADE_LABEL_MAX,
  MAX_GRADE_FILE_BYTES,
  gradeFileProblem,
  gradeLabelError,
  type TutorGradeStatus,
} from "@/features/tutors/grades";
import {
  createTutorGrade,
  deleteTutorGrade,
  markGradeNoticeRead,
  updateTutorGradeLabel,
  uploadTutorGradeSlip,
} from "@/features/tutors/grade.functions";

/**
 * Issue #309, per-grade slip upload inside "My tutor profile".
 *
 * Each grade row has its own upload control (PDF or image, max 10 MB); the
 * slip lands in the private grade-slips bucket via the service-role server fn
 * and enters the staff queue. Status chips mirror the row state; rejected rows
 * show the staff reason. Tutors can add a grade later with the same control
 * and delete a grade (the slip file is deleted with it).
 */

export type TutorGradeRow = {
  id: string;
  label: string;
  status: TutorGradeStatus;
  file_path: string | null;
  staff_reason: string | null;
  created_at: string;
};

export type TutorNoticeRow = {
  id: string;
  kind: string;
  payload: {
    grade_id?: string;
    label?: string;
    reason?: string | null;
    note?: string | null;
  } | null;
  read_at: string | null;
  created_at: string;
};

const STATUS_BADGE_CLASS: Record<TutorGradeStatus, string> = {
  none: "bg-muted text-muted-foreground",
  pending: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  rejected: "bg-destructive/10 text-destructive",
};

function readableFileSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TutorGradesEditor() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const createGrade = useServerFn(createTutorGrade);
  const uploadSlip = useServerFn(uploadTutorGradeSlip);
  const renameGrade = useServerFn(updateTutorGradeLabel);
  const removeGrade = useServerFn(deleteTutorGrade);
  const markRead = useServerFn(markGradeNoticeRead);

  const [newLabel, setNewLabel] = React.useState("");
  const [pendingGradeId, setPendingGradeId] = React.useState<string | null>(null);
  const gradeNewFileRef = React.useRef<HTMLInputElement>(null);

  const gradesQuery = useQuery({
    queryKey: ["tutor-grades", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_grades")
        .select("id, label, status, file_path, staff_reason, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as TutorGradeRow[];
    },
    enabled: Boolean(user),
  });

  const noticesQuery = useQuery({
    queryKey: ["tutor-notices", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutor_notices")
        .select("id, kind, payload, read_at, created_at")
        // Grade notices only, this editor renders grade decisions.
        // credential_approved / credential_rejected render in the
        // credential-edits pending list instead (issue #284).
        .in("kind", ["grade_approved", "grade_rejected"])
        .is("read_at", null)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data as TutorNoticeRow[];
    },
    enabled: Boolean(user),
  });

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["tutor-grades", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["tutors", "published"] });
  };

  const labelErrorFor = (label: string) => {
    const contact = gradeLabelError(label);
    if (contact) return contact;
    return null;
  };

  const addGrade = useMutation({
    mutationFn: async (file: File | null) => {
      const label = newLabel.trim();
      if (!label) throw new Error(t("settings.my_tutor.grades_label_required"));
      const labelProblem = labelErrorFor(label);
      if (labelProblem) throw new Error(labelProblem);
      if (file) {
        const problem = gradeFileProblem(file);
        if (problem === "hkid") throw new Error(t("settings.my_tutor.grades_hkid_error"));
        if (problem === "type") throw new Error(t("settings.my_tutor.grades_file_type"));
        if (problem === "size") throw new Error(t("settings.my_tutor.grades_file_too_large"));
      }
      const created = (await createGrade({ data: { label } })) as { id: string };
      if (file) {
        const content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        await uploadSlip({
          data: {
            gradeId: created.id,
            file: {
              filename: file.name,
              contentType: file.type,
              size: file.size,
              content,
            },
          },
        });
      }
    },
    onSuccess: async () => {
      setNewLabel("");
      toast.success(t("settings.my_tutor.grades_added"));
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const uploadFor = useMutation({
    mutationFn: async ({ gradeId, file }: { gradeId: string; file: File }) => {
      const problem = gradeFileProblem(file);
      if (problem === "hkid") throw new Error(t("settings.my_tutor.grades_hkid_error"));
      if (problem === "type") throw new Error(t("settings.my_tutor.grades_file_type"));
      if (problem === "size") throw new Error(t("settings.my_tutor.grades_file_too_large"));
      const content = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await uploadSlip({
        data: {
          gradeId,
          file: { filename: file.name, contentType: file.type, size: file.size, content },
        },
      });
    },
    onSuccess: async () => {
      toast.success(t("settings.my_tutor.grades_uploaded"));
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => setPendingGradeId(null),
  });

  const saveLabel = useMutation({
    mutationFn: async ({ gradeId, label }: { gradeId: string; label: string }) => {
      const result = (await renameGrade({ data: { gradeId, label } })) as { status: string };
      return result.status;
    },
    onSuccess: async (status) => {
      if (status === "pending") {
        toast.info(t("settings.my_tutor.grades_back_to_pending"));
      }
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteOne = useMutation({
    mutationFn: async (gradeId: string) => {
      await removeGrade({ data: { gradeId } });
    },
    onSuccess: async () => {
      toast.success(t("settings.my_tutor.grades_deleted"));
      await invalidate();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const dismissNotice = useMutation({
    mutationFn: async (noticeId: string) => {
      await markRead({ data: { noticeId } });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["tutor-notices", user?.id] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const grades = gradesQuery.data ?? [];
  const notices = noticesQuery.data ?? [];

  return (
    <div className="space-y-4 rounded-xl border border-[color:var(--ink)]/10 p-4" id="my-grades">
      <div>
        <Label className="text-[color:var(--ink)]">{t("settings.my_tutor.grades_heading")}</Label>
        <p className="mt-1 text-xs leading-5 text-[color:var(--ink)]/60">
          {t("settings.my_tutor.grades_hint")}
        </p>
      </div>

      {/* Issue #309: in-app staff review notices, deep-linking the grade row. */}
      {notices.map((notice) => (
        <div
          key={notice.id}
          className="flex items-start justify-between gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] px-3.5 py-3"
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <div className="min-w-0 text-xs leading-5 text-[color:var(--ink)]/80">
              <p className="font-semibold text-[color:var(--ink)]">
                {notice.kind === "grade_approved"
                  ? t("settings.my_tutor.notice_approved_title")
                  : t("settings.my_tutor.notice_rejected_title")}
              </p>
              <p>
                {notice.payload?.label
                  ? t("settings.my_tutor.notice_about", { label: notice.payload.label })
                  : null}
                {notice.kind === "grade_rejected" ? (
                  <>
                    {" "}
                    {t("settings.my_tutor.notice_rejected_reason", {
                      reason: notice.payload?.reason
                        ? t(`settings.my_tutor.reject_reason_${notice.payload.reason}`, {
                            defaultValue: notice.payload.reason,
                          })
                        : "",
                      note: notice.payload?.note || "",
                    })}
                  </>
                ) : null}{" "}
                {notice.payload?.grade_id ? (
                  <a
                    href={`#grade-${notice.payload.grade_id}`}
                    className="font-semibold text-[color:var(--brand-link)] underline underline-offset-2"
                  >
                    {t("settings.my_tutor.notice_open_grade")}
                  </a>
                ) : null}
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => dismissNotice.mutate(notice.id)}
          >
            {t("settings.my_tutor.notice_dismiss")}
          </Button>
        </div>
      ))}

      {gradesQuery.isLoading ? (
        <div className="h-16 animate-pulse rounded-lg bg-[color:var(--ink)]/5" aria-hidden />
      ) : grades.length === 0 ? (
        <p className="text-xs text-[color:var(--ink)]/60">{t("settings.my_tutor.grades_empty")}</p>
      ) : (
        <div className="space-y-3">
          {grades.map((grade) => (
            <div
              key={grade.id}
              id={`grade-${grade.id}`}
              className="scroll-mt-24 space-y-2 rounded-lg border border-[color:var(--ink)]/10 p-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  value={grade.label}
                  maxLength={GRADE_LABEL_MAX}
                  aria-label={t("settings.my_tutor.grades_row_label")}
                  className="h-9 max-w-xs flex-1 bg-[color:var(--surface)]"
                  onChange={(event) => {
                    const next = grades.map((row) =>
                      row.id === grade.id ? { ...row, label: event.target.value } : row,
                    );
                    queryClient.setQueryData<TutorGradeRow[]>(["tutor-grades", user?.id], next);
                  }}
                  onBlur={(event) => {
                    const label = event.target.value.trim();
                    if (label && label !== grade.label) {
                      const problem = labelErrorFor(label);
                      if (problem) {
                        toast.error(problem);
                        void invalidate();
                        return;
                      }
                      saveLabel.mutate({ gradeId: grade.id, label });
                    }
                  }}
                />
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-[11px] font-bold",
                    STATUS_BADGE_CLASS[grade.status],
                  )}
                >
                  {t(`settings.my_tutor.grade_status_${grade.status}`)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("settings.my_tutor.grades_delete")}
                  disabled={deleteOne.isPending}
                  onClick={() => deleteOne.mutate(grade.id)}
                >
                  {deleteOne.isPending && deleteOne.variables === grade.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  )}
                </Button>
              </div>
              {grade.status === "rejected" && grade.staff_reason ? (
                <p className="text-xs font-medium text-destructive">
                  {t("settings.my_tutor.grades_rejected_reason", { reason: grade.staff_reason })}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Label
                  htmlFor={`grade-slip-${grade.id}`}
                  className="cursor-pointer text-xs font-semibold text-[color:var(--brand-link)] underline-offset-2 hover:underline"
                >
                  {grade.file_path
                    ? t("settings.my_tutor.grades_replace_slip")
                    : t("settings.my_tutor.grades_upload_slip")}
                </Label>
                <input
                  id={`grade-slip-${grade.id}`}
                  type="file"
                  className="sr-only"
                  accept={GRADE_SLIP_ACCEPT_ATTRIBUTE}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = "";
                    if (file) {
                      setPendingGradeId(grade.id);
                      uploadFor.mutate({ gradeId: grade.id, file });
                    }
                  }}
                />
                {uploadFor.isPending && pendingGradeId === grade.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                ) : null}
                {uploadFor.isError && pendingGradeId === grade.id ? (
                  <span className="text-xs text-destructive">
                    {(uploadFor.error as Error).message}
                  </span>
                ) : null}
                <span className="text-[11px] text-muted-foreground">
                  {t("settings.my_tutor.grades_slip_hint", {
                    max: readableFileSize(MAX_GRADE_FILE_BYTES),
                  })}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 border-t border-[color:var(--ink)]/10 pt-3">
        <Label htmlFor="myt-grade-new" className="text-[color:var(--ink)]">
          {t("settings.my_tutor.grades_add_label")}
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            id="myt-grade-new"
            value={newLabel}
            maxLength={GRADE_LABEL_MAX}
            placeholder={t("settings.my_tutor.grades_add_placeholder")}
            className="h-9 max-w-xs flex-1 bg-[color:var(--surface)]"
            onChange={(event) => setNewLabel(event.target.value)}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={addGrade.isPending}
            onClick={() => addGrade.mutate(null)}
          >
            {addGrade.isPending ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Plus className="mr-1.5 h-4 w-4" aria-hidden="true" />
            )}
            {t("settings.my_tutor.grades_add")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={addGrade.isPending}
            onClick={() => {
              const file = gradeNewFileRef.current?.files?.[0];
              addGrade.mutate(file ?? null);
            }}
          >
            <Upload className="mr-1.5 h-4 w-4" aria-hidden="true" />
            {t("settings.my_tutor.grades_add_with_slip")}
          </Button>
          <input
            ref={gradeNewFileRef}
            id="myt-grade-new-file"
            type="file"
            className="sr-only"
            accept={GRADE_SLIP_ACCEPT_ATTRIBUTE}
            aria-label={t("settings.my_tutor.grades_add_with_slip")}
          />
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t("settings.my_tutor.grades_add_hint")}
        </p>
      </div>
    </div>
  );
}
