import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShieldBan } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  ConsoleTable,
  ConsoleTableBody,
  ConsoleTableEmpty,
  ConsoleTableHead,
  ConsoleTableSkeletonRows,
  ConsoleTd,
  ConsoleTh,
} from "@/components/ui/console-table";
import { useAuth } from "@/features/auth/useAuth";
import {
  liftQuarantine,
  liftSuspension,
  listEmergencyActionsAdmin,
  type EmergencyActionRow,
} from "@/features/reports/emergency-suspend.functions";

/**
 * #782 §2.4: the staff-only Emergency Suspend desk card on
 * /admin/trust-safety. Lists accounts with an active suspension or
 * auto-quarantine stamp and lifts either after review. Every action is
 * audited server-side (trust_suspensions); the staff note lives there.
 * Ordinary copyright and not-as-described disputes stay on the reports desk.
 */
export function EmergencySuspendCard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [liftNote, setLiftNote] = useState("");

  const actionsQuery = useQuery({
    queryKey: ["admin", "emergency-actions"],
    queryFn: () => listEmergencyActionsAdmin(),
    enabled: Boolean(user),
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ["admin", "emergency-actions"] });
    void queryClient.invalidateQueries({ queryKey: ["admin", "reports"] });
  };

  const liftSuspensionMutation = useMutation({
    mutationFn: (input: { tutorId: string; note: string }) => liftSuspension({ data: input }),
    onSuccess: () => {
      toast.success(t("trust.emergency_suspend.lift_success"));
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("trust.emergency_suspend.failed")),
  });

  const liftQuarantineMutation = useMutation({
    mutationFn: (input: { targetType: "tutor" | "material"; targetId: string }) =>
      liftQuarantine({ data: input }),
    onSuccess: () => {
      toast.success(t("trust.emergency_suspend.quarantine_lift_success"));
      invalidate();
    },
    onError: (error) =>
      toast.error(error instanceof Error ? error.message : t("trust.emergency_suspend.failed")),
  });

  const rows = actionsQuery.data ?? [];

  return (
    <section className="mt-8">
      <div className="flex items-start gap-2">
        <ShieldBan className="mt-0.5 h-5 w-5 text-[color:var(--warning)]" aria-hidden />
        <div>
          <h3 className="text-base font-bold tracking-tight">
            {t("trust.emergency_suspend.title")}
          </h3>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            {t("trust.emergency_suspend.description")}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="w-full max-w-md">
          <label
            htmlFor="emergency-lift-note"
            className="block text-xs font-bold text-[color:var(--ink)]"
          >
            {t("trust.emergency_suspend.lift_note_label")}
          </label>
          <Textarea
            id="emergency-lift-note"
            value={liftNote}
            onChange={(event) => setLiftNote(event.target.value)}
            maxLength={1000}
            rows={2}
            className="mt-1.5"
            placeholder={t("trust.emergency_suspend.lift_note_placeholder")}
          />
        </div>
      </div>

      <ConsoleTable minTableWidth="760px">
        <ConsoleTableHead>
          <tr>
            <ConsoleTh>{t("trust.emergency_suspend.col_tutor")}</ConsoleTh>
            <ConsoleTh>{t("trust.emergency_suspend.col_state")}</ConsoleTh>
            <ConsoleTh>{t("trust.emergency_suspend.col_last_note")}</ConsoleTh>
            <ConsoleTh align="right">{t("trust.emergency_suspend.col_actions")}</ConsoleTh>
          </tr>
        </ConsoleTableHead>
        <ConsoleTableBody>
          {actionsQuery.isLoading ? (
            <ConsoleTableSkeletonRows columns={4} />
          ) : rows.length === 0 ? (
            <ConsoleTableEmpty
              colSpan={4}
              icon={ShieldBan}
              title={t("trust.emergency_suspend.empty_title")}
              description={t("trust.emergency_suspend.empty_description")}
            />
          ) : (
            rows.map((row) => (
              <EmergencyActionRowView
                key={row.tutor_id}
                row={row}
                liftNote={liftNote}
                busy={liftSuspensionMutation.isPending || liftQuarantineMutation.isPending}
                onLiftSuspension={() =>
                  liftSuspensionMutation.mutate({ tutorId: row.tutor_id, note: liftNote.trim() })
                }
                onLiftQuarantine={() =>
                  liftQuarantineMutation.mutate({ targetType: "tutor", targetId: row.tutor_id })
                }
              />
            ))
          )}
        </ConsoleTableBody>
      </ConsoleTable>
    </section>
  );
}

function EmergencyActionRowView({
  row,
  liftNote,
  busy,
  onLiftSuspension,
  onLiftQuarantine,
}: {
  row: EmergencyActionRow;
  liftNote: string;
  busy: boolean;
  onLiftSuspension: () => void;
  onLiftQuarantine: () => void;
}) {
  const { t } = useTranslation();
  return (
    <tr>
      <ConsoleTd className="text-xs">
        <span className="font-semibold">{row.display_name}</span>
        {row.tutor_code ? (
          <span className="block text-muted-foreground">{row.tutor_code}</span>
        ) : null}
      </ConsoleTd>
      <ConsoleTd className="text-xs">
        {row.suspended_at ? (
          <span className="inline-flex items-center rounded-full border border-[color:var(--ink)]/20 bg-muted px-2 py-0.5 text-[11px] font-semibold text-[color:var(--ink)]">
            {t("trust.emergency_suspend.badge_suspended")}
          </span>
        ) : null}
        {row.quarantined_at ? (
          <span className="ml-2 inline-flex items-center rounded-full border border-border bg-muted/50 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
            {t("trust.emergency_suspend.badge_quarantined")}
          </span>
        ) : null}
      </ConsoleTd>
      <ConsoleTd className="max-w-[280px] text-xs text-muted-foreground">
        {row.last_note ?? "—"}
      </ConsoleTd>
      <ConsoleTd align="right">
        <div className="flex justify-end gap-2">
          {row.quarantined_at ? (
            <Button
              type="button"
              variant="outline"
              className="h-8 px-3 text-xs font-bold"
              disabled={busy}
              onClick={onLiftQuarantine}
            >
              {t("trust.emergency_suspend.remove_quarantine")}
            </Button>
          ) : null}
          {row.suspended_at ? (
            <Button
              type="button"
              variant="solid"
              color="blue"
              className="h-8 px-3 text-xs font-bold"
              disabled={busy || liftNote.trim().length === 0}
              title={
                liftNote.trim().length === 0
                  ? t("trust.emergency_suspend.lift_note_required")
                  : undefined
              }
              onClick={onLiftSuspension}
            >
              {t("trust.emergency_suspend.lift_suspension")}
            </Button>
          ) : null}
        </div>
      </ConsoleTd>
    </tr>
  );
}
