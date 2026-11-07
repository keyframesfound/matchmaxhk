import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { hktClock, hktDayLabel } from "@/features/cases/case-schedule";
import {
  HOMEWORK_NOTE_MAX,
  HOMEWORK_REVIEW_MAX,
  HOMEWORK_TEXT_MAX,
  HOMEWORK_TITLE_MAX,
  homeworkStatus,
  isAllowedHomeworkLink,
  splitHomework,
  summarizeHomework,
  type HomeworkStatus,
  type HomeworkSummary,
} from "@/features/cases/homework";
import {
  assignHomework,
  getCaseHomework,
  reviewHomework,
  submitHomework,
  type HomeworkEntry,
} from "@/features/cases/homework.functions";
import { hktDateKey, hktFromParts } from "@/features/cases/sor";
import { cn } from "@/lib/utils";

import { clockToMinute } from "./schedule-form";

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DUE_DAYS = 7;
const DEFAULT_DUE_TIME = "18:00";
const SAMPLE_COUNT = 2;

const STATUS_CLASS: Record<HomeworkStatus, string> = {
  assigned: "border-border",
  submitted_on_time: "border-border bg-[color:var(--surface-subtle)]",
  submitted_late: "border-border bg-[color:var(--surface-subtle)]",
  overdue: "border-destructive text-destructive",
  reviewed: "border-border text-muted-foreground",
};

function useErrorToast() {
  const { t } = useTranslation();
  return (e: Error) =>
    toast.error(t(`homework.err_${e.message}`, { defaultValue: t("homework.err_generic") }));
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold">{value}</p>
    </div>
  );
}

function SummaryRow({ summary }: { summary: HomeworkSummary | null }) {
  const { t } = useTranslation();
  const rate = summary?.completionRate;
  return (
    <div className="grid grid-cols-3 gap-2">
      <Metric
        label={t("homework.metric_completion")}
        value={rate === null || rate === undefined ? "--%" : `${rate}%`}
      />
      <Metric
        label={t("homework.metric_on_time")}
        value={summary ? t("homework.on_time_value", summary) : "--"}
      />
      <Metric
        label={t("homework.metric_overdue")}
        value={summary ? String(summary.overdue) : "--"}
      />
    </div>
  );
}

function AssignDialog({
  caseId,
  onOpenChange,
  onDone,
}: {
  caseId: string;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const onError = useErrorToast();
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(() =>
    hktDateKey(new Date(Date.now() + DEFAULT_DUE_DAYS * DAY_MS)),
  );
  const [time, setTime] = useState(DEFAULT_DUE_TIME);
  const [instructions, setInstructions] = useState("");
  const [link, setLink] = useState("");

  const save = useMutation({
    mutationFn: () => {
      const minute = clockToMinute(time);
      if (minute === null || !date) throw new Error("BAD_DUE");
      const resourceUrl = link.trim();
      if (resourceUrl && !isAllowedHomeworkLink(resourceUrl)) throw new Error("BAD_LINK");
      return assignHomework({
        data: {
          caseId,
          title: title.trim(),
          dueAtIso: hktFromParts(date, minute).toISOString(),
          instructions: instructions.trim() || undefined,
          resourceUrl: resourceUrl || undefined,
        },
      });
    },
    onSuccess: () => {
      onOpenChange(false);
      onDone();
    },
    onError,
  });

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("homework.assign_title")}</DialogTitle>
          <DialogDescription>{t("homework.optional_note")}</DialogDescription>
        </DialogHeader>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t("homework.field_title")}
          <Input
            value={title}
            maxLength={HOMEWORK_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("homework.field_due_date")}
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("homework.field_due_time")}
            <Input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t("homework.field_instructions")}
          <Textarea
            value={instructions}
            maxLength={HOMEWORK_TEXT_MAX}
            onChange={(e) => setInstructions(e.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t("homework.field_link")}
          <Input
            type="url"
            inputMode="url"
            placeholder="https://"
            value={link}
            onChange={(e) => setLink(e.target.value)}
          />
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("sor.admin_cancel")}
          </Button>
          <Button disabled={save.isPending || !title.trim()} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("homework.assign_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SubmitForm({
  caseId,
  item,
  onDone,
}: {
  caseId: string;
  item: HomeworkEntry;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const onError = useErrorToast();
  const [note, setNote] = useState(item.submissionNote ?? "");
  const [link, setLink] = useState(item.submissionUrl ?? "");
  const save = useMutation({
    mutationFn: () => {
      const trimmed = link.trim();
      if (trimmed && !isAllowedHomeworkLink(trimmed)) throw new Error("BAD_LINK");
      return submitHomework({
        data: {
          caseId,
          homeworkId: item.id,
          note: note.trim() || undefined,
          link: trimmed || undefined,
        },
      });
    },
    onSuccess: onDone,
    onError,
  });
  return (
    <div className="mt-2 grid gap-2">
      <Input
        aria-label={t("homework.field_note")}
        placeholder={t("homework.field_note")}
        value={note}
        maxLength={HOMEWORK_NOTE_MAX}
        onChange={(e) => setNote(e.target.value)}
      />
      <Input
        type="url"
        inputMode="url"
        aria-label={t("homework.field_link")}
        placeholder="https://"
        value={link}
        onChange={(e) => setLink(e.target.value)}
      />
      <Button type="button" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {t(item.submittedAt ? "homework.update_submission" : "homework.mark_submitted")}
      </Button>
    </div>
  );
}

function ReviewForm({
  caseId,
  item,
  onDone,
}: {
  caseId: string;
  item: HomeworkEntry;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const onError = useErrorToast();
  const [comment, setComment] = useState("");
  const save = useMutation({
    mutationFn: () =>
      reviewHomework({
        data: { caseId, homeworkId: item.id, comment: comment.trim() || undefined },
      }),
    onSuccess: onDone,
    onError,
  });
  return (
    <div className="mt-2 grid gap-2">
      <Input
        aria-label={t("homework.field_review")}
        placeholder={t("homework.field_review")}
        value={comment}
        maxLength={HOMEWORK_REVIEW_MAX}
        onChange={(e) => setComment(e.target.value)}
      />
      <Button type="button" size="sm" disabled={save.isPending} onClick={() => save.mutate()}>
        {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
        {t("homework.mark_reviewed")}
      </Button>
    </div>
  );
}

function ExternalLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="font-semibold text-[color:var(--brand-link)] hover:underline"
    >
      {label}
    </a>
  );
}

function HomeworkCard({
  caseId,
  item,
  canSubmit,
  canReview,
  onDone,
}: {
  caseId: string;
  item: HomeworkEntry;
  canSubmit: boolean;
  canReview: boolean;
  onDone: () => void;
}) {
  const { t, i18n } = useTranslation();
  const status = homeworkStatus(item, new Date());
  return (
    <li className="rounded-xl border border-border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 font-semibold [overflow-wrap:anywhere]">{item.title}</p>
        <span
          className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs", STATUS_CLASS[status])}
        >
          {t(`homework.status_${status}`)}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {t("homework.due", {
          day: hktDayLabel(item.dueAt, i18n.language),
          time: hktClock(item.dueAt),
        })}
      </p>
      {item.instructions ? (
        <p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]">{item.instructions}</p>
      ) : null}
      {item.resourceUrl ? (
        <p className="mt-1">
          <ExternalLink href={item.resourceUrl} label={t("homework.open_resource")} />
        </p>
      ) : null}
      {item.submittedAt ? (
        <div className="mt-2 border-t border-border pt-2 text-xs text-muted-foreground">
          <p>
            {t("homework.submitted_at", {
              day: hktDayLabel(item.submittedAt, i18n.language),
              time: hktClock(item.submittedAt),
            })}
          </p>
          {item.submissionNote ? (
            <p className="mt-1 [overflow-wrap:anywhere]">{item.submissionNote}</p>
          ) : null}
          {item.submissionUrl ? (
            <p className="mt-1">
              <ExternalLink href={item.submissionUrl} label={t("homework.open_submission")} />
            </p>
          ) : null}
        </div>
      ) : null}
      {item.reviewComment ? (
        <p className="mt-2 text-xs [overflow-wrap:anywhere]">
          {t("homework.review_comment", { comment: item.reviewComment })}
        </p>
      ) : null}
      {canSubmit && !item.reviewedAt ? (
        <SubmitForm caseId={caseId} item={item} onDone={onDone} />
      ) : null}
      {canReview && item.submittedAt && !item.reviewedAt ? (
        <ReviewForm caseId={caseId} item={item} onDone={onDone} />
      ) : null}
    </li>
  );
}

/** #652: the Homework tab of the Case Detail drawer. */
export function HomeworkTab({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ["case-homework", caseId];
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => getCaseHomework({ data: { caseId } }),
  });
  const [assignOpen, setAssignOpen] = useState(false);
  const refresh = () => void queryClient.invalidateQueries({ queryKey });

  if (isLoading) return <Loader2 className="mt-4 h-5 w-5 animate-spin" aria-hidden />;
  if (isError || !data) {
    return <p className="mt-4 text-sm text-destructive">{t("homework.err_generic")}</p>;
  }

  const now = new Date();
  const { active, completed } = splitHomework(data.items, now);
  const isTutor = data.role === "tutor";
  const renderCard = (item: HomeworkEntry) => (
    <HomeworkCard
      key={item.id}
      caseId={caseId}
      item={item}
      canSubmit={!isTutor && !data.readOnly}
      canReview={isTutor && !data.readOnly}
      onDone={refresh}
    />
  );

  return (
    <div className="mt-4 space-y-4">
      <SummaryRow summary={summarizeHomework(data.items, now)} />
      <p className="text-xs text-muted-foreground">{t("homework.optional_note")}</p>
      {isTutor && !data.readOnly ? (
        <Button type="button" size="sm" onClick={() => setAssignOpen(true)}>
          {t("homework.assign_open")}
        </Button>
      ) : null}
      {data.items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("homework.empty")}</p>
      ) : null}
      {active.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("homework.active_title")}</h3>
          <ul className="space-y-2">{active.map(renderCard)}</ul>
        </section>
      ) : null}
      {completed.length > 0 ? (
        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{t("homework.completed_title")}</h3>
          <ul className="space-y-2">{completed.map(renderCard)}</ul>
        </section>
      ) : null}
      {assignOpen ? (
        <AssignDialog caseId={caseId} onOpenChange={setAssignOpen} onDone={refresh} />
      ) : null}
    </div>
  );
}

/** #652: read-only preview on the empty hub, so the workflow is clear before a match. */
export function HomeworkSamplePreview() {
  const { t } = useTranslation();
  return (
    <section className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-card p-5">
      <h2 className="text-lg font-bold">{t("homework.tab")}</h2>
      <SummaryRow summary={null} />
      <ul aria-hidden className="space-y-2 opacity-60">
        {Array.from({ length: SAMPLE_COUNT }, (_, index) => (
          <li key={index} className="rounded-xl border border-dashed border-border p-3 text-sm">
            {t(`homework.sample_${index + 1}`)}
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted-foreground">{t("homework.empty_hint")}</p>
    </section>
  );
}
