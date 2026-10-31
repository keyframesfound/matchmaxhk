// Issue #459 slice 4: the parent's verified-hours review queue on the case
// page. Rows arrive from the case_lessons trigger (lesson marked done →
// pending_confirmation); the parent confirms within 24h or disputes with a
// reason, and the hourly cron auto-verifies the rest. Same anatomy as the
// #387 SessionLogsSection on the route: one row per lesson, inline dispute.

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  confirmHoursRow,
  disputeHoursRow,
  type HoursLedgerRowT,
} from "@/features/hours/hours.functions";
import { canParentReviewHours } from "@/features/hours/hours";

export function ParentHoursSection({
  rows,
  onChanged,
}: {
  rows: HoursLedgerRowT[];
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [disputingId, setDisputingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const confirm = useMutation({
    mutationFn: (ledgerId: string) => confirmHoursRow({ data: { ledgerId } }),
    onSuccess: () => {
      toast.success(t("hours.confirmed_done"));
      onChanged();
    },
    onError: (e) => toast.error(t(`hours.err_${e.message}`, { defaultValue: e.message })),
  });

  const dispute = useMutation({
    mutationFn: (ledgerId: string) =>
      disputeHoursRow({ data: { ledgerId, reason: reason.trim() } }),
    onSuccess: () => {
      toast.success(t("hours.disputed_done"));
      setDisputingId(null);
      setReason("");
      onChanged();
    },
    onError: (e) => toast.error(t(`hours.err_${e.message}`, { defaultValue: e.message })),
  });

  if (rows.length === 0) return null;
  const now = new Date();

  const hoursLeft = (pendingSince: string) => {
    const msLeft = 24 * 3_600_000 - (now.getTime() - new Date(pendingSince).getTime());
    return Math.max(0, Math.ceil(msLeft / 3_600_000));
  };

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">{t("hours.title")}</h2>
      <ul className="space-y-2">
        {rows.map((row) => (
          <li key={row.id} className="rounded-lg border border-[color:var(--ink)]/10 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-[color:var(--ink)]">
                {format(new Date(row.occurred_at), "EEE d MMM HH:mm")} ·{" "}
                {t("hours.duration_hours", { hours: Number(row.duration_hours) })}
              </span>
              <span className="rounded-full bg-[color:var(--foreground)]/[0.06] px-2 py-0.5 text-xs text-muted-foreground">
                {t(`hours.status_${row.status}`)}
              </span>
              {row.status === "pending_confirmation" && (
                <span className="ml-auto flex items-center gap-2">
                  {canParentReviewHours(row, now) && (
                    <span className="text-xs text-muted-foreground">
                      {t("hours.pending_hint", { hours: hoursLeft(row.pending_since) })}
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={confirm.isPending}
                    onClick={() => confirm.mutate(row.id)}
                  >
                    <Check className="h-4 w-4" />
                    {t("hours.confirm")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={dispute.isPending}
                    onClick={() => setDisputingId(disputingId === row.id ? null : row.id)}
                  >
                    <X className="h-4 w-4" />
                    {t("hours.dispute")}
                  </Button>
                </span>
              )}
            </div>
            {row.status === "disputed" && row.dispute_reason ? (
              <p className="mt-2 text-xs text-muted-foreground">
                {t("hours.dispute_echo", { reason: row.dispute_reason })}
              </p>
            ) : null}
            {row.status === "pending_confirmation" && disputingId === row.id && (
              <div className="mt-2 space-y-2">
                <textarea
                  className="w-full rounded-md border border-[color:var(--ink)]/15 bg-transparent p-2 text-sm"
                  rows={2}
                  maxLength={500}
                  placeholder={t("hours.dispute_reason")}
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
                    disabled={dispute.isPending || reason.trim().length < 3}
                    onClick={() => dispute.mutate(row.id)}
                  >
                    {dispute.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {t("hours.dispute")}
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
