/**
 * Issue #441 — the shared staff risk-flag editor, mounted inside the case
 * detail (case admin) and TutorEditor (tutor admin). Manual-only controls:
 * a flag dropdown, a short staff-only note, Save. Authority (any staff sets
 * REVIEW; only an Operator/admin moves a flag into or out of BLOCKED) is
 * enforced server-side in setRiskFlag — the UI only surfaces the error.
 * Renders no panel chrome of its own; each surface wraps it in its shell
 * (ConsolePanel on the case detail, EditorSection in TutorEditor).
 */

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listRiskFlags,
  setRiskFlag,
  type RiskFlagEntity,
  type RiskFlagRow,
} from "@/features/admin/risk-flags.functions";
import {
  RISK_FLAGS,
  RISK_FLAG_LABEL_KEYS,
  RISK_FLAG_LABELS,
  RISK_FLAG_NOTE_MAX,
  normalizeRiskFlag,
  type RiskFlag,
} from "@/features/admin/risk-flags";

export function findRiskFlagRow(
  rows: RiskFlagRow[] | undefined,
  entity: RiskFlagEntity,
  entityId: string,
): RiskFlagRow | null {
  return (
    (rows ?? []).find((row) =>
      entity === "case" ? row.case_id === entityId : row.tutor_id === entityId,
    ) ?? null
  );
}

export function RiskFlagEditor({ entity, entityId }: { entity: RiskFlagEntity; entityId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const flagsQuery = useQuery({
    queryKey: ["admin", "risk-flags", entity],
    queryFn: () => listRiskFlags({ data: { entity } }),
  });
  const current = findRiskFlagRow(flagsQuery.data, entity, entityId);
  const currentFlag = normalizeRiskFlag(current?.risk_flag);

  const [flag, setFlag] = useState<RiskFlag>(currentFlag);
  const [note, setNote] = useState(current?.risk_note ?? "");

  // Re-sync the local controls when the row loads (or the flag changes
  // elsewhere — the desk list and this editor share one query key).
  useEffect(() => {
    setFlag(currentFlag);
    setNote(current?.risk_note ?? "");
  }, [current?.id, currentFlag, current?.risk_note]);

  const save = useMutation({
    mutationFn: () =>
      setRiskFlag({ data: { entity, id: entityId, flag, note: note.trim() || null } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin", "risk-flags"] });
      toast.success(t("risk.saved", { defaultValue: "Risk flag saved" }));
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dirty = flag !== currentFlag || note.trim() !== (current?.risk_note ?? "");

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-[color:var(--ink)]">
            {t("risk.flag_label", { defaultValue: "Flag" })}
          </Label>
          <Select value={flag} onValueChange={(v) => setFlag(v as RiskFlag)}>
            <SelectTrigger className="h-10 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RISK_FLAGS.map((value) => (
                <SelectItem key={value} value={value}>
                  {t(RISK_FLAG_LABEL_KEYS[value], { defaultValue: RISK_FLAG_LABELS[value] })}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs font-bold text-[color:var(--ink)]">
            {t("risk.note_label", { defaultValue: "Note (staff only)" })}
          </Label>
          <Input
            value={note}
            maxLength={RISK_FLAG_NOTE_MAX}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t("risk.note_placeholder", {
              defaultValue: "Short reason: e.g. caller mismatch, suspected fake request",
            })}
            className="h-10 border-[color:var(--ink)]/15 bg-[color:var(--surface)] text-sm"
          />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={!dirty || save.isPending}
          onClick={() => save.mutate()}
        >
          {save.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
          {t("risk.save", { defaultValue: "Save flag" })}
        </Button>
        {current?.risk_flagged_at ? (
          <span className="text-xs text-muted-foreground">
            {t("risk.audit_set", {
              defaultValue: "Last set {{when}}",
              when: formatDistanceToNow(new Date(current.risk_flagged_at), { addSuffix: true }),
            })}
            {current.risk_flagged_by ? ` · ${current.risk_flagged_by.slice(0, 8)}` : ""}
          </span>
        ) : null}
      </div>
      <p className="text-xs text-muted-foreground">
        {t("risk.operator_hint", {
          defaultValue:
            "Review can be set by any staff member. Blocked can only be set or cleared by an Operator (admin).",
        })}
      </p>
    </div>
  );
}
