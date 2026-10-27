import { Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { dateFnsLocale } from "@/lib/relative-time";
import { CalendarClock, Check, Loader2, Wallet, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/features/i18n/config";

import { Button } from "@/components/ui/button";
import { ConsolePanel } from "@/components/ui/console-panel";
import {
  confirmLessonTutor,
  declineLessonTutor,
  getMyTutorCases,
  type TutorCaseItem,
} from "@/features/cases/tutor.functions";
import {
  lessonPlaceLabel,
  pendingTutorConfirms,
  pickNextLesson,
  type HomeLesson,
} from "@/features/cases/tutor/tutor-home-model";
import { getMyNotesSummary } from "@/features/materials/orders.functions";
import { ShortCaseChip } from "@/features/cases/tutor/short-case-chip";

/**
 * Issue #202, Tutor home. One page that tells the assigned tutor what to do
 * today, built from the SAME `getMyTutorCases` payload the Lessons tab uses
 * (shared React Query key) plus a small notes summary. It is a read-only
 * synthesis: no parent or buyer contact is ever selected, and the admin fee
 * card is always labelled as the PARENT'S fee to MatchMax, never tutor
 * earnings, never added to the notes net.
 */

function toHomeLessons(cases: TutorCaseItem[]): HomeLesson[] {
  return cases.flatMap((c) =>
    c.lessons.map((l) => ({
      lessonId: l.id,
      caseId: c.id,
      caseCode: c.case_code,
      sequence: l.sequence,
      startsAt: l.starts_at,
      durationMin: l.duration_min,
      status: l.status,
      createdAt: l.created_at,
      confirmedByTutorAt: l.confirmed_by_tutor_at,
      locationOrLink: l.location_or_link,
      studentFirstName: c.student_first_name,
      subject: c.subject,
      examSystem: c.exam_system,
      station: c.station,
      lessonMode: c.lesson_mode,
      isShortCase: c.is_short_case,
      scheduledLessonCount: c.scheduled_lesson_count,
    })),
  );
}

/** case_fees/material_orders are HKD numeric (not cents), render directly. */
function fmtHkd(amount: number): string {
  const n = Number(amount);
  return Number.isInteger(n) ? n.toFixed(0) : n.toFixed(2);
}

function placeLabel(
  lesson: Pick<HomeLesson, "lessonMode" | "station">,
  t: ReturnType<typeof useTranslation>["t"],
): string {
  switch (lessonPlaceLabel(lesson)) {
    case "online":
      return t("sor.admin_mode_online");
    case "station":
      return `${t("sor.tutor_station")}: ${lesson.station}`;
    default:
      return t("sor.admin_mode_f2f");
  }
}

function PendingConfirmRow({
  lesson,
  t,
}: {
  lesson: HomeLesson;
  t: ReturnType<typeof useTranslation>["t"];
}) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["sor", "tutor-cases"] });

  const confirm = useMutation({
    mutationFn: () => confirmLessonTutor({ data: { lessonId: lesson.lessonId } }),
    onSuccess: () => {
      toast.success(t("sor.tutor_confirmed"));
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const decline = useMutation({
    mutationFn: () => declineLessonTutor({ data: { lessonId: lesson.lessonId } }),
    onSuccess: () => {
      toast.success(t("sor.tutor_declined"));
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const busy = confirm.isPending || decline.isPending;

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--ink)]/10 p-3">
      <div>
        <p className="text-sm font-medium text-[color:var(--ink)]">
          {format(new Date(lesson.startsAt), "EEE d MMM, HH:mm", {
            locale: dateFnsLocale(i18n.language),
          })}{" "}
          · {lesson.studentFirstName}
          {lesson.subject ? ` · ${lesson.subject}` : ""}
        </p>
        <p className="text-xs text-muted-foreground">
          {lesson.caseCode} · {placeLabel(lesson, t)}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={busy} onClick={() => confirm.mutate()}>
          {confirm.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Check className="h-4 w-4" />
          )}
          {t("sor.tutor_confirm")}
        </Button>
        <Button size="sm" variant="ghost" disabled={busy} onClick={() => decline.mutate()}>
          <X className="h-4 w-4" />
          {t("sor.tutor_decline")}
        </Button>
      </div>
    </li>
  );
}

function NotesBlock({ t }: { t: ReturnType<typeof useTranslation>["t"] }) {
  const { data } = useQuery({
    queryKey: ["materials", "notes-summary"],
    queryFn: getMyNotesSummary,
  });
  if (!data || (data.deliveredThisMonth === 0 && data.netOwedHkd === 0)) return null;
  return (
    <ConsolePanel title={t("sor.tutor_home_notes_title")}>
      <ul className="space-y-1 p-4 text-sm text-[color:var(--ink)]">
        <li>{t("sor.tutor_home_notes_month", { n: data.deliveredThisMonth })}</li>
        <li className="font-semibold">
          {t("sor.tutor_home_notes_net", { n: fmtHkd(data.netOwedHkd) })}
        </li>
      </ul>
      <p className="px-4 pb-2 text-xs text-muted-foreground">{t("sor.tutor_home_notes_note")}</p>
      <p className="px-4 pb-4">
        <Link
          to="/account"
          className="text-sm font-bold text-[color:var(--brand-link)] underline-offset-4 hover:underline"
        >
          {t("sor.tutor_home_notes_link")}
        </Link>
      </p>
    </ConsolePanel>
  );
}

export function TutorHomeSection() {
  const { t } = useTranslation();
  // Shared key with the Lessons tab (TutorCasesSection), warm cache, one fetch.
  const { data, isLoading } = useQuery({
    queryKey: ["sor", "tutor-cases"],
    queryFn: getMyTutorCases,
  });

  const cases = data ?? [];
  const now = new Date();
  const lessons = toHomeLessons(cases);
  const next = pickNextLesson(lessons, now);
  const pending = pendingTutorConfirms(lessons, now);
  const feeCases = cases.filter((c) => c.fee_status !== null);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <ConsolePanel title={t("sor.tutor_home_next_title")}>
          <p className="p-4 text-sm text-muted-foreground">{t("sor.loading")}</p>
        </ConsolePanel>
      </div>
    );
  }

  // Acceptance: a tutor with no cases sees the empty state (with a route to
  // the open case board). Notes summary still renders when it has numbers.
  if (cases.length === 0) {
    return (
      <div className="space-y-4">
        <ConsolePanel title={t("sor.tutor_home_empty_title")}>
          <div className="p-4">
            <p className="text-sm text-[color:var(--ink)]">{t("sor.tutor_home_empty_body")}</p>
            <p className="mt-3">
              <Link
                to="/tutor-requests"
                className="text-sm font-bold text-[color:var(--brand-link)] underline-offset-4 hover:underline"
              >
                {t("sor.tutor_home_empty_cta")}
              </Link>
            </p>
          </div>
        </ConsolePanel>
        <NotesBlock t={t} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ConsolePanel title={t("sor.tutor_home_next_title")}>
        {next === null ? (
          <p className="p-4 text-sm text-muted-foreground">{t("sor.tutor_home_next_none")}</p>
        ) : (
          <div className="p-4">
            <p className="flex items-center gap-2 text-base font-semibold text-[color:var(--ink)]">
              <CalendarClock className="h-4 w-4" aria-hidden="true" />
              {format(new Date(next.startsAt), "EEE d MMM, HH:mm", {
                locale: dateFnsLocale(i18n.language),
              })}
            </p>
            <p className="mt-1 text-sm text-[color:var(--ink)]">
              {next.studentFirstName}
              {next.subject ? ` · ${next.subject}` : ""}
              {next.examSystem ? ` (${next.examSystem})` : ""}
            </p>
            {next.isShortCase && next.scheduledLessonCount ? (
              <p className="mt-1">
                <ShortCaseChip
                  isShortCase={next.isShortCase}
                  scheduledLessonCount={next.scheduledLessonCount}
                />
              </p>
            ) : null}
            <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{placeLabel(next, t)}</span>
              <span>·</span>
              <span>
                {next.status === "planned" && next.confirmedByTutorAt === null
                  ? t("sor.tutor_home_awaiting")
                  : t(`sor.tutor_lesson_status_${next.status}`)}
              </span>
            </p>
            <p className="mt-3">
              <Link
                to="/dashboard"
                hash="lessons"
                className="text-sm font-bold text-[color:var(--brand-link)] underline-offset-4 hover:underline"
              >
                {t("sor.tutor_home_open_lessons")}
              </Link>
            </p>
          </div>
        )}
      </ConsolePanel>

      {pending.length > 0 && (
        <ConsolePanel title={t("sor.tutor_home_awaiting")}>
          <ul className="space-y-2 p-4">
            {pending.map((lesson) => (
              <PendingConfirmRow key={lesson.lessonId} lesson={lesson} t={t} />
            ))}
          </ul>
        </ConsolePanel>
      )}

      {feeCases.length > 0 && (
        <ConsolePanel title={t("sor.tutor_home_fees_title")}>
          <ul className="space-y-2 p-4">
            {feeCases.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex flex-wrap items-center gap-1.5 text-sm text-[color:var(--ink)]">
                  {c.case_code} · {c.student_first_name}
                  <ShortCaseChip
                    isShortCase={c.is_short_case}
                    scheduledLessonCount={c.scheduled_lesson_count}
                  />
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--foreground)]/[0.06] px-3 py-1 text-xs text-muted-foreground">
                  <Wallet className="h-3 w-3" aria-hidden="true" />
                  {t(`sor.fee_status_${c.fee_status}`)}
                  {c.fee_amount_hkd !== null ? ` · HK$${fmtHkd(c.fee_amount_hkd)}` : ""}
                </span>
              </li>
            ))}
          </ul>
          <p className="px-4 pb-4 text-xs text-muted-foreground">{t("sor.tutor_home_fee_note")}</p>
        </ConsolePanel>
      )}

      <NotesBlock t={t} />
    </div>
  );
}
