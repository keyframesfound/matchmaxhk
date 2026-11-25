/**
 * #794 §2.6 — the case workspace's checkpoint capture surface (parent half).
 *
 * A checkpoint is one verified point on ONE scale for ONE MatchMax case. The
 * parent or the matched tutor may log one; a tutor-entered row stays
 * "Waiting for parent confirmation" until the parent taps Confirm. The public
 * card, its windows and its anonymity rules live in the server fn; this
 * component only captures rows and explains the two visible limits:
 *   - four checkpoints per case;
 *   - one scale per card.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { TFunction } from "i18next";
import { Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  SCALE_PLACEHOLDERS,
  SCALE_TYPE_OPTIONS,
  assessmentLabel,
  scaleLabel,
  verificationLabel,
} from "@/features/cases/progress-labels";
import { hktDateKey } from "@/features/cases/sor";
import {
  MAX_CHECKPOINTS_PER_CASE,
  isValidScaleValue,
  type ScaleType,
} from "@/features/cases/progress-evidence";
import {
  confirmProgressCheckpoint,
  listCaseProgressCheckpoints,
  logProgressCheckpoint,
  setProgressShareConsent,
  type CaseProgressCheckpoints,
} from "@/features/cases/progress-checkpoints.functions";

type LoggableAssessmentType = "school_quiz" | "term_exam" | "mock" | "predicted" | "public_exam";

const ASSESSMENT_TYPE_OPTIONS: { value: LoggableAssessmentType }[] = [
  { value: "school_quiz" },
  { value: "term_exam" },
  { value: "mock" },
  { value: "predicted" },
  { value: "public_exam" },
];

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Server errors are stable codes; turn them into one sentence each. */
function addErrorCopy(t: TFunction, message: string, scale: ScaleType | ""): string {
  switch (message) {
    case "CHECKPOINT_LIMIT":
      return t("progress.checkpoints.err_limit");
    case "SCALE_MISMATCH":
      return t("progress.checkpoints.err_scale_mismatch");
    case "INVALID_SCALE_VALUE":
      return scale
        ? t("progress.checkpoints.err_invalid_value", {
            scale: scaleLabel(t, scale),
            example: SCALE_PLACEHOLDERS[scale],
          })
        : t("progress.checkpoints.err_invalid_value_generic");
    case "INVALID_ASSESSED_ON":
      return t("progress.checkpoints.err_bad_month");
    case "TENURE_FLOOR_NOT_MET":
      return t("progress.checkpoints.err_tenure");
    case "OUTSIDE_WINDOW":
      return t("progress.checkpoints.err_window");
    default:
      return t("progress.checkpoints.err_generic");
  }
}

function eligibilityLine(t: TFunction, data: CaseProgressCheckpoints): string {
  if (data.publicEligible) return t("progress.checkpoints.eligibility_shown");
  const withoutConsent = data.blockedReasons.filter((reason) => reason !== "no_consent");
  if (withoutConsent.length === 0 && !data.consent) {
    return t("progress.checkpoints.eligibility_ready");
  }
  return t("progress.checkpoints.eligibility_pending");
}

function CheckpointRow({
  checkpoint,
  canConfirm,
  confirming,
  onConfirm,
}: {
  checkpoint: CaseProgressCheckpoints["checkpoints"][number];
  canConfirm: boolean;
  confirming: boolean;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <li className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[color:var(--ink)]">
          {checkpoint.scoreValue}
          <span className="font-normal text-muted-foreground">
            {" "}
            · {assessmentLabel(t, checkpoint.assessmentType)} · {checkpoint.assessedOn}
          </span>
        </p>
        {checkpoint.label ? (
          <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {checkpoint.label}
          </p>
        ) : null}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {scaleLabel(t, checkpoint.scaleType)} · {verificationLabel(t, checkpoint.verification)}
        </p>
      </div>
      {canConfirm && checkpoint.verification === "tutor_unconfirmed" ? (
        <Button type="button" size="sm" variant="outline" disabled={confirming} onClick={onConfirm}>
          {confirming ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
          {t("progress.checkpoints.confirm")}
        </Button>
      ) : null}
    </li>
  );
}

export function ProgressCheckpointsSection({
  caseId,
  role,
}: {
  caseId: string;
  role: "parent" | "tutor";
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const queryKey = ["case-progress-checkpoints", caseId];
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: () => listCaseProgressCheckpoints({ data: { caseId } }),
  });

  const [assessmentType, setAssessmentType] = useState<LoggableAssessmentType>("school_quiz");
  const [month, setMonth] = useState(() => hktDateKey(new Date()).slice(0, 7));
  const [pickedScale, setPickedScale] = useState<ScaleType | "">("");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");

  const refresh = () => void queryClient.invalidateQueries({ queryKey });

  /** One scale per card: the first checkpoint locks the scale for the case. */
  const lockedScale: ScaleType | null = data?.checkpoints[0]?.scaleType ?? null;
  const scale: ScaleType | "" = lockedScale ?? pickedScale;
  const atCap = (data?.checkpoints.length ?? 0) >= MAX_CHECKPOINTS_PER_CASE;
  const canSubmit =
    !atCap &&
    scale !== "" &&
    isValidScaleValue(scale, value) &&
    MONTH_PATTERN.test(month) &&
    !isLoading;

  const add = useMutation({
    mutationFn: () => {
      if (scale === "") throw new Error("INVALID_SCALE_VALUE");
      return logProgressCheckpoint({
        data: {
          caseId,
          assessmentType,
          assessedOn: month,
          scaleType: scale,
          scoreValue: value.trim(),
          label: label.trim(),
        },
      });
    },
    onSuccess: () => {
      setValue("");
      setLabel("");
      refresh();
    },
    onError: (e: Error) => toast.error(addErrorCopy(t, e.message, scale)),
  });

  const confirm = useMutation({
    mutationFn: (id: string) => confirmProgressCheckpoint({ data: { id } }),
    onSuccess: refresh,
    onError: () => toast.error(t("progress.checkpoints.confirm_failed")),
  });

  const consent = useMutation({
    mutationFn: (next: boolean) => setProgressShareConsent({ data: { caseId, consent: next } }),
    onMutate: (next) => {
      queryClient.setQueryData<CaseProgressCheckpoints>(queryKey, (old) =>
        old ? { ...old, consent: next } : old,
      );
    },
    onError: () => {
      refresh();
      toast.error(t("progress.checkpoints.consent_failed"));
    },
  });

  if (isLoading) return <Loader2 className="mt-4 h-5 w-5 animate-spin" aria-hidden />;
  if (isError || !data) {
    return <p className="mt-4 text-sm text-destructive">{t("progress.checkpoints.load_failed")}</p>;
  }

  const rows = [...data.checkpoints].sort((a, b) => a.assessedOn.localeCompare(b.assessedOn));

  return (
    <section
      aria-labelledby="progress-checkpoints-heading"
      className="space-y-3 rounded-[var(--radius-panel)] border border-border bg-card p-4"
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id="progress-checkpoints-heading" className="text-sm font-semibold">
            {t("progress.checkpoints.heading")}
          </h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("progress.checkpoints.hint")}</p>
        </div>
        <p className="text-xs font-medium text-muted-foreground">
          {t("progress.checkpoints.count", {
            count: data.checkpoints.length,
            max: MAX_CHECKPOINTS_PER_CASE,
          })}
        </p>
      </header>

      {rows.length > 0 ? (
        <ul className="divide-y divide-border rounded-[var(--radius-control)] border border-border">
          {rows.map((checkpoint) => (
            <CheckpointRow
              key={checkpoint.id}
              checkpoint={checkpoint}
              canConfirm={role === "parent"}
              confirming={confirm.isPending && confirm.variables === checkpoint.id}
              onConfirm={() => confirm.mutate(checkpoint.id)}
            />
          ))}
        </ul>
      ) : (
        <p className="rounded-[var(--radius-control)] border border-dashed border-border px-3 py-3 text-sm text-muted-foreground">
          {t("progress.checkpoints.empty")}
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t("progress.checkpoints.assessment_type")}
          <select
            className="h-9 rounded-[var(--radius-control)] border border-input bg-transparent px-2 text-sm text-[color:var(--ink)]"
            value={assessmentType}
            onChange={(e) => setAssessmentType(e.target.value as LoggableAssessmentType)}
          >
            {ASSESSMENT_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {assessmentLabel(t, option.value)}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t("progress.checkpoints.month_sat")}
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t("progress.checkpoints.scale")}
          {lockedScale ? (
            <Input value={scaleLabel(t, lockedScale)} readOnly disabled />
          ) : (
            <select
              className="h-9 rounded-[var(--radius-control)] border border-input bg-transparent px-2 text-sm text-[color:var(--ink)]"
              value={pickedScale}
              onChange={(e) => setPickedScale(e.target.value as ScaleType | "")}
            >
              <option value="">{t("progress.checkpoints.scale_pick")}</option>
              {SCALE_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {scaleLabel(t, option)}
                </option>
              ))}
            </select>
          )}
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          {t("progress.checkpoints.result")}
          <Input
            value={value}
            placeholder={scale ? SCALE_PLACEHOLDERS[scale] : SCALE_PLACEHOLDERS.dse}
            onChange={(e) => setValue(e.target.value)}
          />
        </label>
      </div>
      <label className="grid gap-1 text-xs text-muted-foreground">
        {t("progress.checkpoints.label")}
        <Input
          value={label}
          maxLength={80}
          placeholder={t("progress.checkpoints.label_placeholder")}
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          size="sm"
          disabled={!canSubmit || add.isPending}
          onClick={() => add.mutate()}
        >
          {add.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
          {t("progress.checkpoints.add")}
        </Button>
        {atCap ? (
          <p className="text-xs text-muted-foreground">{t("progress.checkpoints.cap_reached")}</p>
        ) : null}
        {lockedScale ? (
          <p className="text-xs text-muted-foreground">
            {t("progress.checkpoints.scale_locked", { scale: scaleLabel(t, lockedScale) })}
          </p>
        ) : null}
      </div>

      <div className="space-y-2 rounded-[var(--radius-control)] border border-border bg-muted p-3">
        {role === "parent" ? (
          <>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{t("progress.checkpoints.consent_title")}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("progress.checkpoints.consent_hint")}
                </p>
              </div>
              <Switch
                id="progress-share-consent"
                aria-label={t("progress.checkpoints.aria_consent")}
                checked={data.consent}
                disabled={consent.isPending}
                onCheckedChange={(next) => consent.mutate(next)}
              />
            </div>
            <p className="text-xs text-muted-foreground">{eligibilityLine(t, data)}</p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            {t("progress.checkpoints.tutor_consent_note")}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          {data.summary} · {t("progress.checkpoints.privacy_suffix")}
        </p>
      </div>
    </section>
  );
}
