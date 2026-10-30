import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ATTENDANCE_STATUSES,
  NOTE_MIN_SENTENCES,
  countSentences,
  type Attendance,
} from "@/features/academy/attendance";
import { recordAttendance, type AttendanceResult } from "@/features/academy/attendance.functions";

/**
 * #533 attendance form, shared by the tutor hub and the admin desk.
 * Managed lessons show the 2-sentence note gate with a one-time skip;
 * pure-matching lessons keep the note optional (#530 Hybrid lock).
 */

const STATUS_KEY: Record<Attendance, string> = {
  present: "academy.attendance_present",
  late: "academy.attendance_late",
  left_early: "academy.attendance_left_early",
  absent_excused: "academy.attendance_absent_excused",
  absent_billable: "academy.attendance_absent_billable",
};

const ERROR_KEY: Record<string, string> = {
  NOTE_REQUIRED: "academy.error_note_required",
  NOTE_SKIP_USED: "academy.error_note_skip_used",
  INSUFFICIENT_CREDITS: "academy.error_insufficient_credits",
  DONE_WINDOW_CLOSED: "academy.error_window_closed",
  ALREADY_MARKED: "academy.error_already_marked",
};

export function AttendanceForm({
  lessonId,
  managed,
  admin = false,
  onSaved,
}: {
  lessonId: string;
  managed: boolean;
  admin?: boolean;
  onSaved: (result: AttendanceResult) => void;
}) {
  const { t } = useTranslation();
  const [attendance, setAttendance] = useState<Attendance>("present");
  const [note, setNote] = useState("");
  const [skipNote, setSkipNote] = useState(false);
  const [adminOverride, setAdminOverride] = useState(false);
  const noteShort = countSentences(note) < NOTE_MIN_SENTENCES;
  const blocked = managed && noteShort && !skipNote && !adminOverride;

  const save = useMutation({
    mutationFn: () =>
      recordAttendance({ data: { lessonId, attendance, note, skipNote, adminOverride } }),
    onSuccess: (result) => {
      toast.success(t("academy.saved"));
      onSaved(result);
    },
    onError: (e: Error) => {
      const code = Object.keys(ERROR_KEY).find((k) => e.message.includes(k));
      toast.error(code ? t(ERROR_KEY[code]) : e.message);
    },
  });

  return (
    <div className="mt-2 space-y-2 rounded-xl border border-[color:var(--ink)]/10 p-3">
      <div>
        <Label className="text-xs font-medium text-[color:var(--ink)]/70">
          {t("academy.attendance_label")}
        </Label>
        <select
          value={attendance}
          onChange={(e) => setAttendance(e.target.value as Attendance)}
          className="mt-1 h-9 w-full rounded-xl border border-input bg-transparent px-2 text-sm"
          aria-label={t("academy.attendance_label")}
        >
          {ATTENDANCE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(STATUS_KEY[s])}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label className="text-xs font-medium text-[color:var(--ink)]/70">
          {t(managed ? "academy.note_label_managed" : "academy.note_label")}
        </Label>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={1000}
          rows={3}
          className="mt-1"
          placeholder={t("academy.note_placeholder")}
          aria-label={t(managed ? "academy.note_label_managed" : "academy.note_label")}
        />
        {managed ? (
          <p className="mt-1 text-xs text-muted-foreground">{t("academy.note_hint_managed")}</p>
        ) : null}
      </div>
      {managed && noteShort ? (
        <label className="flex items-center gap-2 text-xs text-[color:var(--ink)]/80">
          <input
            type="checkbox"
            checked={skipNote}
            onChange={(e) => setSkipNote(e.target.checked)}
          />
          {t("academy.skip_note_once")}
        </label>
      ) : null}
      {admin && managed && noteShort ? (
        <label className="flex items-center gap-2 text-xs text-[color:var(--ink)]/80">
          <input
            type="checkbox"
            checked={adminOverride}
            onChange={(e) => setAdminOverride(e.target.checked)}
          />
          {t("academy.admin_override")}
        </label>
      ) : null}
      <Button
        size="sm"
        className="h-9 w-full font-semibold"
        disabled={blocked || save.isPending}
        onClick={() => save.mutate()}
      >
        {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
        {t("academy.save")}
      </Button>
    </div>
  );
}
