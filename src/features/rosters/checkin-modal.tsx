/**
 * #613 §4.2 Session Check-In modal: date + start time (HKT defaults),
 * per-student status pills, Mark All Present, optional 200-char session
 * topic, Save & Notify Parents. Idempotent: the client generates ONE
 * session key per modal session, so a double-tap Save lands once (the
 * server dedupes on (roster_id, session_key)).
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_STATUSES,
  MAX_SESSION_NOTE_LENGTH,
  formatHktDateTime,
  hktCheckInDefaults,
  type AttendanceStatus,
} from "@/features/rosters/roster-logic";
import { saveAttendance, type RosterDetail } from "@/features/rosters/rosters.functions";

const QUERY_KEY_ROOT = ["rosters"] as const;

function newSessionKey(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Legacy browsers: still a unique-enough opaque key.
  return `sk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** The pill order matches §4.2: Present 出席 / Late 遲到 / Leave 請假 / Absent 缺席. */
const PILL_CLASS: Record<AttendanceStatus, string> = {
  present: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700",
  late: "border-amber-500/40 bg-amber-500/10 text-amber-700",
  absent_excused: "border-sky-500/40 bg-sky-500/10 text-sky-700",
  absent_unexcused: "border-[#F4212E]/30 bg-[#F4212E]/10 text-destructive",
};

export function CheckInModal({
  open,
  onOpenChange,
  roster,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roster: RosterDetail;
  onSaved?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();
  // One key per modal session → double-tap Save creates ONE record.
  const sessionKeyRef = useRef<string>(newSessionKey());
  const defaults = useMemo(() => hktCheckInDefaults(new Date()), []);
  const [date, setDate] = useState(defaults.date);
  const [time, setTime] = useState(defaults.time);
  const [note, setNote] = useState("");
  const [marks, setMarks] = useState<Record<string, AttendanceStatus>>(() =>
    Object.fromEntries(roster.students.map((s) => [s.id, "present" as AttendanceStatus])),
  );

  const save = useMutation({
    mutationFn: () =>
      saveAttendance({
        data: {
          rosterId: roster.roster.id,
          sessionKey: sessionKeyRef.current,
          sessionDate: date,
          startTime: time,
          sessionNote: note.trim() || undefined,
          marks: roster.students.map((s) => ({
            studentId: s.id,
            status: marks[s.id] ?? "present",
          })),
        },
      }),
    onSuccess: (result) => {
      toast.success(
        result.duplicate
          ? t("rosters.saved_duplicate")
          : t("rosters.saved_at", {
              time: formatHktDateTime(new Date(), i18n.language),
            }),
      );
      void queryClient.invalidateQueries({ queryKey: QUERY_KEY_ROOT });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (error) => {
      const msg = error instanceof Error ? error.message : "";
      if (msg.includes("ATTENDANCE_STALE")) toast.error(t("rosters.error_stale"));
      else if (msg.includes("LOCKED")) toast.error(t("rosters.edit_tooltip"));
      else toast.error(t("rosters.error_generic"));
    },
  });

  const setAll = (status: AttendanceStatus) =>
    setMarks(Object.fromEntries(roster.students.map((s) => [s.id, status])));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          // A fresh key + clean form for the next session.
          sessionKeyRef.current = newSessionKey();
          setNote("");
          setMarks(
            Object.fromEntries(roster.students.map((s) => [s.id, "present" as AttendanceStatus])),
          );
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto rounded-2xl border-border bg-card sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[color:var(--ink)]">
            {t("rosters.take_attendance")}
          </DialogTitle>
          <DialogDescription>{roster.roster.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="roster-session-date">{t("rosters.session_date")}</Label>
              <Input
                id="roster-session-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="roster-session-time">{t("rosters.start_time")}</Label>
              <Input
                id="roster-session-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="h-11"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">{t("rosters.hkt_hint")}</p>

          <div className="space-y-2">
            {roster.students.map((student) => (
              <div
                key={student.id}
                className="rounded-xl border border-border bg-[color:var(--background)] p-3"
              >
                <p className="text-sm font-semibold text-[color:var(--ink)]">
                  {student.displayName}
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5" role="radiogroup">
                  {ATTENDANCE_STATUSES.map((status) => {
                    const active = (marks[student.id] ?? "present") === status;
                    return (
                      <button
                        key={status}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        onClick={() => setMarks((prev) => ({ ...prev, [student.id]: status }))}
                        className={cn(
                          "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors",
                          active
                            ? PILL_CLASS[status]
                            : "border-border text-muted-foreground hover:bg-[color:var(--foreground)]/[0.04]",
                        )}
                      >
                        {t(`rosters.status_${status}`)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="roster-session-note">{t("rosters.session_note")}</Label>
            <Input
              id="roster-session-note"
              value={note}
              maxLength={MAX_SESSION_NOTE_LENGTH}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("rosters.session_note_ph")}
              className="h-11"
            />
            <p className="text-right text-xs text-muted-foreground">
              {note.length}/{MAX_SESSION_NOTE_LENGTH}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="font-semibold"
              onClick={() => setAll("present")}
              disabled={save.isPending}
            >
              {t("rosters.mark_all_present")}
            </Button>
            <Button
              variant="solid"
              color="blue"
              className="font-bold"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              {save.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : null}
              {t("rosters.save_notify")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
