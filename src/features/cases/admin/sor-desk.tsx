import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CalendarPlus, FileUp, Flag, Loader2, UserPlus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ConsolePanel } from "@/components/ui/console-panel";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import {
  createSorCase,
  feeInvoiceCustom,
  feeMarkPaid,
  feeWaive,
  flagCase,
  getDeskCase,
  lessonAdminConfirm,
  lessonAdminLog,
  lessonAdminMark,
  listCaseFlags,
  transitionCase,
  unpaidQueue,
} from "@/features/cases/admin-desk.functions";
import { CASE_FLAG_REASONS, type CaseFlagReason } from "@/features/cases/case-flags";
import { listCaseSessionLogs, revokeSession } from "@/features/cases/experience.functions";
import {
  derivePaidState,
  fullAdminFeeAmount,
  lesson1Amount,
  lesson2BalanceAmount,
} from "@/features/cases/fee-breakdown";
import { importCases } from "@/features/cases/import.functions";
import { parseCaseImportCsv } from "@/features/cases/import-csv";
import { cn } from "@/lib/utils";

function feeHkd(amount: number | null): string {
  return amount === null ? "—" : `HK$${Number(amount).toFixed(0)}`;
}

const TRANSITION_REASON_HINTS: Record<string, boolean> = {
  fee_invoiced: true,
  waived: true,
  closed: true,
  replaced: true,
};

// ---------------------------------------------------------------------------
// Per-case SoR panel (mounted inside CaseDetailView)
// ---------------------------------------------------------------------------

export function SorCasePanel({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data, isLoading, isError } = useQuery({
    queryKey: ["sor", "desk-case", caseId],
    queryFn: () => getDeskCase({ data: { caseId } }),
  });

  const [reason, setReason] = useState("");
  const [fpsRef, setFpsRef] = useState("");
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["sor", "desk-case", caseId] });
    queryClient.invalidateQueries({ queryKey: ["sor", "desk-list"] });
  };

  const transition = useMutation({
    mutationFn: (to: string) =>
      transitionCase({
        data: { caseId, to, reason: reason || undefined, fpsReference: fpsRef || undefined },
      }),
    onSuccess: (res) => {
      toast.success(t(`sor.status_${res.sor_status}`));
      setReason("");
      setFpsRef("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const customInvoice = useMutation({
    mutationFn: (input: { multiplier: number; reason: string }) =>
      feeInvoiceCustom({ data: { caseId, ...input } }),
    onSuccess: () => {
      toast.success(t("sor.admin_fee_invoiced"));
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const markPaid = useMutation({
    mutationFn: (feeId: string) =>
      feeMarkPaid({ data: { feeId, fpsReference: fpsRef || undefined } }),
    onSuccess: () => {
      toast.success(t("sor.admin_fee_paid"));
      setFpsRef("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });
  const waive = useMutation({
    mutationFn: (feeId: string) => feeWaive({ data: { feeId, reason: reason || "—" } }),
    onSuccess: () => {
      toast.success(t("sor.admin_fee_waived"));
      setReason("");
      invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isError) return null; // board case without SoR data — panel stays hidden
  if (isLoading) {
    return (
      <ConsolePanel title={t("sor.admin_panel_title")}>
        <Loader2 className="m-4 h-4 w-4 animate-spin" />
      </ConsolePanel>
    );
  }
  if (!data) return null;

  const openFee = data.fees.find(
    (f) => f.status === "not_due" || f.status === "invoiced" || f.status === "paid",
  );
  const latestFee = data.fees[0] ?? null;
  const canCustomInvoice =
    !openFee && (data.sor_status === "lesson_1_done" || data.sor_status === "lesson_2_done");
  const [lesson1, lesson2] = [
    data.lessons.find((l) => l.sequence === 1),
    data.lessons.find((l) => l.sequence === 2),
  ];

  // #385 preset invoice paths: 100% Lesson 1 / 50% Lesson 2 balance / full 1.5×.
  // #391 group scaling: presets multiply by the case's student_count (×1 for
  // legacy rows) and show "× N students" next to the rate when N > 1.
  const rateHkd = data.hourly_rate_hkd == null ? null : Number(data.hourly_rate_hkd);
  const studentCount = data.student_count ?? 1;
  const paidState = derivePaidState(data.fees, rateHkd, studentCount);
  // The 1.0× paid → 0.5× balance path can sit past fee_paid in the SoR machine
  // (fee actions advance it), so "Lesson 2 done" reads the lesson row too.
  const lesson2Done = data.sor_status === "lesson_2_done" || lesson2?.status === "done";
  const hasBlockingFee = data.fees.some(
    (f) => f.status === "not_due" || f.status === "invoiced" || f.status === "paid",
  );
  const presetReason = (base: string) =>
    studentCount > 1 ? `${base} × ${studentCount} students` : base;
  const presets = rateHkd
    ? {
        l1: {
          amount: lesson1Amount(rateHkd, studentCount),
          enabled: data.sor_status === "lesson_1_done" && !hasBlockingFee && paidState === "none",
          multiplier: 1.0,
          reason: presetReason("preset 1.0 × Lesson 1"),
        },
        l2Balance: {
          amount: lesson2BalanceAmount(rateHkd, studentCount),
          enabled: lesson2Done && paidState === "partial_l1",
          multiplier: 0.5,
          reason: presetReason("preset 0.5 × Lesson 2 balance"),
        },
        full: {
          amount: fullAdminFeeAmount(rateHkd, studentCount),
          enabled: lesson2Done && !hasBlockingFee,
          multiplier: 1.5,
          reason: presetReason("preset full 1.5 lessons"),
        },
      }
    : null;
  const invoicePreset = (p: { multiplier: number; reason: string }) =>
    customInvoice.mutate({ multiplier: p.multiplier, reason: p.reason });

  return (
    <ConsolePanel title={t("sor.admin_panel_title")}>
      <div className="space-y-5 p-4">
        {/* Status machine */}
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[color:var(--foreground)]/[0.06] px-3 py-1 text-xs font-semibold text-[color:var(--ink)]">
              {data.sor_status ? t(`sor.status_${data.sor_status}`) : t("sor.admin_not_sor")}
            </span>
            {data.tutor_code && (
              <span className="text-xs text-muted-foreground">
                {t("sor.admin_tutor")}: {data.tutor_name} ({data.tutor_code})
              </span>
            )}
          </div>
          {data.allowedTransitions.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {data.allowedTransitions.map((to) => (
                <Button
                  key={to}
                  size="sm"
                  variant="outline"
                  disabled={transition.isPending}
                  onClick={() => transition.mutate(to)}
                >
                  {t(`sor.status_${to}`)}
                </Button>
              ))}
              {data.allowedTransitions.some((to) => TRANSITION_REASON_HINTS[to]) && (
                <Input
                  className="w-56"
                  placeholder={t("sor.admin_reason_placeholder")}
                  value={reason}
                  maxLength={500}
                  onChange={(e) => setReason(e.target.value)}
                />
              )}
              {data.allowedTransitions.includes("fee_paid") && (
                <Input
                  className="w-44"
                  placeholder={t("sor.admin_fps_placeholder")}
                  value={fpsRef}
                  maxLength={80}
                  onChange={(e) => setFpsRef(e.target.value)}
                />
              )}
            </div>
          )}
        </div>

        {/* Lessons 1–2 */}
        <div className="border-t border-[color:var(--ink)]/10 pt-4">
          <p className="text-sm font-medium text-[color:var(--ink)]">
            {t("sor.admin_lessons_title")}
          </p>
          <div className="mt-2 space-y-3">
            <AdminLessonRow lesson={lesson1} sequence={1} caseId={caseId} onChanged={invalidate} />
            <AdminLessonRow lesson={lesson2} sequence={2} caseId={caseId} onChanged={invalidate} />
          </div>
        </div>

        {/* Fee */}
        <div className="border-t border-[color:var(--ink)]/10 pt-4">
          <p className="text-sm font-medium text-[color:var(--ink)]">{t("sor.admin_fee_title")}</p>
          {openFee ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-[color:var(--foreground)]/[0.06] px-3 py-1 text-xs text-muted-foreground">
                {t(`sor.fee_status_${openFee.status}`)} · {feeHkd(openFee.amount_hkd)}
                {openFee.due_at
                  ? ` · ${t("sor.admin_due")} ${format(new Date(openFee.due_at), "d MMM")}`
                  : ""}
              </span>
              <Input
                className="w-44"
                placeholder={t("sor.admin_fps_placeholder")}
                value={fpsRef}
                maxLength={80}
                onChange={(e) => setFpsRef(e.target.value)}
              />
              {openFee.status === "invoiced" && (
                <>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={markPaid.isPending}
                    onClick={() => markPaid.mutate(openFee.id)}
                  >
                    {t("sor.admin_mark_paid")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={waive.isPending}
                    onClick={() => waive.mutate(openFee.id)}
                  >
                    {t("sor.admin_waive")}
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              <span>{t("sor.admin_no_open_fee")}</span>
              {latestFee && (
                <span className="text-xs">
                  {t(`sor.fee_status_${latestFee.status}`)} · {feeHkd(latestFee.amount_hkd)}
                </span>
              )}
            </div>
          )}
          {presets ? (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted-foreground">
                {t("sor.admin_fee_breakdown")}
                {/* #391: make the per-student math explicit on group cases. */}
                {rateHkd && studentCount > 1
                  ? ` · ${feeHkd(rateHkd)} × ${studentCount} ${t("sor.admin_students_suffix")}`
                  : ""}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {paidState === "partial_l1" && (
                  <span className="rounded-full border border-[color:var(--ink)]/15 px-2 py-0.5 text-xs text-muted-foreground">
                    {t("sor.admin_paid_partial_chip")}
                  </span>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!presets.l1.enabled || customInvoice.isPending}
                  onClick={() => invoicePreset(presets.l1)}
                >
                  {t("sor.admin_preset_l1", { amount: presets.l1.amount })}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!presets.l2Balance.enabled || customInvoice.isPending}
                  onClick={() => invoicePreset(presets.l2Balance)}
                >
                  {t("sor.admin_preset_l2_balance", { amount: presets.l2Balance.amount })}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!presets.full.enabled || customInvoice.isPending}
                  onClick={() => invoicePreset(presets.full)}
                >
                  {t("sor.admin_preset_full", { amount: presets.full.amount })}
                </Button>
              </div>
            </div>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">{t("sor.admin_no_rate_hint")}</p>
          )}
          {canCustomInvoice && (
            <CustomInvoiceBlock
              onInvoice={(m, r) => customInvoice.mutate({ multiplier: m, reason: r })}
              pending={customInvoice.isPending}
            />
          )}
        </div>

        {/* Audit */}
        <div className="border-t border-[color:var(--ink)]/10 pt-4">
          <p className="text-sm font-medium text-[color:var(--ink)]">
            {t("sor.admin_audit_title")}
          </p>
          <ul className="mt-2 space-y-1">
            {data.audit.map((a) => (
              <li key={a.id} className="text-xs text-muted-foreground">
                {format(new Date(a.created_at), "d MMM HH:mm")} — {a.to_status}
                {a.reason ? ` · ${a.reason}` : ""}
              </li>
            ))}
            {data.audit.length === 0 && (
              <li className="text-xs text-muted-foreground">{t("sor.admin_audit_empty")}</li>
            )}
          </ul>
        </div>

        {/* Issue #254 (F3): staff case flags */}
        <CaseFlagsSection caseId={caseId} />

        {/* Issue #387: verified-experience session logs + operator revoke */}
        <ExperienceLogsSection caseId={caseId} />
      </div>
    </ConsolePanel>
  );
}

/**
 * #387 — every logged session on the case with its status and dispute
 * reason; pending/verified rows can be revoked (public totals recalculate
 * instantly because get_tutor_experience counts verified rows only).
 */
function ExperienceLogsSection({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const {
    data: logs = [],
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["sor", "session-logs", caseId],
    queryFn: () => listCaseSessionLogs({ data: { caseId } }),
  });

  const revoke = useMutation({
    mutationFn: (logId: string) => revokeSession({ data: { logId } }),
    onSuccess: () => {
      toast.success(t("experience.desk_revoked_ok"));
      queryClient.invalidateQueries({ queryKey: ["sor", "session-logs", caseId] });
    },
    onError: (e: Error) =>
      toast.error(t(`experience.err_${e.message}`, { defaultValue: e.message })),
  });

  const timeLabel = (min: number) =>
    `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

  return (
    <div className="border-t border-[color:var(--ink)]/10 pt-4">
      <p className="text-sm font-medium text-[color:var(--ink)]">{t("experience.desk_title")}</p>
      <ul className="mt-2 space-y-1">
        {logs.map((l) => (
          <li
            key={l.id}
            className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
          >
            <span className="font-medium text-[color:var(--ink)]">
              {format(new Date(`${l.log_date}T00:00:00Z`), "d MMM yyyy")} ·{" "}
              {timeLabel(l.start_minute)} ·{" "}
              {t("experience.duration_hours", { hours: l.duration_min / 60 })}
            </span>
            <span className="rounded-full bg-[color:var(--foreground)]/[0.06] px-2 py-0.5">
              {t(`experience.log_status_${l.status}`)}
            </span>
            {l.dispute_reason ? <span>“{l.dispute_reason}”</span> : null}
            {(l.status === "pending" || l.status === "verified" || l.status === "disputed") && (
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-7 px-2 text-xs"
                disabled={revoke.isPending}
                onClick={() => revoke.mutate(l.id)}
              >
                {revoke.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : null}
                {t("experience.desk_revoke")}
              </Button>
            )}
          </li>
        ))}
        {isPending && (
          <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t("experience.desk_title")}…
          </li>
        )}
        {isError && <li className="text-xs text-destructive">{error.message}</li>}
        {!isPending && !isError && logs.length === 0 && (
          <li className="text-xs text-muted-foreground">{t("experience.desk_empty")}</li>
        )}
      </ul>
    </div>
  );
}

const FLAG_REASON_LABEL_KEY: Record<CaseFlagReason, string> = {
  intro_used: "sor.flag_reason_intro_used",
  fee_unpaid: "sor.flag_reason_fee_unpaid",
  parties_continued: "sor.flag_reason_parties_continued",
  off_site_request: "sor.flag_reason_off_site_request",
  tutor_shared_contact: "sor.flag_reason_tutor_shared_contact",
};

function CaseFlagsSection({ caseId }: { caseId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [flagReason, setFlagReason] = useState<string>("");
  const [flagNote, setFlagNote] = useState("");

  const {
    data: flags = [],
    isPending: flagsPending,
    isError: flagsError,
    error: flagsErr,
  } = useQuery({
    queryKey: ["sor", "case-flags", caseId],
    queryFn: () => listCaseFlags({ data: { caseId } }),
  });

  const addFlag = useMutation({
    mutationFn: (input: { reason: CaseFlagReason; note: string | null }) =>
      flagCase({ data: { caseId, reason: input.reason, note: input.note } }),
    onSuccess: () => {
      toast.success(t("sor.flags_added"));
      setFlagReason("");
      setFlagNote("");
      queryClient.invalidateQueries({ queryKey: ["sor", "case-flags", caseId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="border-t border-[color:var(--ink)]/10 pt-4">
      <p className="flex items-center gap-1.5 text-sm font-medium text-[color:var(--ink)]">
        <Flag className="h-3.5 w-3.5" aria-hidden />
        {t("sor.flags_title")}
      </p>
      <ul className="mt-2 space-y-1">
        {flags.map((f) => (
          <li key={f.id} className="text-xs text-muted-foreground">
            {format(new Date(f.created_at), "d MMM HH:mm")} — {t(FLAG_REASON_LABEL_KEY[f.reason])}
            {f.note ? ` · ${f.note}` : ""}
          </li>
        ))}
        {flagsPending && (
          <li className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t("sor.flags_title")}…
          </li>
        )}
        {flagsError && <li className="text-xs text-destructive">{flagsErr.message}</li>}
        {!flagsPending && !flagsError && flags.length === 0 && (
          <li className="text-xs text-muted-foreground">{t("sor.flags_empty")}</li>
        )}
      </ul>
      <div className="mt-3 grid gap-2">
        <Select value={flagReason || undefined} onValueChange={setFlagReason}>
          <SelectTrigger className="h-9 w-full text-sm" aria-label={t("sor.flags_reason_label")}>
            <SelectValue placeholder={t("sor.flags_reason_placeholder")} />
          </SelectTrigger>
          <SelectContent>
            {CASE_FLAG_REASONS.map((r) => (
              <SelectItem key={r} value={r}>
                {t(FLAG_REASON_LABEL_KEY[r])}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          value={flagNote}
          onChange={(e) => setFlagNote(e.target.value)}
          placeholder={t("sor.flags_note_placeholder")}
          aria-label={t("sor.flags_note_placeholder")}
          className="min-h-[60px] text-sm"
          maxLength={500}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          disabled={!flagReason || addFlag.isPending}
          onClick={() =>
            addFlag.mutate({ reason: flagReason as CaseFlagReason, note: flagNote.trim() || null })
          }
        >
          {addFlag.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : (
            <Flag className="h-4 w-4" aria-hidden />
          )}
          {t("sor.flags_add")}
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{t("sor.flags_hint")}</p>
    </div>
  );
}

function AdminLessonRow({
  lesson,
  sequence,
  caseId,
  onChanged,
}: {
  lesson:
    | {
        id: string;
        sequence: number;
        starts_at: string;
        status: string;
        confirmed_by_parent_at: string | null;
        confirmed_by_tutor_at: string | null;
      }
    | undefined;
  sequence: number;
  caseId: string;
  onChanged: () => void;
}) {
  const { t } = useTranslation();
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");

  const log = useMutation({
    mutationFn: () =>
      lessonAdminLog({
        data: {
          caseId,
          sequence,
          dateKey: date,
          hour: 10,
          durationMin: 60,
          locationOrLink: location || null,
        },
      }),
    onSuccess: () => {
      toast.success(t("sor.admin_lesson_logged"));
      setDate("");
      setLocation("");
      onChanged();
    },
    onError: (e) => toast.error(e.message),
  });
  const confirm = useMutation({
    mutationFn: (side: "parent" | "tutor") =>
      lessonAdminConfirm({ data: { lessonId: lesson!.id, side } }),
    onSuccess: () => {
      toast.success(t("sor.admin_lesson_confirmed"));
      onChanged();
    },
    onError: (e) => toast.error(e.message),
  });
  const mark = useMutation({
    mutationFn: (status: "done" | "no_show" | "cancelled") =>
      lessonAdminMark({ data: { lessonId: lesson!.id, status } }),
    onSuccess: () => {
      toast.success(t("sor.admin_lesson_marked"));
      onChanged();
    },
    onError: (e) => toast.error(e.message),
  });

  const busy = log.isPending || confirm.isPending || mark.isPending;

  if (!lesson) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {t("sor.tutor_lesson_n", { n: sequence })}
        </span>
        <Input
          type="date"
          className="w-40"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          aria-label={t("sor.admin_lesson_date")}
        />
        <Input
          className="w-52"
          placeholder={t("sor.admin_lesson_location")}
          value={location}
          maxLength={300}
          onChange={(e) => setLocation(e.target.value)}
        />
        <Button size="sm" variant="outline" disabled={!date || busy} onClick={() => log.mutate()}>
          {log.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <CalendarPlus className="h-4 w-4" />
          )}
          {t("sor.admin_lesson_log")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="font-medium text-[color:var(--ink)]">
        {t("sor.tutor_lesson_n", { n: sequence })} ·{" "}
        {format(new Date(lesson.starts_at), "EEE d MMM HH:mm")}
      </span>
      <span className="rounded-full bg-[color:var(--foreground)]/[0.06] px-2 py-0.5 text-xs text-muted-foreground">
        {t(`sor.tutor_lesson_status_${lesson.status}`)}
      </span>
      {lesson.status === "planned" && (
        <>
          {lesson.confirmed_by_parent_at === null && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => confirm.mutate("parent")}
            >
              {t("sor.admin_confirm_parent")}
            </Button>
          )}
          {lesson.confirmed_by_tutor_at === null && (
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() => confirm.mutate("tutor")}
            >
              {t("sor.admin_confirm_tutor")}
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => mark.mutate("done")}>
            {t("sor.tutor_mark_done")}
          </Button>
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => mark.mutate("no_show")}>
            {t("sor.admin_no_show")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busy}
            onClick={() => mark.mutate("cancelled")}
          >
            {t("sor.tutor_cancel")}
          </Button>
        </>
      )}
    </div>
  );
}

function CustomInvoiceBlock({
  onInvoice,
  pending,
}: {
  onInvoice: (multiplier: number, reason: string) => void;
  pending: boolean;
}) {
  const { t } = useTranslation();
  const [multiplier, setMultiplier] = useState("1");
  const [reason, setReason] = useState("");
  const m = Number(multiplier);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Input
        className="w-24"
        placeholder={t("sor.admin_multiplier")}
        value={multiplier}
        onChange={(e) => setMultiplier(e.target.value)}
      />
      <Input
        className="w-56"
        placeholder={t("sor.admin_custom_reason")}
        value={reason}
        maxLength={500}
        onChange={(e) => setReason(e.target.value)}
      />
      <Button
        size="sm"
        variant="outline"
        disabled={pending || !Number.isFinite(m) || m <= 0 || reason.trim().length < 3}
        onClick={() => onInvoice(m, reason.trim())}
      >
        {t("sor.admin_invoice_custom")}
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// List-view tools: create case + CSV import + unpaid queue
// ---------------------------------------------------------------------------

export function SorDeskTools() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  const unpaid = useQuery({ queryKey: ["sor", "unpaid"], queryFn: unpaidQueue });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
          <UserPlus className="h-4 w-4" />
          {t("sor.admin_new_case")}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
          <FileUp className="h-4 w-4" />
          {t("sor.admin_import")}
        </Button>
      </div>

      {(unpaid.data?.length ?? 0) > 0 && (
        <ConsolePanel title={t("sor.admin_unpaid_title")}>
          <ul className="divide-y divide-[color:var(--ink)]/10">
            {unpaid.data?.map((r) => (
              <li key={r.fee_id} className="flex flex-wrap items-center gap-2 px-4 py-2 text-sm">
                <span className="font-medium text-[color:var(--ink)]">{r.case_code}</span>
                <span className="text-muted-foreground">{r.contact_name}</span>
                <span className="text-muted-foreground">
                  {r.tutor_name} ({r.tutor_code})
                </span>
                <span className="font-medium">{feeHkd(r.amount_hkd)}</span>
                {r.due_at && (
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(r.due_at), "d MMM")}
                  </span>
                )}
                {r.whatsapp_group_url && (
                  <a
                    href={r.whatsapp_group_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-[color:var(--brand-link)] underline-offset-2 hover:underline"
                  >
                    {t("sor.admin_whatsapp_open")}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </ConsolePanel>
      )}

      <CreateCaseDialog open={createOpen} onOpenChange={setCreateOpen} />
      <ImportDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}

function CreateCaseDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [tutorQuery, setTutorQuery] = useState("");
  const [tutorId, setTutorId] = useState<string | null>(null);
  const [form, setForm] = useState({
    studentDisplayName: "",
    curriculum: "",
    subject: "",
    level: "",
    station: "",
    mode: "f2f",
    rate: "",
    whatsapp: "",
    note: "",
  });

  // Tutor search hits the anon-readable tutors table directly from the client.
  const hits = useQuery({
    queryKey: ["sor", "tutor-hits", tutorQuery],
    enabled: open && tutorQuery.trim().length >= 2,
    queryFn: async () => {
      const { supabase } = await import("@/integrations/supabase/client");
      const q = tutorQuery.trim();
      const { data, error } = await supabase
        .from("tutors")
        .select("id, display_name, tutor_code")
        .or(`tutor_code.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(8);
      if (error) throw error;
      return data as { id: string; display_name: string; tutor_code: string | null }[];
    },
  });

  const create = useMutation({
    mutationFn: () =>
      createSorCase({
        data: {
          assignedTutorId: tutorId!,
          studentDisplayName: form.studentDisplayName || undefined,
          curriculum: form.curriculum || null,
          subject: form.subject || null,
          level: form.level || null,
          station: form.station || null,
          lessonMode: form.mode === "online" ? "online" : "f2f",
          hourlyRateHkd: form.rate ? Number(form.rate) : null,
          whatsappGroupUrl: form.whatsapp || null,
          internalNote: form.note || null,
          source: "whatsapp",
        },
      }),
    onSuccess: (res) => {
      toast.success(t("sor.admin_case_created", { code: res.caseCode }));
      queryClient.invalidateQueries({ queryKey: ["sor", "desk-list"] });
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle>{t("sor.admin_new_case")}</DialogTitle>
        <DialogDescription>{t("sor.admin_new_case_hint")}</DialogDescription>
        <div className="space-y-2">
          <Input
            placeholder={t("sor.admin_search_tutor")}
            value={tutorQuery}
            onChange={(e) => setTutorQuery(e.target.value)}
          />
          <div className="flex flex-wrap gap-1">
            {hits.data?.map((h) => (
              <button
                key={h.id}
                type="button"
                onClick={() => setTutorId(h.id)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs",
                  tutorId === h.id
                    ? "border-[color:var(--brand-link)] text-[color:var(--brand-link)]"
                    : "border-[color:var(--ink)]/15 text-muted-foreground",
                )}
              >
                {h.display_name} ({h.tutor_code})
              </button>
            ))}
          </div>
          <Input
            placeholder={t("sor.admin_student_name")}
            value={form.studentDisplayName}
            maxLength={120}
            onChange={(e) => setForm({ ...form, studentDisplayName: e.target.value })}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              placeholder={t("sor.admin_curriculum")}
              value={form.curriculum}
              maxLength={60}
              onChange={(e) => setForm({ ...form, curriculum: e.target.value })}
            />
            <Input
              placeholder={t("sor.admin_subject")}
              value={form.subject}
              maxLength={60}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
            />
            <Input
              placeholder={t("sor.admin_level")}
              value={form.level}
              maxLength={60}
              onChange={(e) => setForm({ ...form, level: e.target.value })}
            />
            <Input
              placeholder={t("sor.tutor_station")}
              value={form.station}
              maxLength={60}
              onChange={(e) => setForm({ ...form, station: e.target.value })}
            />
            <Input
              placeholder={t("sor.admin_rate_hkd")}
              inputMode="numeric"
              value={form.rate}
              onChange={(e) => setForm({ ...form, rate: e.target.value.replace(/[^0-9.]/g, "") })}
            />
            <select
              aria-label={t("sor.admin_mode")}
              className="rounded-md border border-[color:var(--ink)]/15 bg-transparent px-2 py-2 text-sm"
              value={form.mode}
              onChange={(e) => setForm({ ...form, mode: e.target.value })}
            >
              <option value="f2f">{t("sor.admin_mode_f2f")}</option>
              <option value="online">{t("sor.admin_mode_online")}</option>
            </select>
          </div>
          <Input
            placeholder={t("sor.admin_whatsapp_url")}
            value={form.whatsapp}
            maxLength={300}
            onChange={(e) => setForm({ ...form, whatsapp: e.target.value })}
          />
          <Input
            placeholder={t("sor.admin_internal_note")}
            value={form.note}
            maxLength={1000}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("sor.admin_cancel")}
          </Button>
          <Button disabled={!tutorId || create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("sor.admin_create")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [csv, setCsv] = useState("");
  const preview = csv.trim() ? parseCaseImportCsv(csv) : { rows: [], errors: [] };

  const run = useMutation({
    mutationFn: () => importCases({ data: { csv } }),
    onSuccess: (res) => {
      toast.success(
        t("sor.admin_import_done", { created: res.created, errors: res.errors.length }),
      );
      queryClient.invalidateQueries({ queryKey: ["sor", "desk-list"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "cases"] });
      if (res.errors.length === 0) onOpenChange(false);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogTitle>{t("sor.admin_import")}</DialogTitle>
        <DialogDescription>{t("sor.admin_import_hint")}</DialogDescription>
        <textarea
          className="h-40 w-full rounded-md border border-[color:var(--ink)]/15 bg-transparent p-2 font-mono text-xs"
          placeholder="parent name, phone, tutor, subject, rate, lesson dates, fee paid"
          value={csv}
          onChange={(e) => setCsv(e.target.value)}
        />
        {preview.rows.length > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("sor.admin_import_preview", {
              rows: preview.rows.length,
              errors: preview.errors.length,
            })}
          </p>
        )}
        {preview.errors.length > 0 && (
          <ul className="max-h-24 overflow-y-auto text-xs text-red-600">
            {preview.errors.slice(0, 8).map((e, i) => (
              <li key={i}>
                row {e.row}: {e.message}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            {t("sor.admin_cancel")}
          </Button>
          <Button
            disabled={preview.rows.length === 0 || run.isPending}
            onClick={() => run.mutate()}
          >
            {run.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {t("sor.admin_import_run")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
