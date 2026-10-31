import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { dateFnsLocale } from "@/lib/relative-time";
import { Bell, CalendarClock, Check, Loader2, Sparkles, Star, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/features/i18n/config";

import { Button } from "@/components/ui/button";
import { DatePicker, dateToIso, isoToDate } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConsolePanel } from "@/components/ui/console-panel";
import { cn } from "@/lib/utils";
import {
  cancelLessonTutor,
  confirmLessonTutor,
  declineLessonTutor,
  getMyTutorCases,
  getTutorPlusState,
  registerTutorPlusInterest,
  submitTutorReview,
  type TutorCaseItem,
} from "@/features/cases/tutor.functions";
import { logTutorSession } from "@/features/cases/experience.functions";
import { EndCaseControl } from "@/features/cases/end-case-control";
import { AttendanceForm } from "@/features/academy/attendance-form";
import { ReviewStepHeader } from "@/features/cases/review-step-header";
import { caseHasVerifiedLesson } from "@/features/cases/case-reviews";
import { EngagementSummaryCard } from "@/features/cases/engagement-summary-card";
import { ShortCaseChip } from "@/features/cases/tutor/short-case-chip";
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
  // case_fees amounts are HKD numeric (not cents), render directly.
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
  const [step, setStep] = useState(1);

  const submit = useMutation({
    mutationFn: () => submitTutorReview({ data: { caseId, rating, comment } }),
    onSuccess: (res) => {
      toast.success(
        t(res.status === "held" ? "sor.parent_review_held" : "sor.parent_review_thanks"),
      );
      setRating(0);
      setComment("");
      setOpen(false);
      setStep(1);
      queryClient.invalidateQueries({ queryKey: ["sor", "tutor-cases"] });
    },
    // #503: map the server gate codes to plain copy (raw codes otherwise).
    onError: (e) => toast.error(t(`sor.err_${e.message}`, { defaultValue: e.message })),
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
  const stepLabels = [t("sor.review_step_rating"), t("sor.review_step_comment")];
  return (
    <div className="mt-2 rounded-[var(--radius-panel)] border border-border bg-card p-4">
      {/* #503: same carousel-like step flow as the parent's rating card. */}
      <ReviewStepHeader labels={stepLabels} step={step} onStepClick={(s) => setStep(s)} />
      {step === 1 ? (
        <div>
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((s) => (
              <button key={s} type="button" aria-label={`${s}/5`} onClick={() => setRating(s)}>
                <Star
                  className={cn(
                    "h-6 w-6",
                    s <= rating ? "fill-current text-amber-500" : "text-muted-foreground",
                  )}
                />
              </button>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button size="sm" disabled={rating < 1} onClick={() => setStep(2)}>
              {t("sor.review_step_next")}
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <textarea
            className="w-full rounded-md border border-[color:var(--ink)]/15 bg-transparent p-2 text-sm"
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
              <Button size="sm" variant="ghost" onClick={() => setStep(1)}>
                {t("sor.review_step_back")}
              </Button>
              <Button
                size="sm"
                disabled={!valid || submit.isPending}
                onClick={() => submit.mutate()}
              >
                {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {t("sor.parent_tutor_review_submit")}
              </Button>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function LessonRow({
  lesson,
  managed,
  t,
}: {
  lesson: TutorCaseItem["lessons"][number];
  managed: boolean;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const queryClient = useQueryClient();
  const [showAttendance, setShowAttendance] = useState(false);

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
  const busy = confirm.isPending || decline.isPending || cancel.isPending;
  const startLabel = format(new Date(lesson.starts_at), "EEE d MMM, HH:mm", {
    locale: dateFnsLocale(i18n.language),
  });

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

      {showAttendance && actions.done && (
        <AttendanceForm
          lessonId={lesson.id}
          managed={managed}
          onSaved={() => {
            setShowAttendance(false);
            invalidate();
          }}
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
              onClick={() => setShowAttendance((open) => !open)}
            >
              <Check className="h-4 w-4" />
              {t("academy.mark_attendance")}
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
 * #387, log a completed ongoing session (Date / Start / Duration in 0.5h
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
  const [tuitionUnpaid, setTuitionUnpaid] = useState(false);

  const timeMatch = /^(\d{1,2}):(\d{2})$/.exec(start);
  const startMinute = timeMatch ? Number(timeMatch[1]) * 60 + Number(timeMatch[2]) : -1;
  const guard: ExperienceGuardReason | null = validateSessionLogInput(
    { logDate, startMinute, durationMin },
    today,
  );

  const log = useMutation({
    mutationFn: () =>
      logTutorSession({
        data: { caseId: item.id, logDate, startMinute, durationMin, tuitionUnpaid },
      }),
    onSuccess: () => {
      toast.success(t("experience.log_success"));
      setOpen(false);
      setTuitionUnpaid(false);
      invalidate();
      void queryClient.invalidateQueries({ queryKey: ["sor", "earnings"] });
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
        <p className="text-xs font-medium text-muted-foreground">
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
              {format(new Date(`${l.log_date}T00:00:00Z`), "d MMM", {
                locale: dateFnsLocale(i18n.language),
              })}{" "}
              · {timeLabel(l.start_minute)}
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
                <DatePicker
                  label={t("experience.log_date")}
                  value={isoToDate(logDate)}
                  max={isoToDate(today)}
                  min={isoToDate(
                    new Date(Date.parse(`${today}T00:00:00Z`) - 7 * 86400000)
                      .toISOString()
                      .slice(0, 10),
                  )}
                  onChange={(date) => setLogDate(dateToIso(date))}
                />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                {t("experience.log_start")}
                <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
              </label>
              <label className="grid gap-1 text-xs text-muted-foreground">
                {t("experience.log_duration")}
                <Select
                  value={String(durationMin)}
                  onValueChange={(v) => setDurationMin(Number(v))}
                >
                  <SelectTrigger className="h-9 min-h-9 w-auto px-2.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LOG_DURATION_CHOICES_MIN.map((min) => (
                      <SelectItem key={min} value={String(min)}>
                        {minutesLabel(min)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            </div>
            {guard ? (
              <p className="mt-2 text-xs text-destructive">{t(`experience.err_${guard}`)}</p>
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{t("experience.log_hint")}</p>
            )}
            {/* #461 3b: tuition the family still owes the tutor (not the admin fee). */}
            <label className="mt-2 flex items-center gap-2 text-xs text-[color:var(--ink)]">
              <input
                type="checkbox"
                checked={tuitionUnpaid}
                onChange={(e) => setTuitionUnpaid(e.target.checked)}
              />
              {t("experience.log_tuition_unpaid")}
            </label>
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
  const queryClient = useQueryClient();
  const invalidateTutorCases = () =>
    queryClient.invalidateQueries({ queryKey: ["sor", "tutor-cases"] });
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
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      <ShortCaseChip
                        isShortCase={c.is_short_case}
                        scheduledLessonCount={c.scheduled_lesson_count}
                      />
                      <span>
                        {c.station ? `${t("sor.tutor_station")}: ${c.station} · ` : ""}
                        {t("sor.tutor_status_label")}: {t(`sor.status_${c.sor_status}`)}
                      </span>
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
                      <LessonRow key={l.id} lesson={l} managed={c.managed} t={t} />
                    ))}
                  </ul>
                )}
                {caseHasVerifiedLesson(c.lessons) &&
                  c.sor_status !== "closed" &&
                  c.sor_status !== "replaced" && <TutorReviewParentForm caseId={c.id} t={t} />}
                {/* #387: logged sessions + logging form (fee-paid cases). */}
                <SessionLogForm item={c} />
                {/* #503: bilateral End Case — the tutor marks the case
                    finished; it ends when both sides (or staff) confirm. */}
                <div className="mt-3">
                  <EndCaseControl
                    caseId={c.id}
                    sorStatus={c.sor_status}
                    endedByParentAt={c.ended_by_parent_at}
                    endedByTutorAt={c.ended_by_tutor_at}
                    actorRole="tutor"
                    onDone={invalidateTutorCases}
                  />
                </div>
                {/* Issue #412 F: engagement summary, the tutor confirms the
                    agreed arrangements before contact/lessons finalise. */}
                <EngagementSummaryCard caseId={c.id} party="tutor" />
              </li>
            ))}
          </ul>
        )}
      </ConsolePanel>
      <TutorPlusBanner t={t} />
    </div>
  );
}
