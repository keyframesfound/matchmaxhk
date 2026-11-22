import { DemandSidePanel } from "@/features/cases/demand-side/demand-side-panel";
import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarPlus, Check, Loader2, Star, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

import { EngagementSummaryCard } from "@/features/cases/engagement-summary-card";
import { MatchStatusCard } from "@/features/cases/parent/match-status-card";
import { TrialLockCard } from "@/features/cases/trial-lock-card";
import { MatchedTutorSafetyCard } from "@/features/cases/parent/matched-tutor-card";
import { ShareFirstVisitCard } from "@/features/safety/share-first-visit-card";
import { NextLessonLine } from "@/features/cases/case-manager/next-lesson-line";
import { firstLiveLesson } from "@/features/safety/safety-share";
import { useAuth } from "@/features/auth/useAuth";

import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PageContainer } from "@/components/layout/PageContainer";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  cancelLessonParent,
  confirmLessonParent,
  getParentCaseDetail,
  requestSlot,
  submitParentReview,
  type ParentCaseDetail,
} from "@/features/cases/parent.functions";
import { CaseContactLine } from "@/features/cases/case-contact-line";
import { ReportButton } from "@/features/reports/report-button";
import { disputeSession } from "@/features/cases/experience.functions";
import { disputeHoursLeft } from "@/features/tutors/experience";
import { ParentHoursSection } from "@/features/hours/parent-hours-section";
import { MistakeBookSection } from "@/features/cases/case-manager/mistake-book-tab";
import { UsefulnessPulseCard } from "@/features/cases/usefulness-pulse-card";
import { isTimeClashError } from "@/features/cases/schedule-lesson";
import i18n from "@/features/i18n/config";

// #461 addendum §1: the DB clash trigger's named errors get the locked
// blocking copy; everything else keeps the existing raw-message behaviour.
function sorActionError(message: string): string {
  if (isTimeClashError(message)) return i18n.t("sor.err_TIME_CLASH");
  return message;
}
import { parentCanReviewCase } from "@/features/cases/case-reviews";
import { completedLessonCount, evaluateRatingWindow } from "@/features/cases/rating-window";
import { DeskReportSheet, PrivateRatingLine, RatingSheet } from "@/features/cases/rating-sheet";
import { EndCaseControl } from "@/features/cases/end-case-control";

export const Route = createFileRoute("/_authenticated/account/cases/$caseId")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Case | MatchMax" }, { name: "robots", content: "noindex" }],
  }),
  component: ParentCaseDetailPage,
});

function ParentCaseDetailPage() {
  const { caseId } = Route.useParams();
  const { t } = useTranslation();
  const { user } = useAuth();
  const userId = user?.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["sor", "parent-case", caseId],
    queryFn: () => getParentCaseDetail({ data: { caseId } }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["sor", "parent-case", caseId] });
    queryClient.invalidateQueries({ queryKey: ["sor", "parent-cases"] });
  };

  // #794 §2.1: the 1-tap rating sheet opens the moment a lesson becomes
  // eligible (dual-confirm completing it), plus the private desk-report path.
  const [ratingOpen, setRatingOpen] = useState(false);
  const [deskReportOpen, setDeskReportOpen] = useState(false);

  const confirm = useMutation({
    mutationFn: (lessonId: string) => confirmLessonParent({ data: { lessonId } }),
    onSuccess: (_res, lessonId) => {
      toast.success(t("sor.tutor_confirmed"));
      invalidate();
      const lesson = data?.lessons.find((l) => l.id === lessonId);
      const becomesEligible =
        lesson != null &&
        (lesson.status === "done" ||
          (lesson.status === "confirmed" && lesson.confirmed_by_tutor_at !== null));
      if (becomesEligible) setRatingOpen(true);
    },
    onError: (e) => toast.error(sorActionError(e.message)),
  });
  const cancel = useMutation({
    mutationFn: (lessonId: string) => cancelLessonParent({ data: { lessonId } }),
    onSuccess: (res) => {
      toast.success(
        t(res.status === "late_cancel" ? "sor.tutor_late_cancelled" : "sor.tutor_cancelled"),
      );
      invalidate();
    },
    onError: (e) => toast.error(sorActionError(e.message)),
  });
  const request = useMutation({
    mutationFn: (startsAt: string) => requestSlot({ data: { caseId, startsAt } }),
    onSuccess: () => {
      toast.success(t("sor.parent_slot_requested"));
      invalidate();
    },
    onError: (e) => toast.error(sorActionError(e.message)),
  });

  if (isError) throw notFound();

  return (
    <div className="min-h-screen bg-[color:var(--background)]">
      <SiteHeader />
      <PageContainer>
        {isLoading || !data ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[color:var(--ink)]">
                {data.case_code} · {data.title}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {data.subjects?.[0] ?? ""}
                {data.exam_system ? ` · ${data.exam_system}` : ""}
                {data.tutor_code ? ` · ${t("sor.parent_tutor")} ${data.tutor_code}` : ""}
                {data.sor_status ? ` · ${t(`sor.status_${data.sor_status}`)}` : ""}
              </p>
            </div>

            {/* #466: parent match-status card (WhatsApp-first stage tracker) */}
            <MatchStatusCard
              status={data.status}
              matchedTutorId={data.matched_tutor_id}
              sorStatus={data.sor_status}
            />

            {/* #772 Part 1: one active trial per subject request. Shows the
                anti-shopping banner, the active trial status and the 3rd
                rematch ops notice; the mutex itself is enforced server-side. */}
            <TrialLockCard caseId={caseId} activeTutorLabel={data.tutor_code} />

            {/* #529 bait-and-switch card: who to expect at the first lesson. */}
            {data.matched_tutor ? <MatchedTutorSafetyCard tutor={data.matched_tutor} /> : null}
            {/* #782 §2.4: Report Safety / Illegal Activity from the case. */}
            {data.matched_tutor_id ? (
              <div className="flex justify-end">
                <ReportButton
                  targetType="tutor_card"
                  targetId={data.matched_tutor_id}
                  label={t("report.case_tutor_label")}
                />
              </div>
            ) : null}
            {/* #783 §2.5: the tutor's phone on this case, after the fee is paid. */}
            {data.tutor_contact ? (
              <CaseContactLine contact={data.tutor_contact} counterparty="tutor" />
            ) : null}

            {/* #650 Safety lite: share the first home-visit window with the
                trusted contact (soft auto-prompt once per case, manual share
                control otherwise; online/centre cases never auto-nag). */}
            {userId ? (
              <ShareFirstVisitCard
                userId={userId}
                caseId={caseId}
                caseMode={data.mode}
                caseDistrict={data.district}
                matchedTutor={data.matched_tutor}
                firstLesson={firstLiveLesson(data.lessons)}
                parentName={data.parentDisplayName ?? data.case_code}
                shareState={data.safetyShare}
              />
            ) : null}

            {/* Fee (amount + status only; no tutor contact) */}
            {data.fee && (
              <p className="inline-flex items-center gap-2 rounded-full bg-[color:var(--foreground)]/[0.06] px-3 py-1.5 text-sm text-muted-foreground">
                <span className="font-medium text-[color:var(--ink)]">
                  {t(`sor.fee_status_${data.fee.status}`)} · HK$
                  {Number(data.fee.amount_hkd).toFixed(0)}
                </span>
                <span className="text-xs">{t("sor.parent_fee_note")}</span>
              </p>
            )}

            {/* #636: Next Lesson + deep link into Case Manager. */}
            {data.canRequestSlot && (
              <NextLessonLine caseCode={data.case_code} lessons={data.lessons} />
            )}

            {/* #637: household briefing and student self-input. */}
            <DemandSidePanel caseId={caseId} />

            {/* #796 §2.2: Digital Mistake Book — the student/parent side of the
                Case Workspace. Self-upload works before class without the tutor;
                the section stays a soft "opens after Lesson 1" note until then. */}
            <MistakeBookSection caseId={caseId} />

            {/* Lesson timeline */}
            <section className="space-y-2">
              <h2 className="text-sm font-semibold text-muted-foreground">
                {t("sor.parent_lessons_title")}
              </h2>
              {data.lessons.length === 0 && (
                <p className="text-sm text-muted-foreground">{t("sor.parent_lessons_empty")}</p>
              )}
              {data.lessons.map((l) => (
                <div
                  key={l.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-[color:var(--ink)]/10 p-3"
                >
                  <span className="text-sm font-medium text-[color:var(--ink)]">
                    {t("sor.tutor_lesson_n", { n: l.sequence })} ·{" "}
                    {format(new Date(l.starts_at), "EEE d MMM HH:mm")}
                  </span>
                  <span className="rounded-full bg-[color:var(--foreground)]/[0.06] px-2 py-0.5 text-xs text-muted-foreground">
                    {t(`sor.tutor_lesson_status_${l.status}`)}
                  </span>
                  {l.location_or_link && l.status !== "cancelled" && l.status !== "late_cancel" && (
                    <span className="text-xs text-muted-foreground">{l.location_or_link}</span>
                  )}
                  {(l.status === "planned" || l.status === "confirmed") && (
                    <span className="ml-auto flex gap-2">
                      {l.confirmed_by_parent_at === null && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={confirm.isPending}
                          onClick={() => confirm.mutate(l.id)}
                        >
                          <Check className="h-4 w-4" />
                          {t("sor.parent_confirm")}
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={cancel.isPending}
                        onClick={() => {
                          // #461 addendum §2: bilateral cancel confirm — the
                          // counterparty is notified immediately on cancel.
                          if (window.confirm(t("sor.parent_cancel_confirm"))) {
                            cancel.mutate(l.id);
                          }
                        }}
                      >
                        <X className="h-4 w-4" />
                        {t("sor.tutor_cancel")}
                      </Button>
                    </span>
                  )}
                </div>
              ))}
            </section>

            {/* Slot request (#204), fee_paid|active cases only */}
            {data.canRequestSlot && (
              <section className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground">
                  {t("sor.parent_slots_title")}
                </h2>
                {data.slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("sor.parent_slots_empty")}</p>
                ) : (
                  data.slotDays.map((day) => (
                    <div key={day} className="flex flex-wrap items-center gap-2">
                      <span className="w-24 text-xs font-semibold text-muted-foreground">
                        {format(new Date(`${day}T00:00:00Z`), "EEE d MMM")}
                      </span>
                      {data.slots
                        .filter((s) => s.startsAt.startsWith(day))
                        .map((s) => (
                          <Button
                            key={s.startsAt}
                            size="sm"
                            variant="outline"
                            disabled={request.isPending}
                            onClick={() => request.mutate(s.startsAt)}
                          >
                            <CalendarPlus className="h-4 w-4" />
                            {format(new Date(s.startsAt), "HH:mm")}
                          </Button>
                        ))}
                    </div>
                  ))
                )}
              </section>
            )}

            {/* Issue #412 F: engagement summary, dual-party confirmation
                before contact details / lesson start are finalised. */}
            <EngagementSummaryCard caseId={caseId} party="customer" />

            {/* #503: bilateral End Case — the parent marks the case finished;
                it ends when both sides (or staff) have confirmed. */}
            <EndCaseControl
              caseId={caseId}
              sorStatus={data.sor_status}
              endedByParentAt={data.ended_by_parent_at}
              endedByTutorAt={data.ended_by_tutor_at}
              actorRole="parent"
              onDone={invalidate}
            />

            <ReviewSection
              detail={data}
              onRate={() => setRatingOpen(true)}
              onDeskReport={() => setDeskReportOpen(true)}
            />

            {/* #796 §2.4: the private lesson pulse, due only at verified
                lessons 5, 10, 15, … The server returns nothing for Ops, the
                tutor or a non-party, and the card hides itself once answered. */}
            <UsefulnessPulseCard caseId={caseId} tutorId={data.matched_tutor_id ?? undefined} />

            {/* #794 §2.1: one row per case per direction, edited in place. */}
            <RatingSheet
              open={ratingOpen}
              onOpenChange={setRatingOpen}
              caseId={caseId}
              direction="parent_to_tutor"
              counterpartyName={data.matched_tutor?.displayName ?? null}
              onSaved={invalidate}
            />
            <DeskReportSheet
              open={deskReportOpen}
              onOpenChange={setDeskReportOpen}
              caseId={caseId}
            />

            {/* #387: tutor-logged sessions, one-click dispute + 72h hint */}
            <SessionLogsSection logs={data.session_logs} onChanged={invalidate} />

            {/* #459: verified-hours review queue — confirm/dispute lessons
                the tutor marked done; unreviewed rows auto-verify in 24h. */}
            <ParentHoursSection rows={data.hoursLedger} onChanged={invalidate} />
          </div>
        )}
      </PageContainer>
      <SiteFooter />
    </div>
  );
}

/**
 * #387, tutor-logged sessions on the parent's case surface. A pending row
 * shows the 72h auto-verify countdown and a one-click "Dispute / Did not
 * happen"; a disputed row stays visible with 0 hours counted.
 */
function SessionLogsSection({
  logs,
  onChanged,
}: {
  logs: ParentCaseDetail["session_logs"];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const dispute = useMutation({
    mutationFn: (logId: string) =>
      disputeSession({ data: { logId, reason: reason.trim() || undefined } }),
    onSuccess: () => {
      toast.success(t("experience.parent_disputed_done"));
      setDisputingId(null);
      setReason("");
      onChanged();
    },
    onError: (e) => toast.error(t(`experience.err_${e.message}`, { defaultValue: e.message })),
  });

  if (logs.length === 0) return null;
  const now = new Date();

  const timeLabel = (min: number) =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">
        {t("experience.parent_title")}
      </h2>
      <ul className="space-y-2">
        {logs.map((l) => (
          <li key={l.id} className="rounded-lg border border-[color:var(--ink)]/10 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[color:var(--ink)]">
                {format(new Date(`${l.log_date}T00:00:00Z`), "EEE d MMM")} ·{" "}
                {timeLabel(l.start_minute)} ·{" "}
                {t("experience.duration_hours", { hours: l.duration_min / 60 })}
              </span>
              <span className="rounded-full bg-[color:var(--foreground)]/[0.06] px-2 py-0.5 text-xs text-muted-foreground">
                {t(`experience.log_status_${l.status}`)}
              </span>
              {l.status === "pending" && (
                <span className="ml-auto flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {t("experience.parent_pending_hint", {
                      hours: disputeHoursLeft(new Date(l.created_at), now),
                    })}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={dispute.isPending}
                    onClick={() => setDisputingId(disputingId === l.id ? null : l.id)}
                  >
                    <X className="h-4 w-4" />
                    {t("experience.parent_dispute")}
                  </Button>
                </span>
              )}
            </div>
            {l.status === "pending" && disputingId === l.id && (
              <div className="mt-2 space-y-2">
                <textarea
                  className="w-full rounded-md border border-[color:var(--ink)]/15 bg-transparent p-2 text-sm"
                  rows={2}
                  maxLength={500}
                  placeholder={t("experience.parent_dispute_reason")}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setDisputingId(null)}>
                    {t("sor.parent_review_cancel")}
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={dispute.isPending}
                    onClick={() => dispute.mutate(l.id)}
                  >
                    {dispute.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {t("experience.parent_dispute")}
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * #794 §2.1 ratings loop, parent side.
 *
 *  - no eligible completed lesson yet → no public review, private desk report
 *    only (reasons: no-show / rude or unsafe / never confirmed / other);
 *  - one eligible completed lesson → "Rate your tutor" opens the 1-tap sheet
 *    (stars → optional text → optional private desk note → Save);
 *  - a saved review shows in place with its window state; edits always hit the
 *    SAME row (14 days after each save, reopened by a new completed lesson,
 *    frozen 14 days after the case ends).
 *  - the tutor's rating of this family is private: shown here to the other
 *    party only, never on a public parent page.
 */
function ReviewSection({
  detail,
  onRate,
  onDeskReport,
}: {
  detail: ParentCaseDetail;
  onRate: () => void;
  onDeskReport: () => void;
}) {
  const { t } = useTranslation();
  const eligibleLessons = completedLessonCount(detail.lessons);
  const myReview = detail.myReview;
  const window = evaluateRatingWindow({
    now: new Date(),
    caseEndedAt: detail.case_ended_at,
    lastSavedAt: myReview?.updated_at ?? null,
    eligibleLessonsNow: eligibleLessons,
    eligibleLessonsAtSave: myReview?.completed_lessons_at_write ?? null,
  });

  if (!parentCanReviewCase(detail.lessons)) {
    return (
      <section id="review" className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t("sor.rate_no_lesson_title")}
        </h2>
        <p className="text-sm text-muted-foreground">{t("sor.rate_no_lesson_body")}</p>
        <Button size="sm" variant="outline" onClick={onDeskReport}>
          {t("sor.desk_report_cta")}
        </Button>
      </section>
    );
  }

  return (
    <section id="review" className="space-y-3">
      <h2 className="text-sm font-semibold text-muted-foreground">
        {t("sor.parent_review_title")}
      </h2>

      {myReview ? (
        <div className="space-y-2 rounded-[var(--radius-panel)] border border-border bg-card p-4">
          <PrivateRatingLine rating={myReview.rating} comment={myReview.comment} />
          <p className="text-xs text-muted-foreground">
            {myReview.status === "held"
              ? t("sor.rate_state_held")
              : myReview.held_reason?.startsWith("comment_held")
                ? t("sor.rate_state_text_held")
                : t("sor.rate_state_published")}
          </p>
          {window.canWrite ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" onClick={onRate}>
                {t("sor.parent_review_edit")}
              </Button>
              {window.freezeAt ? (
                <span className="text-xs text-muted-foreground">
                  {t("sor.rate_window_days_left", { days: window.daysLeft ?? 0 })}
                </span>
              ) : null}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("sor.rate_frozen_note")}</p>
          )}
          {myReview.rating <= 2 ? (
            <p className="text-xs text-muted-foreground">
              <Link
                to="/help"
                className="text-[color:var(--brand-link)] underline-offset-2 hover:underline"
              >
                {t("sor.rating_low_rematch")}
              </Link>
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-2 rounded-[var(--radius-panel)] border border-border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t("sor.rate_invite_body")}</p>
          <Button size="sm" onClick={onRate} disabled={!window.canWrite}>
            {t("sor.rate_cta")}
          </Button>
          {!window.canWrite ? (
            <p className="text-xs text-muted-foreground">{t("sor.rate_frozen_note")}</p>
          ) : null}
        </div>
      )}

      {detail.tutorReview ? (
        <div className="space-y-1 rounded-[var(--radius-panel)] border border-border p-4">
          <p className="text-xs font-semibold text-muted-foreground">
            {t("sor.rate_tutor_private_title")}
          </p>
          <PrivateRatingLine
            rating={detail.tutorReview.rating}
            comment={detail.tutorReview.comment}
          />
          <p className="text-xs text-muted-foreground">{t("sor.rate_tutor_private_hint")}</p>
        </div>
      ) : null}
    </section>
  );
}
