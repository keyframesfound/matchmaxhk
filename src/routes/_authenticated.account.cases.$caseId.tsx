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
import { disputeSession } from "@/features/cases/experience.functions";
import { disputeHoursLeft } from "@/features/tutors/experience";
import { ParentHoursSection } from "@/features/hours/parent-hours-section";
import { isTimeClashError } from "@/features/cases/schedule-lesson";
import i18n from "@/features/i18n/config";

// #461 addendum §1: the DB clash trigger's named errors get the locked
// blocking copy; everything else keeps the existing raw-message behaviour.
function sorActionError(message: string): string {
  if (isTimeClashError(message)) return i18n.t("sor.err_TIME_CLASH");
  return message;
}
import {
  feeHoldKind,
  PENDING_LESSON_HOLD_REASON,
  parentCanReviewCase,
  ratingPromptDue,
  RATING_PROMPT_LESSON_N,
  REVIEW_COMMENT_MAX_PARENT,
  REVIEW_COMMENT_MIN,
} from "@/features/cases/case-reviews";
import { EndCaseControl } from "@/features/cases/end-case-control";
import { ReviewStepHeader } from "@/features/cases/review-step-header";

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

  const confirm = useMutation({
    mutationFn: (lessonId: string) => confirmLessonParent({ data: { lessonId } }),
    onSuccess: () => {
      toast.success(t("sor.tutor_confirmed"));
      invalidate();
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

            {/* #529 bait-and-switch card: who to expect at the first lesson. */}
            {data.matched_tutor ? <MatchedTutorSafetyCard tutor={data.matched_tutor} /> : null}

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

            <ReviewSection caseId={caseId} detail={data} onChanged={invalidate} />

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

function ReviewSection({
  caseId,
  detail,
  onChanged,
}: {
  caseId: string;
  detail: ParentCaseDetail;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [editing, setEditing] = useState(false);
  const [step, setStep] = useState(1);
  // #503: ratings unlock after at least one BILATERALLY confirmed lesson —
  // not "tutor logged alone". Same gate the server fn enforces.
  const reviewUnlocked = parentCanReviewCase(detail.lessons);
  // #649 CEO LOCK N = 2: the post-lesson prompt (with the tutor's first name)
  // replaces the generic heading once lesson N is reached; the L1 soft draft
  // keeps the generic title.
  const promptDue = ratingPromptDue(detail.lessons);
  // #649 review: the prompt names the tutor only when a real first name
  // exists — no matched tutor / blank card name (rendered as "—") must not
  // produce "How was your lesson with ?" or "with —?".
  const tutorFirstName =
    detail.matched_tutor?.displayName.trim().split(/\s+/)[0] || detail.tutor_code || "";
  const heading =
    promptDue && tutorFirstName && tutorFirstName !== "—"
      ? t("sor.rating_prompt_title", { tutorFirstName })
      : t("sor.parent_review_title");
  const caseEnded = detail.sor_status === "closed";
  const myReview = detail.myReview;
  const hasVisibleOrHeld =
    myReview !== null && (myReview.status === "visible" || myReview.status === "held");
  // #386: a review held ONLY for the fee settlement publishes automatically
  // once the case admin fee settles; a contact-hold does not. A COMBINED
  // reason (fee + contact filter) explains both halves in its own copy.
  // #649: a PURE lesson-threshold hold (fee settled, lesson N not reached)
  // waits for the second lesson instead.
  const holdKind = feeHoldKind(myReview?.held_reason);
  const lessonHold = myReview?.held_reason === PENDING_LESSON_HOLD_REASON;
  // #649: a COMBINED lesson-threshold hold (L2 wait + contact filter) needs
  // its own copy branch, mirroring the fee+contact combination.
  const lessonHoldCombined =
    myReview?.held_reason?.startsWith(`${PENDING_LESSON_HOLD_REASON} + `) ?? false;

  const submit = useMutation({
    mutationFn: () => submitParentReview({ data: { caseId, rating, comment } }),
    onSuccess: (res) => {
      if (res.status === "visible") {
        toast.success(t("sor.parent_review_thanks"));
      } else if (res.heldReason === PENDING_LESSON_HOLD_REASON) {
        // #649: fee settled but lesson N not reached — draft waits for L2.
        toast.success(t("sor.rating_pending_lesson_state", { n: RATING_PROMPT_LESSON_N }));
      } else if (res.heldReason?.startsWith(`${PENDING_LESSON_HOLD_REASON} + `)) {
        // #649: L2 wait + contact filter, both halves explained.
        toast.success(t("sor.parent_review_lesson_hold_combined", { n: RATING_PROMPT_LESSON_N }));
      } else if (feeHoldKind(res.heldReason) === "pure") {
        // #649 confirmation copy for the fee-settlement hold.
        toast.success(t("sor.rating_publish_pending_fee"));
      } else if (feeHoldKind(res.heldReason) === "combined") {
        // #386: fee hold + contact filter, both halves must be explained.
        toast.success(t("sor.parent_review_fee_hold_combined"));
      } else {
        toast.success(t("sor.parent_review_held"));
      }
      setRating(0);
      setComment("");
      setEditing(false);
      setStep(1);
      onChanged();
    },
    onError: (e) => toast.error(t(`sor.err_${e.message}`, { defaultValue: e.message })),
  });

  const canSubmit =
    rating >= 1 &&
    comment.trim().length >= REVIEW_COMMENT_MIN &&
    comment.trim().length <= REVIEW_COMMENT_MAX_PARENT;

  // #503 acceptance: no rating UI until the bilateral-lesson gate opens — and
  // once the case ENDED the rating is final (a written review stays readable
  // as a frozen snapshot; no new or edited review gets in).
  if (!reviewUnlocked || (caseEnded && !hasVisibleOrHeld)) {
    return null;
  }

  // Ended with a written review: frozen final rating, no edit path.
  if (caseEnded) {
    return (
      <section id="review" className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">
          {t("sor.parent_review_title")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("sor.parent_review_submitted_state", { rating: myReview?.rating ?? 0 })}{" "}
          {t("sor.review_final_note")}
        </p>
      </section>
    );
  }

  if (myReview && hasVisibleOrHeld && !editing) {
    return (
      <section id="review" className="space-y-2">
        <h2 className="text-sm font-semibold text-muted-foreground">{heading}</h2>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {myReview.status === "held"
              ? holdKind === "pure" && detail.review_fee_settled
                ? // #649: fee already settled — the review is actually waiting
                  // for Lesson 2 (the lazy publish never rewrites the reason).
                  t("sor.rating_pending_lesson_state", { n: RATING_PROMPT_LESSON_N })
                : holdKind === "pure"
                  ? t("sor.parent_review_fee_pending_state")
                  : holdKind === "combined" && detail.review_fee_settled
                    ? // Fee half already settled — only the contact check blocks.
                      t("sor.parent_review_pending_state")
                    : holdKind === "combined"
                      ? t("sor.parent_review_fee_pending_combined_state")
                      : lessonHoldCombined
                        ? t("sor.parent_review_lesson_pending_combined_state", {
                            n: RATING_PROMPT_LESSON_N,
                          })
                        : lessonHold
                          ? t("sor.rating_pending_lesson_state", { n: RATING_PROMPT_LESSON_N })
                          : t("sor.parent_review_pending_state")
              : t("sor.parent_review_submitted_state", { rating: myReview.rating })}
          </p>
          {/* #649: after a low rating, the soft desk rematch/replace line
              (Cap.57-safe — a matching promise, never an automatic refund). */}
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
          {/* #386: edits update the single case review (never a second one).
              #503: editable any time while the case is still active. */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setRating(myReview.rating);
              setComment(myReview.comment);
              setEditing(true);
              setStep(1);
            }}
          >
            {t("sor.parent_review_edit")}
          </Button>
        </div>
      </section>
    );
  }

  // Carousel-like step flow (same anatomy as the live case-request stepper):
  // one step per card, Rating first, then the comment.
  const stepLabels = [t("sor.review_step_rating"), t("sor.review_step_comment")];

  return (
    <section id="review" className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{heading}</h2>
      <div className="rounded-[var(--radius-panel)] border border-border bg-card p-5">
        <ReviewStepHeader labels={stepLabels} step={step} onStepClick={(s) => setStep(s)} />

        {step === 1 ? (
          <div>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <button key={s} type="button" aria-label={`${s}/5`} onClick={() => setRating(s)}>
                  <Star
                    className={cn(
                      "h-7 w-7",
                      s <= rating ? "fill-current text-amber-500" : "text-muted-foreground",
                    )}
                  />
                </button>
              ))}
            </div>
            {/* #649 helper: one rating per case, editable while lessons run. */}
            <p className="mt-3 text-xs text-muted-foreground">{t("sor.rating_prompt_helper")}</p>
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
              rows={4}
              maxLength={REVIEW_COMMENT_MAX_PARENT}
              placeholder={t("sor.parent_review_placeholder", {
                min: REVIEW_COMMENT_MIN,
                max: REVIEW_COMMENT_MAX_PARENT,
              })}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                {comment.trim().length}/{REVIEW_COMMENT_MAX_PARENT} ·{" "}
                {t("sor.parent_review_hold_note")}
              </span>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setStep(1)}>
                  {t("sor.review_step_back")}
                </Button>
                <Button
                  size="sm"
                  disabled={!canSubmit || submit.isPending}
                  onClick={() => submit.mutate()}
                >
                  {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {t("sor.parent_review_submit")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
