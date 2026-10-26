import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Ban, ShieldOff, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { listOpenReportsForStatus, type OpenReportOption } from "./account-status.functions";
import { STATUS_CHANGE_REASONS, type StatusAction } from "./account-status.shared";
import type { UserRow } from "./UserStatsOverview";

const REASON_LABELS: Record<string, string> = {
  contact_details: "Contact details shared",
  inappropriate_photo: "Inappropriate photo",
  spam: "Spam",
  fake_identity: "Fake identity",
  other: "Other",
};

const ACTION_COPY: Record<StatusAction, { title: string; description: string; confirm: string }> = {
  suspend: {
    title: "Suspend account?",
    description:
      "The user can still sign in and browse, but cannot request tutors, apply to cases, upload content, or message others. Their tutor card stays up without the Request-tutor action.",
    confirm: "Suspend",
  },
  ban: {
    title: "Ban account?",
    description:
      "The user is signed out everywhere, blocked from signing in or re-registering (email + Google identity stored on the block list), and their tutor card is unpublished.",
    confirm: "Ban",
  },
  restore: {
    title: "Restore account?",
    description:
      "The account returns to active. A banned account is removed from the block list and any tutor card hidden by the ban is republished. No verified badge is granted.",
    confirm: "Restore",
  },
};

interface AccountStatusDialogProps {
  user: UserRow | null;
  /** Preselected action from the row menu. */
  action: StatusAction;
  onActionChange: (action: StatusAction) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: {
    userId: string;
    action: StatusAction;
    reason?: string;
    note?: string;
    reportId?: string;
  }) => Promise<void>;
  isPending: boolean;
}

/**
 * Issue #308: suspend / ban / restore confirmation. Optional reason from a
 * short list, optional note, and an optional link to an existing open
 * report (never required).
 */
export function AccountStatusDialog({
  user,
  action,
  onActionChange,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: AccountStatusDialogProps) {
  const [reason, setReason] = useState<string>("contact_details");
  const [note, setNote] = useState("");
  const [reportId, setReportId] = useState<string>("none");
  const [reports, setReports] = useState<OpenReportOption[]>([]);

  const listReportsFn = useServerFn(listOpenReportsForStatus);

  // Reset the form whenever the dialog opens for a (possibly different) user.
  useEffect(() => {
    if (open) {
      setReason("contact_details");
      setNote("");
      setReportId("none");
    }
  }, [open, user?.user_id]);

  // Open reports for the optional link picker. Failure is non-fatal: the
  // report link is optional, so the picker just stays empty.
  useEffect(() => {
    if (!open) return;
    let active = true;
    listReportsFn({})
      .then((res) => {
        if (active) setReports(res.reports);
      })
      .catch(() => {
        if (active) setReports([]);
      });
    return () => {
      active = false;
    };
  }, [open, listReportsFn]);

  if (!user) return null;

  const copy = ACTION_COPY[action];
  const destructive = action === "ban";

  async function handleConfirm() {
    try {
      await onConfirm({
        userId: user!.user_id,
        action,
        ...(action !== "restore" ? { reason } : {}),
        ...(note.trim() ? { note: note.trim() } : {}),
        ...(reportId !== "none" ? { reportId } : {}),
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg border-border bg-card">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-lg font-bold text-[color:var(--ink)]">
            {copy.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-xs text-muted-foreground">
            {user.display_name ?? user.email ?? user.user_id}, {copy.description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="my-2 space-y-3">
          <div className="flex gap-1.5">
            {(["suspend", "ban", "restore"] as StatusAction[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onActionChange(option)}
                className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-bold capitalize transition-colors ${
                  action === option
                    ? "border-[color:var(--ink)]/40 bg-[color:var(--ink)]/5 text-[color:var(--ink)]"
                    : "border-border/60 text-muted-foreground hover:text-[color:var(--ink)]"
                }`}
              >
                {option}
              </button>
            ))}
          </div>

          {action !== "restore" && (
            <>
              <div>
                <p className="mb-1 text-xs font-bold text-[color:var(--ink)]">Reason</p>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger className="h-9 w-full text-xs font-semibold">
                    <SelectValue placeholder="Pick a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_CHANGE_REASONS.map((value) => (
                      <SelectItem key={value} value={value}>
                        {REASON_LABELS[value]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-1 text-xs font-bold text-[color:var(--ink)]">Note (optional)</p>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  rows={2}
                  placeholder="Context for the record, shown to the user with the reason."
                  className="text-xs"
                />
              </div>
            </>
          )}

          <div>
            <p className="mb-1 text-xs font-bold text-[color:var(--ink)]">
              Link a report (optional)
            </p>
            <Select value={reportId} onValueChange={setReportId}>
              <SelectTrigger className="h-9 w-full text-xs font-semibold">
                <SelectValue placeholder="No report linked" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No report linked</SelectItem>
                {reports.map((report) => (
                  <SelectItem key={report.id} value={report.id}>
                    {report.target_type} · {REASON_LABELS[report.reason] ?? report.reason} ·{" "}
                    {new Date(report.created_at).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {destructive && (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-[11px] text-destructive dark:text-red-400">
              One notification email is sent to the user. The reporter is never named and your note
              is not emailed. Restore is admin-only.
            </div>
          )}
        </div>

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel disabled={isPending} className="h-9 text-xs font-bold">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleConfirm();
            }}
            disabled={isPending}
            className={`h-9 text-xs font-bold ${
              destructive
                ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                : "bg-[color:var(--ink)] text-[color:var(--surface-invert-fg)] hover:bg-[color:var(--ink)]/90"
            }`}
          >
            {action === "suspend" && <ShieldOff className="mr-1.5 h-3.5 w-3.5" />}
            {action === "ban" && <Ban className="mr-1.5 h-3.5 w-3.5" />}
            {action === "restore" && <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />}
            {isPending ? "Working..." : copy.confirm}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
