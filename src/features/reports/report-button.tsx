import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AuthGateDialog } from "@/features/auth/AuthGateDialog";
import { useAuth } from "@/features/auth/useAuth";
import {
  REPORT_REASONS,
  submitReport,
  type ReportReason,
  type ReportTargetType,
} from "@/features/reports/reports.functions";
import { cn } from "@/lib/utils";

/**
 * Issue #216: Report button — one report form for a tutor card, a photo, an
 * introduction, and a note. The reporter picks a reason ("other" requires a
 * note); login is required (AuthGateDialog, same pattern as saving a case);
 * one OPEN report per (reporter, item) — a repeat submit shows a friendly
 * duplicate toast backed by the partial unique index on reports.
 *
 * The reported tutor is never shown who reported (reporter identity has no
 * tutor-facing read path — see 20261011000000_create_reports.sql).
 */
export function ReportButton({
  targetType,
  targetId,
  label,
  className,
}: {
  targetType: ReportTargetType;
  targetId: string;
  /** What the reporter is reporting, shown in the dialog ("this tutor card"). */
  label: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      submitReport({
        data: {
          targetType,
          targetId,
          reason: reason as ReportReason,
          note: reason === "other" ? note : undefined,
        },
      }),
    onSuccess: () => {
      toast.success(t("report.submitted"));
      setDialogOpen(false);
      setReason(null);
      setNote("");
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DUPLICATE_REPORT") {
        toast.info(t("report.duplicate"));
        setDialogOpen(false);
        return;
      }
      toast.error(t("report.failed"));
    },
  });

  return (
    <>
      <TooltipWrappedReportTrigger
        label={t("report.button_aria", { item: label })}
        className={className}
        onOpen={(event) => {
          event.stopPropagation();
          if (user) {
            setDialogOpen(true);
          } else {
            setGateOpen(true);
          }
        }}
      />
      <AuthGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        title={t("report.login_title")}
        description={t("report.login_description")}
      />
      <ReportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        label={label}
        reason={reason}
        setReason={setReason}
        note={note}
        setNote={setNote}
        pending={mutation.isPending}
        onSubmit={() => mutation.mutate()}
      />
    </>
  );
}

/**
 * Text-only report trigger for inline placement (e.g. under the tutor
 * self-introduction on the profile). Same dialog and rules as ReportButton.
 */
export function InlineReportLink({
  targetType,
  targetId,
  label,
}: {
  targetType: ReportTargetType;
  targetId: string;
  label: string;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const mutation = useMutation({
    mutationFn: () =>
      submitReport({
        data: {
          targetType,
          targetId,
          reason: reason as ReportReason,
          note: reason === "other" ? note : undefined,
        },
      }),
    onSuccess: () => {
      toast.success(t("report.submitted"));
      setDialogOpen(false);
      setReason(null);
      setNote("");
      setHasSubmitted(true);
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DUPLICATE_REPORT") {
        toast.info(t("report.duplicate"));
        setDialogOpen(false);
        setHasSubmitted(true);
        return;
      }
      toast.error(t("report.failed"));
    },
  });

  if (hasSubmitted) return null;

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          if (user) {
            setDialogOpen(true);
          } else {
            setGateOpen(true);
          }
        }}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground underline underline-offset-4 transition-colors hover:text-[color:var(--ink)]"
      >
        <Flag className="h-3.5 w-3.5" aria-hidden="true" />
        {t("report.inline_link", { item: label })}
      </button>
      <AuthGateDialog
        open={gateOpen}
        onOpenChange={setGateOpen}
        title={t("report.login_title")}
        description={t("report.login_description")}
      />
      <ReportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        label={label}
        reason={reason}
        setReason={setReason}
        note={note}
        setNote={setNote}
        pending={mutation.isPending}
        onSubmit={() => mutation.mutate()}
      />
    </>
  );
}

function ReportDialog({
  open,
  onOpenChange,
  label,
  reason,
  setReason,
  note,
  setNote,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  reason: ReportReason | null;
  setReason: (reason: ReportReason) => void;
  note: string;
  setNote: (note: string) => void;
  pending: boolean;
  onSubmit: () => void;
}) {
  const { t } = useTranslation();
  const reasonOptions = REPORT_REASONS.map((value) => ({
    value,
    label: t(`report.reason_${value}`),
  }));
  const canSubmit = reason !== null && (reason !== "other" || note.trim().length > 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-full max-w-md flex-col gap-0 p-0 sm:max-w-md">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-base font-bold text-[color:var(--ink)]">
            {t("report.title", { item: label })}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {t("report.description")}
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <ul className="space-y-1.5" role="radiogroup" aria-label={t("report.reasons_aria")}>
            {reasonOptions.map((option) => {
              const selected = reason === option.value;
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => setReason(option.value)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-sm border px-3 py-2.5 text-left text-sm transition-colors",
                      selected
                        ? "border-[color:var(--foreground)] bg-muted font-semibold text-[color:var(--ink)]"
                        : "border-border bg-[color:var(--surface)] text-muted-foreground hover:bg-muted/50",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                        selected ? "border-[color:var(--foreground)]" : "border-border",
                      )}
                    >
                      {selected ? (
                        <span className="h-2 w-2 rounded-full bg-[color:var(--foreground)]" />
                      ) : null}
                    </span>
                    {option.label}
                  </button>
                </li>
              );
            })}
          </ul>
          {reason === "other" ? (
            <div className="mt-3">
              <label htmlFor="report-note" className="text-xs font-bold text-[color:var(--ink)]">
                {t("report.note_label")}
              </label>
              <Textarea
                id="report-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={1000}
                rows={3}
                className="mt-1.5"
                placeholder={t("report.note_placeholder")}
              />
            </div>
          ) : null}
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
            {t("report.privacy_note")}
          </p>
        </div>
        <div className="flex justify-end gap-2 border-t border-border px-5 py-3">
          <Button
            type="button"
            variant="outline"
            className="h-9 text-sm font-bold"
            onClick={() => onOpenChange(false)}
          >
            {t("report.cancel")}
          </Button>
          <Button
            type="button"
            variant="solid"
            color="blue"
            className="h-9 text-sm font-bold"
            disabled={!canSubmit || pending}
            onClick={onSubmit}
          >
            {pending ? t("report.submitting") : t("report.submit")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TooltipWrappedReportTrigger({
  label,
  className,
  onOpen,
}: {
  label: string;
  className?: string;
  onOpen: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onOpen}
      onKeyDown={(event) => event.stopPropagation()}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-[color:var(--ink)] transition-colors hover:bg-[color:var(--foreground)]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40 @max-sm:h-8 @max-sm:w-8",
        className,
      )}
    >
      <Flag className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
    </button>
  );
}
