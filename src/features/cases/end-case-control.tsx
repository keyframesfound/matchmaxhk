/**
 * Issue #503, the bilateral End Case control, shared by the parent case page
 * and the tutor Schedule hub (both parties can tap — not staff-only).
 *
 * Step-card confirm (same anatomy as the live case-request stepper, no
 * dialog): tap End Case → the confirmation card with the issue's plain copy →
 * confirm records this side's marker through the endCase server fn; when the
 * other side has already tapped, the same tap completes the case to 'closed'.
 * No scare language: the record stays on both profiles, ratings freeze.
 */

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { endCase } from "@/features/cases/end-case.functions";
import { canEndCase, sideHasEnded } from "@/features/cases/end-case";

export function EndCaseControl({
  caseId,
  sorStatus,
  endedByParentAt,
  endedByTutorAt,
  actorRole,
  onDone,
}: {
  caseId: string;
  sorStatus: string | null;
  endedByParentAt: string | null;
  endedByTutorAt: string | null;
  actorRole: "parent" | "tutor";
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  const myMarked = sideHasEnded(endedByParentAt, endedByTutorAt, actorRole);
  const otherMarked = sideHasEnded(
    endedByParentAt,
    endedByTutorAt,
    actorRole === "parent" ? "tutor" : "parent",
  );
  const ended = sorStatus === "closed" || (myMarked && otherMarked);

  const submit = useMutation({
    mutationFn: () => endCase({ data: { caseId } }),
    onSuccess: (res) => {
      toast.success(t(res.ended ? "sor.end_case_done_toast" : "sor.end_case_marked_toast"));
      setConfirming(false);
      onDone();
    },
    onError: (e) => {
      if (e.message === "CASE_ENDED") {
        // Already ended meanwhile (the other side completed, or staff): the
        // next refresh shows the ended state; a plain note beats a raw code.
        toast.error(t("sor.err_CASE_ENDED"));
        onDone();
        return;
      }
      toast.error(t(`sor.err_${e.message}`, { defaultValue: e.message }));
    },
  });

  // Hidden unless the case is ongoing (fee_paid | active) and not already
  // ended; a closed case keeps its status label and full history elsewhere.
  if (!canEndCase(sorStatus) || ended) return null;

  if (myMarked) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-muted-foreground">{t("sor.end_case_title")}</h2>
        <p className="mt-2 flex items-start gap-2 text-sm leading-relaxed text-muted-foreground">
          <CheckCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          {t("sor.end_case_waiting")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--radius-panel)] border border-border bg-card p-5">
      <h2 className="text-sm font-semibold text-muted-foreground">{t("sor.end_case_title")}</h2>
      {otherMarked ? (
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("sor.end_case_other_marked")}
        </p>
      ) : null}
      {confirming ? (
        <div className="mt-3">
          <p className="text-sm leading-relaxed text-[color:var(--ink)]">
            {t("sor.end_case_confirm_copy")}
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={submit.isPending}
              onClick={() => setConfirming(false)}
            >
              {t("sor.admin_cancel")}
            </Button>
            <Button size="sm" disabled={submit.isPending} onClick={() => submit.mutate()}>
              {submit.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCheck className="h-4 w-4" />
              )}
              {t("sor.end_case_confirm")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-3">
          <Button size="sm" variant="outline" onClick={() => setConfirming(true)}>
            <CheckCheck className="h-4 w-4" />
            {t("sor.end_case_button")}
          </Button>
        </div>
      )}
    </div>
  );
}
