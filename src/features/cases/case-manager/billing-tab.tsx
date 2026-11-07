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
import {
  RESCHEDULE_NOTE_MAX,
  STATEMENT_STATUSES,
  buildStatement,
  canRespondToReschedule,
  type StatementLesson,
  type StatementMonth,
  type StatementStatus,
} from "@/features/cases/case-billing";
import {
  getCaseBilling,
  requestReschedule,
  respondReschedule,
  setStatementMonthStatus,
  shareStatement,
  type CaseBilling,
  type PendingReschedule,
} from "@/features/cases/case-billing.functions";
import { hktClock, hktDayLabel } from "@/features/cases/case-schedule";
import { hktDateKey, hktFromParts } from "@/features/cases/sor";
import { cn } from "@/lib/utils";

import { clockToMinute } from "./schedule-form";

function useErrorToast() {
  const { t } = useTranslation();
  return (e: Error) =>
    toast.error(t(`billing.err_${e.message}`, { defaultValue: t("billing.err_generic") }));
}

function useWhen() {
  const { i18n } = useTranslation();
  return (iso: string) => `${hktDayLabel(iso, i18n.language)}, ${hktClock(iso)}`;
}

function RescheduleDialog({
  caseId,
  lesson,
  onOpenChange,
  onDone,
}: {
  caseId: string;
  lesson: StatementLesson;
  onOpenChange: (open: boolean) => void;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const onError = useErrorToast();
  const [date, setDate] = useState(() => hktDateKey(new Date(lesson.startsAt)));
  const [time, setTime] = useState(() => hktClock(lesson.startsAt));
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () => {
      const minute = clockToMinute(time);
      if (minute === null || !date) throw new Error("BAD_TIME");
      return requestReschedule({
        data: {
          caseId,
          lessonId: lesson.id,
          proposedIso: hktFromParts(date, minute).toISOString(),
          note: note.trim() || undefined,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("billing.request_sent"));
      onOpenChange(false);
      onDone();
    },
    onError,
  });
  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("billing.request_cta")}</DialogTitle>
          <DialogDescription>{t("billing.request_hint")}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("sor.schedule_next_date")}
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="grid gap-1 text-xs text-muted-foreground">
            {t("sor.schedule_next_time")}
            <Input type="time" step={900} value={time} onChange={(e) => setTime(e.target.value)} />
          </label>
        </div>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t("billing.request_note")}
          <Input
            value={note}
            maxLength={RESCHEDULE_NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("sor.admin_cancel")}
          </Button>
          <Button disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            {t("billing.request_submit")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PendingRow({
  caseId,
  request,
  role,
  onDone,
}: {
  caseId: string;
  request: PendingReschedule;
  role: CaseBilling["role"];
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const when = useWhen();
  const onError = useErrorToast();
  const respond = useMutation({
    mutationFn: (accept: boolean) =>
      respondReschedule({ data: { caseId, requestId: request.id, accept } }),
    onSuccess: onDone,
    onError,
  });
  const canRespond = canRespondToReschedule(
    { status: "pending", proposerRole: request.proposerRole },
    role,
  );
  return (
    <li className="mm-slot-proposed rounded-xl p-3 text-sm">
      <p className="text-xs font-semibold">{t("billing.pending_badge")}</p>
      <p className="mt-1">
        {request.fromStartsAt ? `${when(request.fromStartsAt)} → ` : ""}
        {when(request.proposedStartsAt)} HKT
      </p>
      {request.note ? (
        <p className="mt-1 text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {request.note}
        </p>
      ) : null}
      {canRespond ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            disabled={respond.isPending}
            onClick={() => respond.mutate(true)}
          >
            {t("billing.accept")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={respond.isPending}
            onClick={() => respond.mutate(false)}
          >
            {t("billing.decline")}
          </Button>
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">{t("billing.waiting_other_side")}</p>
      )}
    </li>
  );
}

function statementSummary(
  t: ReturnType<typeof useTranslation>["t"],
  month: StatementMonth,
  when: (iso: string) => string,
): string {
  const total = month.total === null ? "" : t("billing.money", { amount: month.total });
  return [
    t("billing.summary_title", { month: month.month }),
    ...month.lines.map(
      (l) =>
        `${when(l.startsAt)} · ${t("billing.hours", { n: l.hours })}` +
        (l.lineTotal === null ? "" : ` · ${t("billing.money", { amount: l.lineTotal })}`),
    ),
    t("billing.summary_total", { lessons: month.lessons, hours: month.hours, total }),
    t("billing.summary_note"),
  ].join("\n");
}

function MonthCard({
  caseId,
  month,
  onDone,
}: {
  caseId: string;
  month: StatementMonth;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const when = useWhen();
  const onError = useErrorToast();
  const mark = useMutation({
    mutationFn: (status: StatementStatus) =>
      setStatementMonthStatus({ data: { caseId, month: month.month, status } }),
    onSuccess: onDone,
    onError,
  });
  const share = useMutation({
    mutationFn: () => shareStatement({ data: { caseId, month: month.month } }),
    onSuccess: () => toast.success(t("billing.shared")),
    onError,
  });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(statementSummary(t, month, when));
      toast.success(t("billing.copied"));
    } catch {
      toast.error(t("billing.copy_failed"));
    }
  };
  return (
    <li className="rounded-xl border border-border p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">{month.month}</p>
        <p className="text-xs text-muted-foreground">
          {t("billing.month_line", { lessons: month.lessons, hours: month.hours })}
          {month.total === null ? "" : ` · ${t("billing.money", { amount: month.total })}`}
        </p>
      </div>
      <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
        {month.lines.map((l) => (
          <li key={l.id} className="flex justify-between gap-3">
            <span>
              {when(l.startsAt)} · {t("billing.hours", { n: l.hours })}
            </span>
            {l.lineTotal === null ? null : (
              <span>{t("billing.money", { amount: l.lineTotal })}</span>
            )}
          </li>
        ))}
      </ul>
      <div
        role="group"
        aria-label={t("billing.status_label")}
        className="mt-3 flex flex-wrap gap-1.5"
      >
        {STATEMENT_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={month.status === status}
            disabled={mark.isPending}
            onClick={() => mark.mutate(status)}
            className={cn(
              "h-9 rounded-full border border-border px-3 text-xs",
              month.status === status && "mm-slot-occupied",
            )}
          >
            {t(`billing.status_${status}`)}
          </button>
        ))}
      </div>
      {month.markedByRole && month.markedAt ? (
        <p className="mt-1.5 text-xs text-muted-foreground">
          {t("billing.marked_by", {
            status: t(`billing.status_${month.status}`),
            // Issue copy names the person; the role covers a profile with no name.
            name: month.markedByName ?? t(`billing.role_${month.markedByRole}`),
            when: when(month.markedAt),
          })}
        </p>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => void copy()}>
          {t("billing.copy")}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={share.isPending}
          onClick={() => share.mutate()}
        >
          {t("billing.share")}
        </Button>
      </div>
    </li>
  );
}

/** #654: the Schedule & Billing tab. Bookkeeping only; MatchMax moves no money here. */
export function BillingTab({
  caseId,
  onScheduleChanged,
}: {
  caseId: string;
  onScheduleChanged: () => void;
}) {
  const { t } = useTranslation();
  const when = useWhen();
  const queryClient = useQueryClient();
  const queryKey = ["case-billing", caseId];
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => getCaseBilling({ data: { caseId } }),
  });
  const [rescheduling, setRescheduling] = useState<StatementLesson | null>(null);
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey });
    onScheduleChanged();
  };

  if (isLoading) return <Loader2 className="mt-4 h-5 w-5 animate-spin" aria-hidden />;
  if (isError || !data) {
    return <p className="mt-4 text-sm text-destructive">{t("billing.err_generic")}</p>;
  }

  const now = Date.now();
  const upcoming = data.lessons
    .filter(
      (l) => (l.status === "planned" || l.status === "confirmed") && Date.parse(l.startsAt) > now,
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const pendingLessons = new Set(data.pending.map((p) => p.lessonId));
  const statement = buildStatement(
    data.lessons,
    { rateHkd: data.rateHkd, studentCount: data.studentCount },
    data.marks,
  );

  return (
    <div className="mt-4 space-y-5">
      {data.pending.length > 0 ? (
        <ul className="space-y-2">
          {data.pending.map((request) => (
            <PendingRow
              key={request.id}
              caseId={caseId}
              request={request}
              role={data.role}
              onDone={refresh}
            />
          ))}
        </ul>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t("billing.upcoming_title")}</h3>
        {upcoming.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("billing.upcoming_empty")}</p>
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {upcoming.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>{when(l.startsAt)}</span>
                {pendingLessons.has(l.id) ? (
                  <span className="text-xs text-muted-foreground">
                    {t("billing.pending_badge")}
                  </span>
                ) : data.canRequest ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => setRescheduling(l)}
                  >
                    {t("billing.request_cta")}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold">{t("billing.statement_title")}</h3>
        <p className="text-xs text-muted-foreground">
          {t(data.isShortCase ? "billing.fee_notice_short" : "billing.fee_notice")}
        </p>
        {statement.months.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("billing.statement_empty")}</p>
        ) : (
          <ul className="space-y-2">
            {statement.months.map((month) => (
              <MonthCard key={month.month} caseId={caseId} month={month} onDone={refresh} />
            ))}
          </ul>
        )}
        {statement.caseTotal === null ? (
          <p className="text-xs text-muted-foreground">{t("billing.no_rate")}</p>
        ) : statement.months.length > 0 ? (
          <p className="text-sm font-semibold">
            {t("billing.case_total", {
              total: t("billing.money", { amount: statement.caseTotal }),
            })}
          </p>
        ) : null}
      </section>

      {rescheduling ? (
        <RescheduleDialog
          caseId={caseId}
          lesson={rescheduling}
          onOpenChange={(open) => !open && setRescheduling(null)}
          onDone={refresh}
        />
      ) : null}
    </div>
  );
}

/** #654: read-only preview on the empty hub. */
export function BillingSamplePreview() {
  const { t } = useTranslation();
  return (
    <section className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-card p-5">
      <h2 className="text-lg font-bold">{t("billing.tab")}</h2>
      <div aria-hidden className="space-y-2 opacity-60">
        <p className="rounded-xl border border-dashed border-border p-3 text-sm">
          {t("billing.sample_reschedule")}
        </p>
        <p className="rounded-xl border border-dashed border-border p-3 text-sm">
          {t("billing.sample_statement")}
        </p>
      </div>
      <p className="text-xs text-muted-foreground">{t("billing.fee_notice")}</p>
    </section>
  );
}
