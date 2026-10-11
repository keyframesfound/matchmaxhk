import { useEffect, useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
 * Report intent that survives the login round-trip (issue #216 review
 * finding): when a logged-out user clicks Report and the auth gate opens, we
 * stash the target in sessionStorage; once `user` appears, the dialog reopens
 * automatically so they don't have to find the report button again. Google
 * OAuth landing in a fresh tab loses sessionStorage — the intent degrades to
 * "click Report again", same as before; the email path (same tab) resumes.
 */
const PENDING_REPORT_KEY = "mm_pending_report";

type PendingReport = {
  targetType: ReportTargetType;
  targetId: string;
};

function stashPendingReport(intent: PendingReport) {
  try {
    sessionStorage.setItem(PENDING_REPORT_KEY, JSON.stringify(intent));
  } catch {
    // sessionStorage unavailable — the user just clicks Report again
  }
}

function takePendingReport(target: PendingReport): boolean {
  try {
    const raw = sessionStorage.getItem(PENDING_REPORT_KEY);
    if (!raw) return false;
    sessionStorage.removeItem(PENDING_REPORT_KEY);
    const parsed = JSON.parse(raw) as PendingReport;
    return parsed?.targetType === target.targetType && parsed?.targetId === target.targetId;
  } catch {
    return false;
  }
}

/** Shared submit wiring for both trigger variants (button + inline link). */
function useReportMutation(
  targetType: ReportTargetType,
  targetId: string,
  reason: ReportReason | null,
  note: string,
  onDone: () => void,
) {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: () =>
      submitReport({
        data: {
          targetType,
          targetId,
          reason: reason as ReportReason,
          // Optional context is collected for EVERY reason (staff investigating
          // a copyright or harassment report needs it too); the server still
          // requires it only for "other".
          note: note.trim() ? note.trim() : undefined,
        },
      }),
    onSuccess: () => {
      toast.success(t("report.submitted"));
      onDone();
    },
    onError: (error) => {
      if (error instanceof Error && error.message === "DUPLICATE_REPORT") {
        toast.info(t("report.duplicate"));
        onDone();
        return;
      }
      if (error instanceof Error && error.message === "RATE_LIMITED") {
        toast.error(t("report.rate_limited"));
        return;
      }
      if (error instanceof Error && error.message === "SELF_REPORT") {
        toast.error(t("report.self_report"));
        return;
      }
      toast.error(t("report.failed"));
    },
  });
}

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

  // Resume a stashed report intent once the user is signed in (see
  // PENDING_REPORT_KEY above).
  useEffect(() => {
    if (user && takePendingReport({ targetType, targetId })) {
      setDialogOpen(true);
    }
  }, [user, targetType, targetId]);

  const reset = () => {
    setDialogOpen(false);
    setReason(null);
    setNote("");
  };
  const mutation = useReportMutation(targetType, targetId, reason, note, reset);

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
            stashPendingReport({ targetType, targetId });
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
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setReason(null);
            setNote("");
          }
        }}
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

  useEffect(() => {
    if (user && takePendingReport({ targetType, targetId })) {
      setDialogOpen(true);
    }
  }, [user, targetType, targetId]);

  const reset = () => {
    setDialogOpen(false);
    setReason(null);
    setNote("");
    setHasSubmitted(true);
  };
  const mutation = useReportMutation(targetType, targetId, reason, note, reset);

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
            stashPendingReport({ targetType, targetId });
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
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setReason(null);
            setNote("");
          }
        }}
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
 * Icon-only report trigger for placement alongside other icon buttons (save,
 * share). With multiple targets (tutor card + photo on the profile header) it
 * opens a small menu to pick what is being reported; with one target it opens
 * the report dialog directly. Same dialog and rules as ReportButton.
 */
export function ReportMenuButton({
  targets,
  menuLabel,
  className,
}: {
  targets: { targetType: ReportTargetType; targetId: string; label: string }[];
  /** Screen-reader/tooltip label for the flag button itself. */
  menuLabel: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [pendingTarget, setPendingTarget] = useState<{
    targetType: ReportTargetType;
    targetId: string;
    label: string;
  } | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [gateOpen, setGateOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");

  // Resume a stashed report intent once the user is signed in.
  useEffect(() => {
    if (user && pendingTarget && takePendingReport(pendingTarget)) {
      setDialogOpen(true);
    }
  }, [user, pendingTarget]);

  const reset = () => {
    setDialogOpen(false);
    setPendingTarget(null);
    setReason(null);
    setNote("");
  };
  const mutation = useReportMutation(
    pendingTarget?.targetType ?? "tutor_card",
    pendingTarget?.targetId ?? "",
    reason,
    note,
    reset,
  );

  const openFor = (target: (typeof targets)[number]) => {
    if (user) {
      setPendingTarget(target);
      setDialogOpen(true);
    } else {
      setPendingTarget(target);
      stashPendingReport(target);
      setGateOpen(true);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label={menuLabel}
            title={menuLabel}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-sm text-[color:var(--ink)] transition-colors hover:bg-[color:var(--foreground)]/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ring)]/40 @max-sm:h-8 @max-sm:w-8",
              className,
            )}
          >
            <Flag className="h-4 w-4" strokeWidth={2.4} aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {targets.map((target) => (
            <DropdownMenuItem key={target.targetType} onSelect={() => openFor(target)}>
              {t("report.menu_item", { item: target.label })}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      <AuthGateDialog
        open={gateOpen}
        onOpenChange={(open) => {
          setGateOpen(open);
          if (!open) setPendingTarget(null);
        }}
        title={t("report.login_title")}
        description={t("report.login_description")}
      />
      <ReportDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) reset();
        }}
        label={pendingTarget?.label ?? ""}
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
          {reason ? (
            <div className="mt-3">
              <label htmlFor="report-note" className="text-xs font-bold text-[color:var(--ink)]">
                {reason === "other" ? t("report.note_label") : t("report.note_label_optional")}
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
