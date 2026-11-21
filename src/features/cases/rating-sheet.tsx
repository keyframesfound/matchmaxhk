/**
 * #794 §2.1 — the 1-tap rating sheet and the private desk report.
 *
 * Sheet anatomy (locked): stars 1–5 → optional short text → optional private
 * note to the desk → Save. Opened immediately after Mark done / Attendance
 * dual-confirm on an eligible lesson, and available from the case surfaces
 * while the 14-day window is open.
 *
 * Direction rules (child/family privacy):
 *  - parent→tutor: the text is the PUBLIC review (TutorCard / tutor profile).
 *  - tutor→parent: stars + text are visible to the other party and the desk
 *    only — never a public parent page, never Explore.
 *  - the private desk note never leaves the desk, on either direction.
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Lock, Star } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  REVIEW_COMMENT_MAX_PARENT,
  REVIEW_COMMENT_MAX_TUTOR,
  type ReviewDirection,
} from "@/features/cases/case-reviews";
import {
  DESK_REPORT_DETAIL_MAX,
  DESK_REPORT_REASONS,
  RATING_DESK_NOTE_MAX,
  type DeskReportReason,
} from "@/features/cases/rating-window";
import {
  getCaseRatingState,
  reportCaseToDesk,
  saveCaseRating,
} from "@/features/cases/rating.functions";
import { cn } from "@/lib/utils";

const ERROR_KEYS: Record<string, string> = {
  NO_ELIGIBLE_LESSON: "sor.rate_err_no_lesson",
  REVIEW_FROZEN: "sor.rate_err_frozen",
  CASE_NOT_FOUND: "sor.rate_err_case",
  NO_TUTOR: "sor.rate_err_case",
  BAD_REASON: "sor.rate_err_case",
};

function StarRow({
  value,
  onChange,
  size = "md",
}: {
  value: number;
  onChange?: (v: number) => void;
  size?: "md" | "sm";
}) {
  return (
    <div className="flex items-center gap-1" role="radiogroup">
      {[1, 2, 3, 4, 5].map((s) =>
        onChange ? (
          <button
            key={s}
            type="button"
            role="radio"
            aria-checked={value === s}
            aria-label={`${s}/5`}
            className="rounded-md p-0.5 focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]"
            onClick={() => onChange(s)}
          >
            <Star
              className={cn(
                size === "md" ? "h-8 w-8" : "h-3.5 w-3.5",
                s <= value ? "fill-current text-amber-500" : "text-muted-foreground",
              )}
            />
          </button>
        ) : (
          <Star
            key={s}
            className={cn(
              size === "md" ? "h-5 w-5" : "h-3.5 w-3.5",
              s <= value ? "fill-current text-amber-500" : "text-muted-foreground",
            )}
            aria-hidden="true"
          />
        ),
      )}
    </div>
  );
}

/**
 * The sheet. `direction` decides whose review this is; the server fns still
 * verify that the caller really is that party on this case.
 */
export function RatingSheet({
  open,
  onOpenChange,
  caseId,
  direction,
  counterpartyName,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  direction: ReviewDirection;
  counterpartyName?: string | null;
  onSaved?: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [deskNote, setDeskNote] = useState("");
  const [showDeskNote, setShowDeskNote] = useState(false);

  const state = useQuery({
    queryKey: ["case-rating", caseId, direction],
    queryFn: () => getCaseRatingState({ data: { caseId, direction } }),
    enabled: open,
  });

  // Seed from the existing row each time the sheet opens (edit-in-place).
  useEffect(() => {
    if (!open) return;
    const existing = state.data?.existing;
    setRating(existing?.rating ?? 0);
    setComment(existing?.comment ?? "");
    setDeskNote("");
    setShowDeskNote(false);
  }, [open, state.data]);

  const commentMax =
    direction === "parent_to_tutor" ? REVIEW_COMMENT_MAX_PARENT : REVIEW_COMMENT_MAX_TUTOR;

  const save = useMutation({
    mutationFn: () => saveCaseRating({ data: { caseId, direction, rating, comment, deskNote } }),
    onSuccess: (res) => {
      if (res.status === "held") {
        toast.success(t("sor.rate_saved_text_held"));
      } else {
        toast.success(t("sor.rate_saved"));
      }
      queryClient.invalidateQueries({ queryKey: ["case-rating", caseId, direction] });
      queryClient.invalidateQueries({ queryKey: ["sor", "parent-case", caseId] });
      queryClient.invalidateQueries({ queryKey: ["sor", "tutor-cases"] });
      onOpenChange(false);
      onSaved?.();
    },
    onError: (e: Error) => {
      const code = Object.keys(ERROR_KEYS).find((k) => e.message.includes(k));
      toast.error(code ? t(ERROR_KEYS[code]) : e.message);
    },
  });

  const window = state.data?.window;
  const closed = window ? !window.canWrite : false;
  const title =
    direction === "parent_to_tutor"
      ? t("sor.rate_title_tutor", { name: counterpartyName || t("sor.rate_tutor_generic") })
      : t("sor.rate_title_parent");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{t("sor.rate_subtitle")}</DialogDescription>
        </DialogHeader>

        {state.isLoading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("common.loading")}
          </div>
        ) : closed ? (
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">{t("sor.rate_err_frozen")}</p>
            {state.data?.existing ? (
              <div className="rounded-lg border border-border p-3">
                <StarRow value={state.data.existing.rating} size="sm" />
                {state.data.existing.comment ? (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {state.data.existing.comment}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <StarRow value={rating} onChange={setRating} />
              <p className="mt-2 text-xs text-muted-foreground">{t("sor.rate_helper")}</p>
            </div>

            <div>
              <Label className="text-xs font-medium text-[color:var(--ink)]/70">
                {direction === "parent_to_tutor"
                  ? t("sor.rate_text_label_public")
                  : t("sor.rate_text_label_private")}
              </Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, commentMax))}
                rows={3}
                className="mt-1"
                maxLength={commentMax}
                placeholder={t("sor.rate_text_placeholder")}
                aria-label={t("sor.rate_text_label_public")}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("sor.rate_text_optional", { max: commentMax })}
              </p>
            </div>

            {showDeskNote ? (
              <div>
                <Label className="flex items-center gap-1 text-xs font-medium text-[color:var(--ink)]/70">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  {t("sor.rate_desk_note_label")}
                </Label>
                <Textarea
                  value={deskNote}
                  onChange={(e) => setDeskNote(e.target.value.slice(0, RATING_DESK_NOTE_MAX))}
                  rows={2}
                  className="mt-1"
                  maxLength={RATING_DESK_NOTE_MAX}
                  placeholder={t("sor.rate_desk_note_placeholder")}
                  aria-label={t("sor.rate_desk_note_label")}
                />
                <p className="mt-1 text-xs text-muted-foreground">{t("sor.rate_desk_note_hint")}</p>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="px-0 text-xs"
                onClick={() => setShowDeskNote(true)}
              >
                <Lock className="mr-1 h-3 w-3" aria-hidden="true" />
                {t("sor.rate_desk_note_add")}
              </Button>
            )}

            <div className="flex items-center justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
                {t("sor.rate_cancel")}
              </Button>
              <Button
                size="sm"
                disabled={rating < 1 || save.isPending}
                onClick={() => save.mutate()}
              >
                {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                {t("sor.rate_save")}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">{t("sor.rate_edit_window_hint")}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * #794: before the first eligible completed lesson there is no public review —
 * this private report is the only way a participant can tell the desk what
 * happened (no-show / rude or unsafe / never confirmed / other).
 */
export function DeskReportSheet({
  open,
  onOpenChange,
  caseId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  onSaved?: () => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<DeskReportReason>("no_show");
  const [detail, setDetail] = useState("");

  const submit = useMutation({
    mutationFn: () => reportCaseToDesk({ data: { caseId, reason, detail } }),
    onSuccess: () => {
      toast.success(t("sor.desk_report_saved"));
      setDetail("");
      onOpenChange(false);
      onSaved?.();
    },
    onError: (e: Error) => toast.error(t(`sor.err_${e.message}`, { defaultValue: e.message })),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("sor.desk_report_title")}</DialogTitle>
          <DialogDescription>{t("sor.desk_report_subtitle")}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs font-medium text-[color:var(--ink)]/70">
              {t("sor.desk_report_reason_label")}
            </Label>
            <div className="space-y-1">
              {DESK_REPORT_REASONS.map((r) => (
                <label
                  key={r}
                  className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm"
                >
                  <input
                    type="radio"
                    name="desk-report-reason"
                    value={r}
                    checked={reason === r}
                    onChange={() => setReason(r)}
                  />
                  {t(`sor.desk_report_reason_${r}`)}
                </label>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs font-medium text-[color:var(--ink)]/70">
              {t("sor.desk_report_detail_label")}
            </Label>
            <Textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value.slice(0, DESK_REPORT_DETAIL_MAX))}
              rows={3}
              className="mt-1"
              maxLength={DESK_REPORT_DETAIL_MAX}
              placeholder={t("sor.desk_report_detail_placeholder")}
              aria-label={t("sor.desk_report_detail_label")}
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => onOpenChange(false)}>
              {t("sor.rate_cancel")}
            </Button>
            <Button size="sm" disabled={submit.isPending} onClick={() => submit.mutate()}>
              {submit.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
              {t("sor.desk_report_submit")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Read-only stars for a saved private (tutor→parent) rating. */
export function PrivateRatingLine({ rating, comment }: { rating: number; comment: string }) {
  return (
    <div className="space-y-1">
      <StarRow value={rating} size="sm" />
      {comment ? <p className="text-sm text-muted-foreground">{comment}</p> : null}
    </div>
  );
}
