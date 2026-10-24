import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Bell, CalendarClock, Check, Loader2, Sparkles, Star, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConsolePanel } from "@/components/ui/console-panel";
import { cn } from "@/lib/utils";
import {
  cancelLessonTutor,
  confirmLessonTutor,
  declineLessonTutor,
  getMyTutorCases,
  getTutorPlusState,
  markLessonDoneTutor,
  registerTutorPlusInterest,
  submitTutorReview,
  type TutorCaseItem,
} from "@/features/cases/tutor.functions";
import { logTutorSession } from "@/features/cases/experience.functions";
import { lessonActionsFor } from "@/features/cases/tutor/week-model";
import { REVIEW_COMMENT_MAX_TUTOR, REVIEW_COMMENT_MIN } from "@/features/cases/case-reviews";
import { canMarkDone, hktDateKey } from "@/features/cases/sor";
import {
  formatExperienceHours,
  validateSessionLogInput,
  type ExperienceGuardReason,
} from "@/features/tutors/experience";
import { formatMoneyFromCents } from "@/lib/money";

/** #387: 0.5h–4.0h in 0.5h steps. */
const LOG_DURATION_CHOICES_MIN = [30, 60, 90, 120, 150, 180, 210, 240];

function feePillHkd(amount: number | null): string {
  if (amount === null) return "";
  // case_fees amounts are HKD numeric (not cents) — render directly.
  return `HK$${Number(amount).toFixed(0)}`;
}

function TutorReviewParentForm({
  caseId,
  t,
}: {
  caseId: string;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const submit = useMutation({
    mutationFn: () => submitTutorReview({ data: { caseId, rating, comment } }),
    onSuccess: (res) => {
      toast.success(
        t(res.status === "held" ? "sor.parent_review_held" : "sor.parent_review_thanks"),
      );
      setRating(0);
      setComment("");
      setOpen(false);
      queryClient.invalidateQueries({ queryKey: ["sor", "tutor-cases"] });
    },
    onError: (e) => toast.error(e.message),
  });

  const valid =
    rating >= 1 &&
    comment.trim().length >= REVIEW_COMMENT_MIN &&
    comment.trim().length <= REVIEW_COMMENT_MAX_TUTOR;

  if (!open) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)}>
        <Star className="h-4 w-4" />
        {t("sor.parent_tutor_reviews_title")}
      </Button>
    );
  }
  return (
    <div className="mt-2 rounded-lg border border-[color:var(--ink)]/10 p-3">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((s) => (
          <button key={s} type="button" aria-label={`${s}/5`} onClick={() => setRating(s)}>
            <Star
              className={cn(
                "h-5 w-5",
                s <= rating ? "fill-current text-amber-500" : "text-muted-foreground/40",
              )}
            />
          </button>
        ))}
      </div>
      <textarea
        className="mt-2 w-full rounded-md border border-[color:var(--ink)]/15 bg-transparent p-2 text-sm"
        rows={3}
        maxLength={REVIEW_COMMENT_MAX_TUTOR}
        placeholder={t("sor.parent_tutor_review_placeholder")}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {comment.trim().length}/{REVIEW_COMMENT_MAX_TUTOR}
        </span>
        <span className="flex gap-2">
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
            {t("sor.admin_cancel")}
          </Button>
          <Button size="sm" disabled={!valid || submit.isPending} onClick={() => submit.mutate()}>
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("sor.parent_tutor_review_submit")}
          </Button>
        </span>
      </div>
    </div>
  );
}

function LessonRow({
  lesson,
  t,
}: {
  lesson: TutorCaseItem["lessons"][number];
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["sor", "tutor-cases"] });

  const confirm = useMutation({
    mutationFn: () => confirmLessonTutor({ data: { lessonId: lesson.id } }),
    onSuccess: () => {
      toast.success(t("sor.tutor_confirmed"));
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const decline = useMutation({
    mutationFn: () => declineLessonTutor({ data: { lessonId: lesson.id } }),
    onSuccess: () => {
      toast.success(t("sor.tutor_declined"));
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const done = useMutation({
    mutationFn: () =>
      markLessonDoneTutor({ data: { lessonId: lesson.id, privateNote: note || undefined } }),
    onSuccess: () => {
      toast.success(t("sor.tutor_marked_done"));
      setShowNote(false);
      setNote("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: () => cancelLessonTutor({ data: { lessonId: lesson.id } }),
    onSuccess: (res) => {
      toast.success(
        t(res.status === "late_cancel" ? "sor.tutor_late_cancelled" : "sor.tutor_cancelled"),
      );
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const actions = lessonActionsFor(lesson, new Date(), canMarkDone);
  const busy = confirm.isPending || decline.isPending || done.isPending || cancel.isPending;
  const startLabel = format(new Date(lesson.starts_at), "EEE d MMM, HH:mm");

  return (
    <li className="rounded-lg border border-[color:var(--ink)]/10 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-[color:var(--ink)]">
          {t("sor.tutor_lesson_n", { n: lesson.sequence })} · {startLabel}
        </span>
        <span className="rounded-full bg-[color:var(--foreground)]/[0.06] px-2 py-0.5 text-xs text-muted-foreground">
          {t(`sor.tutor_lesson_status_${lesson.status}`)}
        </span>
        {(lesson.confirmed_by_parent_at !== null || lesson.confirmed_by_tutor_at !== null) && (
          <span className="text-xs text-muted-foreground">
            {lesson.confirmed_by_parent_at !== null ? t("sor.tutor_parent_confirmed") : null}
            {lesson.confirmed_by_parent_at !== null && lesson.confirmed_by_tutor_at !== null
              ? " · "
              : null}
            {lesson.confirmed_by_tutor_at !== null ? t("sor.tutor_you_confirmed") : null}
          </span>
        )}
      </div>

      {showNote && (
        <Input
          className="mt-2"
          maxLength={500}
          placeholder={t("sor.tutor_private_note_placeholder")}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      )}

      {(actions.confirm || actions.decline || actions.done || actions.cancel) && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {actions.confirm && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => confirm.mutate()}>
              {confirm.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {t("sor.tutor_confirm")}
            </Button>
          )}
          {actions.decline && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => decline.mutate()}>
              <X className="h-4 w-4" />
              {t("sor.tutor_decline")}
            </Button>
          )}
          {actions.done && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => {
                if (!showNote) {
                  // First click reveals the private-note field; the note is
                  // optional — the second click submits with whatever is there.
                  setShowNote(true);
                  return;
                }
                done.mutate();
              }}
            >
              <Check className="h-4 w-4" />
              {t("sor.tutor_mark_done")}
            </Button>
          )}
          {actions.cancel && (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => cancel.mutate()}>
              {t("sor.tutor_cancel")}
            </Button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * #387 — log a completed ongoing session (Date / Start / Duration in 0.5h
 * steps). Guardrails validated inline client-side AND server-side; pending
 * rows auto-verify 72h after logging unless the parent disputes.
 */
function SessionLogForm({ item }: { item: TutorCaseItem }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["sor", "tutor-cases"] });

  const today = hktDateKey(new Date());
  const [open, setOpen] = useState(false);
  const [logDate, setLogDate] = useState(today);
  const [start, setStart] = useState("18:00");
  const [durationMin, setDurationMin] = useState(60);

  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(start);
  const startMinute = timeMatch ? Number(timeMatch[1]) * 60 + Number(timeMatch[2]) : -1;
  const guard: ExperienceGuardReason | null = validateSessionLogInput(
    { logDate, startMinute, durationMin },
    today,
  );

  const log = useMutation({
    mutationFn: () =>
      logTutorSession({ data: { caseId: item.id, logDate, startMinute, durationMin } }),
    onSuccess: () => {
      toast.success(t("experience.log_success"));
      setOpen(false);
      invalidate();
    },
    onError: (e) => toast.error(t(`experience.err_${e.message}`, { defaultValue: e.message })),
  });

  const minutesLabel = (min: number) =>
    t("experience.duration_hours", { hours: formatExperienceHours(min / 60) });
  const timeLabel = (min: number) =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

  if (!item.can_log_session && item.session_logs.length === 0) return null;

  return (
    <div className="mt-3 border-t border-[color:var(--ink)]/10 pt-3">
      {item.session_logs.length > 0 && (
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("experience.log_sessions_title")}
        </p>
      )}
      <ul className="mt-1 space-y-1">
        {item.session_logs.map((l) => (
          <li
            key={l.id}
            className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
          >
            <span className="font-medium text-[color:var(--ink)]">
              {format(new Date(`${l.log_date}T00:00:00Z`), "d MMM")} · {timeLabel(l.start_minute)}
            </span>
            <span>{minutesLabel(l.duration_min)}</span>
            <span className="rounded-full bg-[color:var(--foreground)]/[0.06] px-2 py-0.5">
              {t(`experience.log_status_${l.status}`)}
            </span>
          </li>
        ))}
      </ul>

      {item.can_log_session &&
        (open ? (
          <div className="mt-2 rounded-lg border border-[color:var(--ink)]/10 p-3">
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="grid gap-1 text-xs text-muted-foreground">
                {t("experience.log_date")}
                <Input
                  type="date"
                  max={today}
                  min={`${new Date(Date.parse(`${today}T00:00:00Z`) - 7 * 86400000)
                    .toISOString()
                    .slice(0, 10)}`}
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                {t("experience.log_start")}
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                {t("experience.log_duration")}
                <select
                  className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
                  value={durationMin}
                  onChange={(e) => setDurationMin(Number(e.target.value))}
                >
                  {LOG_DURATION_CHOICES_MIN.map((min) => (
                    <option key={min} value={min}>
                      {minutesLabel(min)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {guard ? (
              <p className="mt-2 text-xs text-destructive">{t(`experience.err_${guard}`)}</p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{t("experience.log_hint")}</p>
            )}
            <div className="mt-2 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                {t("sor.admin_cancel")}
              </Button>
              <Button
                size="sm"
                disabled={Boolean(guard) || log.isPending}
                onClick={() => log.mutate()}
              >
                {log.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("experience.log_submit")}
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" className="mt-2" onClick={() => setOpen(true)}>
            <CalendarClock className="h-4 w-4" />
            {t("experience.log_open")}
          </Button>
        ))}
    </div>
  );
}

function TutorPlusBanner({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  const queryClient = useQueryClient();
  const { data } = useQuery({
    queryKey: ["sor", "tutor-plus"],
    queryFn: getTutorPlusState,
  });
  const interest = useMutation({
    mutationFn: () => registerTutorPlusInterest(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sor", "tutor-plus"] }),
    onError: (e) => toast.error(e.message),
  });

  if (!data?.showBanner) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-[color:var(--ink)]/10 p-4">
      <Sparkles className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      <p className="flex-1 text-sm text-[color:var(--ink)]">
        {t("sor.tutor_plus_banner", { count: data.activeStudents })}
      </p>
      <Button
        size="sm"
        variant="outline"
        disabled={interest.isPending}
        onClick={() => interest.mutate()}
      >
        {interest.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Bell className="h-4 w-4" />
        )}
        {t("sor.tutor_plus_interested")}
      </Button>
    </div>
  );
}

/** #201 tutor list + lesson actions + #204 Tutor Plus banner. No parent phone, no WhatsApp. */
export function TutorCasesSection() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery({
    queryKey: ["sor", "tutor-cases"],
    queryFn: getMyTutorCases,
  });

  return (
    <div className="space-y-4">
      <ConsolePanel title={t("sor.tutor_cases_title")}>
        {isLoading ? (
          <p className="p-4 text-sm text-muted-foreground">{t("sor.loading")}</p>
        ) : (data?.length ?? 0) === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{t("sor.tutor_cases_empty")}</p>
        ) : (
          <ul className="space-y-4">
            {data?.map((c) => (
              <li key={c.id} className="rounded-xl border border-[color:var(--ink)]/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-[color:var(--ink)]">
                      {c.case_code} · {c.student_first_name}
                      {c.subject ? ` · ${c.subject}` : ""}
                      {c.exam_system ? ` (${c.exam_system})` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {c.station ? `${t("sor.tutor_station")}: ${c.station} · ` : ""}
                      {t("sor.tutor_status_label")}: {t(`sor.status_${c.sor_status}`)}
                    </p>
                  </div>
                  {c.fee_status && (
                    <span className="rounded-full bg-[color:var(--foreground)]/[0.06] px-3 py-1 text-xs text-muted-foreground">
                      {t(`sor.fee_status_${c.fee_status}`)}
                      {c.fee_amount_hkd !== null ? ` · ${feePillHkd(c.fee_amount_hkd)}` : ""}
                    </span>
                  )}
                </div>
                {c.lessons.length > 0 && (
                  <ul className="mt-3 space-y-2">
                    {c.lessons.map((l) => (
                      <LessonRow key={l.id} lesson={l} t={t} />
                    ))}
                  </ul>
                )}
                {c.lessons.some((l) => l.status === "done") &&
                  c.sor_status !== "closed" &&
                  c.sor_status !== "replaced" && <TutorReviewParentForm caseId={c.id} t={t} />}
                {/* #387: logged sessions + logging form (fee-paid cases). */}
                <SessionLogForm item={c} />
              </li>
            ))}
          </ul>
        )}
      </ConsolePanel>
      <TutorPlusBanner t={t} />
    </div>
  );
}
