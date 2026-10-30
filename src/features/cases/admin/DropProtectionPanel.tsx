import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, MessageSquareQuote, ShieldAlert, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { ConsolePanel } from "@/components/ui/console-panel";
import { MacroRow } from "@/features/cases/admin/ShortCasePanel";
import {
  getDropProtectionState,
  recordDropOutcome,
  type DropProtectionState,
} from "@/features/cases/drop-protection.functions";
import {
  BYPASS_FLAGS,
  DROP_INITIATORS,
  DROP_REASON_CLASSES,
  DROP_VERIFICATIONS,
  DROP_VERIFIED_BY,
  FEE_RULE_LABELS,
  OUTCOME_KINDS,
  PROMO_TYPES,
  SPLIT_MODES,
  buildOutcome,
  dropRecordError,
  resolveCaseFee,
  type BypassFlag,
  type DropInitiator,
  type DropReasonClass,
  type DropVerification,
  type DropVerifiedBy,
  type OutcomeKind,
  type PromoType,
  type SplitMode,
} from "@/features/cases/fee-drop";
import { outOfWindowWarning, ownershipBannerLabel } from "@/features/cases/ownership-window";
import {
  CASE_RISK_FLAG_LABELS,
  CASE_RISK_FLAG_TYPES,
  isCaseRiskFlagType,
  type CaseRiskFlagType,
} from "@/features/trust/trust";
import {
  liftBlacklistEntry,
  raiseCaseRiskFlag,
  resolveCaseRiskFlag,
} from "@/features/trust/trust.functions";

/**
 * Epic #537 — Drop-Protection desk panel (#520 / #525 / #508 / #528 / #529 / #535).
 *
 * One place for the operator to record how a case ended and see the fee the
 * #536 engine resolves, live, before saving. The preview and the saved
 * snapshot call the same resolveCaseFee, so they cannot disagree. Trust
 * actions (risk flags, parent blacklist) sit beside it because the hostile-
 * parent path writes both.
 */

const OUTCOME_LABEL: Record<OutcomeKind, string> = {
  in_progress: "In progress",
  pre_l1_reject: "Rejected before Lesson 1",
  trial_only_stop: "Free online intro only, did not continue",
  l1_no_show: "Parent no-show / cancel < 24h before Lesson 1",
  continued: "Continued past Lesson 2",
  stopped_after_l1: "Stopped after exactly one paid lesson",
};
const INITIATOR_LABEL: Record<DropInitiator, string> = {
  parent: "Parent",
  centre: "Centre",
  tutor: "Tutor",
  admin: "Admin",
};
const REASON_LABEL: Record<DropReasonClass, string> = {
  vague: "Vague / not a fit (no clear fault)",
  tutor_fault: "Clear tutor fault (late, rude, unprepared)",
  serious_misconduct: "Serious misconduct (abusive, unsafe)",
  hostile_parent: "Hostile or abusive parent",
  tutor_flake: "Tutor quit, no emergency",
  tutor_emergency: "Tutor emergency with proof",
};
const VERIFICATION_LABEL: Record<DropVerification, string> = {
  none: "Not asked yet",
  pending: "Asked, waiting for reply",
  verified: "Verified",
  rejected_tutor_fault: "Rejected: tutor fault",
  rejected_bypass: "Rejected: still continuing / bypass",
};
const VERIFIED_BY_LABEL: Record<DropVerifiedBy | "", string> = {
  "": "Choose…",
  parent_wa: "Parent WhatsApp",
  centre_wa: "Centre coordinator WhatsApp",
  admin_evidence: "Admin-reviewed tutor evidence",
};
const VERIFIED_BY_OPTIONS: readonly (DropVerifiedBy | "")[] = ["", ...DROP_VERIFIED_BY];
const PROMO_LABEL: Record<PromoType, string> = {
  standard: "Standard",
  free_online_trial: "Free 15–20m online intro",
  discounted_first: "Discounted first lesson",
};
const SPLIT_LABEL: Record<SplitMode, string> = {
  "100_50": "100% L1 + 50% L2",
  "75_75": "75% + 75% (A/B only)",
};
const BYPASS_LABEL: Record<BypassFlag, string> = {
  none: "No bypass concern",
  suspected: "Suspected bypass",
  confirmed: "Confirmed bypass",
};

const ERROR_COPY: Record<string, string> = {
  VERIFIED_BY_REQUIRED: "Pick who confirmed the stop.",
  PROOF_NOTE_REQUIRED: "Paste the confirmation reply (at least 10 characters).",
  CLIENT_CONFIRMATION_REQUIRED:
    "A parent or centre stop needs their confirmation. Tutor word alone never reduces the fee.",
  DISCOUNT_PCT_REQUIRED: "Enter the first-lesson discount %.",
  NO_RATE_ON_CASE: "Lock an agreed rate on the case first.",
  NO_PARENT_KEY_TO_BLACKLIST: "No parent account or phone on the case to blacklist.",
};

// #525 ops script, exact wording. Ask why ONCE; no follow-up loop.
const OPS_SCRIPTS = [
  {
    id: "ask",
    label: "Verify stop · ask why once",
    text: "Confirming — did the full lesson happen, and what was the main reason you decided not to continue?",
  },
  {
    id: "thanks",
    label: "Follow-up · record reason",
    text: "Thanks for confirming. Just so we record it accurately — was there any specific issue with the tutor (timing, preparation, or conduct)?",
  },
];

const hkd = (n: number) => `HK$${n.toLocaleString("en-HK")}`;
const fieldClass = "mt-1 h-9 w-full rounded-xl border border-input bg-transparent px-2 text-sm";

type EnumSelectProps<T extends string> = {
  label: string;
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onChange: (value: T) => void;
};

function EnumSelect<T extends string>({
  label,
  value,
  options,
  labels,
  onChange,
}: EnumSelectProps<T>) {
  return (
    <div>
      <Label className="text-[11px] font-medium text-muted-foreground">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
        className={fieldClass}
        aria-label={label}
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </select>
    </div>
  );
}

function errorMessage(e: Error): string {
  return ERROR_COPY[e.message] ?? e.message;
}

type PanelProps = { caseId: string; state: DropProtectionState };

function TrustStrip({ caseId, state }: PanelProps) {
  const queryClient = useQueryClient();
  const [flagType, setFlagType] = useState<CaseRiskFlagType>("BYPASS_COLLUSION_RISK");
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: ["admin", "drop-protection", caseId] });
  const onError = (e: Error) => toast.error(errorMessage(e));

  const raise = useMutation({
    mutationFn: () => raiseCaseRiskFlag({ data: { caseId, flagType } }),
    onSuccess: refresh,
    onError,
  });
  const resolve = useMutation({
    mutationFn: (flagId: string) => resolveCaseRiskFlag({ data: { flagId } }),
    onSuccess: refresh,
    onError,
  });
  const lift = useMutation({
    mutationFn: () => liftBlacklistEntry({ data: { caseId } }),
    onSuccess: (r) => {
      toast.success(`Lifted ${r.lifted} blacklist ${r.lifted === 1 ? "entry" : "entries"}`);
      void refresh();
    },
    onError,
  });

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-[color:var(--ink)]/[0.07] px-3 py-2.5">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-[color:var(--ink)]">
        <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" /> Trust
      </p>
      {state.parentBlacklisted ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-[color:var(--destructive)]/10 px-2.5 py-1.5">
          <span className="text-[11px] font-semibold text-[color:var(--destructive)]">
            Parent is on the trust blacklist. Do not rematch this household.
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-[11px]"
            disabled={lift.isPending}
            onClick={() => lift.mutate()}
          >
            Lift
          </Button>
        </div>
      ) : null}
      {state.openRiskFlags.length === 0 ? (
        <p className="text-[11px] text-muted-foreground">No open risk flags.</p>
      ) : (
        <ul className="space-y-1">
          {state.openRiskFlags.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-2 text-[11px]">
              <span>
                <span className="font-semibold text-[color:var(--warning)]">
                  {isCaseRiskFlagType(f.flagType) ? CASE_RISK_FLAG_LABELS[f.flagType] : f.flagType}
                </span>
                <span className="text-muted-foreground"> · {f.source}</span>
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-[11px]"
                disabled={resolve.isPending}
                onClick={() => resolve.mutate(f.id)}
              >
                Resolve
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <EnumSelect
            label="Raise a risk flag"
            value={flagType}
            options={CASE_RISK_FLAG_TYPES}
            labels={CASE_RISK_FLAG_LABELS}
            onChange={setFlagType}
          />
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-9 text-xs font-semibold"
          disabled={raise.isPending}
          onClick={() => raise.mutate()}
        >
          Raise
        </Button>
      </div>
    </div>
  );
}

type FormState = {
  outcomeKind: OutcomeKind;
  initiator: DropInitiator;
  reasonClass: DropReasonClass;
  verification: DropVerification;
  verifiedBy: DropVerifiedBy | "";
  proofNote: string;
  bypass: BypassFlag;
  promoType: PromoType;
  discountPct: string;
  splitMode: SplitMode;
  confirmBlacklist: boolean;
};

function initialForm(state: DropProtectionState): FormState {
  const s = state.saved;
  return {
    outcomeKind: s.outcomeKind ?? state.suggestedOutcome,
    initiator: s.initiator ?? "parent",
    reasonClass: s.reasonClass ?? "vague",
    verification: s.verification === "none" ? "pending" : s.verification,
    verifiedBy: s.verifiedBy ?? "",
    proofNote: s.proofNote ?? "",
    bypass: s.bypass,
    promoType: s.promoType,
    discountPct: s.discountPct ? String(s.discountPct) : "50",
    splitMode: s.splitMode,
    confirmBlacklist: true,
  };
}

function StopFields({
  form,
  set,
}: {
  form: FormState;
  set: <K extends keyof FormState>(key: K, value: FormState[K]) => void;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-[color:var(--ink)]/[0.07] px-3 py-2.5">
      <div className="grid grid-cols-2 gap-2">
        <EnumSelect
          label="Who stopped"
          value={form.initiator}
          options={DROP_INITIATORS}
          labels={INITIATOR_LABEL}
          onChange={(v) => set("initiator", v)}
        />
        <EnumSelect
          label="Verification"
          value={form.verification}
          options={DROP_VERIFICATIONS}
          labels={VERIFICATION_LABEL}
          onChange={(v) => set("verification", v)}
        />
      </div>
      <EnumSelect
        label="Reason (from the one ask)"
        value={form.reasonClass}
        options={DROP_REASON_CLASSES}
        labels={REASON_LABEL}
        onChange={(v) => set("reasonClass", v)}
      />
      <EnumSelect
        label="Confirmed by"
        value={form.verifiedBy}
        options={VERIFIED_BY_OPTIONS}
        labels={VERIFIED_BY_LABEL}
        onChange={(v) => set("verifiedBy", v)}
      />
      <div>
        <Label className="text-[11px] font-medium text-muted-foreground">
          Proof (paste the WhatsApp reply)
        </Label>
        <textarea
          value={form.proofNote}
          onChange={(e) => set("proofNote", e.target.value)}
          rows={3}
          maxLength={2000}
          className="mt-1 w-full rounded-xl border border-input bg-transparent px-2 py-1.5 text-sm"
          aria-label="Proof note"
        />
      </div>
      {form.reasonClass === "hostile_parent" ? (
        <label className="flex items-center gap-2 text-[11px]">
          <input
            type="checkbox"
            checked={form.confirmBlacklist}
            onChange={(e) => set("confirmBlacklist", e.target.checked)}
          />
          Blacklist this parent when approved (no rematch for the household)
        </label>
      ) : null}
    </div>
  );
}

function FeePreview({
  state,
  preview,
}: {
  state: DropProtectionState;
  preview: ReturnType<typeof resolveCaseFee> | null;
}) {
  if (preview === null) {
    return (
      <p className="rounded-xl border border-[color:var(--ink)]/[0.07] px-3.5 py-3 text-[11px] text-muted-foreground">
        Lock an agreed rate on the case to see the fee.
      </p>
    );
  }
  const studentsLabel = state.studentCount > 1 ? ` × ${state.studentCount} students` : "";
  return (
    <div className="rounded-xl border border-[color:var(--ink)]/[0.07] bg-[color:var(--surface-subtle)]/40 px-3.5 py-3">
      <p className="text-sm font-semibold text-[color:var(--ink)]">
        {preview.finalCommissionDueHkd === null
          ? "Nothing final yet"
          : `Final fee due ${hkd(preview.finalCommissionDueHkd)}`}
      </p>
      <p className="mt-0.5 text-[11px] text-muted-foreground">
        {FEE_RULE_LABELS[preview.ruleId]} · R = {hkd(Math.round(state.lessonValueHkd ?? 0))}
        {studentsLabel} · tier base {preview.baseMultiplier}×R
      </p>
      {preview.consequences.shadowbanTutorDays > 0 ? (
        <p className="mt-1 text-[11px] text-[color:var(--warning)]">
          Tutor gets a strike and a {preview.consequences.shadowbanTutorDays}-day shadowban.
          Priority rematch for the family.
        </p>
      ) : null}
      {preview.consequences.banTutor ? (
        <p className="mt-1 text-[11px] font-semibold text-[color:var(--destructive)]">
          Ban path: fee still owed. Ban from the account tools. No parent refund.
        </p>
      ) : null}
    </div>
  );
}

function DropForm({ caseId, state }: PanelProps) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FormState>(() => initialForm(state));
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));
  const isStop = form.outcomeKind === "stopped_after_l1";
  const discountPct = form.promoType === "discounted_first" ? Number(form.discountPct) : null;

  const preview = useMemo(() => {
    if (state.lessonValueHkd === null) return null;
    return resolveCaseFee({
      lessonValueHkd: state.lessonValueHkd,
      studentCount: state.studentCount,
      promoType: form.promoType,
      firstLessonDiscountPct: discountPct ?? undefined,
      splitMode: form.splitMode,
      packageType: state.packageType,
      tier: state.ownership.tier,
      ownership: state.ownership.state,
      bypass: form.bypass,
      priorQualityDrops: state.priorQualityDrops,
      outcome: buildOutcome({
        kind: form.outcomeKind,
        initiator: form.initiator,
        verification: form.verification,
        reasonClass: form.reasonClass,
      }),
    });
  }, [state, form, discountPct]);

  const gateError = dropRecordError({
    kind: form.outcomeKind,
    initiator: isStop ? form.initiator : null,
    verification: isStop ? form.verification : null,
    verifiedBy: form.verifiedBy || null,
    proofNote: form.proofNote,
    promoType: form.promoType,
    discountPct,
  });

  const save = useMutation({
    mutationFn: () =>
      recordDropOutcome({
        data: {
          caseId,
          outcomeKind: form.outcomeKind,
          initiator: isStop ? form.initiator : null,
          reasonClass: isStop ? form.reasonClass : null,
          verification: isStop ? form.verification : null,
          verifiedBy: isStop && form.verifiedBy ? form.verifiedBy : null,
          proofNote: form.proofNote.trim() || null,
          bypass: form.bypass,
          promoType: form.promoType,
          discountPct,
          splitMode: form.splitMode,
          confirmBlacklist: form.confirmBlacklist,
        },
      }),
    onSuccess: (r) => {
      const due = r.finalCommissionDueHkd !== null ? ` · ${hkd(r.finalCommissionDueHkd)}` : "";
      toast.success(`${FEE_RULE_LABELS[r.ruleId]}${due}`);
      if (r.consequences.banTutor) {
        toast.warning("Ban the tutor from the account tools: bans stay a human action.");
      }
      void queryClient.invalidateQueries({ queryKey: ["admin", "drop-protection", caseId] });
      void queryClient.invalidateQueries({ queryKey: ["admin", "cases"] });
    },
    onError: (e: Error) => toast.error(errorMessage(e)),
  });

  return (
    <div className="mt-3 space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <EnumSelect
          label="Promo on first lesson"
          value={form.promoType}
          options={PROMO_TYPES}
          labels={PROMO_LABEL}
          onChange={(v) => set("promoType", v)}
        />
        {form.promoType === "discounted_first" ? (
          <div>
            <Label className="text-[11px] font-medium text-muted-foreground">Discount %</Label>
            <input
              type="number"
              min={1}
              max={100}
              value={form.discountPct}
              onChange={(e) => set("discountPct", e.target.value)}
              className={fieldClass}
              aria-label="First-lesson discount percent"
            />
          </div>
        ) : (
          <EnumSelect
            label="Split"
            value={form.splitMode}
            options={SPLIT_MODES}
            labels={SPLIT_LABEL}
            onChange={(v) => set("splitMode", v)}
          />
        )}
      </div>

      <EnumSelect
        label="How the case went"
        value={form.outcomeKind}
        options={OUTCOME_KINDS}
        labels={OUTCOME_LABEL}
        onChange={(v) => set("outcomeKind", v)}
      />

      {isStop ? <StopFields form={form} set={set} /> : null}

      <EnumSelect
        label="Bypass"
        value={form.bypass}
        options={BYPASS_FLAGS}
        labels={BYPASS_LABEL}
        onChange={(v) => set("bypass", v)}
      />

      <FeePreview state={state} preview={preview} />

      {gateError ? (
        <p className="text-[11px] text-[color:var(--warning)]">{ERROR_COPY[gateError]}</p>
      ) : null}
      <Button
        size="sm"
        className="h-9 w-full font-semibold"
        disabled={gateError !== null || preview === null || save.isPending}
        onClick={() => save.mutate()}
      >
        {save.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
        Save decision
      </Button>
    </div>
  );
}

export function DropProtectionPanel({ caseId }: { caseId: string }) {
  const fetchState = useServerFn(getDropProtectionState);
  const { data: state, isLoading } = useQuery({
    queryKey: ["admin", "drop-protection", caseId],
    queryFn: () => fetchState({ data: { caseId } }),
  });
  const showWindowWarning =
    state?.counterparty === "centre" &&
    state.ownership.state === "closed" &&
    state.ownership.windowEndsAt !== null;

  return (
    <ConsolePanel>
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Drop-Protection and fee rules
        </h2>
        {state?.saved.finalCommissionDueHkd != null ? (
          <span className="rounded-full bg-[color:var(--ink)]/[0.06] px-2 py-0.5 text-[11px] font-semibold">
            Saved {hkd(state.saved.finalCommissionDueHkd)}
          </span>
        ) : null}
      </div>

      {isLoading || !state ? (
        <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
        </p>
      ) : (
        <>
          {state.counterparty ? (
            <p className="mt-3 rounded-xl bg-[color:var(--primary)]/[0.08] px-3 py-2 text-[11px] font-semibold text-[color:var(--ink)]">
              {ownershipBannerLabel(state.counterparty, state.ownership)}
            </p>
          ) : null}
          {showWindowWarning && state.ownership.windowEndsAt ? (
            <p className="mt-2 rounded-xl border border-[color:var(--destructive)]/30 px-3 py-2 text-[11px] font-semibold text-[color:var(--destructive)]">
              {outOfWindowWarning(state.ownership.windowEndsAt)}
            </p>
          ) : null}
          <DropForm key={state.saved.recordedAt ?? "new"} caseId={caseId} state={state} />
          <TrustStrip caseId={caseId} state={state} />
        </>
      )}

      <div className="mt-4 border-t border-[color:var(--ink)]/[0.07] pt-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <MessageSquareQuote className="h-3.5 w-3.5" aria-hidden="true" /> Verify scripts (ask why
          once)
        </p>
        <div className="mt-2 space-y-2">
          {OPS_SCRIPTS.map((m) => (
            <MacroRow key={m.id} label={m.label} text={m.text} />
          ))}
        </div>
      </div>
    </ConsolePanel>
  );
}
